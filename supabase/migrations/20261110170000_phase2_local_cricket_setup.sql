-- Phase 2 – local cricket set-up (owner feedback, CricHeroes reference)
-- * Tournaments describe local cricket: overs per innings as a number, match type (limited overs / box / two innings),
--   ball type (tennis, tape, leather…), pitch type, category (open, corporate, village…), players a side.
-- * #40/#41 extended: the organiser can add teams directly (existing team, or a new team created on the spot).

alter table public.tournaments
  add column if not exists match_type text not null default 'limited_overs'
    check (match_type in ('limited_overs','box_cricket','two_innings')),
  add column if not exists category text check (category is null or pg_catalog.length(category) <= 40),
  add column if not exists pitch_type text check (pitch_type is null or pg_catalog.length(pitch_type) <= 40);

-- #31 Create a tournament (local cricket form)
create or replace function public.create_tournament(p jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := (select auth.uid()); new_id uuid; nm text := pg_catalog.btrim(coalesce(p->>'name', ''));
  cd text := pg_catalog.upper(pg_catalog.btrim(coalesce(p->>'code', ''))); tc int; ov int; mt text; pps int; fmt text;
begin
  if uid is null then raise exception 'Please sign in to create a tournament.' using errcode = '42501'; end if;
  if exists (select 1 from public.profiles where id = uid and account_status in ('suspended','disabled')) then
    raise exception 'Your account is suspended.' using errcode = '42501';
  end if;
  if pg_catalog.length(nm) < 3 then raise exception 'Tournament name must be at least 3 characters long.' using errcode = '22023'; end if;
  if cd !~ '^[A-Z0-9][A-Z0-9-]{1,15}$' then
    raise exception 'Tournament code must be 2–16 letters, numbers or dashes (e.g. TPL-26).' using errcode = '22023';
  end if;
  if exists (select 1 from public.tournaments where lower(name) = lower(nm)) then
    raise exception 'A tournament named "%" already exists. Please choose a different name.', nm using errcode = '22023';
  end if;
  if exists (select 1 from public.tournaments where code = cd) then
    raise exception 'The code "%" is already used. Please choose another.', cd using errcode = '22023';
  end if;
  tc := nullif(p->>'teams_count', '')::int;
  if tc is null or tc < 2 or tc > 64 then raise exception 'Number of teams must be between 2 and 64.' using errcode = '22023'; end if;
  if (p->>'start_date') is null or (p->>'end_date') is null then raise exception 'Start and end dates are required.' using errcode = '22023'; end if;
  if (p->>'end_date')::date < (p->>'start_date')::date then raise exception 'End date cannot be earlier than start date.' using errcode = '22023'; end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p->>'venue', ''))) < 3 then raise exception 'Ground is required (at least 3 characters).' using errcode = '22023'; end if;
  if (select count(*) from public.tournaments where owner_id = uid and created_at > pg_catalog.now() - interval '1 day') >= 10 then
    raise exception 'You have created many tournaments today. Please try again tomorrow.' using errcode = '22023';
  end if;

  mt := coalesce(nullif(p->>'match_type', ''), 'limited_overs');
  if mt not in ('limited_overs','box_cricket','two_innings') then raise exception 'Unknown match type.' using errcode = '22023'; end if;
  ov := nullif(p->>'overs_per_innings', '')::int;
  if mt <> 'two_innings' and (ov is null or ov < 1 or ov > 100) then
    raise exception 'Overs per innings must be between 1 and 100.' using errcode = '22023';
  end if;
  pps := coalesce(nullif(p->>'players_per_side', '')::int, 11);
  if pps < 2 or pps > 15 then raise exception 'Players a side must be between 2 and 15.' using errcode = '22023'; end if;
  fmt := coalesce(nullif(pg_catalog.btrim(coalesce(p->>'format', '')), ''),
                  case mt when 'two_innings' then 'Two innings' when 'box_cricket' then ov || ' overs box cricket' else ov || ' overs' end);

  insert into public.tournaments (code, name, format, match_type, overs_per_innings, players_per_side, ball_type, pitch_type, category,
                                  teams_count, matches_total, start_date, end_date, venue, city,
                                  banner_color, organizer_name, entry_fee, prize_pool, penalty_policy, rules_summary, owner_id)
  values (cd, nm, fmt, mt, ov, pps, nullif(p->>'ball_type', ''),
          nullif(pg_catalog.btrim(coalesce(p->>'pitch_type', '')), ''), nullif(pg_catalog.btrim(coalesce(p->>'category', '')), ''),
          tc, 0, (p->>'start_date')::date, (p->>'end_date')::date, pg_catalog.btrim(p->>'venue'),
          nullif(pg_catalog.btrim(coalesce(p->>'city', '')), ''),
          coalesce(nullif(p->>'banner_color', ''), '#059669'),
          coalesce(nullif(pg_catalog.btrim(coalesce(p->>'organizer_name', '')), ''), (select display_name from public.profiles where id = uid)),
          nullif(pg_catalog.btrim(coalesce(p->>'entry_fee', '')), ''), nullif(pg_catalog.btrim(coalesce(p->>'prize_pool', '')), ''),
          coalesce(nullif(p->>'penalty_policy', ''), 'none'), nullif(pg_catalog.btrim(coalesce(p->>'rules_summary', '')), ''), uid)
  returning id into new_id;

  insert into public.user_role_assignments (user_id, role, scope_type, scope_id, granted_by, notes)
  values (uid, 'organiser', 'tournament', new_id, uid, 'Automatic: created the tournament')
  on conflict do nothing;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, 'TOURNAMENT_CREATED', 'tournaments', new_id::text, jsonb_build_object('name', nm, 'code', cd));

  return (select to_jsonb(t) from public.tournaments t where t.id = new_id);
