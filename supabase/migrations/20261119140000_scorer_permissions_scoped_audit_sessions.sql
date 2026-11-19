-- Batch 4: #383 granular scorer permissions by match, #385 role-specific audit log viewer, #386 session and device management.

-- ---------- #383 granular scorer permissions ----------
-- match_officials.permissions: null = full scoring (as before). Keys (true/false): score, undo, edit_ball, end_innings,
-- replace_bowler, penalty, manage_match. A missing key means allowed. Applies ONLY to a person who can score the match solely
-- because they were added as its scorer; the match creator, tournament organiser/admins and platform admins are never limited.
alter table public.match_officials add column if not exists permissions jsonb;

create or replace function private.scorer_may(p_match_id uuid, p_perm text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when exists (
      select 1 from public.matches m
       where m.id = p_match_id
         and (m.created_by = (select auth.uid()) or m.scorer_id = (select auth.uid()) or private.is_admin()
              or (m.tournament_id is not null and (private.is_tournament_admin(m.tournament_id)
                  or exists (select 1 from public.tournaments t where t.id = m.tournament_id and t.owner_id = (select auth.uid()))
                  or exists (select 1 from public.user_role_assignments r where r.user_id = (select auth.uid()) and r.role = 'organiser'
                             and r.scope_type = 'tournament' and r.scope_id = m.tournament_id and r.is_active))))
    ) then true
    else coalesce((
      select (mo.permissions ->> p_perm)::boolean from public.match_officials mo
       where mo.match_id = p_match_id and mo.user_id = (select auth.uid()) and mo.role = 'scorer' and mo.status = 'accepted'
       limit 1), true)
  end;
$$;

create or replace function private.require_scorer(p_match_id uuid, p_perm text)
returns public.matches language plpgsql stable security definer set search_path = '' as $$
declare m public.matches%rowtype;
begin
  m := private.require_scorer(p_match_id);
  if not private.scorer_may(p_match_id, p_perm) then
    raise exception 'The match organiser has not given you permission to do this on this match.' using errcode = '42501';
  end if;
  return m;
end;
$$;

-- Point each scoring action at its own permission key (the function bodies are otherwise unchanged).
do $$
declare r record; def text;
begin
  for r in
    select * from (values
      ('record_ball','score'),('set_innings_players','score'),('undo_last_ball','undo'),('edit_ball','edit_ball'),
      ('end_innings','end_innings'),('replace_bowler_mid_over','replace_bowler'),('award_penalty_runs','penalty'),
      ('abandon_match','manage_match'),('pause_match','manage_match'),('resume_match','manage_match'),
      ('start_super_over','manage_match'),('set_player_of_match','manage_match'),('enforce_follow_on','manage_match')
    ) as t(fn, perm)
  loop
    select pg_get_functiondef(p.oid) into def from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = r.fn limit 1;
    if def is not null and position('private.require_scorer(p_match_id)' in def) > 0 then
      execute replace(def, 'private.require_scorer(p_match_id)', format('private.require_scorer(p_match_id, %L)', r.perm));
    end if;
  end loop;
end $$;

create or replace function public.set_scorer_permissions(p_assignment_id uuid, p_permissions jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare mo public.match_officials%rowtype; k text; clean jsonb := '{}'::jsonb;
begin
  if (select auth.uid()) is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  select * into mo from public.match_officials where id = p_assignment_id;
  if not found then raise exception 'Assignment not found.' using errcode = '22023'; end if;
  if not private.can_manage_match(mo.match_id) then raise exception 'Only the match creator or tournament organiser can set scorer permissions.' using errcode = '42501'; end if;
  if mo.role <> 'scorer' then raise exception 'Permissions apply to scorers only.' using errcode = '22023'; end if;
  for k in select jsonb_object_keys(coalesce(p_permissions, '{}'::jsonb)) loop
    if k not in ('score','undo','edit_ball','end_innings','replace_bowler','penalty','manage_match') then
      raise exception 'Unknown permission: %', k using errcode = '22023';
    end if;
    clean := clean || jsonb_build_object(k, (p_permissions ->> k)::boolean);
  end loop;
  update public.match_officials set permissions = case when clean = '{}'::jsonb then null else clean end where id = p_assignment_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, target_user_id, metadata)
  values ((select auth.uid()), 'SCORER_PERMISSIONS_SET', 'matches', mo.match_id::text, mo.user_id, jsonb_build_object('match_id', mo.match_id, 'permissions', clean));
  return public.list_match_officials(mo.match_id);
end;
$$;

create or replace function public.list_match_officials(p_match_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'can_manage', private.can_manage_match(p_match_id),
    'can_rate', exists (select 1 from public.matches m where m.id = p_match_id and m.status = 'completed'
                        and (private.can_manage_match(p_match_id) or exists (select 1 from public.teams t where t.id in (m.team_a_id, m.team_b_id) and t.owner_id = (select auth.uid())))),
    'officials', coalesce((select jsonb_agg(jsonb_build_object(
        'id', mo.id, 'user_id', mo.user_id, 'name', pr.display_name, 'role', mo.role, 'status', mo.status, 'invited_at', mo.invited_at,
        'fee', case when private.can_manage_match(p_match_id) or mo.user_id = (select auth.uid()) then mo.fee end,
        'paid', case when private.can_manage_match(p_match_id) or mo.user_id = (select auth.uid()) then mo.paid end,
        'payment_note', case when private.can_manage_match(p_match_id) or mo.user_id = (select auth.uid()) then mo.payment_note end,
        'permissions', case when mo.role = 'scorer' then mo.permissions end,
        'is_me', mo.user_id = (select auth.uid()),
        'my_rating', (select rating from public.official_feedback f where f.assignment_id = mo.id and f.rater_id = (select auth.uid())),
        'rating', (select round(avg(rating)::numeric, 1) from public.official_feedback f where f.assignment_id = mo.id))
        order by case mo.role when 'umpire' then 1 when 'third_umpire' then 2 when 'match_referee' then 3 else 4 end, mo.invited_at)
      from public.match_officials mo join public.profiles pr on pr.id = mo.user_id
     where mo.match_id = p_match_id and (mo.status in ('invited','accepted') or private.can_manage_match(p_match_id))), '[]'::jsonb)
  );
$$;

-- ---------- #385 role-specific audit log viewer ----------
-- Organisers see the activity of their own tournament, match creators / organisers of their own match, team owners of their own team.
create or replace function public.list_scoped_audit_logs(p_scope text, p_id uuid, p_limit integer default 200)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); ok boolean := false; ids text[];
begin
  if uid is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  if p_scope = 'match' then
    ok := private.can_manage_match(p_id);
    ids := array[p_id::text];
  elsif p_scope = 'tournament' then
    ok := private.is_admin() or private.is_tournament_admin(p_id)
          or exists (select 1 from public.tournaments t where t.id = p_id and t.owner_id = uid)
          or exists (select 1 from public.user_role_assignments r where r.user_id = uid and r.role = 'organiser' and r.scope_type = 'tournament' and r.scope_id = p_id and r.is_active);
    ids := array[p_id::text] || coalesce((select array_agg(m.id::text) from public.matches m where m.tournament_id = p_id), '{}');
  elsif p_scope = 'team' then
    ok := private.is_admin() or exists (select 1 from public.teams t where t.id = p_id and t.owner_id = uid);
    ids := array[p_id::text];
  else
    raise exception 'Unknown scope.' using errcode = '22023';
  end if;
  if not ok then raise exception 'You can only view the activity log of something you manage.' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(l order by l.created_at desc) from (
      select a.id, a.action, a.entity_type, a.entity_id, a.created_at,
             coalesce(ap.display_name, case when a.actor_user_id is null then 'System' else 'Unnamed member' end) as actor_name,
             tp.display_name as target_name,
             a.metadata - 'ip' as metadata
        from public.audit_logs a
        left join public.profiles ap on ap.id = a.actor_user_id
        left join public.profiles tp on tp.id = a.target_user_id
       where a.entity_id = any (ids)
          or a.metadata ->> 'match_id' = any (ids)
          or a.metadata ->> 'tournament_id' = any (ids)
          or a.metadata ->> 'team_id' = any (ids)
       order by a.created_at desc
       limit greatest(1, least(coalesce(p_limit, 200), 500))
    ) l), '[]'::jsonb);
end;
$$;

-- ---------- #386 session and device management ----------
create or replace function public.list_my_sessions()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); cur text := (select auth.jwt() ->> 'session_id');
begin
  if uid is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', s.id, 'created_at', s.created_at, 'last_active', coalesce(s.refreshed_at::timestamptz, s.updated_at, s.created_at),
      'user_agent', s.user_agent, 'is_current', s.id::text = cur) order by s.created_at desc)
    from auth.sessions s where s.user_id = uid), '[]'::jsonb);
end;
$$;

create or replace function public.revoke_my_session(p_session_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); cur text := (select auth.jwt() ->> 'session_id');
begin
  if uid is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  if p_session_id::text = cur then raise exception 'That is this device. Use Sign Out instead.' using errcode = '22023'; end if;
  delete from auth.sessions where id = p_session_id and user_id = uid;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, 'SESSION_REVOKED', 'sessions', p_session_id::text, '{}'::jsonb);
  return public.list_my_sessions();
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.set_scorer_permissions(uuid,jsonb)', 'public.list_scoped_audit_logs(text,uuid,integer)',
    'public.list_my_sessions()', 'public.revoke_my_session(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
