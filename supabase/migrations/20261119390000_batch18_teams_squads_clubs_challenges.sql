-- Batch 18: #339 team invitations, #340 squad eligibility, #342 availability RSVP, #343 captain lineup approval,
--           #344 club multi-team hierarchy, #367 friendly match challenges.

create or replace function private.my_player_id() returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.players where profile_id = (select auth.uid()) limit 1;
$$;

-- owner, captain or vice-captain (who has an account) of a team
create or replace function private.is_team_leader(p_team uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.teams where id = p_team and owner_id = (select auth.uid()))
      or exists (select 1 from public.team_members tm join public.players p on p.id = tm.player_id
                  where tm.team_id = p_team and (tm.is_captain or tm.is_vice_captain) and p.profile_id = (select auth.uid()));
$$;

-- ------------------------------------------------------------------ #339 invitations
create table if not exists public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  invited_by uuid not null,
  message text check (message is null or char_length(message) <= 300),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create unique index if not exists team_invitations_one_pending on public.team_invitations (team_id, player_id) where status = 'pending';
alter table public.team_invitations enable row level security;
revoke all on public.team_invitations from anon, authenticated;

create or replace function public.list_team_invitations(p_team_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_team_owner(p_team_id);
  return jsonb_build_object('items', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'player_id', i.player_id, 'name', p.display_name, 'status', i.status, 'message', i.message,
            'created_at', i.created_at, 'decided_at', i.decided_at) order by i.created_at desc), '[]'::jsonb)
     from (select * from public.team_invitations where team_id = p_team_id order by created_at desc limit 50) i join public.players p on p.id = i.player_id));
end $$;

create or replace function public.invite_player_to_team(p_team_id uuid, p_player_id uuid, p_message text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare pl public.players%rowtype; t public.teams%rowtype; msg text := nullif(pg_catalog.btrim(coalesce(p_message, '')), '');
begin
  perform private.require_team_owner(p_team_id);
  select * into t from public.teams where id = p_team_id;
  select * into pl from public.players where id = p_player_id;
  if not found then raise exception 'Player not found.' using errcode = '22023'; end if;
  if pl.profile_id is null then raise exception 'This player has no account yet, so they cannot accept an invitation. Add them to the squad directly.' using errcode = '22023'; end if;
  if exists (select 1 from public.team_members where team_id = p_team_id and player_id = p_player_id) then raise exception 'This player is already in the team.' using errcode = '22023'; end if;
  if exists (select 1 from public.team_invitations where team_id = p_team_id and player_id = p_player_id and status = 'pending') then raise exception 'An invitation is already waiting for this player.' using errcode = '22023'; end if;
  if (select count(*) from public.team_members where team_id = p_team_id) >= 40 then raise exception 'A squad can have at most 40 players.' using errcode = '22023'; end if;
  if msg is not null and pg_catalog.length(msg) > 300 then raise exception 'Keep the message under 300 characters.' using errcode = '22023'; end if;
  if (select count(*) from public.team_invitations where invited_by = (select auth.uid()) and created_at > now() - interval '1 day') >= 30 then raise exception 'You have sent many invitations today. Please try again tomorrow.' using errcode = '22023'; end if;
  insert into public.team_invitations (team_id, player_id, invited_by, message) values (p_team_id, p_player_id, (select auth.uid()), msg);
  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  values (pl.profile_id, 'team_invitation', 'Team invitation', t.name || ' invited you to join the team' || coalesce(': ' || msg, '.'), jsonb_build_object('team_id', p_team_id));
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'TEAM_INVITATION_SENT', 'teams', p_team_id::text, jsonb_build_object('player_id', p_player_id));
  return public.list_team_invitations(p_team_id);
end $$;

create or replace function public.cancel_team_invitation(p_invitation_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare i public.team_invitations%rowtype;
begin
  select * into i from public.team_invitations where id = p_invitation_id;
  if not found then raise exception 'Invitation not found.' using errcode = '22023'; end if;
  perform private.require_team_owner(i.team_id);
  if i.status <> 'pending' then raise exception 'This invitation has already been answered.' using errcode = '22023'; end if;
  update public.team_invitations set status = 'cancelled', decided_at = now() where id = i.id;
  return public.list_team_invitations(i.team_id);
end $$;

create or replace function public.my_team_invitations() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  return jsonb_build_object('items', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'team_id', i.team_id, 'team', t.name, 'city', t.city, 'status', i.status, 'message', i.message,
            'created_at', i.created_at) order by i.created_at desc), '[]'::jsonb)
     from public.team_invitations i join public.players p on p.id = i.player_id join public.teams t on t.id = i.team_id
    where p.profile_id = (select auth.uid()) and (i.status = 'pending' or i.decided_at > now() - interval '14 days')));
end $$;

