-- Phase 2 / Category B – structure and schedule
-- #42 Group creation, #43 League, #44 Knockout (first round), #45 Round-robin, #47 Custom formats,
-- #48 Automatic fixture generation, #49 Manual fixture creation, #50 Match scheduling,
-- #51 Match rescheduling, #52 Tournament calendar.
-- The matches table is shared with Phase 3 (scoring); result columns are filled later.

alter table public.tournaments add column if not exists structure text not null default 'league'
  check (structure in ('league','round_robin','double_round_robin','knockout','groups_knockout','custom'));

create table if not exists public.tournament_groups (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  name text not null check (pg_catalog.length(name) between 1 and 30),
  sort_order int not null default 0,
  unique (tournament_id, name)
);
create index if not exists tournament_groups_tournament_idx on public.tournament_groups (tournament_id);

alter table public.tournament_teams add column if not exists group_id uuid references public.tournament_groups(id) on delete set null;
create index if not exists tournament_teams_group_idx on public.tournament_teams (group_id);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments(id) on delete cascade,
  group_id uuid references public.tournament_groups(id) on delete set null,
  stage text not null default 'league' check (stage in ('league','group','knockout','quarter_final','semi_final','final','third_place','friendly')),
  round_no int,
  match_no int,
  team_a_id uuid references public.teams(id) on delete set null,
  team_b_id uuid references public.teams(id) on delete set null,
  scheduled_at timestamptz,
  venue text check (venue is null or pg_catalog.length(venue) <= 150),
  status text not null default 'scheduled' check (status in ('scheduled','live','completed','abandoned','cancelled')),
  -- results (filled by scoring in Phase 3 or by manual result entry)
  winner_team_id uuid references public.teams(id) on delete set null,
  result_type text check (result_type is null or result_type in ('win','tie','no_result','walkover')),
  team_a_runs int, team_a_wickets int, team_a_balls int,
  team_b_runs int, team_b_wickets int, team_b_balls int,
  result_summary text,
  notes text check (notes is null or pg_catalog.length(notes) <= 500),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (team_a_id is null or team_b_id is null or team_a_id <> team_b_id)
);
create index if not exists matches_tournament_idx on public.matches (tournament_id, scheduled_at);
create index if not exists matches_group_idx on public.matches (group_id);
create index if not exists matches_team_a_idx on public.matches (team_a_id);
create index if not exists matches_team_b_idx on public.matches (team_b_id);
create index if not exists matches_winner_idx on public.matches (winner_team_id);
create index if not exists matches_created_by_idx on public.matches (created_by);

drop trigger if exists matches_set_updated_at on public.matches;
create trigger matches_set_updated_at before update on public.matches
for each row execute function private.set_updated_at();

alter table public.tournament_groups enable row level security;
alter table public.matches enable row level security;
drop policy if exists tournament_groups_read on public.tournament_groups;
create policy tournament_groups_read on public.tournament_groups for select to anon, authenticated using (true);
drop policy if exists matches_read on public.matches;
create policy matches_read on public.matches for select to anon, authenticated using (true);
revoke all on public.tournament_groups, public.matches from anon, authenticated;
grant select on public.tournament_groups, public.matches to anon, authenticated;
grant all on public.tournament_groups, public.matches to service_role;

-- ------------------------------------------------------------------
-- #42 Groups: create N groups and spread approved teams (random order).
create or replace function public.create_tournament_groups(p_tournament_id uuid, p_group_count int)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare i int; gids uuid[] := '{}'; gid uuid; r record; n int := 0;
begin
  perform private.require_tournament_organiser(p_tournament_id);
  if p_group_count < 1 or p_group_count > 8 then raise exception 'Choose between 1 and 8 groups.' using errcode = '22023'; end if;
  if exists (select 1 from public.matches where tournament_id = p_tournament_id and status <> 'scheduled') then
    raise exception 'Matches have already been played; groups can no longer change.' using errcode = '22023';
  end if;
  update public.tournament_teams set group_id = null where tournament_id = p_tournament_id;
  delete from public.tournament_groups where tournament_id = p_tournament_id;
  for i in 1..p_group_count loop
    insert into public.tournament_groups (tournament_id, name, sort_order)
    values (p_tournament_id, 'Group ' || pg_catalog.chr(64 + i), i) returning id into gid;
    gids := gids || gid;
  end loop;
  for r in select team_id from public.tournament_teams where tournament_id = p_tournament_id and status = 'approved' order by pg_catalog.random() loop
    update public.tournament_teams set group_id = gids[(n % p_group_count) + 1] where tournament_id = p_tournament_id and team_id = r.team_id;
    n := n + 1;
  end loop;
  update public.tournaments set structure = case when p_group_count > 1 then 'groups_knockout' else structure end where id = p_tournament_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'GROUPS_CREATED', 'tournaments', p_tournament_id::text, jsonb_build_object('groups', p_group_count, 'teams', n));
  return jsonb_build_object('groups', p_group_count, 'teams', n);
