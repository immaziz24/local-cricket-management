-- Phase 2 / Category C – #72 Playing XI, #73 Substitutes, #74 Player replacements, #75 Player transfers
-- Lineups are picked per match by the team owner (or the tournament organiser) from the team squad.
-- A replacement swaps a playing player out for a substitute during a match (injury, concussion, illness).
-- A transfer moves a player from one team to another: the receiving team asks, the current team agrees.

alter table public.tournaments
  add column if not exists players_per_side int not null default 11 check (players_per_side between 2 and 15),
  add column if not exists max_substitutes int not null default 4 check (max_substitutes between 0 and 10);

create table if not exists public.match_players (
  match_id uuid not null references public.matches(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  role text not null default 'playing' check (role in ('playing','substitute','replaced')),
  batting_order int check (batting_order is null or batting_order between 1 and 30),
  is_captain boolean not null default false,
  is_wicket_keeper boolean not null default false,
  replaces_player_id uuid references public.players(id) on delete set null,
  replacement_reason text check (replacement_reason is null or pg_catalog.length(replacement_reason) <= 200),
  replaced_at timestamptz,
  selected_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (match_id, player_id)
);
create index if not exists match_players_team_idx on public.match_players (match_id, team_id);
create index if not exists match_players_player_idx on public.match_players (player_id);
create index if not exists match_players_team_fk_idx on public.match_players (team_id);
create index if not exists match_players_replaces_idx on public.match_players (replaces_player_id);
create index if not exists match_players_selected_by_idx on public.match_players (selected_by);
create unique index if not exists match_players_one_captain_uidx on public.match_players (match_id, team_id) where is_captain and role = 'playing';

create table if not exists public.player_transfers (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  from_team_id uuid not null references public.teams(id) on delete cascade,
  to_team_id uuid not null references public.teams(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','rejected','cancelled')),
  note text check (note is null or pg_catalog.length(note) <= 300),
  decision_reason text check (decision_reason is null or pg_catalog.length(decision_reason) <= 300),
  requested_by uuid references auth.users(id) on delete set null,
  decided_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  check (from_team_id <> to_team_id)
);
create unique index if not exists player_transfers_one_pending_uidx on public.player_transfers (player_id, from_team_id, to_team_id) where status = 'pending';
create index if not exists player_transfers_player_idx on public.player_transfers (player_id);
create index if not exists player_transfers_from_idx on public.player_transfers (from_team_id);
create index if not exists player_transfers_to_idx on public.player_transfers (to_team_id);
create index if not exists player_transfers_requested_by_idx on public.player_transfers (requested_by);
create index if not exists player_transfers_decided_by_idx on public.player_transfers (decided_by);

alter table public.match_players enable row level security;
alter table public.player_transfers enable row level security;
drop policy if exists match_players_read on public.match_players;
create policy match_players_read on public.match_players for select to anon, authenticated using (true);
drop policy if exists player_transfers_read on public.player_transfers;
create policy player_transfers_read on public.player_transfers for select to authenticated
  using (exists (select 1 from public.teams t where t.id in (from_team_id, to_team_id) and t.owner_id = (select auth.uid())));
revoke all on public.match_players, public.player_transfers from anon, authenticated;
grant select on public.match_players to anon, authenticated;
grant select on public.player_transfers to authenticated;
grant all on public.match_players, public.player_transfers to service_role;

-- Team owner of one side of the match, or the tournament organiser.
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
  if exists (select 1 from public.teams where id = p_team_id and owner_id = (select auth.uid())) or private.is_admin() then
    return m;
  end if;
  if m.tournament_id is not null and (
       exists (select 1 from public.tournaments where id = m.tournament_id and owner_id = (select auth.uid()))
    or exists (select 1 from public.user_role_assignments where user_id = (select auth.uid()) and role = 'organiser'
               and scope_type = 'tournament' and scope_id = m.tournament_id and is_active)) then
    return m;
  end if;
  raise exception 'Only the team owner or the tournament organiser can pick this lineup.' using errcode = '42501';
end;
$$;
revoke all on function private.require_lineup_editor(uuid, uuid) from public, anon, authenticated;

-- Read both lineups of a match together with each squad (public), plus what the caller may edit.
create or replace function public.get_match_lineups(p_match_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare m record; t record; uid uuid := (select auth.uid()); is_org boolean := false; per_side int := 11; max_subs int := 4;
begin
  select * into m from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found.' using errcode = '22023'; end if;
  if m.tournament_id is not null then
    select * into t from public.tournaments where id = m.tournament_id;
    per_side := t.players_per_side; max_subs := t.max_substitutes;
    is_org := uid is not null and (t.owner_id = uid or private.is_admin()
      or exists (select 1 from public.user_role_assignments where user_id = uid and role = 'organiser'
                 and scope_type = 'tournament' and scope_id = m.tournament_id and is_active));
  end if;
  return jsonb_build_object(
    'match_id', m.id, 'status', m.status,
    'players_per_side', per_side, 'max_substitutes', max_subs,
    'teams', coalesce((
      select jsonb_agg(jsonb_build_object(
        'team_id', tm.id, 'name', tm.name, 'short_name', tm.short_name, 'logo_url', tm.logo_url,
        'can_edit', uid is not null and (is_org or tm.owner_id = uid or private.is_admin()),
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

-- #72 Playing XI + #73 substitutes. p: {playing: [player ids in batting order], substitutes: [ids], captain, wicket_keeper}
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

-- #74 Replace a playing player during a match (injury, concussion, illness, other).
create or replace function public.replace_match_player(p_match_id uuid, p_team_id uuid, p_out uuid, p_in uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare m public.matches%rowtype; outp record; other uuid; reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), ''); in_name text; out_name text;
begin
  m := private.require_lineup_editor(p_match_id, p_team_id);
  if m.status not in ('scheduled','live') then raise exception 'Replacements can only be made before or during the match.' using errcode = '22023'; end if;
  if reason is null then raise exception 'Give a reason for the replacement (e.g. injury).' using errcode = '22023'; end if;
  select * into outp from public.match_players where match_id = p_match_id and team_id = p_team_id and player_id = p_out and role = 'playing';
  if not found then raise exception 'The player going out must be in the playing side.' using errcode = '22023'; end if;
  if not exists (select 1 from public.team_members where team_id = p_team_id and player_id = p_in) then
    raise exception 'The new player must be in the team squad.' using errcode = '22023';
  end if;
  if exists (select 1 from public.match_players where match_id = p_match_id and player_id = p_in and role in ('playing','replaced')) then
    raise exception 'The new player has already played in this match.' using errcode = '22023';
  end if;
  other := case when m.team_a_id = p_team_id then m.team_b_id else m.team_a_id end;
  if exists (select 1 from public.match_players where match_id = p_match_id and team_id = other and player_id = p_in) then
    raise exception 'The new player is picked by the other team.' using errcode = '22023';
  end if;

  update public.match_players set role = 'replaced', replaced_at = now(), is_captain = false, is_wicket_keeper = false
   where match_id = p_match_id and player_id = p_out;
  insert into public.match_players (match_id, team_id, player_id, role, batting_order, is_captain, is_wicket_keeper,
                                    replaces_player_id, replacement_reason, replaced_at, selected_by)
  values (p_match_id, p_team_id, p_in, 'playing', outp.batting_order, outp.is_captain, outp.is_wicket_keeper,
          p_out, reason, now(), (select auth.uid()))
  on conflict (match_id, player_id) do update set role = 'playing', batting_order = excluded.batting_order,
     is_captain = excluded.is_captain, is_wicket_keeper = excluded.is_wicket_keeper,
     replaces_player_id = excluded.replaces_player_id, replacement_reason = excluded.replacement_reason,
     replaced_at = excluded.replaced_at, selected_by = excluded.selected_by;

  select display_name into in_name from public.players where id = p_in;
  select display_name into out_name from public.players where id = p_out;
  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  select tm.owner_id, 'player_replaced', 'Player replaced',
         (select name from public.teams where id = p_team_id) || ': ' || in_name || ' replaces ' || out_name || ' (' || reason || ').',
         jsonb_build_object('match_id', p_match_id)
    from public.teams tm where tm.id = other and tm.owner_id <> (select auth.uid());
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'MATCH_PLAYER_REPLACED', 'teams', p_team_id::text,
          jsonb_build_object('match_id', p_match_id, 'out', p_out, 'in', p_in, 'reason', reason));
  return jsonb_build_object('in', p_in, 'out', p_out);
end;
$$;

-- #75 Transfers -------------------------------------------------------------
-- The receiving team's owner asks for a player of another team.
create or replace function public.request_player_transfer(p_player_id uuid, p_from_team uuid, p_to_team uuid, p_note text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare tid uuid; pname text; to_name text;
begin
  perform private.require_team_owner(p_to_team);
  if p_from_team = p_to_team then raise exception 'Choose a different team.' using errcode = '22023'; end if;
  if not exists (select 1 from public.team_members where team_id = p_from_team and player_id = p_player_id) then
    raise exception 'This player is not in that team.' using errcode = '22023';
  end if;
  if exists (select 1 from public.team_members where team_id = p_to_team and player_id = p_player_id) then
    raise exception 'This player is already in your team.' using errcode = '22023';
  end if;
  if exists (select 1 from public.player_transfers where player_id = p_player_id and from_team_id = p_from_team and to_team_id = p_to_team and status = 'pending') then
    raise exception 'A transfer request for this player is already waiting.' using errcode = '22023';
  end if;
  if (select count(*) from public.player_transfers where requested_by = (select auth.uid()) and created_at > now() - interval '1 day') >= 30 then
    raise exception 'Too many transfer requests today. Try again tomorrow.' using errcode = '54000';
  end if;
  insert into public.player_transfers (player_id, from_team_id, to_team_id, note, requested_by)
  values (p_player_id, p_from_team, p_to_team, nullif(pg_catalog.btrim(coalesce(p_note, '')), ''), (select auth.uid()))
  returning id into tid;
  select display_name into pname from public.players where id = p_player_id;
  select name into to_name from public.teams where id = p_to_team;
  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  select owner_id, 'transfer_request', 'Transfer request',
         to_name || ' wants ' || pname || ' from ' || name || '. Open the team page to accept or decline.',
         jsonb_build_object('transfer_id', tid, 'team_id', p_from_team)
    from public.teams where id = p_from_team;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'TRANSFER_REQUESTED', 'teams', p_from_team::text,
          jsonb_build_object('transfer_id', tid, 'player_id', p_player_id, 'to_team', p_to_team));
  return jsonb_build_object('id', tid);
end;
$$;

-- The current team's owner accepts (player moves) or declines (reason required).
create or replace function public.decide_player_transfer(p_transfer_id uuid, p_accept boolean, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare tr record; pname text; reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), ''); profile uuid;
begin
  select * into tr from public.player_transfers where id = p_transfer_id;
  if not found then raise exception 'Transfer request not found.' using errcode = '22023'; end if;
  perform private.require_team_owner(tr.from_team_id);
  if tr.status <> 'pending' then raise exception 'This request has already been answered.' using errcode = '22023'; end if;
  if not p_accept and reason is null then raise exception 'Give a reason for declining.' using errcode = '22023'; end if;
  if p_accept then
    if not exists (select 1 from public.team_members where team_id = tr.from_team_id and player_id = tr.player_id) then
      raise exception 'The player is no longer in your team.' using errcode = '22023';
    end if;
    delete from public.team_members where team_id = tr.from_team_id and player_id = tr.player_id;
    insert into public.team_members (team_id, player_id, added_by)
    values (tr.to_team_id, tr.player_id, tr.requested_by) on conflict do nothing;
    -- other waiting requests for the same player from this team are no longer possible
    update public.player_transfers set status = 'cancelled', decided_at = now(), decided_by = (select auth.uid()),
           decision_reason = 'Player moved to another team'
     where player_id = tr.player_id and from_team_id = tr.from_team_id and status = 'pending' and id <> tr.id;
  end if;
  update public.player_transfers set status = case when p_accept then 'accepted' else 'rejected' end,
         decision_reason = reason, decided_by = (select auth.uid()), decided_at = now()
   where id = p_transfer_id;

  select display_name, profile_id into pname, profile from public.players where id = tr.player_id;
  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  select r, 'transfer_decided', case when p_accept then 'Transfer completed' else 'Transfer declined' end,
         pname || case when p_accept then ' moved from ' || (select name from public.teams where id = tr.from_team_id)
                                          || ' to ' || (select name from public.teams where id = tr.to_team_id) || '.'
                       else ' stays with ' || (select name from public.teams where id = tr.from_team_id) || '. Reason: ' || reason end,
         jsonb_build_object('transfer_id', tr.id, 'team_id', tr.to_team_id)
    from unnest(array[tr.requested_by, case when p_accept then profile end]) r
   where r is not null and r <> (select auth.uid());
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), case when p_accept then 'TRANSFER_ACCEPTED' else 'TRANSFER_REJECTED' end, 'teams', tr.from_team_id::text,
          jsonb_build_object('transfer_id', tr.id, 'player_id', tr.player_id, 'to_team', tr.to_team_id, 'reason', reason));
  if p_accept then
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
    values ((select auth.uid()), 'PLAYER_JOINED_BY_TRANSFER', 'teams', tr.to_team_id::text,
            jsonb_build_object('transfer_id', tr.id, 'player_id', tr.player_id, 'from_team', tr.from_team_id));
  end if;
  return jsonb_build_object('id', tr.id, 'status', case when p_accept then 'accepted' else 'rejected' end);
end;
$$;

create or replace function public.cancel_player_transfer(p_transfer_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare tr record;
begin
  select * into tr from public.player_transfers where id = p_transfer_id;
  if not found then raise exception 'Transfer request not found.' using errcode = '22023'; end if;
  perform private.require_team_owner(tr.to_team_id);
  if tr.status <> 'pending' then raise exception 'This request has already been answered.' using errcode = '22023'; end if;
  update public.player_transfers set status = 'cancelled', decided_by = (select auth.uid()), decided_at = now() where id = p_transfer_id;
  return jsonb_build_object('id', p_transfer_id, 'status', 'cancelled');
end;
$$;

-- Transfers that involve one team (incoming and outgoing), for its owner.
create or replace function public.get_team_transfers(p_team_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_team_owner(p_team_id);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', tr.id, 'status', tr.status, 'note', tr.note, 'decision_reason', tr.decision_reason,
      'created_at', tr.created_at, 'decided_at', tr.decided_at,
      'direction', case when tr.from_team_id = p_team_id then 'outgoing' else 'incoming' end,
      'player', jsonb_build_object('id', p.id, 'name', p.display_name, 'photo_url', p.photo_url),
      'from_team', jsonb_build_object('id', ft.id, 'name', ft.name),
      'to_team', jsonb_build_object('id', tt.id, 'name', tt.name)
    ) order by (tr.status = 'pending') desc, tr.created_at desc)
    from public.player_transfers tr
    join public.players p on p.id = tr.player_id
    join public.teams ft on ft.id = tr.from_team_id
    join public.teams tt on tt.id = tr.to_team_id
    where p_team_id in (tr.from_team_id, tr.to_team_id)), '[]'::jsonb);
end;
$$;

-- Find teams by name to ask for a player (small public search).
create or replace function public.search_teams(p_query text)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'city', t.city, 'logo_url', t.logo_url) order by t.name), '[]'::jsonb)
    from (select * from public.teams
           where pg_catalog.length(pg_catalog.btrim(coalesce(p_query, ''))) >= 2
             and name ilike '%' || replace(replace(pg_catalog.btrim(p_query), '%', ''), '_', '') || '%'
           order by name limit 15) t;