create or replace function public.respond_team_invitation(p_invitation_id uuid, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare i public.team_invitations%rowtype; pl public.players%rowtype; t public.teams%rowtype;
begin
  perform private.require_active_user();
  select * into i from public.team_invitations where id = p_invitation_id for update;
  if not found then raise exception 'Invitation not found.' using errcode = '22023'; end if;
  select * into pl from public.players where id = i.player_id;
  if pl.profile_id is distinct from (select auth.uid()) then raise exception 'This invitation is not for you.' using errcode = '42501'; end if;
  if i.status <> 'pending' then raise exception 'This invitation has already been answered.' using errcode = '22023'; end if;
  select * into t from public.teams where id = i.team_id;
  if coalesce(p_accept, false) then
    if exists (select 1 from public.team_members where team_id = i.team_id and player_id = i.player_id) then raise exception 'You are already in this team.' using errcode = '22023'; end if;
    if (select count(*) from public.team_members where team_id = i.team_id) >= 40 then raise exception 'This squad is full.' using errcode = '22023'; end if;
    insert into public.team_members (team_id, player_id, added_by) values (i.team_id, i.player_id, i.invited_by);
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
    values ((select auth.uid()), 'PLAYER_ADDED_TO_TEAM', 'teams', i.team_id::text, jsonb_build_object('player_id', i.player_id, 'via', 'invitation'));
  end if;
  update public.team_invitations set status = case when coalesce(p_accept, false) then 'accepted' else 'declined' end, decided_at = now() where id = i.id;
  if t.owner_id is not null then
    insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
    values (t.owner_id, 'team_invitation_reply', case when coalesce(p_accept, false) then 'Invitation accepted' else 'Invitation declined' end,
            pl.display_name || case when coalesce(p_accept, false) then ' joined ' else ' declined to join ' end || t.name || '.', jsonb_build_object('team_id', t.id));
  end if;
  return public.my_team_invitations();
end $$;

-- ------------------------------------------------------------------ #340 squad eligibility
create table if not exists public.squad_verifications (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  status text not null check (status in ('verified', 'rejected')),
  note text check (note is null or char_length(note) <= 200),
  decided_by uuid not null,
  decided_at timestamptz not null default now(),
  primary key (tournament_id, team_id, player_id)
);
alter table public.squad_verifications enable row level security;
revoke all on public.squad_verifications from anon, authenticated;

-- a plain-language reason this player may not be picked for this team in this tournament, or null
create or replace function private.player_block_reason(p_tournament uuid, p_team uuid, p_player uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare v public.squad_verifications%rowtype; other text;
begin
  select * into v from public.squad_verifications where tournament_id = p_tournament and team_id = p_team and player_id = p_player;
  if found and v.status = 'rejected' then return 'rejected by the organiser' || coalesce(' (' || v.note || ')', ''); end if;
  select t.name into other from public.tournament_teams tt join public.teams t on t.id = tt.team_id join public.team_members tm on tm.team_id = tt.team_id
   where tt.tournament_id = p_tournament and tt.status = 'approved' and tt.team_id <> p_team and tm.player_id = p_player limit 1;
  if other is not null then return 'already in ' || other || ' in this tournament'; end if;
  return null;
end $$;

create or replace function public.get_squad_eligibility(p_tournament_id uuid, p_team_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare t public.tournaments%rowtype; tt public.tournament_teams%rowtype; org boolean; cap int; res jsonb := '[]'::jsonb; r record; checks jsonb; st text; why text; age int; n int; pps int;
begin
  if (select auth.uid()) is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  select * into t from public.tournaments where id = p_tournament_id;
  if not found then raise exception 'Tournament not found.' using errcode = '22023'; end if;
  org := private.is_tournament_organiser(p_tournament_id);
  if not org and not private.is_team_leader(p_team_id) then raise exception 'Only the organiser or the team can see this.' using errcode = '42501'; end if;
  select * into tt from public.tournament_teams where tournament_id = p_tournament_id and team_id = p_team_id;
  if not found then raise exception 'This team is not in the tournament.' using errcode = '22023'; end if;
  begin cap := substring(coalesce(t.category, '') from '(?i)(?:u|under)[ -]?(\d{1,2})')::int; exception when others then cap := null; end;
  for r in select p.id, p.display_name, p.profile_id, p.date_of_birth, tm.joined_at from public.team_members tm join public.players p on p.id = tm.player_id where tm.team_id = p_team_id order by p.display_name loop
    checks := '[]'::jsonb; st := 'ok';
    why := private.player_block_reason(p_tournament_id, p_team_id, r.id);
    if why is not null then checks := checks || jsonb_build_array(jsonb_build_object('key', 'blocked', 'state', 'block', 'text', 'Not eligible: ' || why)); st := 'block'; end if;
    if r.profile_id is null then checks := checks || jsonb_build_array(jsonb_build_object('key', 'account', 'state', 'warn', 'text', 'No account linked, so identity is not confirmed')); if st = 'ok' then st := 'warn'; end if; end if;
    if r.joined_at > tt.created_at + interval '1 hour' then checks := checks || jsonb_build_array(jsonb_build_object('key', 'late', 'state', 'warn', 'text', 'Joined the squad after the team registered')); if st = 'ok' then st := 'warn'; end if; end if;
    if cap is not null then
      if r.date_of_birth is null then checks := checks || jsonb_build_array(jsonb_build_object('key', 'dob', 'state', 'warn', 'text', 'Date of birth missing (age limit under ' || cap || ')')); if st = 'ok' then st := 'warn'; end if;
      else
        age := extract(year from age(coalesce(t.start_date, current_date), r.date_of_birth))::int;
        if age >= cap then checks := checks || jsonb_build_array(jsonb_build_object('key', 'age', 'state', 'warn', 'text', 'Age ' || age || ' is over the under-' || cap || ' limit')); if st = 'ok' then st := 'warn'; end if; end if;
      end if;
    end if;
    res := res || jsonb_build_array(jsonb_build_object('player_id', r.id, 'name', r.display_name, 'state', st, 'checks', checks,
      'verification', (select jsonb_build_object('status', v.status, 'note', v.note, 'decided_at', v.decided_at) from public.squad_verifications v where v.tournament_id = p_tournament_id and v.team_id = p_team_id and v.player_id = r.id)));
  end loop;
  n := jsonb_array_length(res); pps := coalesce(t.players_per_side, 11);
  return jsonb_build_object('can_decide', org, 'team', (select name from public.teams where id = p_team_id), 'squad_size', n, 'players_per_side', pps, 'squad_big_enough', n >= pps,
    'age_limit', cap, 'blocked', (select count(*) from jsonb_array_elements(res) x where x ->> 'state' = 'block'), 'warnings', (select count(*) from jsonb_array_elements(res) x where x ->> 'state' = 'warn'), 'players', res);
end $$;

create or replace function public.set_squad_verification(p_tournament_id uuid, p_team_id uuid, p_player_id uuid, p_status text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare nt text := nullif(pg_catalog.btrim(coalesce(p_note, '')), ''); t public.teams%rowtype; pn text;
begin
  perform private.require_tournament_organiser(p_tournament_id);
  if p_status not in ('verified', 'rejected', 'clear') then raise exception 'Choose verified, rejected or clear.' using errcode = '22023'; end if;
  if not exists (select 1 from public.team_members where team_id = p_team_id and player_id = p_player_id) then raise exception 'That player is not in this squad.' using errcode = '22023'; end if;
  if nt is not null and pg_catalog.length(nt) > 200 then raise exception 'Keep the note under 200 characters.' using errcode = '22023'; end if;
  if p_status = 'rejected' and nt is null then raise exception 'Give a reason when rejecting a player.' using errcode = '22023'; end if;
  if p_status = 'clear' then
    delete from public.squad_verifications where tournament_id = p_tournament_id and team_id = p_team_id and player_id = p_player_id;
  else
    insert into public.squad_verifications (tournament_id, team_id, player_id, status, note, decided_by) values (p_tournament_id, p_team_id, p_player_id, p_status, nt, (select auth.uid()))
    on conflict (tournament_id, team_id, player_id) do update set status = excluded.status, note = excluded.note, decided_by = excluded.decided_by, decided_at = now();
  end if;
  if p_status = 'rejected' then
    select * into t from public.teams where id = p_team_id; select display_name into pn from public.players where id = p_player_id;
    if t.owner_id is not null then
      insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
      values (t.owner_id, 'squad_eligibility', 'Player not eligible', pn || ' cannot play for ' || t.name || ' in this tournament: ' || nt, jsonb_build_object('tournament_id', p_tournament_id, 'team_id', p_team_id));
    end if;
  end if;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'SQUAD_VERIFICATION_SET', 'tournaments', p_tournament_id::text, jsonb_build_object('team_id', p_team_id, 'player_id', p_player_id, 'status', p_status));
  return public.get_squad_eligibility(p_tournament_id, p_team_id);
end $$;

-- lineups now refuse players who are not eligible for the tournament
create or replace function public.set_match_lineup(p_match_id uuid, p_team_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  m public.matches%rowtype; per_side int := 11; max_subs int := 4; playing uuid[]; subs uuid[]; cap uuid; wk uuid; other uuid; i int; why text;
begin
  m := private.require_lineup_editor(p_match_id, p_team_id);
  if m.status <> 'scheduled' then raise exception 'The lineup is fixed once the match has started. Use Replace a player instead.' using errcode = '22023'; end if;
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
  if m.tournament_id is not null then
    select string_agg(pl.display_name || ' is ' || r.reason, '; ') into why
      from unnest(playing || subs) x cross join lateral (select private.player_block_reason(m.tournament_id, p_team_id, x) as reason) r join public.players pl on pl.id = x where r.reason is not null;
    if why is not null then raise exception 'Not eligible: %.', why using errcode = '22023'; end if;
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
end $$;

-- ------------------------------------------------------------------ #342 availability RSVP
create table if not exists public.match_availability (
  match_id uuid not null references public.matches(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  status text not null check (status in ('yes', 'no', 'maybe')),
  note text check (note is null or char_length(note) <= 120),
  updated_at timestamptz not null default now(),
  primary key (match_id, player_id)
);
alter table public.match_availability enable row level security;
revoke all on public.match_availability from anon, authenticated;

create or replace function public.set_my_availability(p_match_id uuid, p_status text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare m public.matches%rowtype; pid uuid := private.my_player_id(); tid uuid; nt text := nullif(pg_catalog.btrim(coalesce(p_note, '')), '');
begin
  perform private.require_active_user();
  if p_status not in ('yes', 'no', 'maybe') then raise exception 'Choose yes, no or maybe.' using errcode = '22023'; end if;
  if nt is not null and pg_catalog.length(nt) > 120 then raise exception 'Keep the note under 120 characters.' using errcode = '22023'; end if;
  select * into m from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found.' using errcode = '22023'; end if;
  if m.status <> 'scheduled' then raise exception 'This match has already started.' using errcode = '22023'; end if;
  if pid is null then raise exception 'You need a player profile to answer.' using errcode = '22023'; end if;
  select tm.team_id into tid from public.team_members tm where tm.player_id = pid and tm.team_id in (m.team_a_id, m.team_b_id) limit 1;
  if tid is null then raise exception 'You are not in either squad for this match.' using errcode = '42501'; end if;
  insert into public.match_availability (match_id, team_id, player_id, status, note) values (p_match_id, tid, pid, p_status, nt)
  on conflict (match_id, player_id) do update set status = excluded.status, note = excluded.note, updated_at = now(), team_id = excluded.team_id;
  return public.get_match_availability(p_match_id);
end $$;

create or replace function public.get_match_availability(p_match_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare m public.matches%rowtype; pid uuid := private.my_player_id(); res jsonb := '[]'::jsonb; tid uuid; leader boolean; mine jsonb; mine_team uuid;
begin
  if (select auth.uid()) is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  select * into m from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found.' using errcode = '22023'; end if;
  select tm.team_id into mine_team from public.team_members tm where tm.player_id = pid and tm.team_id in (m.team_a_id, m.team_b_id) limit 1;
  select jsonb_build_object('status', a.status, 'note', a.note) into mine from public.match_availability a where a.match_id = p_match_id and a.player_id = pid;
  foreach tid in array array[m.team_a_id, m.team_b_id] loop
    continue when tid is null;
    leader := private.is_team_leader(tid) or private.can_score_match(p_match_id);
    res := res || jsonb_build_array(jsonb_build_object('team_id', tid, 'team', (select name from public.teams where id = tid), 'can_see_players', leader,
      'yes', (select count(*) from public.match_availability a where a.match_id = p_match_id and a.team_id = tid and a.status = 'yes'),
      'no', (select count(*) from public.match_availability a where a.match_id = p_match_id and a.team_id = tid and a.status = 'no'),
      'maybe', (select count(*) from public.match_availability a where a.match_id = p_match_id and a.team_id = tid and a.status = 'maybe'),
      'waiting', (select count(*) from public.team_members tm where tm.team_id = tid and not exists (select 1 from public.match_availability a where a.match_id = p_match_id and a.player_id = tm.player_id)),
      'players', case when leader then (select coalesce(jsonb_agg(jsonb_build_object('player_id', p.id, 'name', p.display_name, 'status', a.status, 'note', a.note) order by case a.status when 'yes' then 0 when 'maybe' then 1 when 'no' then 2 else 3 end, p.display_name), '[]'::jsonb)
                 from public.team_members tm join public.players p on p.id = tm.player_id left join public.match_availability a on a.match_id = p_match_id and a.player_id = p.id where tm.team_id = tid) else '[]'::jsonb end));
  end loop;
  return jsonb_build_object('match_status', m.status, 'my_team_id', mine_team, 'mine', mine, 'teams', res);
end $$;

-- ------------------------------------------------------------------ #343 captain lineup approval
create table if not exists public.match_lineup_approvals (
  match_id uuid not null references public.matches(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  status text not null check (status in ('pending', 'approved', 'changes_requested')),
  signature text not null,
  requested_by uuid not null,
  requested_at timestamptz not null default now(),
  decided_by uuid, decided_at timestamptz,
  note text check (note is null or char_length(note) <= 200),
  primary key (match_id, team_id)
);
alter table public.match_lineup_approvals enable row level security;
revoke all on public.match_lineup_approvals from anon, authenticated;

create or replace function private.lineup_signature(p_match uuid, p_team uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(md5(string_agg(player_id::text || ':' || role || ':' || coalesce(batting_order, 0) || ':' || is_captain::text, ',' order by role, batting_order, player_id)), '')
    from public.match_players where match_id = p_match and team_id = p_team and role in ('playing', 'substitute');
$$;

create or replace function public.get_lineup_approval(p_match_id uuid, p_team_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare a public.match_lineup_approvals%rowtype; m public.matches%rowtype; sig text; capn text; me_captain boolean; has_lineup boolean;
begin
  if (select auth.uid()) is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  select * into m from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found.' using errcode = '22023'; end if;
  sig := private.lineup_signature(p_match_id, p_team_id);
  has_lineup := exists (select 1 from public.match_players where match_id = p_match_id and team_id = p_team_id and role = 'playing');
  select p.display_name into capn from public.team_members tm join public.players p on p.id = tm.player_id where tm.team_id = p_team_id and tm.is_captain limit 1;
  me_captain := exists (select 1 from public.team_members tm join public.players p on p.id = tm.player_id where tm.team_id = p_team_id and (tm.is_captain or tm.is_vice_captain) and p.profile_id = (select auth.uid()));
  select * into a from public.match_lineup_approvals where match_id = p_match_id and team_id = p_team_id;
  return jsonb_build_object('has_lineup', has_lineup, 'captain', capn, 'status', a.status, 'stale', found and a.signature <> sig, 'note', a.note, 'decided_at', a.decided_at, 'requested_at', a.requested_at,
    'decided_by', (select display_name from public.profiles where id = a.decided_by),
    'can_request', m.status = 'scheduled' and has_lineup and (exists (select 1 from public.teams where id = p_team_id and owner_id = (select auth.uid())) or private.can_score_match(p_match_id)),
    'can_decide', m.status = 'scheduled' and me_captain and a.status = 'pending' and a.signature = sig);
end $$;

create or replace function public.request_lineup_approval(p_match_id uuid, p_team_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare m public.matches%rowtype; sig text; cap record; uid uuid := (select auth.uid()); t public.teams%rowtype;
begin
  m := private.require_lineup_editor(p_match_id, p_team_id);
  if m.status <> 'scheduled' then raise exception 'The lineup is fixed once the match has started.' using errcode = '22023'; end if;
  if not exists (select 1 from public.match_players where match_id = p_match_id and team_id = p_team_id and role = 'playing') then raise exception 'Pick the playing side first.' using errcode = '22023'; end if;
  sig := private.lineup_signature(p_match_id, p_team_id);
  select * into t from public.teams where id = p_team_id;
  select p.profile_id, p.display_name into cap from public.team_members tm join public.players p on p.id = tm.player_id where tm.team_id = p_team_id and tm.is_captain limit 1;
  if cap.profile_id is null then raise exception 'The team captain needs an account to approve. Set a captain who has joined the platform.' using errcode = '22023'; end if;
  if cap.profile_id = uid then
    insert into public.match_lineup_approvals (match_id, team_id, status, signature, requested_by, decided_by, decided_at) values (p_match_id, p_team_id, 'approved', sig, uid, uid, now())
    on conflict (match_id, team_id) do update set status = 'approved', signature = excluded.signature, requested_by = uid, requested_at = now(), decided_by = uid, decided_at = now(), note = null;
  else
    insert into public.match_lineup_approvals (match_id, team_id, status, signature, requested_by) values (p_match_id, p_team_id, 'pending', sig, uid)
    on conflict (match_id, team_id) do update set status = 'pending', signature = excluded.signature, requested_by = uid, requested_at = now(), decided_by = null, decided_at = null, note = null;
    insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
    values (cap.profile_id, 'lineup_approval', 'Approve the lineup', 'The lineup for ' || t.name || ' is waiting for your approval.', jsonb_build_object('match_id', p_match_id, 'team_id', p_team_id));
  end if;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, 'LINEUP_APPROVAL_REQUESTED', 'matches', p_match_id::text, jsonb_build_object('team_id', p_team_id));
  return public.get_lineup_approval(p_match_id, p_team_id);
end $$;

create or replace function public.decide_lineup_approval(p_match_id uuid, p_team_id uuid, p_approve boolean, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.match_lineup_approvals%rowtype; uid uuid := (select auth.uid()); nt text := nullif(pg_catalog.btrim(coalesce(p_note, '')), ''); t public.teams%rowtype;
begin
  perform private.require_active_user();
  if not exists (select 1 from public.team_members tm join public.players p on p.id = tm.player_id where tm.team_id = p_team_id and (tm.is_captain or tm.is_vice_captain) and p.profile_id = uid) then
    raise exception 'Only the captain or vice-captain can decide.' using errcode = '42501';
  end if;
  select * into a from public.match_lineup_approvals where match_id = p_match_id and team_id = p_team_id for update;
  if not found or a.status <> 'pending' then raise exception 'There is no lineup waiting for approval.' using errcode = '22023'; end if;
  if a.signature <> private.lineup_signature(p_match_id, p_team_id) then raise exception 'The lineup changed after it was sent. Ask for approval again.' using errcode = '22023'; end if;
  if not coalesce(p_approve, false) and (nt is null or pg_catalog.length(nt) < 3) then raise exception 'Say what should change (at least 3 characters).' using errcode = '22023'; end if;
  if nt is not null and pg_catalog.length(nt) > 200 then raise exception 'Keep the note under 200 characters.' using errcode = '22023'; end if;
  update public.match_lineup_approvals set status = case when coalesce(p_approve, false) then 'approved' else 'changes_requested' end, decided_by = uid, decided_at = now(), note = nt where match_id = p_match_id and team_id = p_team_id;
  select * into t from public.teams where id = p_team_id;
  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  select distinct x, 'lineup_approval', case when coalesce(p_approve, false) then 'Lineup approved' else 'Lineup needs changes' end,
         t.name || ': the captain ' || case when coalesce(p_approve, false) then 'approved the lineup.' else 'asked for changes' || coalesce(' - ' || nt, '.') end, jsonb_build_object('match_id', p_match_id, 'team_id', p_team_id)
    from unnest(array[t.owner_id, a.requested_by]) x where x is not null and x <> uid;
  return public.get_lineup_approval(p_match_id, p_team_id);
end $$;

-- ------------------------------------------------------------------ #344 clubs
create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 60),
  city text check (city is null or char_length(city) <= 60),
  owner_id uuid not null,
  created_at timestamptz not null default now()
);
alter table public.clubs enable row level security;
revoke all on public.clubs from anon, authenticated;
alter table public.teams add column if not exists club_id uuid references public.clubs(id) on delete set null;
alter table public.teams add column if not exists club_level int check (club_level is null or club_level between 1 and 10);
create index if not exists teams_club_idx on public.teams (club_id) where club_id is not null;

create or replace function public.get_club(p_club_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c public.clubs%rowtype; uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  select * into c from public.clubs where id = p_club_id;
  if not found then raise exception 'Club not found.' using errcode = '22023'; end if;
  return jsonb_build_object('id', c.id, 'name', c.name, 'city', c.city, 'can_manage', c.owner_id = uid or private.is_admin(),
    'teams', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'level', t.club_level, 'members', (select count(*) from public.team_members m where m.team_id = t.id), 'i_own', t.owner_id = uid) order by t.club_level nulls last, t.name), '[]'::jsonb) from public.teams t where t.club_id = c.id and t.archived_at is null),
    'players', (select coalesce(jsonb_agg(jsonb_build_object('player_id', p.id, 'name', p.display_name, 'team_id', t.id, 'team', t.name, 'level', t.club_level) order by t.club_level nulls last, p.display_name), '[]'::jsonb)
                  from public.teams t join public.team_members m on m.team_id = t.id join public.players p on p.id = m.player_id where t.club_id = c.id and t.archived_at is null));
end $$;

create or replace function public.list_my_clubs() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  return jsonb_build_object('items', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'city', c.city, 'mine', c.owner_id = uid, 'team_count', (select count(*) from public.teams t where t.club_id = c.id and t.archived_at is null)) order by c.name), '[]'::jsonb)
     from public.clubs c where c.owner_id = uid or exists (select 1 from public.teams t where t.club_id = c.id and t.owner_id = uid)));
end $$;

create or replace function public.save_club(p_club_id uuid, p_name text, p_city text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare nm text := pg_catalog.btrim(coalesce(p_name, '')); ct text := nullif(pg_catalog.btrim(coalesce(p_city, '')), ''); uid uuid := (select auth.uid()); cid uuid := p_club_id;
begin
  perform private.require_active_user();
  if pg_catalog.length(nm) < 2 or pg_catalog.length(nm) > 60 then raise exception 'Give the club a name of 2 to 60 characters.' using errcode = '22023'; end if;
  if ct is not null and pg_catalog.length(ct) > 60 then raise exception 'Keep the city under 60 characters.' using errcode = '22023'; end if;
  if cid is null then
    if (select count(*) from public.clubs where owner_id = uid) >= 10 then raise exception 'You can run at most 10 clubs.' using errcode = '22023'; end if;
    insert into public.clubs (name, city, owner_id) values (nm, ct, uid) returning id into cid;
  else
    if not exists (select 1 from public.clubs where id = cid and (owner_id = uid or private.is_admin())) then raise exception 'Only the club owner can change the club.' using errcode = '42501'; end if;
    update public.clubs set name = nm, city = ct where id = cid;
  end if;
  return public.get_club(cid);
end $$;

create or replace function public.delete_club(p_club_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_active_user();
  if not exists (select 1 from public.clubs where id = p_club_id and (owner_id = (select auth.uid()) or private.is_admin())) then raise exception 'Only the club owner can delete the club.' using errcode = '42501'; end if;
  delete from public.clubs where id = p_club_id;
  return public.list_my_clubs();
end $$;

create or replace function public.set_team_club(p_team_id uuid, p_club_id uuid, p_level int default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); t public.teams%rowtype; c public.clubs%rowtype;
begin
  perform private.require_active_user();
  select * into t from public.teams where id = p_team_id;
  if not found then raise exception 'Team not found.' using errcode = '22023'; end if;
  if p_club_id is null then
    if t.owner_id <> uid and not exists (select 1 from public.clubs where id = t.club_id and owner_id = uid) and not private.is_admin() then raise exception 'Only the team owner or the club owner can take a team out of a club.' using errcode = '42501'; end if;
    update public.teams set club_id = null, club_level = null where id = p_team_id;
    return jsonb_build_object('team_id', p_team_id, 'club_id', null);
  end if;
  select * into c from public.clubs where id = p_club_id;
  if not found then raise exception 'Club not found.' using errcode = '22023'; end if;
  if (t.owner_id <> uid or c.owner_id <> uid) and not private.is_admin() then raise exception 'You must own both the club and the team to link them.' using errcode = '42501'; end if;
  if p_level is not null and (p_level < 1 or p_level > 10) then raise exception 'Level must be between 1 (top team) and 10.' using errcode = '22023'; end if;
  if (select count(*) from public.teams where club_id = p_club_id and id <> p_team_id) >= 12 then raise exception 'A club can have at most 12 teams.' using errcode = '22023'; end if;
  update public.teams set club_id = p_club_id, club_level = p_level where id = p_team_id;
  return public.get_club(p_club_id);
end $$;

create or replace function public.move_club_player(p_club_id uuid, p_player_id uuid, p_from_team uuid, p_to_team uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_active_user();
  if not exists (select 1 from public.clubs where id = p_club_id and (owner_id = (select auth.uid()) or private.is_admin())) then raise exception 'Only the club owner can move players between the club''s teams.' using errcode = '42501'; end if;
  if p_from_team = p_to_team then raise exception 'Choose two different teams.' using errcode = '22023'; end if;
  if (select count(*) from public.teams where id in (p_from_team, p_to_team) and club_id = p_club_id) <> 2 then raise exception 'Both teams must belong to this club.' using errcode = '22023'; end if;
  if not exists (select 1 from public.team_members where team_id = p_from_team and player_id = p_player_id) then raise exception 'That player is not in the first team.' using errcode = '22023'; end if;
  if exists (select 1 from public.team_members where team_id = p_to_team and player_id = p_player_id) then raise exception 'That player is already in the second team.' using errcode = '22023'; end if;
  if (select count(*) from public.team_members where team_id = p_to_team) >= 40 then raise exception 'The second squad is full.' using errcode = '22023'; end if;
  if exists (select 1 from public.match_players mp join public.matches m on m.id = mp.match_id where mp.team_id = p_from_team and mp.player_id = p_player_id and m.status in ('scheduled', 'live')) then
    raise exception 'This player is picked for an upcoming or live match. Change that lineup first.' using errcode = '22023';
  end if;
  delete from public.team_members where team_id = p_from_team and player_id = p_player_id;
  insert into public.team_members (team_id, player_id, added_by) values (p_to_team, p_player_id, (select auth.uid()));
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'CLUB_PLAYER_MOVED', 'clubs', p_club_id::text, jsonb_build_object('player_id', p_player_id, 'from', p_from_team, 'to', p_to_team));
  return public.get_club(p_club_id);
end $$;

-- ------------------------------------------------------------------ #367 friendly challenges
create table if not exists public.match_challenges (
  id uuid primary key default gen_random_uuid(),
  from_team_id uuid not null references public.teams(id) on delete cascade,
  to_team_id uuid not null references public.teams(id) on delete cascade,
  proposed_by uuid not null,
  proposed_at timestamptz not null,
  venue text check (venue is null or char_length(venue) <= 120),
  overs int check (overs is null or overs between 1 and 100),
  players_per_side int not null default 11 check (players_per_side between 2 and 15),
  message text check (message is null or char_length(message) <= 300),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  response_note text check (response_note is null or char_length(response_note) <= 200),
  decided_by uuid, decided_at timestamptz,
  match_id uuid references public.matches(id) on delete set null,
  created_at timestamptz not null default now(),
  check (from_team_id <> to_team_id)
);
create unique index if not exists match_challenges_one_pending on public.match_challenges (from_team_id, to_team_id) where status = 'pending';
alter table public.match_challenges enable row level security;
revoke all on public.match_challenges from anon, authenticated;

create or replace function public.list_my_challenges() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  return jsonb_build_object('items', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'from_team_id', c.from_team_id, 'from_team', f.name, 'to_team_id', c.to_team_id, 'to_team', t.name,
            'proposed_at', c.proposed_at, 'venue', c.venue, 'overs', c.overs, 'players_per_side', c.players_per_side, 'message', c.message, 'response_note', c.response_note, 'match_id', c.match_id,
            'status', case when c.status = 'pending' and c.proposed_at < now() then 'expired' else c.status end,
            'direction', case when f.owner_id = uid then 'sent' else 'received' end,
            'can_respond', c.status = 'pending' and c.proposed_at >= now() and t.owner_id = uid,
            'can_cancel', c.status = 'pending' and c.proposed_by = uid) order by c.created_at desc), '[]'::jsonb)
     from (select * from public.match_challenges where created_at > now() - interval '60 days' order by created_at desc limit 200) c
       join public.teams f on f.id = c.from_team_id join public.teams t on t.id = c.to_team_id where f.owner_id = uid or t.owner_id = uid));
