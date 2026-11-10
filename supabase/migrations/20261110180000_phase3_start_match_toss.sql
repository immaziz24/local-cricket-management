-- Phase 3 / Category A – #1 Create a match, #2 Select teams, #3 Playing XI, #4 Substitutes,
-- #5 Toss winner, #6 Toss decision (bat or bowl).
-- Any signed-in user can create a match (friendly, or a tournament fixture made by the organiser).
-- Who may score a match: the person who created it, its appointed scorer, the tournament organiser, or an admin.

alter table public.matches
  add column if not exists title text check (title is null or pg_catalog.length(title) <= 100),
  add column if not exists city text check (city is null or pg_catalog.length(city) <= 60),
  add column if not exists match_type text check (match_type is null or match_type in ('limited_overs','box_cricket','two_innings')),
  add column if not exists overs_per_innings int check (overs_per_innings is null or overs_per_innings between 1 and 100),
  add column if not exists players_per_side int check (players_per_side is null or players_per_side between 2 and 15),
  add column if not exists ball_type text check (ball_type is null or pg_catalog.length(ball_type) <= 40),
  add column if not exists pitch_type text check (pitch_type is null or pg_catalog.length(pitch_type) <= 40),
  add column if not exists toss_winner_id uuid references public.teams(id) on delete set null,
  add column if not exists toss_decision text check (toss_decision is null or toss_decision in ('bat','bowl')),
  add column if not exists scorer_id uuid references auth.users(id) on delete set null,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz;
create index if not exists matches_toss_winner_idx on public.matches (toss_winner_id);
create index if not exists matches_scorer_idx on public.matches (scorer_id);
create index if not exists matches_status_idx on public.matches (status, scheduled_at);

-- Can the signed-in user score this match?
create or replace function private.can_score_match(p_match_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.matches m
     where m.id = p_match_id
       and (m.created_by = (select auth.uid()) or m.scorer_id = (select auth.uid()) or private.is_admin()
            or (m.tournament_id is not null and (
                  exists (select 1 from public.tournaments t where t.id = m.tournament_id and t.owner_id = (select auth.uid()))
               or exists (select 1 from public.user_role_assignments r where r.user_id = (select auth.uid()) and r.role = 'organiser'
                          and r.scope_type = 'tournament' and r.scope_id = m.tournament_id and r.is_active))))
  ) and not exists (select 1 from public.profiles where id = (select auth.uid()) and account_status in ('suspended','disabled'));
$$;
revoke all on function private.can_score_match(uuid) from public, anon, authenticated;

