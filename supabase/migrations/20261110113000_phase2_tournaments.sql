-- Phase 2 / Category B – Tournaments (first part)
-- #31 Create a tournament, #32 Tournament name and branding, #34 Start and end dates, #35 Location,
-- #36 Tournament registration, #37 Registration fees, #38 Prize money details, #39 Rules and regulations,
-- #40 Team registration, #41 Team approval and rejection.
-- Open platform: anyone can create a tournament and becomes its Organiser (for that tournament only).

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9][A-Z0-9-]{1,15}$'),
  name text not null check (pg_catalog.length(pg_catalog.btrim(name)) between 3 and 100),
  format text not null default 'T20',
  ball_type text,
  status text not null default 'registration' check (status in ('registration','upcoming','ongoing','completed','cancelled')),
  registration_open boolean not null default true,
  teams_count int not null check (teams_count between 2 and 64),
  matches_total int not null default 0 check (matches_total >= 0),
  matches_completed int not null default 0 check (matches_completed >= 0),
  start_date date not null,
  end_date date not null,
  venue text not null check (pg_catalog.length(pg_catalog.btrim(venue)) between 3 and 150),
  city text,
  banner_color text check (banner_color is null or banner_color ~ '^#[0-9A-Fa-f]{6}$'),
  logo_url text,
  banner_url text,
  organizer_name text,
  entry_fee text,
  prize_pool text,
  penalty_policy text check (penalty_policy is null or penalty_policy in ('overs_deduction','fielding_restriction','penalty_runs','none')),
  rules_summary text check (rules_summary is null or pg_catalog.length(rules_summary) <= 5000),
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create unique index if not exists tournaments_name_lower_uidx on public.tournaments (lower(name));
create index if not exists tournaments_owner_idx on public.tournaments (owner_id);
create index if not exists tournaments_start_idx on public.tournaments (start_date desc);

create table if not exists public.tournament_teams (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected','withdrawn')),
  requested_by uuid references auth.users(id) on delete set null,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  note text check (note is null or pg_catalog.length(note) <= 300),
  created_at timestamptz not null default now(),
  primary key (tournament_id, team_id)
);
create index if not exists tournament_teams_team_idx on public.tournament_teams (team_id);
create index if not exists tournament_teams_requested_by_idx on public.tournament_teams (requested_by);
create index if not exists tournament_teams_decided_by_idx on public.tournament_teams (decided_by);

drop trigger if exists tournaments_set_updated_at on public.tournaments;
create trigger tournaments_set_updated_at before update on public.tournaments
for each row execute function private.set_updated_at();

alter table public.tournaments enable row level security;
alter table public.tournament_teams enable row level security;
drop policy if exists tournaments_read on public.tournaments;
create policy tournaments_read on public.tournaments for select to anon, authenticated using (true);
drop policy if exists tournament_teams_read on public.tournament_teams;
create policy tournament_teams_read on public.tournament_teams for select to anon, authenticated using (true);
revoke all on public.tournaments, public.tournament_teams from anon, authenticated;
grant select on public.tournaments, public.tournament_teams to anon, authenticated;
grant all on public.tournaments, public.tournament_teams to service_role;

-- ------------------------------------------------------------------
create or replace function private.require_tournament_organiser(p_tournament_id uuid)
returns void language plpgsql stable security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  if not exists (select 1 from public.tournaments where id = p_tournament_id) then
    raise exception 'Tournament not found.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.tournaments where id = p_tournament_id and owner_id = (select auth.uid()))
     and not exists (select 1 from public.user_role_assignments where user_id = (select auth.uid()) and role = 'organiser'
                     and scope_type = 'tournament' and scope_id = p_tournament_id and is_active)
     and not private.is_admin() then
    raise exception 'Only the tournament organiser can do this.' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where id = (select auth.uid()) and account_status in ('suspended','disabled')) then
    raise exception 'Your account is suspended.' using errcode = '42501';
  end if;
