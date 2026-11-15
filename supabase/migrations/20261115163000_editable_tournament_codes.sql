create or replace function public.create_tournament(p jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := (select auth.uid()); new_id uuid; nm text := pg_catalog.btrim(coalesce(p->>'name', ''));
  cd text := pg_catalog.upper(pg_catalog.btrim(coalesce(p->>'code', ''))); tc int; ov int; mt text; pps int; fmt text;
  prior public.tournaments%rowtype;
  series uuid;
  season int := coalesce(nullif(p->>'season_number', '')::int, 1);
begin
  if uid is null then raise exception 'Please sign in to create a tournament.' using errcode = '42501'; end if;
  if exists (select 1 from public.profiles where id = uid and account_status in ('suspended','disabled')) then
    raise exception 'Your account is suspended.' using errcode = '42501';
  end if;
  if pg_catalog.length(nm) < 3 then raise exception 'Tournament name must be at least 3 characters long.' using errcode = '22023'; end if;
  if cd !~ '^[A-Z0-9][A-Z0-9-]{1,15}$' then
    raise exception 'Tournament code must be 2–16 letters, numbers or dashes (e.g. TPL-26).' using errcode = '22023';
  end if;
  if nullif(p->>'previous_tournament_id', '') is not null then
    perform private.require_tournament_organiser((p->>'previous_tournament_id')::uuid);
    select * into strict prior from public.tournaments where id = (p->>'previous_tournament_id')::uuid;
    series := coalesce(prior.series_id, prior.id);
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(series::text, 0));
    select coalesce(max(season_number), 1) + 1 into season
    from public.tournaments where id = series or series_id = series;
    if not coalesce((p->>'custom_code')::boolean, false) then
      cd := pg_catalog.regexp_replace(cd, '-S[0-9]+$', '') || '-S' || season;
    else
      season := coalesce(substring(cd from '-S([0-9]{1,3})$')::int, season);
    end if;
  else
    season := coalesce(substring(cd from '-S([0-9]{1,3})$')::int, season);
  end if;
  if season not between 1 and 999 then
    raise exception 'Season must be between 1 and 999.' using errcode = '22023';
  end if;
  if series is null and exists (select 1 from public.tournaments where lower(name) = lower(nm)) then
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
                                  banner_color, organizer_name, entry_fee, prize_pool, penalty_policy, rules_summary, owner_id, series_id, season_number)
  values (cd, nm, fmt, mt, ov, pps, nullif(p->>'ball_type', ''),
          nullif(pg_catalog.btrim(coalesce(p->>'pitch_type', '')), ''), nullif(pg_catalog.btrim(coalesce(p->>'category', '')), ''),
          tc, 0, (p->>'start_date')::date, (p->>'end_date')::date, pg_catalog.btrim(p->>'venue'),
          nullif(pg_catalog.btrim(coalesce(p->>'city', '')), ''),
          coalesce(nullif(p->>'banner_color', ''), '#059669'),
          coalesce(nullif(pg_catalog.btrim(coalesce(p->>'organizer_name', '')), ''), (select display_name from public.profiles where id = uid)),
          nullif(pg_catalog.btrim(coalesce(p->>'entry_fee', '')), ''), nullif(pg_catalog.btrim(coalesce(p->>'prize_pool', '')), ''),
          coalesce(nullif(p->>'penalty_policy', ''), 'none'), nullif(pg_catalog.btrim(coalesce(p->>'rules_summary', '')), ''), uid, series, season)
  returning id into new_id;

  insert into public.user_role_assignments (user_id, role, scope_type, scope_id, granted_by, notes)
  values (uid, 'organiser', 'tournament', new_id, uid, 'Automatic: created the tournament')
  on conflict do nothing;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, 'TOURNAMENT_CREATED', 'tournaments', new_id::text, jsonb_build_object('name', nm, 'code', cd));

  return (select to_jsonb(t) from public.tournaments t where t.id = new_id);
end;
$$;

create or replace function public.update_tournament(p_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  new_code text := nullif(pg_catalog.upper(pg_catalog.btrim(p->>'code')), '');
  code_season int;
  match_kind text := nullif(p->>'match_type', '');
  overs int := nullif(p->>'overs_per_innings', '')::int;
  side_size int := nullif(p->>'players_per_side', '')::int;
begin
  perform private.require_tournament_organiser(p_id);
  if new_code is not null and new_code !~ '^[A-Z0-9][A-Z0-9-]{1,15}$' then
    raise exception 'Use 2–16 letters, numbers or dashes for the short code.' using errcode = '22023';
  end if;
  code_season := nullif(substring(new_code from '-S([0-9]{1,3})$')::int, 0);
  if match_kind is not null and (match_kind not in ('limited_overs','box_cricket','two_innings')
     or side_size is null or side_size not between 2 and 15
     or (match_kind <> 'two_innings' and (overs is null or overs not between 1 and 100))) then
    raise exception 'Check the match type, overs and players per side.' using errcode = '22023';
  end if;
  perform 1 from public.tournaments where id = p_id for update;
  if coalesce(nullif(p->>'teams_count','')::int, 64) <
     (select count(*) from public.tournament_teams where tournament_id = p_id and status = 'approved') then
    raise exception 'Team slots cannot be lower than the number of approved teams.' using errcode = '22023';
  end if;
  update public.tournaments set
    season_number = case when new_code is distinct from code then coalesce(code_season, season_number) else season_number end,
    code = coalesce(new_code, code),
    match_type = coalesce(match_kind, match_type),
    overs_per_innings = case when match_kind is null then overs_per_innings when match_kind = 'two_innings' then null else overs end,
    players_per_side = coalesce(side_size, players_per_side),
    pitch_type = coalesce(p->>'pitch_type', pitch_type),
    category = coalesce(p->>'category', category),
    name = coalesce(nullif(pg_catalog.btrim(coalesce(p->>'name', '')), ''), name),
    format = case match_kind when 'two_innings' then 'Two innings' when 'box_cricket' then overs || ' overs box cricket' when 'limited_overs' then overs || ' overs' else coalesce(nullif(p->>'format', ''), format) end,
    ball_type = coalesce(p->>'ball_type', ball_type),
    teams_count = coalesce(nullif(p->>'teams_count', '')::int, teams_count),
    start_date = coalesce(nullif(p->>'start_date', '')::date, start_date),
    end_date = coalesce(nullif(p->>'end_date', '')::date, end_date),
    venue = coalesce(nullif(pg_catalog.btrim(coalesce(p->>'venue', '')), ''), venue),
    city = coalesce(p->>'city', city),
    banner_color = coalesce(nullif(p->>'banner_color', ''), banner_color),
    organizer_name = coalesce(p->>'organizer_name', organizer_name),
    entry_fee = coalesce(p->>'entry_fee', entry_fee),
    prize_pool = coalesce(p->>'prize_pool', prize_pool),
    penalty_policy = coalesce(nullif(p->>'penalty_policy', ''), penalty_policy),
    rules_summary = coalesce(p->>'rules_summary', rules_summary),
    registration_open = coalesce((p->>'registration_open')::boolean, registration_open),
    status = coalesce(nullif(p->>'status', ''), status)
  where id = p_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'TOURNAMENT_UPDATED', 'tournaments', p_id::text, p);
  return (select to_jsonb(t) from public.tournaments t where t.id = p_id);
end;
$$;