end $$;

create or replace function public.send_match_challenge(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); a uuid := nullif(p ->> 'from_team_id', '')::uuid; b uuid := nullif(p ->> 'to_team_id', '')::uuid; at timestamptz := nullif(p ->> 'proposed_at', '')::timestamptz;
  ov int := nullif(p ->> 'overs', '')::int; pps int := coalesce(nullif(p ->> 'players_per_side', '')::int, 11); ve text := nullif(pg_catalog.btrim(coalesce(p ->> 'venue', '')), ''); msg text := nullif(pg_catalog.btrim(coalesce(p ->> 'message', '')), '');
  fo public.teams%rowtype; tt public.teams%rowtype;
begin
  perform private.require_active_user();
  if a is null or b is null then raise exception 'Choose your team and the team you are challenging.' using errcode = '22023'; end if;
  if a = b then raise exception 'Choose two different teams.' using errcode = '22023'; end if;
  select * into fo from public.teams where id = a; select * into tt from public.teams where id = b;
  if fo.id is null or tt.id is null then raise exception 'Team not found.' using errcode = '22023'; end if;
  if fo.owner_id is distinct from uid then raise exception 'You can only challenge from a team you own.' using errcode = '42501'; end if;
  if tt.owner_id = uid then raise exception 'You own both teams. Start the match directly instead.' using errcode = '22023'; end if;
  if tt.owner_id is null then raise exception 'That team has no owner to answer the challenge.' using errcode = '22023'; end if;
  if at is null or at < now() then raise exception 'Choose a date and time in the future.' using errcode = '22023'; end if;
  if ov is null or ov < 1 or ov > 100 then raise exception 'Overs must be between 1 and 100.' using errcode = '22023'; end if;
  if pps < 2 or pps > 15 then raise exception 'Players a side must be between 2 and 15.' using errcode = '22023'; end if;
  if ve is not null and pg_catalog.length(ve) > 120 then raise exception 'Keep the venue under 120 characters.' using errcode = '22023'; end if;
  if msg is not null and pg_catalog.length(msg) > 300 then raise exception 'Keep the message under 300 characters.' using errcode = '22023'; end if;
  if exists (select 1 from public.match_challenges where from_team_id = a and to_team_id = b and status = 'pending') then raise exception 'A challenge to this team is already waiting.' using errcode = '22023'; end if;
  if (select count(*) from public.match_challenges where proposed_by = uid and created_at > now() - interval '1 day') >= 20 then raise exception 'You have sent many challenges today. Please try again tomorrow.' using errcode = '22023'; end if;
  insert into public.match_challenges (from_team_id, to_team_id, proposed_by, proposed_at, venue, overs, players_per_side, message) values (a, b, uid, at, ve, ov, pps, msg);
  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  values (tt.owner_id, 'match_challenge', 'Match challenge', fo.name || ' challenged ' || tt.name || ' to a ' || ov || '-over friendly on ' || pg_catalog.to_char(at at time zone 'Asia/Kolkata', 'DD Mon, HH12:MI AM') || coalesce(' at ' || ve, '') || '.', jsonb_build_object('from_team_id', a, 'to_team_id', b));
  return public.list_my_challenges();