-- The scorer of a friendly match may also pick both lineups (in local cricket the scorer often does it).
create or replace function private.require_lineup_editor(p_match_id uuid, p_team_id uuid)
returns public.matches language plpgsql stable security definer set search_path = ''
as $$
declare m public.matches%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  select * into m from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found.' using errcode = '22023'; end if;
  if p_team_id is null or p_team_id not in (coalesce(m.team_a_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(m.team_b_id, '00000000-0000-0000-0000-000000000000'::uuid)) then
    raise exception 'This team is not playing in this match.' using errcode = '22023';
  end if;
  if exists (select 1 from public.profiles where id = (select auth.uid()) and account_status in ('suspended','disabled')) then
    raise exception 'Your account is suspended.' using errcode = '42501';
  end if;
  if exists (select 1 from public.teams where id = p_team_id and owner_id = (select auth.uid())) or private.can_score_match(p_match_id) then
    return m;
  end if;
  raise exception 'Only the team owner, the match scorer or the tournament organiser can pick this lineup.' using errcode = '42501';
end;
$$;
revoke all on function private.require_lineup_editor(uuid, uuid) from public, anon, authenticated;

-- #1 #2 Create a friendly match between any two teams. The creator becomes its scorer.
create or replace function public.create_friendly_match(p jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := (select auth.uid()); a uuid := nullif(p->>'team_a_id', '')::uuid; b uuid := nullif(p->>'team_b_id', '')::uuid;
  mt text := coalesce(nullif(p->>'match_type', ''), 'limited_overs'); ov int := nullif(p->>'overs_per_innings', '')::int;
  pps int := coalesce(nullif(p->>'players_per_side', '')::int, 11); new_id uuid;
begin
  if uid is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  if exists (select 1 from public.profiles where id = uid and account_status in ('suspended','disabled')) then
    raise exception 'Your account is suspended.' using errcode = '42501';
  end if;
  if a is null or b is null then raise exception 'Choose both teams.' using errcode = '22023'; end if;
  if a = b then raise exception 'Choose two different teams.' using errcode = '22023'; end if;
  if (select count(*) from public.teams where id in (a, b)) <> 2 then raise exception 'Team not found.' using errcode = '22023'; end if;
  if mt not in ('limited_overs','box_cricket','two_innings') then raise exception 'Unknown match type.' using errcode = '22023'; end if;
  if mt <> 'two_innings' and (ov is null or ov < 1 or ov > 100) then raise exception 'Overs per innings must be between 1 and 100.' using errcode = '22023'; end if;
  if pps < 2 or pps > 15 then raise exception 'Players a side must be between 2 and 15.' using errcode = '22023'; end if;
  if (select count(*) from public.matches where created_by = uid and created_at > pg_catalog.now() - interval '1 day') >= 50 then
    raise exception 'You have created many matches today. Please try again tomorrow.' using errcode = '22023';
  end if;

  insert into public.matches (stage, team_a_id, team_b_id, scheduled_at, venue, city, title, match_type, overs_per_innings,
                              players_per_side, ball_type, pitch_type, created_by, scorer_id)
  values ('friendly', a, b, coalesce(nullif(p->>'scheduled_at', '')::timestamptz, pg_catalog.now()),
          nullif(pg_catalog.btrim(coalesce(p->>'venue', '')), ''), nullif(pg_catalog.btrim(coalesce(p->>'city', '')), ''),
          nullif(pg_catalog.btrim(coalesce(p->>'title', '')), ''), mt, ov, pps,
          nullif(pg_catalog.btrim(coalesce(p->>'ball_type', '')), ''), nullif(pg_catalog.btrim(coalesce(p->>'pitch_type', '')), ''), uid, uid)
  returning id into new_id;

  insert into public.user_role_assignments (user_id, role, scope_type, scope_id, granted_by, notes)
  values (uid, 'scorer', 'match', new_id, uid, 'Automatic: created the match')
  on conflict do nothing;
  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  select distinct t.owner_id, 'match_created', 'New match',
         (select name from public.teams where id = a) || ' vs ' || (select name from public.teams where id = b) || ' was created.',
         jsonb_build_object('match_id', new_id)
    from public.teams t where t.id in (a, b) and t.owner_id <> uid;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, 'MATCH_CREATED', 'matches', new_id::text, jsonb_build_object('team_a', a, 'team_b', b));
  return jsonb_build_object('id', new_id);
end;
$$;

-- #5 #6 Toss and start. Both sides need a playing side picked first.
create or replace function public.start_match(p_match_id uuid, p_toss_winner uuid, p_decision text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare m public.matches%rowtype; bat_first uuid; ov int; pps int; t_status text; t_ov int; t_pps int; t_mt text; t_ball text; t_pitch text;
begin
  select * into m from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found.' using errcode = '22023'; end if;
  if not private.can_score_match(p_match_id) then raise exception 'Only the match scorer or the tournament organiser can start this match.' using errcode = '42501'; end if;
  if m.status <> 'scheduled' then raise exception 'This match has already started or finished.' using errcode = '22023'; end if;
  if m.team_a_id is null or m.team_b_id is null then raise exception 'Both teams must be set.' using errcode = '22023'; end if;
  if p_toss_winner is null or p_toss_winner not in (m.team_a_id, m.team_b_id) then raise exception 'Choose who won the toss.' using errcode = '22023'; end if;
  if p_decision not in ('bat','bowl') then raise exception 'Choose bat or bowl.' using errcode = '22023'; end if;
  if (select count(*) from public.match_players where match_id = p_match_id and team_id = m.team_a_id and role = 'playing') < 2
     or (select count(*) from public.match_players where match_id = p_match_id and team_id = m.team_b_id and role = 'playing') < 2 then
    raise exception 'Pick the Playing XI of both teams first.' using errcode = '22023';
  end if;
  if m.tournament_id is not null then
    select status, overs_per_innings, players_per_side, match_type, ball_type, pitch_type
      into t_status, t_ov, t_pps, t_mt, t_ball, t_pitch from public.tournaments where id = m.tournament_id;
    if t_status in ('completed','cancelled') then raise exception 'This tournament is finished.' using errcode = '22023'; end if;
  end if;
  ov := coalesce(m.overs_per_innings, t_ov);
  pps := coalesce(m.players_per_side, t_pps, 11);
  if coalesce(m.match_type, t_mt, 'limited_overs') <> 'two_innings' and ov is null then
    raise exception 'Set the number of overs first.' using errcode = '22023';
  end if;
  bat_first := case when p_decision = 'bat' then p_toss_winner
                    else case when p_toss_winner = m.team_a_id then m.team_b_id else m.team_a_id end end;

  update public.matches set status = 'live', toss_winner_id = p_toss_winner, toss_decision = p_decision,
         batting_first_team_id = bat_first, started_at = pg_catalog.now(),
         scorer_id = coalesce(scorer_id, (select auth.uid())),
         overs_per_innings = ov, players_per_side = pps,
         match_type = coalesce(m.match_type, t_mt, 'limited_overs'),
         ball_type = coalesce(m.ball_type, t_ball), pitch_type = coalesce(m.pitch_type, t_pitch)
   where id = p_match_id;
  if m.tournament_id is not null then
    update public.tournaments set status = 'ongoing' where id = m.tournament_id and status in ('registration','upcoming');
  end if;

  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  select distinct tm.owner_id, 'match_started', 'Match started',
         (select name from public.teams where id = p_toss_winner) || ' won the toss and chose to ' || p_decision || '.',
         jsonb_build_object('match_id', p_match_id)
    from public.teams tm where tm.id in (m.team_a_id, m.team_b_id) and tm.owner_id <> (select auth.uid());
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'MATCH_STARTED', 'matches', p_match_id::text,
          jsonb_build_object('toss_winner', p_toss_winner, 'decision', p_decision, 'batting_first', bat_first));
  return jsonb_build_object('id', p_match_id, 'status', 'live', 'batting_first_team_id', bat_first);
end;
$$;

-- Match page header: match, teams, tournament and what the viewer may do.
create or replace function public.get_match_centre(p_match_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare m record;
begin
  select * into m from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found.' using errcode = '22023'; end if;
  return jsonb_build_object(
    'match', to_jsonb(m) - 'created_by' - 'scorer_id',
    'team_a', (select jsonb_build_object('id', id, 'name', name, 'short_name', short_name, 'logo_url', logo_url) from public.teams where id = m.team_a_id),
    'team_b', (select jsonb_build_object('id', id, 'name', name, 'short_name', short_name, 'logo_url', logo_url) from public.teams where id = m.team_b_id),
    'tournament', (select jsonb_build_object('id', id, 'name', name, 'code', code, 'overs_per_innings', overs_per_innings,
                                             'players_per_side', players_per_side, 'ball_type', ball_type, 'match_type', match_type)
                     from public.tournaments where id = m.tournament_id),
    'scorer_name', (select display_name from public.profiles where id = m.scorer_id),
    'can_score', private.can_score_match(p_match_id)
  );
end;
$$;

-- Matches list for the Matches page (live, upcoming, recent) — public.
create or replace function public.list_matches(p_filter text default 'all', p_limit int default 50)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(s.x order by s.sort_key), '[]'::jsonb) from (
    select jsonb_build_object(
             'id', m.id, 'status', m.status, 'stage', m.stage, 'title', m.title, 'scheduled_at', m.scheduled_at,
             'venue', m.venue, 'city', m.city, 'result_summary', m.result_summary, 'overs_per_innings', m.overs_per_innings,
             'team_a', jsonb_build_object('id', ta.id, 'name', ta.name, 'short_name', ta.short_name, 'logo_url', ta.logo_url),
             'team_b', jsonb_build_object('id', tb.id, 'name', tb.name, 'short_name', tb.short_name, 'logo_url', tb.logo_url),
             'team_a_runs', m.team_a_runs, 'team_a_wickets', m.team_a_wickets, 'team_a_balls', m.team_a_balls,
             'team_b_runs', m.team_b_runs, 'team_b_wickets', m.team_b_wickets, 'team_b_balls', m.team_b_balls,
             'tournament', case when tr.id is null then null else jsonb_build_object('id', tr.id, 'name', tr.name) end,
             'mine', (select auth.uid()) is not null and (m.created_by = (select auth.uid()) or m.scorer_id = (select auth.uid())
                      or ta.owner_id = (select auth.uid()) or tb.owner_id = (select auth.uid()))
           ) as x,
           case when m.status = 'live' then extract(epoch from m.started_at) * -1
                when m.status = 'scheduled' then extract(epoch from coalesce(m.scheduled_at, m.created_at))
                else extract(epoch from coalesce(m.completed_at, m.scheduled_at, m.updated_at)) * -1 end as sort_key
      from public.matches m
      join public.teams ta on ta.id = m.team_a_id
      join public.teams tb on tb.id = m.team_b_id
      left join public.tournaments tr on tr.id = m.tournament_id
     where case p_filter
             when 'live' then m.status = 'live'
             when 'upcoming' then m.status = 'scheduled'
             when 'completed' then m.status in ('completed','abandoned')
             when 'mine' then (select auth.uid()) is not null and (m.created_by = (select auth.uid()) or m.scorer_id = (select auth.uid())
                               or ta.owner_id = (select auth.uid()) or tb.owner_id = (select auth.uid()))
             else true end
     order by sort_key
     limit least(greatest(coalesce(p_limit, 50), 1), 200)
  ) s;
$$;

create or replace function public.count_live_matches()
returns int language sql stable security definer set search_path = ''
as $$ select count(*)::int from public.matches where status = 'live'; $$;

revoke all on function public.create_friendly_match(jsonb) from public, anon;
revoke all on function public.start_match(uuid, uuid, text) from public, anon;
revoke all on function public.get_match_centre(uuid) from public;
revoke all on function public.list_matches(text, int) from public;
revoke all on function public.count_live_matches() from public;
grant execute on function public.create_friendly_match(jsonb) to authenticated;
grant execute on function public.start_match(uuid, uuid, text) to authenticated;
grant execute on function public.get_match_centre(uuid) to anon, authenticated;
grant execute on function public.list_matches(text, int) to anon, authenticated;
grant execute on function public.count_live_matches() to anon, authenticated;

-- Lineups: friendly matches use the match's own players a side; the match scorer may edit both sides.
create or replace function public.get_match_lineups(p_match_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare m record; uid uuid := (select auth.uid()); scorer boolean; per_side int := 11; max_subs int := 4;
begin
  select * into m from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found.' using errcode = '22023'; end if;
  if m.tournament_id is not null then
    select players_per_side, max_substitutes into per_side, max_subs from public.tournaments where id = m.tournament_id;
  end if;
  per_side := coalesce(m.players_per_side, per_side, 11);
  scorer := private.can_score_match(p_match_id);
  return jsonb_build_object(
    'match_id', m.id, 'status', m.status,
    'players_per_side', per_side, 'max_substitutes', max_subs,
    'teams', coalesce((
      select jsonb_agg(jsonb_build_object(
        'team_id', tm.id, 'name', tm.name, 'short_name', tm.short_name, 'logo_url', tm.logo_url,
        'can_edit', uid is not null and (scorer or tm.owner_id = uid),
        'squad', coalesce((select jsonb_agg(jsonb_build_object('player_id', p.id, 'name', p.display_name, 'photo_url', p.photo_url,
                                     'player_role', p.player_role, 'is_captain', mem.is_captain, 'jersey_number', mem.jersey_number)
                                     order by mem.is_captain desc, p.display_name)
                           from public.team_members mem join public.players p on p.id = mem.player_id
                          where mem.team_id = tm.id), '[]'::jsonb),
        'lineup', coalesce((select jsonb_agg(jsonb_build_object('player_id', mp.player_id, 'name', p.display_name, 'role', mp.role,
                                     'batting_order', mp.batting_order, 'is_captain', mp.is_captain, 'is_wicket_keeper', mp.is_wicket_keeper,
                                     'replaces_player_id', mp.replaces_player_id, 'replacement_reason', mp.replacement_reason)
                                     order by mp.role, mp.batting_order nulls last, p.display_name)
                            from public.match_players mp join public.players p on p.id = mp.player_id
                           where mp.match_id = m.id and mp.team_id = tm.id), '[]'::jsonb)
      ) order by case when tm.id = m.team_a_id then 0 else 1 end)
      from public.teams tm where tm.id in (m.team_a_id, m.team_b_id)), '[]'::jsonb)
  );
end;
$$;

-- Lineup size follows the match's own players a side when set.
create or replace function public.set_match_lineup(p_match_id uuid, p_team_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  m public.matches%rowtype; per_side int := 11; max_subs int := 4; playing uuid[]; subs uuid[]; cap uuid; wk uuid; other uuid; i int;
begin
  m := private.require_lineup_editor(p_match_id, p_team_id);
  if m.status not in ('scheduled','live') then raise exception 'The lineup can only be changed before or during the match.' using errcode = '22023'; end if;
  if exists (select 1 from public.match_players where match_id = p_match_id and team_id = p_team_id and role = 'replaced') then
    raise exception 'A replacement has already been made. Use replacements instead of picking the lineup again.' using errcode = '22023';
  end if;
  if m.tournament_id is not null then
    select players_per_side, max_substitutes into per_side, max_subs from public.tournaments where id = m.tournament_id;
  end if;
  per_side := coalesce(m.players_per_side, per_side, 11);
  select coalesce(array_agg(x::uuid), '{}') into playing from jsonb_array_elements_text(coalesce(p->'playing', '[]'::jsonb)) x;
  select coalesce(array_agg(x::uuid), '{}') into subs from jsonb_array_elements_text(coalesce(p->'substitutes', '[]'::jsonb)) x;
  cap := nullif(p->>'captain', '')::uuid; wk := nullif(p->>'wicket_keeper', '')::uuid;

  if pg_catalog.cardinality(playing) < 2 then raise exception 'Pick at least 2 playing players.' using errcode = '22023'; end if;
  if pg_catalog.cardinality(playing) > per_side then raise exception 'Pick at most % playing players.', per_side using errcode = '22023'; end if;
  if pg_catalog.cardinality(subs) > max_subs then raise exception 'At most % substitutes are allowed.', max_subs using errcode = '22023'; end if;
  if (select count(distinct x) from unnest(playing || subs) x) <> pg_catalog.cardinality(playing || subs) then
    raise exception 'A player can only be picked once.' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(playing || subs) x where not exists (select 1 from public.team_members where team_id = p_team_id and player_id = x)) then
    raise exception 'Only players from the team squad can be picked.' using errcode = '22023';
  end if;
  other := case when m.team_a_id = p_team_id then m.team_b_id else m.team_a_id end;
  if exists (select 1 from public.match_players where match_id = p_match_id and team_id = other and player_id = any (playing || subs)) then
    raise exception 'One of these players is already picked by the other team for this match.' using errcode = '22023';
  end if;
  if cap is not null and not cap = any (playing) then raise exception 'The captain must be in the playing side.' using errcode = '22023'; end if;
  if wk is not null and not wk = any (playing) then raise exception 'The wicket-keeper must be in the playing side.' using errcode = '22023'; end if;

  delete from public.match_players where match_id = p_match_id and team_id = p_team_id;
  for i in 1 .. pg_catalog.cardinality(playing) loop
    insert into public.match_players (match_id, team_id, player_id, role, batting_order, is_captain, is_wicket_keeper, selected_by)
    values (p_match_id, p_team_id, playing[i], 'playing', i, playing[i] = coalesce(cap, '00000000-0000-0000-0000-000000000000'::uuid),
            playing[i] = coalesce(wk, '00000000-0000-0000-0000-000000000000'::uuid), (select auth.uid()));
  end loop;
  insert into public.match_players (match_id, team_id, player_id, role, selected_by)
  select p_match_id, p_team_id, x, 'substitute', (select auth.uid()) from unnest(subs) x;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'MATCH_LINEUP_SET', 'teams', p_team_id::text,
          jsonb_build_object('match_id', p_match_id, 'playing', pg_catalog.cardinality(playing), 'substitutes', pg_catalog.cardinality(subs)));
  return jsonb_build_object('playing', pg_catalog.cardinality(playing), 'substitutes', pg_catalog.cardinality(subs));
end;
$$;