end;
$$;

-- Organiser adds an existing team straight into the tournament (no request needed). The team owner is told.
create or replace function public.organiser_add_team(p_tournament_id uuid, p_team_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare tr record; approved int; tm record;
begin
  perform private.require_tournament_organiser(p_tournament_id);
  select * into tr from public.tournaments where id = p_tournament_id;
  if tr.status in ('completed','cancelled') then raise exception 'This tournament is finished.' using errcode = '22023'; end if;
  select * into tm from public.teams where id = p_team_id;
  if not found then raise exception 'Team not found.' using errcode = '22023'; end if;
  if exists (select 1 from public.tournament_teams where tournament_id = p_tournament_id and team_id = p_team_id and status = 'approved') then
    raise exception '% is already in this tournament.', tm.name using errcode = '22023';
  end if;
  select count(*) into approved from public.tournament_teams where tournament_id = p_tournament_id and status = 'approved';
  if approved >= tr.teams_count then
    raise exception 'The tournament is full (% teams). Increase the number of teams first.', tr.teams_count using errcode = '22023';
  end if;

  insert into public.tournament_teams (tournament_id, team_id, status, requested_by, decided_by, decided_at, note)
  values (p_tournament_id, p_team_id, 'approved', (select auth.uid()), (select auth.uid()), pg_catalog.now(), 'Added by organiser')
  on conflict (tournament_id, team_id) do update
    set status = 'approved', decided_by = excluded.decided_by, decided_at = excluded.decided_at, note = excluded.note;

  if tm.owner_id <> (select auth.uid()) then
    insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
    values (tm.owner_id, 'team_added_to_tournament', tm.name || ' added to ' || tr.name,
            'The organiser added your team to ' || tr.name || '. If this is a mistake you can withdraw from the tournament page.',
            jsonb_build_object('tournament_id', p_tournament_id, 'team_id', p_team_id));
  end if;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'TEAM_ADDED_BY_ORGANISER', 'tournaments', p_tournament_id::text, jsonb_build_object('team_id', p_team_id));
  return jsonb_build_object('team_id', p_team_id, 'status', 'approved');
