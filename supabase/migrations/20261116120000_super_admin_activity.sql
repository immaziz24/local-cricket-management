create table private.user_activity (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  last_active_at timestamptz not null
);
alter table private.user_activity enable row level security;
create index on private.user_activity (last_active_at);

create function public.record_user_activity()
returns void language sql security definer set search_path = '' as $$
  insert into private.user_activity (user_id, last_active_at)
  select p.id, now() from public.profiles p
  where p.id = (select auth.uid()) and p.account_status = 'active'
  on conflict (user_id) do update set last_active_at = excluded.last_active_at
  where user_activity.last_active_at <= excluded.last_active_at - interval '1 minute';
$$;
revoke all on function public.record_user_activity() from public, anon;
grant execute on function public.record_user_activity() to authenticated;

create or replace function public.get_super_admin_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not private.has_role('super_admin') then
    raise exception 'Only a Super-Admin can view this dashboard.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'online_users', (select count(*) from private.user_activity a join public.profiles p on p.id = a.user_id where p.account_status = 'active' and a.last_active_at >= now() - interval '5 minutes'),
    'total_users', (select count(*) from public.profiles),
    'new_users_7d', (select count(*) from public.profiles where created_at > pg_catalog.now() - interval '7 days'),
    'suspended_users', (select count(*) from public.profiles where account_status = 'suspended'),
    'pending_verifications', (select count(*) from public.user_verifications where status = 'pending'),
    'open_reports', (select count(*) from public.user_reports where status in ('submitted','under_review')),
    'role_breakdown', jsonb_build_object(
      'super_admins', (select count(distinct user_id) from public.user_role_assignments where role = 'super_admin' and is_active),
      'admins',       (select count(distinct user_id) from public.user_role_assignments where role = 'admin' and is_active),
      'organisers',   (select count(distinct user_id) from public.user_role_assignments where role = 'organiser' and is_active),
      'team_owners',  (select count(distinct user_id) from public.user_role_assignments where role = 'team_owner' and is_active),
      'captains',     (select count(distinct user_id) from public.user_role_assignments where role = 'captain' and is_active),
      'scorers',      (select count(distinct user_id) from public.user_role_assignments where role = 'scorer' and is_active),
      'umpires',      (select count(distinct user_id) from public.user_role_assignments where role = 'umpire' and is_active),
      'players',      (select count(distinct user_id) from public.user_role_assignments where role = 'player' and is_active)
    ),
    'maintenance_mode', ps.maintenance_mode,
    'broadcast_banner', case when ps.broadcast_message is null then null else jsonb_build_object(
      'message', ps.broadcast_message,
      'level', ps.broadcast_level,
      'timestamp', ps.broadcast_updated_at
    ) end
  )
  into result
  from public.platform_settings ps
  where ps.id;

  return result;
end;
$$;