end;
$$;
revoke all on function private.require_tournament_organiser(uuid) from public, anon, authenticated;

-- #31 Create a tournament (payload = the fields of the Create Tournament form)
create or replace function public.create_tournament(p jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := (select auth.uid()); new_id uuid; nm text := pg_catalog.btrim(coalesce(p->>'name', ''));
  cd text := pg_catalog.upper(pg_catalog.btrim(coalesce(p->>'code', ''))); tc int;
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
  if pg_catalog.length(pg_catalog.btrim(coalesce(p->>'venue', ''))) < 3 then raise exception 'Venue is required (at least 3 characters).' using errcode = '22023'; end if;
  if (select count(*) from public.tournaments where owner_id = uid and created_at > pg_catalog.now() - interval '1 day') >= 10 then
    raise exception 'You have created many tournaments today. Please try again tomorrow.' using errcode = '22023';
  end if;

  insert into public.tournaments (code, name, format, ball_type, teams_count, matches_total, start_date, end_date, venue, city,
                                  banner_color, organizer_name, entry_fee, prize_pool, penalty_policy, rules_summary, owner_id)
  values (cd, nm, coalesce(nullif(p->>'format', ''), 'T20'), nullif(p->>'ball_type', ''), tc,
          coalesce(nullif(p->>'matches_total', '')::int, greatest(1, tc - 1)),
          (p->>'start_date')::date, (p->>'end_date')::date, pg_catalog.btrim(p->>'venue'), nullif(pg_catalog.btrim(coalesce(p->>'city', '')), ''),
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

-- #32–#39 Edit tournament details (organiser)
create or replace function public.update_tournament(p_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_tournament_organiser(p_id);
  update public.tournaments set
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

-- #40 A team owner asks to enter their team.
create or replace function public.register_team_for_tournament(p_tournament_id uuid, p_team_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare tr record; approved int; existing text;
begin
  perform private.require_team_owner(p_team_id);
  select * into tr from public.tournaments where id = p_tournament_id;
  if not found then raise exception 'Tournament not found.' using errcode = '22023'; end if;
  if not tr.registration_open or tr.status not in ('registration','upcoming') then
    raise exception 'Registration for this tournament is closed.' using errcode = '22023';
  end if;
  select count(*) into approved from public.tournament_teams where tournament_id = p_tournament_id and status = 'approved';
  if approved >= tr.teams_count then raise exception 'This tournament is already full.' using errcode = '22023'; end if;
  select status into existing from public.tournament_teams where tournament_id = p_tournament_id and team_id = p_team_id;
  if existing in ('pending','approved') then
    raise exception 'This team has already applied.' using errcode = '22023';
  end if;

  insert into public.tournament_teams (tournament_id, team_id, status, requested_by)
  values (p_tournament_id, p_team_id, 'pending', (select auth.uid()))
  on conflict (tournament_id, team_id) do update
    set status = 'pending', requested_by = excluded.requested_by, decided_by = null, decided_at = null, note = null, created_at = pg_catalog.now();

  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  values (tr.owner_id, 'team_registration', 'New team registration',
          (select name from public.teams where id = p_team_id) || ' wants to join ' || tr.name || '.',
          jsonb_build_object('tournament_id', p_tournament_id, 'team_id', p_team_id));
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'TEAM_REGISTERED', 'tournaments', p_tournament_id::text, jsonb_build_object('team_id', p_team_id));
  return jsonb_build_object('status', 'pending');
end;
$$;

-- #41 Organiser approves or rejects a team.
create or replace function public.decide_team_registration(p_tournament_id uuid, p_team_id uuid, p_approve boolean, p_note text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare tr record; approved int; owner uuid; tname text;
begin
  perform private.require_tournament_organiser(p_tournament_id);
  select * into tr from public.tournaments where id = p_tournament_id;
  if not exists (select 1 from public.tournament_teams where tournament_id = p_tournament_id and team_id = p_team_id and status = 'pending') then
    raise exception 'No pending registration for this team.' using errcode = '22023';
  end if;
  if p_approve then
    select count(*) into approved from public.tournament_teams where tournament_id = p_tournament_id and status = 'approved';
    if approved >= tr.teams_count then raise exception 'The tournament is full (% teams). Increase the number of teams first.', tr.teams_count using errcode = '22023'; end if;
  elsif nullif(pg_catalog.btrim(coalesce(p_note, '')), '') is null then
    raise exception 'Please give a reason when rejecting.' using errcode = '22023';
  end if;

  update public.tournament_teams
     set status = case when p_approve then 'approved' else 'rejected' end,
         decided_by = (select auth.uid()), decided_at = pg_catalog.now(),
         note = nullif(pg_catalog.btrim(coalesce(p_note, '')), '')
   where tournament_id = p_tournament_id and team_id = p_team_id;

  select owner_id, name into owner, tname from public.teams where id = p_team_id;
  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  values (owner, 'team_registration_' || case when p_approve then 'approved' else 'rejected' end,
          case when p_approve then tname || ' is in ' || tr.name || '!' else tname || ' was not accepted for ' || tr.name end,
          case when p_approve then 'Your team registration was approved.' else 'Reason: ' || p_note end,
          jsonb_build_object('tournament_id', p_tournament_id, 'team_id', p_team_id));
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), case when p_approve then 'TEAM_APPROVED' else 'TEAM_REJECTED' end, 'tournaments', p_tournament_id::text,
          jsonb_build_object('team_id', p_team_id, 'note', p_note));
  return jsonb_build_object('status', case when p_approve then 'approved' else 'rejected' end);
end;
$$;

-- Team owner withdraws (pending or approved, before the tournament starts).
create or replace function public.withdraw_team_from_tournament(p_tournament_id uuid, p_team_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_team_owner(p_team_id);
  update public.tournament_teams set status = 'withdrawn', decided_at = pg_catalog.now()
   where tournament_id = p_tournament_id and team_id = p_team_id and status in ('pending','approved');
  if not found then raise exception 'This team is not registered.' using errcode = '22023'; end if;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'TEAM_WITHDRAWN', 'tournaments', p_tournament_id::text, jsonb_build_object('team_id', p_team_id));
  return jsonb_build_object('status', 'withdrawn');
end;
$$;

-- Tournament page: registrations with team details (public), plus who is viewing.
create or replace function public.get_tournament_registrations(p_tournament_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare viewer uuid := (select auth.uid());
begin
  return jsonb_build_object(
    'is_organiser', viewer is not null and (
        exists (select 1 from public.tournaments where id = p_tournament_id and owner_id = viewer)
        or exists (select 1 from public.user_role_assignments where user_id = viewer and role = 'organiser'
                   and scope_type = 'tournament' and scope_id = p_tournament_id and is_active)),
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

revoke all on function public.create_tournament(jsonb) from public, anon;
revoke all on function public.update_tournament(uuid, jsonb) from public, anon;
revoke all on function public.register_team_for_tournament(uuid, uuid) from public, anon;
revoke all on function public.decide_team_registration(uuid, uuid, boolean, text) from public, anon;
revoke all on function public.withdraw_team_from_tournament(uuid, uuid) from public, anon;
revoke all on function public.get_tournament_registrations(uuid) from public;
grant execute on function public.create_tournament(jsonb) to authenticated;
grant execute on function public.update_tournament(uuid, jsonb) to authenticated;
grant execute on function public.register_team_for_tournament(uuid, uuid) to authenticated;
grant execute on function public.decide_team_registration(uuid, uuid, boolean, text) to authenticated;
grant execute on function public.withdraw_team_from_tournament(uuid, uuid) to authenticated;
grant execute on function public.get_tournament_registrations(uuid) to anon, authenticated;
