-- Phase 2 / Category C – Players and teams
-- #59 Player registration, #60 Player profile, #63 Batting style, #64 Bowling style, #65 Player role,
-- #68 Team profile, #70 Captain and vice-captain, #71 Squad management (+ icon player).
--
-- Rules (open platform, blueprint 6a):
-- * Anyone can create a team and becomes its Team Owner.
-- * Team owners add players by 10-digit mobile number. If the number belongs to a known player,
--   that player is added; otherwise the owner types a name and an unregistered player is created.
-- * When someone registers with that mobile number later, the player record is linked to their
--   account automatically, so their teams and stats become theirs.
-- * Mobile numbers are never readable by other users; lookup is exact-match only and rate-limited.

-- ------------------------------------------------------------------
-- Tables
-- ------------------------------------------------------------------
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references auth.users(id) on delete set null,
  display_name text not null check (pg_catalog.length(pg_catalog.btrim(display_name)) between 2 and 80),
  mobile_number text unique check (mobile_number is null or mobile_number ~ '^[6-9][0-9]{9}$'),
  photo_url text,
  player_role text check (player_role is null or player_role in ('batter','bowler','all_rounder','wicket_keeper')),
  batting_style text check (batting_style is null or batting_style in ('right_hand','left_hand')),
  bowling_style text check (bowling_style is null or bowling_style in (
    'right_arm_fast','right_arm_medium','right_arm_off_spin','right_arm_leg_spin',
    'left_arm_fast','left_arm_medium','left_arm_orthodox','left_arm_chinaman','none')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists players_created_by_idx on public.players (created_by);
create index if not exists players_name_idx on public.players (lower(display_name));

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (pg_catalog.length(pg_catalog.btrim(name)) between 2 and 60),
  short_name text check (short_name is null or pg_catalog.length(short_name) between 2 and 6),
  city text check (city is null or pg_catalog.length(city) <= 60),
  logo_url text,
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists teams_owner_idx on public.teams (owner_id);
create index if not exists teams_name_idx on public.teams (lower(name));

create table if not exists public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  is_captain boolean not null default false,
  is_vice_captain boolean not null default false,
  is_icon boolean not null default false,
  jersey_number int check (jersey_number is null or jersey_number between 0 and 999),
  added_by uuid references auth.users(id) on delete set null,
  joined_at timestamptz not null default now(),
  primary key (team_id, player_id),
  check (not (is_captain and is_vice_captain))
);
create index if not exists team_members_player_idx on public.team_members (player_id);
create index if not exists team_members_added_by_idx on public.team_members (added_by);
create unique index if not exists team_members_one_captain_uidx on public.team_members (team_id) where is_captain;
create unique index if not exists team_members_one_vice_uidx on public.team_members (team_id) where is_vice_captain;

-- Rate-limit log for mobile lookups (private).
create table if not exists private.mobile_lookups (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  looked_up_at timestamptz not null default now()
);
create index if not exists mobile_lookups_user_time_idx on private.mobile_lookups (user_id, looked_up_at desc);

drop trigger if exists players_set_updated_at on public.players;
create trigger players_set_updated_at before update on public.players
for each row execute function private.set_updated_at();
drop trigger if exists teams_set_updated_at on public.teams;
create trigger teams_set_updated_at before update on public.teams
for each row execute function private.set_updated_at();

-- ------------------------------------------------------------------
-- Row level security: everyone may read teams/squads/player names; mobile numbers stay hidden.
-- All changes go through the functions below.
-- ------------------------------------------------------------------
alter table public.players enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;

drop policy if exists players_read on public.players;
create policy players_read on public.players for select to anon, authenticated using (true);
drop policy if exists teams_read on public.teams;
create policy teams_read on public.teams for select to anon, authenticated using (true);
drop policy if exists team_members_read on public.team_members;
create policy team_members_read on public.team_members for select to anon, authenticated using (true);

revoke all on public.players, public.teams, public.team_members from anon, authenticated;
grant select (id, profile_id, display_name, photo_url, player_role, batting_style, bowling_style, created_at)
  on public.players to anon, authenticated;
grant select on public.teams to anon, authenticated;
grant select on public.team_members to anon, authenticated;
grant all on public.players, public.teams, public.team_members to service_role;

