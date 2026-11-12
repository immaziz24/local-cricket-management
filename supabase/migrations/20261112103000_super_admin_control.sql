-- #257 Super-admin dashboard, #258 admin dashboard, #18 score correction:
-- platform admins can find and fix anything – users, teams, matches, tournaments, and any ball of any match.
-- Admin and Super-Admin can search, edit and correct; only Super-Admin can delete users. Every change is audited.

create or replace function private.require_admin() returns uuid
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Only platform admins can do this.' using errcode = '42501'; end if;
  return (select auth.uid());
end $$;

create or replace function private.is_super_admin_user(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_role_assignments where user_id = p_user and role = 'super_admin' and is_active);
$$;

create or replace function private.admin_log(p_action text, p_type text, p_id text, p_meta jsonb default '{}'::jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata) values ((select auth.uid()), p_action, p_type, p_id, p_meta);
$$;

-- Search everything. p_kind: users | teams | matches | tournaments | all
create or replace function public.admin_search(p_query text, p_kind text default 'all')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare q text := pg_catalog.btrim(coalesce(p_query, '')); like_q text; r jsonb := '{}'::jsonb;
begin
  perform private.require_admin();
  like_q := '%' || replace(replace(q, '%', ''), '_', '') || '%';
  if p_kind in ('all', 'users') then
    r := r || jsonb_build_object('users', coalesce((select jsonb_agg(x) from (
      select jsonb_build_object('id', p.id, 'name', p.display_name, 'email', u.email, 'mobile', p.mobile_number, 'status', p.account_status,
             'created_at', p.created_at, 'last_sign_in_at', u.last_sign_in_at, 'email_confirmed', u.email_confirmed_at is not null,
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

create or replace function public.admin_get_user(p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return (select jsonb_build_object('id', p.id, 'name', p.display_name, 'username', p.username, 'email', u.email, 'mobile', p.mobile_number,
      'status', p.account_status, 'created_at', p.created_at, 'last_sign_in_at', u.last_sign_in_at, 'email_confirmed', u.email_confirmed_at is not null,
      'roles', coalesce((select jsonb_agg(jsonb_build_object('role', ra.role, 'scope_type', ra.scope_type, 'scope_id', ra.scope_id)) from public.user_role_assignments ra where ra.user_id = p.id and ra.is_active), '[]'::jsonb),
      'player', (select jsonb_build_object('id', pl.id, 'name', pl.display_name) from public.players pl where pl.profile_id = p.id limit 1),
      'teams_owned', (select count(*) from public.teams where owner_id = p.id),
      'tournaments_owned', (select count(*) from public.tournaments where owner_id = p.id),
      'matches_created', (select count(*) from public.matches where created_by = p.id),
      'is_super_admin', private.is_super_admin_user(p.id))
    from public.profiles p left join auth.users u on u.id = p.id where p.id = p_user_id);
end $$;

-- p: {name, mobile, status (active|suspended|disabled), email_confirmed (true)}
create or replace function public.admin_update_user(p_user_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := private.require_admin(); v_mobile text;
begin
  if not exists (select 1 from public.profiles where id = p_user_id) then raise exception 'User not found.' using errcode = '22023'; end if;
  if private.is_super_admin_user(p_user_id) and not private.is_super_admin_user(me) then
    raise exception 'Only a Super-Admin can change a Super-Admin account.' using errcode = '42501'; end if;
  if p_user_id = me and p ? 'status' and p->>'status' <> 'active' then raise exception 'You cannot suspend your own account.' using errcode = '22023'; end if;
  if p ? 'name' then
    if pg_catalog.length(pg_catalog.btrim(p->>'name')) < 2 then raise exception 'Name is too short.' using errcode = '22023'; end if;
    update public.profiles set display_name = pg_catalog.btrim(p->>'name'), updated_at = now() where id = p_user_id;
    update public.players set display_name = pg_catalog.btrim(p->>'name') where profile_id = p_user_id;
  end if;
  if p ? 'mobile' then
    v_mobile := nullif(pg_catalog.regexp_replace(coalesce(p->>'mobile', ''), '\D', '', 'g'), '');
    if v_mobile is not null and pg_catalog.length(v_mobile) > 10 then v_mobile := pg_catalog.right(v_mobile, 10); end if;
    if v_mobile is not null and v_mobile !~ '^[6-9]\d{9}$' then raise exception 'Enter a valid 10-digit mobile number.' using errcode = '22023'; end if;
    if v_mobile is not null and exists (select 1 from public.profiles where mobile_number = v_mobile and id <> p_user_id) then
      raise exception 'Another account already uses this mobile number.' using errcode = '22023'; end if;
    update public.profiles set mobile_number = v_mobile, updated_at = now() where id = p_user_id;
  end if;
  if p ? 'status' then
    if p->>'status' not in ('active', 'suspended', 'disabled') then raise exception 'Unknown status.' using errcode = '22023'; end if;
    update public.profiles set account_status = p->>'status', updated_at = now() where id = p_user_id;
  end if;
  if (p->>'email_confirmed')::boolean is true then
    update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()) where id = p_user_id;
  end if;
  perform private.admin_log('ADMIN_USER_UPDATED', 'profiles', p_user_id::text, p);
  return public.admin_get_user(p_user_id);
end $$;

-- Super-Admin only. Teams and tournaments the user owns are handed to the Super-Admin, so no cricket data is lost.
create or replace function public.admin_delete_user(p_user_id uuid, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := private.require_admin(); v_name text;
begin
  if not private.is_super_admin_user(me) then raise exception 'Only the Super-Admin can delete accounts.' using errcode = '42501'; end if;
  if p_user_id = me then raise exception 'You cannot delete your own account here.' using errcode = '22023'; end if;
  if private.is_super_admin_user(p_user_id) then raise exception 'A Super-Admin account cannot be deleted.' using errcode = '42501'; end if;
  select display_name into v_name from public.profiles where id = p_user_id;
  update public.teams set owner_id = me where owner_id = p_user_id;
  update public.tournaments set owner_id = me where owner_id = p_user_id;
  update public.user_suspensions set issued_by = me where issued_by = p_user_id;
  delete from public.user_reports where reporter_user_id = p_user_id;
  delete from auth.users where id = p_user_id;
  perform private.admin_log('ADMIN_USER_DELETED', 'profiles', p_user_id::text, jsonb_build_object('name', v_name, 'reason', p_reason));
  return jsonb_build_object('deleted', true);
end $$;

-- Teams. p: {name, short_name, city}
create or replace function public.admin_update_team(p_team_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  update public.teams set name = coalesce(nullif(pg_catalog.btrim(p->>'name'), ''), name),
    short_name = case when p ? 'short_name' then nullif(pg_catalog.upper(pg_catalog.btrim(p->>'short_name')), '') else short_name end,
    city = case when p ? 'city' then nullif(pg_catalog.btrim(p->>'city'), '') else city end
  where id = p_team_id;
  if not found then raise exception 'Team not found.' using errcode = '22023'; end if;
  perform private.admin_log('ADMIN_TEAM_UPDATED', 'teams', p_team_id::text, p);
  return jsonb_build_object('id', p_team_id);
end $$;

create or replace function public.admin_delete_team(p_team_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_name text;
begin
  perform private.require_admin();
  if exists (select 1 from public.matches where (team_a_id = p_team_id or team_b_id = p_team_id) and status <> 'scheduled') then
    raise exception 'This team has played matches. Delete those matches first, or rename the team instead.' using errcode = '22023'; end if;
  select name into v_name from public.teams where id = p_team_id;
  delete from public.matches where (team_a_id = p_team_id or team_b_id = p_team_id) and status = 'scheduled';
  delete from public.teams where id = p_team_id;
  perform private.admin_log('ADMIN_TEAM_DELETED', 'teams', p_team_id::text, jsonb_build_object('name', v_name));
  return jsonb_build_object('deleted', true);
end $$;

-- Tournaments. p: {name, status, venue}
create or replace function public.admin_update_tournament(p_tournament_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  update public.tournaments set name = coalesce(nullif(pg_catalog.btrim(p->>'name'), ''), name),
    venue = coalesce(nullif(pg_catalog.btrim(p->>'venue'), ''), venue),
    status = coalesce(nullif(p->>'status', ''), status)
  where id = p_tournament_id;
  if not found then raise exception 'Tournament not found.' using errcode = '22023'; end if;
  perform private.admin_log('ADMIN_TOURNAMENT_UPDATED', 'tournaments', p_tournament_id::text, p);
  return jsonb_build_object('id', p_tournament_id);
end $$;

create or replace function public.admin_delete_tournament(p_tournament_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_name text;
begin
  perform private.require_admin();
  select name into v_name from public.tournaments where id = p_tournament_id;
  if v_name is null then raise exception 'Tournament not found.' using errcode = '22023'; end if;
  delete from public.matches where tournament_id = p_tournament_id;
  delete from public.tournaments where id = p_tournament_id;
  perform private.admin_log('ADMIN_TOURNAMENT_DELETED', 'tournaments', p_tournament_id::text, jsonb_build_object('name', v_name));
  return jsonb_build_object('deleted', true);
end $$;

-- Matches: details and result. p: {title, venue, city, scheduled_at, status, result_type, winner_team_id, result_summary, overs_per_innings}
create or replace function public.admin_update_match(p_match_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare m public.matches%rowtype;
begin
  perform private.require_admin();
  select * into m from public.matches where id = p_match_id for update;
  if not found then raise exception 'Match not found.' using errcode = '22023'; end if;
  if p ? 'winner_team_id' and nullif(p->>'winner_team_id', '') is not null and (p->>'winner_team_id')::uuid not in (m.team_a_id, m.team_b_id) then
    raise exception 'The winner must be one of the two teams.' using errcode = '22023'; end if;
  if p ? 'status' and p->>'status' not in ('scheduled', 'live', 'completed', 'abandoned', 'cancelled') then
    raise exception 'Unknown match status.' using errcode = '22023'; end if;
  update public.matches set
    title = case when p ? 'title' then nullif(pg_catalog.btrim(p->>'title'), '') else title end,
    venue = case when p ? 'venue' then nullif(pg_catalog.btrim(p->>'venue'), '') else venue end,
    city = case when p ? 'city' then nullif(pg_catalog.btrim(p->>'city'), '') else city end,
    scheduled_at = case when p ? 'scheduled_at' then nullif(p->>'scheduled_at', '')::timestamptz else scheduled_at end,
    overs_per_innings = case when p ? 'overs_per_innings' then nullif(p->>'overs_per_innings', '')::int else overs_per_innings end,
    status = coalesce(nullif(p->>'status', ''), status),
    result_type = case when p ? 'result_type' then nullif(p->>'result_type', '') else result_type end,
    winner_team_id = case when p ? 'winner_team_id' then nullif(p->>'winner_team_id', '')::uuid else winner_team_id end,
    result_summary = case when p ? 'result_summary' then nullif(pg_catalog.btrim(p->>'result_summary'), '') else result_summary end,
    completed_at = case when p->>'status' = 'completed' then coalesce(completed_at, now()) else completed_at end,
    updated_at = now()
  where id = p_match_id;
  perform private.admin_log('ADMIN_MATCH_UPDATED', 'matches', p_match_id::text, p);
  return jsonb_build_object('id', p_match_id);
end $$;

create or replace function public.admin_delete_match(p_match_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  delete from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found.' using errcode = '22023'; end if;
  perform private.admin_log('ADMIN_MATCH_DELETED', 'matches', p_match_id::text);
  return jsonb_build_object('deleted', true);
end $$;

-- Every ball of a match with names, for correction.
create or replace function public.admin_list_balls(p_match_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return (select jsonb_build_object(
    'match_id', p_match_id,
    'innings', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'innings_no', i.innings_no, 'batting_team', (select name from public.teams where id = i.batting_team_id),
        'batting_team_id', i.batting_team_id, 'bowling_team_id', i.bowling_team_id, 'runs', i.runs, 'wickets', i.wickets, 'legal_balls', i.legal_balls, 'status', i.status,
        'balls', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'seq', b.seq, 'over', b.over_no, 'ball', b.ball_in_over, 'runs_bat', b.runs_bat,
            'extra_type', b.extra_type, 'extra_runs', b.extra_runs, 'is_wicket', b.is_wicket, 'wicket_type', b.wicket_type,
            'striker_id', b.striker_id, 'non_striker_id', b.non_striker_id, 'bowler_id', b.bowler_id, 'dismissed_id', b.dismissed_id, 'fielder_id', b.fielder_id,
            'striker', (select display_name from public.players where id = b.striker_id), 'bowler', (select display_name from public.players where id = b.bowler_id),
            'dismissed', (select display_name from public.players where id = b.dismissed_id), 'commentary', b.commentary) order by b.seq)
          from public.balls b where b.innings_id = i.id), '[]'::jsonb)) order by i.innings_no)
      from public.innings i where i.match_id = p_match_id), '[]'::jsonb),
    'players', coalesce((select jsonb_agg(distinct jsonb_build_object('id', pl.id, 'name', pl.display_name, 'team_id', tm.team_id))
      from public.matches m join public.team_members tm on tm.team_id in (m.team_a_id, m.team_b_id) join public.players pl on pl.id = tm.player_id
      where m.id = p_match_id), '[]'::jsonb)));
end $$;

-- Rebuild an innings' totals and over numbering from its balls, then the match's team totals.
create or replace function private.admin_recompute_innings(p_innings_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare i public.innings%rowtype; m public.matches%rowtype; r record; legal_before int := 0;
begin
  select * into i from public.innings where id = p_innings_id for update;
  for r in select id, is_legal from public.balls where innings_id = p_innings_id order by seq loop
    update public.balls set over_no = legal_before / 6,
      ball_in_over = case when r.is_legal then legal_before % 6 + 1 else legal_before % 6 end
    where id = r.id;
    if r.is_legal then legal_before := legal_before + 1; end if;
  end loop;
  update public.innings set
    runs = coalesce((select sum(runs_bat + extra_runs) from public.balls where innings_id = i.id), 0) + coalesce(i.penalty_runs, 0),
    extras = coalesce((select sum(extra_runs) from public.balls where innings_id = i.id), 0),
    wickets = (select count(*) from public.balls where innings_id = i.id and is_wicket),
    legal_balls = (select count(*) from public.balls where innings_id = i.id and is_legal)
  where id = i.id;
  select * into m from public.matches where id = i.match_id for update;
  update public.matches set
    team_a_runs = (select coalesce(sum(runs), 0) from public.innings where match_id = m.id and batting_team_id = m.team_a_id and not is_super_over),
    team_a_wickets = (select coalesce(sum(wickets), 0) from public.innings where match_id = m.id and batting_team_id = m.team_a_id and not is_super_over),
    team_a_balls = (select coalesce(sum(legal_balls), 0) from public.innings where match_id = m.id and batting_team_id = m.team_a_id and not is_super_over),
    team_b_runs = (select coalesce(sum(runs), 0) from public.innings where match_id = m.id and batting_team_id = m.team_b_id and not is_super_over),
    team_b_wickets = (select coalesce(sum(wickets), 0) from public.innings where match_id = m.id and batting_team_id = m.team_b_id and not is_super_over),
    team_b_balls = (select coalesce(sum(legal_balls), 0) from public.innings where match_id = m.id and batting_team_id = m.team_b_id and not is_super_over),
    updated_at = now()
  where id = m.id;
end $$;

-- Correct one ball. p: {runs_bat, extra_type (null|wide|no_ball|bye|leg_bye), extra_runs, wicket_type (null to clear), dismissed_id, fielder_id, striker_id, non_striker_id, bowler_id, commentary}
create or replace function public.admin_update_ball(p_ball_id bigint, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare b public.balls%rowtype; v_ext text; v_wk text;
begin
  perform private.require_admin();
  select * into b from public.balls where id = p_ball_id for update;
  if not found then raise exception 'Ball not found.' using errcode = '22023'; end if;
  v_ext := case when p ? 'extra_type' then nullif(p->>'extra_type', '') else b.extra_type end;
  if v_ext is not null and v_ext not in ('wide', 'no_ball', 'bye', 'leg_bye') then raise exception 'Unknown extra.' using errcode = '22023'; end if;
  v_wk := case when p ? 'wicket_type' then nullif(p->>'wicket_type', '') else b.wicket_type end;
  update public.balls set
    runs_bat = case when p ? 'runs_bat' then greatest(0, least(7, (p->>'runs_bat')::int)) else runs_bat end,
    extra_type = v_ext,
    extra_runs = case when p ? 'extra_runs' then greatest(0, least(10, (p->>'extra_runs')::int)) when v_ext is null then 0 else extra_runs end,
    is_legal = v_ext is null or v_ext in ('bye', 'leg_bye'),
    wicket_type = v_wk,
    is_wicket = v_wk is not null and v_wk <> 'retired_hurt',
    dismissed_id = case when v_wk is null then null when p ? 'dismissed_id' then nullif(p->>'dismissed_id', '')::uuid else dismissed_id end,
    fielder_id = case when v_wk is null then null when p ? 'fielder_id' then nullif(p->>'fielder_id', '')::uuid else fielder_id end,
    striker_id = case when p ? 'striker_id' and nullif(p->>'striker_id', '') is not null then (p->>'striker_id')::uuid else striker_id end,
    non_striker_id = case when p ? 'non_striker_id' and nullif(p->>'non_striker_id', '') is not null then (p->>'non_striker_id')::uuid else non_striker_id end,
    bowler_id = case when p ? 'bowler_id' and nullif(p->>'bowler_id', '') is not null then (p->>'bowler_id')::uuid else bowler_id end,
    commentary = case when p ? 'commentary' then nullif(pg_catalog.btrim(p->>'commentary'), '') else commentary end
  where id = p_ball_id;
  perform private.admin_recompute_innings(b.innings_id);
  perform private.admin_log('ADMIN_BALL_CORRECTED', 'matches', b.match_id::text,
    jsonb_build_object('ball_id', p_ball_id, 'over', b.over_no, 'ball', b.ball_in_over, 'before', jsonb_build_object('runs_bat', b.runs_bat, 'extra_type', b.extra_type, 'extra_runs', b.extra_runs, 'wicket_type', b.wicket_type), 'after', p));
  return public.admin_list_balls(b.match_id);
end $$;

create or replace function public.admin_delete_ball(p_ball_id bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare b public.balls%rowtype;
begin
  perform private.require_admin();
  select * into b from public.balls where id = p_ball_id for update;
  if not found then raise exception 'Ball not found.' using errcode = '22023'; end if;
  delete from public.balls where id = p_ball_id;
  perform private.admin_recompute_innings(b.innings_id);
  perform private.admin_log('ADMIN_BALL_DELETED', 'matches', b.match_id::text,
    jsonb_build_object('over', b.over_no, 'ball', b.ball_in_over, 'runs_bat', b.runs_bat, 'extra_type', b.extra_type, 'wicket_type', b.wicket_type));
  return public.admin_list_balls(b.match_id);
end $$;

do $$
declare f text;
begin
  foreach f in array array['public.admin_search(text, text)', 'public.admin_get_user(uuid)', 'public.admin_update_user(uuid, jsonb)',
    'public.admin_delete_user(uuid, text)', 'public.admin_update_team(uuid, jsonb)', 'public.admin_delete_team(uuid)',
    'public.admin_update_tournament(uuid, jsonb)', 'public.admin_delete_tournament(uuid)', 'public.admin_update_match(uuid, jsonb)',
    'public.admin_delete_match(uuid)', 'public.admin_list_balls(uuid)', 'public.admin_update_ball(bigint, jsonb)', 'public.admin_delete_ball(bigint)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  foreach f in array array['private.require_admin()', 'private.is_super_admin_user(uuid)', 'private.admin_log(text, text, text, jsonb)', 'private.admin_recompute_innings(uuid)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;