end;
$$;

-- Organiser creates a new team on the spot (they own it and can add its players) and adds it.
create or replace function public.organiser_create_team(p_tournament_id uuid, p_name text, p_short_name text default null, p_city text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := (select auth.uid()); tr record; approved int; new_id uuid; nm text := pg_catalog.btrim(coalesce(p_name, ''));
begin
  perform private.require_tournament_organiser(p_tournament_id);
  select * into tr from public.tournaments where id = p_tournament_id;
  if tr.status in ('completed','cancelled') then raise exception 'This tournament is finished.' using errcode = '22023'; end if;
  if pg_catalog.length(nm) < 2 then raise exception 'Team name must be at least 2 characters.' using errcode = '22023'; end if;
  select count(*) into approved from public.tournament_teams where tournament_id = p_tournament_id and status = 'approved';
  if approved >= tr.teams_count then
    raise exception 'The tournament is full (% teams). Increase the number of teams first.', tr.teams_count using errcode = '22023';
  end if;
  if (select count(*) from public.teams where owner_id = uid and created_at > pg_catalog.now() - interval '1 day') >= 40 then
    raise exception 'You have created many teams today. Please try again tomorrow.' using errcode = '22023';
  end if;

  insert into public.teams (name, short_name, city, owner_id)
  values (nm, nullif(pg_catalog.upper(pg_catalog.btrim(coalesce(p_short_name, ''))), ''),
          coalesce(nullif(pg_catalog.btrim(coalesce(p_city, '')), ''), tr.city), uid)
  returning id into new_id;
  insert into public.user_role_assignments (user_id, role, scope_type, scope_id, granted_by, notes)
  values (uid, 'team_owner', 'team', new_id, uid, 'Automatic: created the team for a tournament')
  on conflict do nothing;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, 'TEAM_CREATED', 'teams', new_id::text, jsonb_build_object('name', nm, 'tournament_id', p_tournament_id));

  insert into public.tournament_teams (tournament_id, team_id, status, requested_by, decided_by, decided_at, note)
  values (p_tournament_id, new_id, 'approved', uid, uid, pg_catalog.now(), 'Created by organiser');
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, 'TEAM_ADDED_BY_ORGANISER', 'tournaments', p_tournament_id::text, jsonb_build_object('team_id', new_id, 'created', true));
  return jsonb_build_object('team_id', new_id, 'status', 'approved');
end;
$$;

-- Organiser removes a team before its matches start.
create or replace function public.organiser_remove_team(p_tournament_id uuid, p_team_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_tournament_organiser(p_tournament_id);
  if exists (select 1 from public.matches where tournament_id = p_tournament_id and p_team_id in (team_a_id, team_b_id) and status <> 'scheduled') then
    raise exception 'This team has already played. It cannot be removed now.' using errcode = '22023';
  end if;
  update public.tournament_teams set status = 'withdrawn', decided_by = (select auth.uid()), decided_at = pg_catalog.now(), note = 'Removed by organiser'
   where tournament_id = p_tournament_id and team_id = p_team_id and status in ('pending','approved');
  if not found then raise exception 'This team is not in the tournament.' using errcode = '22023'; end if;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'TEAM_REMOVED_BY_ORGANISER', 'tournaments', p_tournament_id::text, jsonb_build_object('team_id', p_team_id));
  return jsonb_build_object('team_id', p_team_id, 'status', 'withdrawn');
end;
$$;

revoke all on function public.organiser_add_team(uuid, uuid) from public, anon;
revoke all on function public.organiser_create_team(uuid, text, text, text) from public, anon;
revoke all on function public.organiser_remove_team(uuid, uuid) from public, anon;
grant execute on function public.organiser_add_team(uuid, uuid) to authenticated;
grant execute on function public.organiser_create_team(uuid, text, text, text) to authenticated;
grant execute on function public.organiser_remove_team(uuid, uuid) to authenticated;