create or replace function public.admin_search(p_query text, p_kind text default 'all')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare q text := pg_catalog.btrim(coalesce(p_query, '')); like_q text; r jsonb := '{}'::jsonb;
begin
  perform private.require_admin();
  like_q := '%' || replace(replace(q, '%', ''), '_', '') || '%';
  if p_kind in ('all', 'users') then
    r := r || jsonb_build_object('users', coalesce((select jsonb_agg(x) from (
      select jsonb_build_object('id', p.id, 'name', p.display_name, 'email', u.email, 'mobile', p.mobile_number, 'status', p.account_status,
             'created_at', p.created_at, 'last_sign_in_at', u.last_sign_in_at,
             'last_active_at', case when private.has_role('super_admin') then (select a.last_active_at from private.user_activity a where a.user_id = p.id) end, 'email_confirmed', u.email_confirmed_at is not null,
             'roles', (select jsonb_agg(distinct ra.role) from public.user_role_assignments ra where ra.user_id = p.id and ra.is_active and ra.role in ('admin', 'super_admin'))) x
        from public.profiles p left join auth.users u on u.id = p.id
       where q = '' or p.display_name ilike like_q or u.email ilike like_q or p.mobile_number like like_q or p.id::text = q
       order by p.created_at desc limit 40) s), '[]'::jsonb));
  end if;
  if p_kind in ('all', 'teams') then
    r := r || jsonb_build_object('teams', coalesce((select jsonb_agg(x) from (
      select jsonb_build_object('id', t.id, 'name', t.name, 'city', t.city, 'owner', (select display_name from public.profiles where id = t.owner_id),
             'owner_id', t.owner_id, 'players', (select count(*) from public.team_members tm where tm.team_id = t.id), 'created_at', t.created_at) x
        from public.teams t where q = '' or t.name ilike like_q or t.city ilike like_q or t.id::text = q
       order by t.created_at desc limit 40) s), '[]'::jsonb));
  end if;
  if p_kind in ('all', 'matches') then
    r := r || jsonb_build_object('matches', coalesce((select jsonb_agg(x) from (
      select jsonb_build_object('id', m.id, 'title', coalesce(nullif(m.title, ''), ta.name || ' vs ' || tb.name), 'status', m.status, 'result', m.result_summary,
             'scheduled_at', m.scheduled_at, 'created_at', m.created_at, 'tournament', (select name from public.tournaments where id = m.tournament_id),
             'score', ta.name || ' ' || coalesce(m.team_a_runs, 0) || '/' || coalesce(m.team_a_wickets, 0) || ' · ' || tb.name || ' ' || coalesce(m.team_b_runs, 0) || '/' || coalesce(m.team_b_wickets, 0)) x
        from public.matches m left join public.teams ta on ta.id = m.team_a_id left join public.teams tb on tb.id = m.team_b_id
       where q = '' or ta.name ilike like_q or tb.name ilike like_q or m.title ilike like_q or m.venue ilike like_q or m.id::text = q
       order by m.created_at desc limit 40) s), '[]'::jsonb));
  end if;
  if p_kind in ('all', 'tournaments') then
    r := r || jsonb_build_object('tournaments', coalesce((select jsonb_agg(x) from (
      select jsonb_build_object('id', t.id, 'name', t.name, 'code', t.code, 'status', t.status, 'venue', t.venue, 'start_date', t.start_date,
             'owner', (select display_name from public.profiles where id = t.owner_id), 'created_at', t.created_at) x
        from public.tournaments t where q = '' or t.name ilike like_q or t.code ilike like_q or t.venue ilike like_q or t.id::text = q
       order by t.created_at desc limit 40) s), '[]'::jsonb));
  end if;
  return r;
end $$;

create or replace function public.get_tournament_registrations(p_tournament_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare viewer uuid := (select auth.uid());
begin
  return jsonb_build_object(
    'is_organiser', viewer is not null and ((private.has_role('super_admin') and private.is_admin()) or private.is_tournament_admin(p_tournament_id) or
        exists (select 1 from public.tournaments where id = p_tournament_id and owner_id = viewer)
        or exists (select 1 from public.user_role_assignments where user_id = viewer and role = 'organiser'
                   and scope_type = 'tournament' and scope_id = p_tournament_id and is_active)),
    'admin_access', (
      select case
        when t.owner_id = viewer then jsonb_build_object('admins', coalesce((
          select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name) order by p.display_name, p.id)
          from private.tournament_admins a join public.profiles p on p.id = a.user_id
          where a.tournament_id = t.id
        ), '[]'::jsonb))
        when private.is_tournament_admin(t.id) then jsonb_build_object('granted_by', coalesce((
          select p.display_name
          from public.audit_logs l join public.profiles p on p.id = l.actor_user_id
          where l.action = 'TOURNAMENT_ADMIN_GRANT' and l.entity_type = 'tournaments'
            and l.entity_id = t.id::text and l.metadata->>'user_id' = viewer::text
          order by l.created_at desc
          limit 1
        ), owner.display_name, 'Tournament owner'))
      end
      from public.tournaments t left join public.profiles owner on owner.id = t.owner_id
      where t.id = p_tournament_id
    ),
    'teams', coalesce((
      select jsonb_agg(jsonb_build_object(
               'team_id', t.id, 'name', t.name, 'short_name', t.short_name, 'city', t.city, 'logo_url', t.logo_url,
               'status', tt.status, 'note', tt.note, 'created_at', tt.created_at, 'i_own', t.owner_id = viewer,
               'captain', (select pl.display_name from public.team_members tm join public.players pl on pl.id = tm.player_id
                           where tm.team_id = t.id and tm.is_captain limit 1),
               'squad_size', (select count(*) from public.team_members tm where tm.team_id = t.id))
             order by (tt.status = 'pending') desc, tt.created_at)
      from public.tournament_teams tt join public.teams t on t.id = tt.team_id
      where tt.tournament_id = p_tournament_id), '[]'::jsonb)
  );
end;
$$;
