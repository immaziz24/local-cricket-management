alter table public.tournaments
  add column series_id uuid,
  add column season_number integer not null default 1 check (season_number between 1 and 999);

drop index public.tournaments_name_lower_uidx;
create unique index tournaments_standalone_name_uidx on public.tournaments (lower(name)) where series_id is null;
create unique index tournaments_series_season_uidx on public.tournaments ((coalesce(series_id, id)), season_number);

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
    cd := pg_catalog.regexp_replace(cd, '-S[0-9]+$', '') || '-S' || season;
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
declare season int := nullif(p->>'season_number', '')::int;
begin
  perform private.require_tournament_organiser(p_id);
  if season is not null and season not between 1 and 999 then
    raise exception 'Season must be between 1 and 999.' using errcode = '22023';
  end if;
  update public.tournaments set
    season_number = coalesce(season, season_number),
    code = case when season is null then code else
      pg_catalog.left(pg_catalog.regexp_replace(code, '-[0-9]{2}(-[A-Z0-9]+)?$', ''), 8)
      || '-' || pg_catalog.to_char(coalesce(nullif(p->>'start_date', '')::date, start_date), 'YY')
      || '-S' || season end,
    pitch_type = coalesce(p->>'pitch_type', pitch_type),
    category = coalesce(p->>'category', category),
    name = coalesce(nullif(pg_catalog.btrim(coalesce(p->>'name', '')), ''), name),
    format = coalesce(nullif(p->>'format', ''), format),
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