-- ------------------------------------------------------------------
-- Helpers
-- ------------------------------------------------------------------
create or replace function private.clean_mobile(p text)
returns text language sql immutable set search_path = ''
as $$
  select case when pg_catalog.length(d) >= 10 and pg_catalog.right(d, 10) ~ '^[6-9][0-9]{9}$'
              then pg_catalog.right(d, 10) else null end
  from (select pg_catalog.regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') as d) x;
$$;

create or replace function private.require_team_owner(p_team_id uuid)
returns void language plpgsql stable security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Please sign in first.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.teams where id = p_team_id) then
    raise exception 'Team not found.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.teams where id = p_team_id and owner_id = (select auth.uid()))
     and not private.is_admin() then
    raise exception 'Only the team owner can change this team.' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where id = (select auth.uid()) and account_status in ('suspended','disabled')) then
    raise exception 'Your account is suspended.' using errcode = '42501';
  end if;
end;
$$;
revoke all on function private.require_team_owner(uuid) from public, anon, authenticated;

-- ------------------------------------------------------------------
-- Sign-up: create or claim the player record by mobile number.
-- ------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_mobile text := private.clean_mobile(new.raw_user_meta_data ->> 'mobile_number');
  name text := nullif(coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name'), '');
begin
  insert into public.profiles (id, display_name, mobile_number)
  values (new.id, name, clean_mobile)
  on conflict (id) do nothing;

  insert into public.user_role_assignments (user_id, role, scope_type, notes)
  values (new.id, 'player', 'global', 'Automatic: every registered user is a player')
  on conflict do nothing;

  -- Claim an unregistered player added earlier with the same mobile number, or create one.
  if clean_mobile is not null and exists (
       select 1 from public.players where mobile_number = clean_mobile and profile_id is null) then
    update public.players set profile_id = new.id
     where mobile_number = clean_mobile and profile_id is null;
  elsif not exists (select 1 from public.players where profile_id = new.id) then
    insert into public.players (profile_id, display_name, mobile_number, created_by)
    values (new.id, coalesce(name, 'Player'),
            case when exists (select 1 from public.players where mobile_number = clean_mobile) then null else clean_mobile end,
            new.id);
  end if;

  return new;
end;
$$;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

-- Existing accounts get a player record.
insert into public.players (profile_id, display_name, mobile_number, created_by)
select p.id, coalesce(p.display_name, 'Player'), p.mobile_number, p.id
from public.profiles p
where not exists (select 1 from public.players pl where pl.profile_id = p.id)
on conflict do nothing;

-- ------------------------------------------------------------------
-- Functions used by the website
-- ------------------------------------------------------------------

-- My own player record (creates one if missing).
create or replace function public.get_my_player()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := (select auth.uid()); rec record;
begin
  if uid is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  select * into rec from public.players where profile_id = uid;
  if not found then
    insert into public.players (profile_id, display_name, created_by)
    values (uid, coalesce((select display_name from public.profiles where id = uid), 'Player'), uid)
    returning * into rec;
  end if;
  return jsonb_build_object('id', rec.id, 'display_name', rec.display_name, 'mobile_number', rec.mobile_number,
    'player_role', rec.player_role, 'batting_style', rec.batting_style, 'bowling_style', rec.bowling_style, 'photo_url', rec.photo_url);
end;
$$;

-- Update my playing details (#63–#65).
create or replace function public.update_my_player(p_player_role text, p_batting_style text, p_bowling_style text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  perform public.get_my_player();
  update public.players
     set player_role = nullif(p_player_role, ''), batting_style = nullif(p_batting_style, ''), bowling_style = nullif(p_bowling_style, '')
   where profile_id = uid;
  return public.get_my_player();
end;
$$;

-- Create a team (#68). Caller becomes Team Owner.
create or replace function public.create_team(p_name text, p_short_name text default null, p_city text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := (select auth.uid()); new_id uuid; me jsonb;
begin
  if uid is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  if exists (select 1 from public.profiles where id = uid and account_status in ('suspended','disabled')) then
    raise exception 'Your account is suspended.' using errcode = '42501';
  end if;
  if (select count(*) from public.teams where owner_id = uid and created_at > pg_catalog.now() - interval '1 day') >= 20 then
    raise exception 'You have created many teams today. Please try again tomorrow.' using errcode = '22023';
  end if;

  insert into public.teams (name, short_name, city, owner_id)
  values (pg_catalog.btrim(p_name), nullif(pg_catalog.upper(pg_catalog.btrim(coalesce(p_short_name, ''))), ''),
          nullif(pg_catalog.btrim(coalesce(p_city, '')), ''), uid)
  returning id into new_id;

  insert into public.user_role_assignments (user_id, role, scope_type, scope_id, granted_by, notes)
  values (uid, 'team_owner', 'team', new_id, uid, 'Automatic: created the team')
  on conflict do nothing;

  -- The owner is added to the squad by default (they can remove themselves).
  me := public.get_my_player();
  insert into public.team_members (team_id, player_id, added_by)
  values (new_id, (me->>'id')::uuid, uid)
  on conflict do nothing;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, 'TEAM_CREATED', 'teams', new_id::text, jsonb_build_object('name', p_name));
  return jsonb_build_object('id', new_id);
end;
$$;

-- Edit team profile (owner).
create or replace function public.update_team(p_team_id uuid, p_name text, p_short_name text, p_city text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_team_owner(p_team_id);
  update public.teams
     set name = pg_catalog.btrim(p_name),
         short_name = nullif(pg_catalog.upper(pg_catalog.btrim(coalesce(p_short_name, ''))), ''),
         city = nullif(pg_catalog.btrim(coalesce(p_city, '')), '')
   where id = p_team_id;
  return jsonb_build_object('id', p_team_id);
end;
$$;

-- Look up a player by full mobile number (team owners adding players).
create or replace function public.find_player_by_mobile(p_mobile text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := (select auth.uid()); m text := private.clean_mobile(p_mobile); rec record;
begin
  if uid is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  if m is null then
    raise exception 'Enter a valid 10-digit Indian mobile number.' using errcode = '22023';
  end if;
  if (select count(*) from private.mobile_lookups where user_id = uid and looked_up_at > pg_catalog.now() - interval '1 hour') >= 60 then
    raise exception 'Too many searches. Please wait a little and try again.' using errcode = '22023';
  end if;
  insert into private.mobile_lookups (user_id) values (uid);

  select pl.id, pl.display_name, pl.photo_url, pl.player_role, (pl.profile_id is not null) as is_registered
    into rec
    from public.players pl
   where pl.mobile_number = m
      or pl.profile_id = (select pr.id from public.profiles pr where pr.mobile_number = m limit 1)
   limit 1;
  if not found then
    return jsonb_build_object('found', false);
  end if;
  return jsonb_build_object('found', true, 'id', rec.id, 'display_name', rec.display_name,
    'photo_url', rec.photo_url, 'player_role', rec.player_role, 'is_registered', rec.is_registered);
end;
$$;

-- Add an existing player to a team (#71).
create or replace function public.add_player_to_team(p_team_id uuid, p_player_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_team_owner(p_team_id);
  if not exists (select 1 from public.players where id = p_player_id) then
    raise exception 'Player not found.' using errcode = '22023';
  end if;
  if exists (select 1 from public.team_members where team_id = p_team_id and player_id = p_player_id) then
    raise exception 'This player is already in the team.' using errcode = '22023';
  end if;
  if (select count(*) from public.team_members where team_id = p_team_id) >= 40 then
    raise exception 'A squad can have at most 40 players.' using errcode = '22023';
  end if;
  insert into public.team_members (team_id, player_id, added_by) values (p_team_id, p_player_id, (select auth.uid()));
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'PLAYER_ADDED_TO_TEAM', 'teams', p_team_id::text, jsonb_build_object('player_id', p_player_id));
  return jsonb_build_object('team_id', p_team_id, 'player_id', p_player_id);
end;
$$;

-- Add a player who is not on the platform yet (#59 manual player registration).
create or replace function public.add_new_player_to_team(
  p_team_id uuid, p_name text, p_mobile text default null,
  p_player_role text default null, p_batting_style text default null, p_bowling_style text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare m text := private.clean_mobile(p_mobile); existing uuid; new_id uuid;
begin
  perform private.require_team_owner(p_team_id);
  if nullif(pg_catalog.btrim(coalesce(p_mobile, '')), '') is not null and m is null then
    raise exception 'Enter a valid 10-digit Indian mobile number, or leave it empty.' using errcode = '22023';
  end if;
  if m is not null then
    select id into existing from public.players where mobile_number = m
      or profile_id = (select pr.id from public.profiles pr where pr.mobile_number = m limit 1) limit 1;
    if existing is not null then
      return public.add_player_to_team(p_team_id, existing) || jsonb_build_object('matched_existing', true);
    end if;
  end if;

  insert into public.players (display_name, mobile_number, player_role, batting_style, bowling_style, created_by)
  values (pg_catalog.btrim(p_name), m, nullif(p_player_role, ''), nullif(p_batting_style, ''), nullif(p_bowling_style, ''), (select auth.uid()))
  returning id into new_id;

  return public.add_player_to_team(p_team_id, new_id) || jsonb_build_object('matched_existing', false);
end;
$$;

-- Remove a player from the squad.
create or replace function public.remove_player_from_team(p_team_id uuid, p_player_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_team_owner(p_team_id);
  delete from public.team_members where team_id = p_team_id and player_id = p_player_id;
  if not found then raise exception 'Player is not in this team.' using errcode = '22023'; end if;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'PLAYER_REMOVED_FROM_TEAM', 'teams', p_team_id::text, jsonb_build_object('player_id', p_player_id));
  return jsonb_build_object('team_id', p_team_id, 'player_id', p_player_id, 'removed', true);
end;
$$;

-- Captain, vice-captain, icon player (#70). Pass null to clear.
create or replace function public.set_team_leadership(p_team_id uuid, p_captain uuid, p_vice_captain uuid, p_icon uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_team_owner(p_team_id);
  if p_captain is not null and p_captain = p_vice_captain then
    raise exception 'Captain and vice-captain must be different players.' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(array[p_captain, p_vice_captain, p_icon]) as x(pid)
    where pid is not null and not exists (select 1 from public.team_members where team_id = p_team_id and player_id = x.pid)
  ) then
    raise exception 'Choose players who are in this team.' using errcode = '22023';
  end if;

  update public.team_members set is_captain = false, is_vice_captain = false, is_icon = false where team_id = p_team_id;
  update public.team_members set is_captain = true where team_id = p_team_id and player_id = p_captain;
  update public.team_members set is_vice_captain = true where team_id = p_team_id and player_id = p_vice_captain;
  update public.team_members set is_icon = true where team_id = p_team_id and player_id = p_icon;

  -- Registered captains get the Captain role for this team.
  update public.user_role_assignments set is_active = false
   where role = 'captain' and scope_type = 'team' and scope_id = p_team_id;
  insert into public.user_role_assignments (user_id, role, scope_type, scope_id, granted_by, notes)
  select pl.profile_id, 'captain', 'team', p_team_id, (select auth.uid()), 'Automatic: chosen as captain'
    from public.players pl where pl.id = p_captain and pl.profile_id is not null
  on conflict (user_id, role, scope_type, coalesce(scope_id, '00000000-0000-0000-0000-000000000000'::uuid))
  do update set is_active = true;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'TEAM_LEADERSHIP_SET', 'teams', p_team_id::text,
          jsonb_build_object('captain', p_captain, 'vice_captain', p_vice_captain, 'icon', p_icon));
  return jsonb_build_object('team_id', p_team_id);
end;
$$;

revoke all on function public.get_my_player() from public, anon;
revoke all on function public.update_my_player(text, text, text) from public, anon;
revoke all on function public.create_team(text, text, text) from public, anon;
revoke all on function public.update_team(uuid, text, text, text) from public, anon;
revoke all on function public.find_player_by_mobile(text) from public, anon;
revoke all on function public.add_player_to_team(uuid, uuid) from public, anon;
revoke all on function public.add_new_player_to_team(uuid, text, text, text, text, text) from public, anon;
revoke all on function public.remove_player_from_team(uuid, uuid) from public, anon;
revoke all on function public.set_team_leadership(uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.get_my_player() to authenticated;
grant execute on function public.update_my_player(text, text, text) to authenticated;
grant execute on function public.create_team(text, text, text) to authenticated;
grant execute on function public.update_team(uuid, text, text, text) to authenticated;
grant execute on function public.find_player_by_mobile(text) to authenticated;
grant execute on function public.add_player_to_team(uuid, uuid) to authenticated;
grant execute on function public.add_new_player_to_team(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.remove_player_from_team(uuid, uuid) to authenticated;
grant execute on function public.set_team_leadership(uuid, uuid, uuid, uuid) to authenticated;