end;
$$;

-- Move a team to another group.
create or replace function public.set_team_group(p_tournament_id uuid, p_team_id uuid, p_group_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_tournament_organiser(p_tournament_id);
  if p_group_id is not null and not exists (select 1 from public.tournament_groups where id = p_group_id and tournament_id = p_tournament_id) then
    raise exception 'Group not found.' using errcode = '22023';
  end if;
  update public.tournament_teams set group_id = p_group_id where tournament_id = p_tournament_id and team_id = p_team_id and status = 'approved';
  if not found then raise exception 'Only approved teams can be placed in a group.' using errcode = '22023'; end if;
  return jsonb_build_object('team_id', p_team_id, 'group_id', p_group_id);
end;
$$;

-- Set the tournament structure (#43–#47).
create or replace function public.set_tournament_structure(p_tournament_id uuid, p_structure text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_tournament_organiser(p_tournament_id);
  update public.tournaments set structure = p_structure where id = p_tournament_id;
  return jsonb_build_object('structure', p_structure);
end;
$$;

-- #48 Save fixtures generated by the website (round-robin / knockout pairings + schedule).
-- p_fixtures: [{team_a_id, team_b_id, stage, group_id, round_no, scheduled_at, venue}]
-- p_replace = true removes not-yet-played generated matches first.
create or replace function public.save_generated_fixtures(p_tournament_id uuid, p_fixtures jsonb, p_replace boolean default true)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare f jsonb; n int := 0; next_no int; a uuid; b uuid;
begin
  perform private.require_tournament_organiser(p_tournament_id);
  if jsonb_typeof(p_fixtures) <> 'array' or jsonb_array_length(p_fixtures) = 0 then
    raise exception 'No fixtures to save.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_fixtures) > 500 then raise exception 'Too many fixtures.' using errcode = '22023'; end if;
  if p_replace then
    delete from public.matches where tournament_id = p_tournament_id and status = 'scheduled';
  end if;
  select coalesce(max(match_no), 0) into next_no from public.matches where tournament_id = p_tournament_id;

  for f in select * from jsonb_array_elements(p_fixtures) loop
    a := nullif(f->>'team_a_id', '')::uuid; b := nullif(f->>'team_b_id', '')::uuid;
    if (a is not null and not exists (select 1 from public.tournament_teams where tournament_id = p_tournament_id and team_id = a and status = 'approved'))
       or (b is not null and not exists (select 1 from public.tournament_teams where tournament_id = p_tournament_id and team_id = b and status = 'approved')) then
      raise exception 'Fixtures can only use approved teams of this tournament.' using errcode = '22023';
    end if;
    next_no := next_no + 1;
    insert into public.matches (tournament_id, group_id, stage, round_no, match_no, team_a_id, team_b_id, scheduled_at, venue, created_by)
    values (p_tournament_id, nullif(f->>'group_id', '')::uuid, coalesce(nullif(f->>'stage', ''), 'league'),
            nullif(f->>'round_no', '')::int, next_no, a, b, nullif(f->>'scheduled_at', '')::timestamptz,
            coalesce(nullif(f->>'venue', ''), (select venue from public.tournaments where id = p_tournament_id)), (select auth.uid()));
    n := n + 1;
  end loop;

  update public.tournaments set matches_total = (select count(*) from public.matches where tournament_id = p_tournament_id),
         status = case when status = 'registration' then 'upcoming' else status end
   where id = p_tournament_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'FIXTURES_GENERATED', 'tournaments', p_tournament_id::text, jsonb_build_object('matches', n));
  return jsonb_build_object('matches', n);
end;
$$;

-- #49 Add one match by hand.
create or replace function public.create_match(p_tournament_id uuid, p_team_a uuid, p_team_b uuid, p_scheduled_at timestamptz,
                                               p_venue text default null, p_stage text default 'league', p_group_id uuid default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  if p_team_a is not null and p_team_a = p_team_b then raise exception 'Choose two different teams.' using errcode = '22023'; end if;
  return public.save_generated_fixtures(p_tournament_id,
    jsonb_build_array(jsonb_build_object('team_a_id', p_team_a, 'team_b_id', p_team_b, 'scheduled_at', p_scheduled_at,
                                         'venue', p_venue, 'stage', p_stage, 'group_id', p_group_id)), false);
end;
$$;

-- #51 Reschedule (notifies both team owners).
create or replace function public.reschedule_match(p_match_id uuid, p_scheduled_at timestamptz, p_venue text default null, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare m record; tname text;
begin
  select * into m from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found.' using errcode = '22023'; end if;
  perform private.require_tournament_organiser(m.tournament_id);
  if m.status not in ('scheduled') then raise exception 'Only matches that have not started can be rescheduled.' using errcode = '22023'; end if;
  update public.matches set scheduled_at = p_scheduled_at, venue = coalesce(nullif(pg_catalog.btrim(coalesce(p_venue, '')), ''), venue),
         notes = coalesce(nullif(pg_catalog.btrim(coalesce(p_reason, '')), ''), notes)
   where id = p_match_id;
  select name into tname from public.tournaments where id = m.tournament_id;
  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  select distinct t.owner_id, 'match_rescheduled', 'Match rescheduled',
         (select name from public.teams where id = m.team_a_id) || ' vs ' || (select name from public.teams where id = m.team_b_id)
         || ' (' || tname || ') is now on ' || pg_catalog.to_char(p_scheduled_at at time zone 'Asia/Kolkata', 'DD Mon YYYY, HH12:MI AM')
         || coalesce('. Reason: ' || nullif(pg_catalog.btrim(coalesce(p_reason, '')), ''), ''),
         jsonb_build_object('match_id', p_match_id)
    from public.teams t where t.id in (m.team_a_id, m.team_b_id);
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'MATCH_RESCHEDULED', 'tournaments', m.tournament_id::text,
          jsonb_build_object('match_id', p_match_id, 'from', m.scheduled_at, 'to', p_scheduled_at, 'reason', p_reason));
  return jsonb_build_object('id', p_match_id);
end;
$$;

-- Remove a match that has not started.
create or replace function public.delete_match(p_match_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare m record;
begin
  select * into m from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found.' using errcode = '22023'; end if;
  perform private.require_tournament_organiser(m.tournament_id);
  if m.status <> 'scheduled' then raise exception 'Only matches that have not started can be deleted.' using errcode = '22023'; end if;
  delete from public.matches where id = p_match_id;
  update public.tournaments set matches_total = (select count(*) from public.matches where tournament_id = m.tournament_id) where id = m.tournament_id;
  return jsonb_build_object('deleted', true);
end;
$$;

revoke all on function public.create_tournament_groups(uuid, int) from public, anon;
revoke all on function public.set_team_group(uuid, uuid, uuid) from public, anon;
revoke all on function public.set_tournament_structure(uuid, text) from public, anon;
revoke all on function public.save_generated_fixtures(uuid, jsonb, boolean) from public, anon;
revoke all on function public.create_match(uuid, uuid, uuid, timestamptz, text, text, uuid) from public, anon;
revoke all on function public.reschedule_match(uuid, timestamptz, text, text) from public, anon;
revoke all on function public.delete_match(uuid) from public, anon;
grant execute on function public.create_tournament_groups(uuid, int) to authenticated;
grant execute on function public.set_team_group(uuid, uuid, uuid) to authenticated;
grant execute on function public.set_tournament_structure(uuid, text) to authenticated;
grant execute on function public.save_generated_fixtures(uuid, jsonb, boolean) to authenticated;
grant execute on function public.create_match(uuid, uuid, uuid, timestamptz, text, text, uuid) to authenticated;
grant execute on function public.reschedule_match(uuid, timestamptz, text, text) to authenticated;
grant execute on function public.delete_match(uuid) to authenticated;