$$;

revoke all on function public.get_match_lineups(uuid) from public;
revoke all on function public.set_match_lineup(uuid, uuid, jsonb) from public, anon;
revoke all on function public.replace_match_player(uuid, uuid, uuid, uuid, text) from public, anon;
revoke all on function public.request_player_transfer(uuid, uuid, uuid, text) from public, anon;
revoke all on function public.decide_player_transfer(uuid, boolean, text) from public, anon;
revoke all on function public.cancel_player_transfer(uuid) from public, anon;
revoke all on function public.get_team_transfers(uuid) from public, anon;
revoke all on function public.search_teams(text) from public, anon;
grant execute on function public.get_match_lineups(uuid) to anon, authenticated;
grant execute on function public.set_match_lineup(uuid, uuid, jsonb) to authenticated;
grant execute on function public.replace_match_player(uuid, uuid, uuid, uuid, text) to authenticated;
grant execute on function public.request_player_transfer(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.decide_player_transfer(uuid, boolean, text) to authenticated;
grant execute on function public.cancel_player_transfer(uuid) to authenticated;
grant execute on function public.get_team_transfers(uuid) to authenticated;
grant execute on function public.search_teams(text) to authenticated;

-- Organiser sets players a side and substitutes along with the other rules.
create or replace function public.set_tournament_rules(p_tournament_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_tournament_organiser(p_tournament_id);
  update public.tournaments set
    overs_per_innings = case when p ? 'overs_per_innings' then nullif(p->>'overs_per_innings', '')::int else overs_per_innings end,
    points_win        = coalesce(nullif(p->>'points_win', '')::int, points_win),
    points_tie        = coalesce(nullif(p->>'points_tie', '')::int, points_tie),
    points_no_result  = coalesce(nullif(p->>'points_no_result', '')::int, points_no_result),
    qualify_per_group = coalesce(nullif(p->>'qualify_per_group', '')::int, qualify_per_group),
    players_per_side  = coalesce(nullif(p->>'players_per_side', '')::int, players_per_side),
    max_substitutes   = coalesce(nullif(p->>'max_substitutes', '')::int, max_substitutes)
  where id = p_tournament_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'TOURNAMENT_RULES_UPDATED', 'tournaments', p_tournament_id::text, p);
  return jsonb_build_object('id', p_tournament_id);
end;
$$;

-- Team history stays public, so transfer negotiations (requests / declines) and lineup saves are left out;
-- completed transfers show the other team's name.
create or replace function public.get_team_history(p_team_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  return coalesce((
    select jsonb_agg(h order by h.created_at desc)
    from (
      select a.created_at, a.action,
             coalesce(ap.display_name, 'Someone') as by_name,
             (select pl.display_name from public.players pl where pl.id = (a.metadata ->> 'player_id')::uuid) as player_name,
             (select pl.display_name from public.players pl where pl.id = (a.metadata ->> 'captain')::uuid) as captain_name,
             (select pl.display_name from public.players pl where pl.id = (a.metadata ->> 'vice_captain')::uuid) as vice_captain_name,
             (select pl.display_name from public.players pl where pl.id = (a.metadata ->> 'icon')::uuid) as icon_name,
             (select t.name from public.teams t where t.id = coalesce(a.metadata ->> 'to_team', a.metadata ->> 'from_team')::uuid) as other_team_name,
             (select pl.display_name from public.players pl where pl.id = (a.metadata ->> 'in')::uuid) as in_name,
             (select pl.display_name from public.players pl where pl.id = (a.metadata ->> 'out')::uuid) as out_name,
             a.metadata ->> 'reason' as reason
      from public.audit_logs a
      left join public.profiles ap on ap.id = a.actor_user_id
      where a.entity_type = 'teams' and a.entity_id = p_team_id::text
        and a.action not in ('TRANSFER_REQUESTED', 'TRANSFER_REJECTED', 'MATCH_LINEUP_SET')
      order by a.created_at desc
      limit 100
    ) h
  ), '[]'::jsonb);
end;
$$;