end $$;

create or replace function public.respond_match_challenge(p_challenge_id uuid, p_accept boolean, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c public.match_challenges%rowtype; uid uuid := (select auth.uid()); nt text := nullif(pg_catalog.btrim(coalesce(p_note, '')), ''); mid uuid; ft public.teams%rowtype; tt public.teams%rowtype;
begin
  perform private.require_active_user();
  select * into c from public.match_challenges where id = p_challenge_id for update;
  if not found then raise exception 'Challenge not found.' using errcode = '22023'; end if;
  select * into tt from public.teams where id = c.to_team_id; select * into ft from public.teams where id = c.from_team_id;
  if tt.owner_id is distinct from uid then raise exception 'Only the owner of the challenged team can answer.' using errcode = '42501'; end if;
  if c.status <> 'pending' then raise exception 'This challenge has already been answered.' using errcode = '22023'; end if;
  if nt is not null and pg_catalog.length(nt) > 200 then raise exception 'Keep the note under 200 characters.' using errcode = '22023'; end if;
  if coalesce(p_accept, false) then
    if c.proposed_at < now() then raise exception 'The proposed time has passed. Ask them to send a new challenge.' using errcode = '22023'; end if;
    mid := (public.create_friendly_match(jsonb_build_object('team_a_id', c.from_team_id, 'team_b_id', c.to_team_id, 'scheduled_at', c.proposed_at, 'venue', c.venue,
              'match_type', 'limited_overs', 'overs_per_innings', c.overs, 'players_per_side', c.players_per_side, 'title', ft.name || ' vs ' || tt.name))) ->> 'id';
    insert into public.user_role_assignments (user_id, role, scope_type, scope_id, granted_by, notes)
    values (c.proposed_by, 'scorer', 'match', mid::uuid, uid, 'Automatic: sent the challenge') on conflict do nothing;
  end if;
  update public.match_challenges set status = case when coalesce(p_accept, false) then 'accepted' else 'declined' end, response_note = nt, decided_by = uid, decided_at = now(), match_id = mid::uuid where id = c.id;
  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  values (c.proposed_by, 'match_challenge_reply', case when coalesce(p_accept, false) then 'Challenge accepted' else 'Challenge declined' end,
          tt.name || case when coalesce(p_accept, false) then ' accepted your challenge. The match is created.' else ' declined your challenge' || coalesce(': ' || nt, '.') end, jsonb_build_object('match_id', mid));
  return public.list_my_challenges();
end $$;

create or replace function public.cancel_match_challenge(p_challenge_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c public.match_challenges%rowtype;
begin
  perform private.require_active_user();
  select * into c from public.match_challenges where id = p_challenge_id for update;
  if not found or c.proposed_by <> (select auth.uid()) then raise exception 'Challenge not found.' using errcode = '22023'; end if;
  if c.status <> 'pending' then raise exception 'This challenge has already been answered.' using errcode = '22023'; end if;
  update public.match_challenges set status = 'cancelled', decided_at = now() where id = c.id;
  return public.list_my_challenges();
end $$;

do $$ declare f text; begin
  foreach f in array array[
    'public.list_team_invitations(uuid)', 'public.invite_player_to_team(uuid,uuid,text)', 'public.cancel_team_invitation(uuid)', 'public.my_team_invitations()', 'public.respond_team_invitation(uuid,boolean)',
    'public.get_squad_eligibility(uuid,uuid)', 'public.set_squad_verification(uuid,uuid,uuid,text,text)',
    'public.set_my_availability(uuid,text,text)', 'public.get_match_availability(uuid)',
    'public.get_lineup_approval(uuid,uuid)', 'public.request_lineup_approval(uuid,uuid)', 'public.decide_lineup_approval(uuid,uuid,boolean,text)',
    'public.get_club(uuid)', 'public.list_my_clubs()', 'public.save_club(uuid,text,text)', 'public.delete_club(uuid)', 'public.set_team_club(uuid,uuid,int)', 'public.move_club_player(uuid,uuid,uuid,uuid)',
    'public.list_my_challenges()', 'public.send_match_challenge(jsonb)', 'public.respond_match_challenge(uuid,boolean,text)', 'public.cancel_match_challenge(uuid)']
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
revoke all on function private.my_player_id(), private.is_team_leader(uuid), private.player_block_reason(uuid,uuid,uuid), private.lineup_signature(uuid,uuid) from public, anon, authenticated;
