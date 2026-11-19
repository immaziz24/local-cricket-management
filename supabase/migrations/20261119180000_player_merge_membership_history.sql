-- Batch 6: #341 historical team membership effective dates, #338 player duplicate detection and controlled merge.

-- ---------- #341 membership history ----------
create table if not exists public.team_membership_history (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  joined_at timestamptz not null,
  left_at timestamptz,
  left_reason text,
  changed_by uuid,
  created_at timestamptz not null default now(),
  constraint membership_dates_ok check (left_at is null or left_at >= joined_at)
);
create index if not exists team_membership_history_player_idx on public.team_membership_history (player_id);
create index if not exists team_membership_history_team_player_idx on public.team_membership_history (team_id, player_id);
create unique index if not exists team_membership_history_one_open on public.team_membership_history (team_id, player_id) where left_at is null;
alter table public.team_membership_history enable row level security;

insert into public.team_membership_history (team_id, player_id, joined_at)
select tm.team_id, tm.player_id, coalesce(tm.joined_at, now()) from public.team_members tm
 where not exists (select 1 from public.team_membership_history h where h.team_id = tm.team_id and h.player_id = tm.player_id and h.left_at is null);

create or replace function private.log_team_membership() returns trigger language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if tg_op = 'INSERT' then
    insert into public.team_membership_history (team_id, player_id, joined_at, changed_by)
    values (new.team_id, new.player_id, coalesce(new.joined_at, now()), (select auth.uid()))
    on conflict do nothing;
    return new;
  else
    update public.team_membership_history set left_at = greatest(now(), joined_at), left_reason = coalesce(left_reason, 'left'), changed_by = (select auth.uid())
     where team_id = old.team_id and player_id = old.player_id and left_at is null;
    get diagnostics n = row_count;
    if n = 0 and exists (select 1 from public.players p where p.id = old.player_id) and exists (select 1 from public.teams t where t.id = old.team_id) then
      insert into public.team_membership_history (team_id, player_id, joined_at, left_at, left_reason, changed_by)
      values (old.team_id, old.player_id, coalesce(old.joined_at, now()), greatest(now(), coalesce(old.joined_at, now())), 'left', (select auth.uid()));
    end if;
    return old;
  end if;
end;
$$;
drop trigger if exists team_members_history on public.team_members;
create trigger team_members_history after insert or delete on public.team_members for each row execute function private.log_team_membership();

create or replace function public.get_player_team_history(p_player_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', h.id, 'team_id', h.team_id, 'team_name', t.name, 'joined_at', h.joined_at, 'left_at', h.left_at,
    'left_reason', h.left_reason, 'is_current', h.left_at is null,
    'can_edit', (private.is_admin() or t.owner_id = (select auth.uid()))) order by h.joined_at desc), '[]'::jsonb)
  from public.team_membership_history h join public.teams t on t.id = h.team_id
  where h.player_id = p_player_id;
$$;

create or replace function public.was_team_member_on(p_team_id uuid, p_player_id uuid, p_at timestamptz)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.team_membership_history h
    where h.team_id = p_team_id and h.player_id = p_player_id and h.joined_at <= p_at and (h.left_at is null or h.left_at >= p_at));
$$;

create or replace function public.set_membership_dates(p_history_id uuid, p_joined timestamptz, p_left timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare h public.team_membership_history%rowtype; t public.teams%rowtype; uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  select * into h from public.team_membership_history where id = p_history_id;
  if not found then raise exception 'Membership record not found.' using errcode = '22023'; end if;
  select * into t from public.teams where id = h.team_id;
  if not (private.is_admin() or t.owner_id = uid) then raise exception 'Only the team owner or an admin can correct membership dates.' using errcode = '42501'; end if;
  if p_joined is null or p_joined > now() then raise exception 'The joining date must be in the past.' using errcode = '22023'; end if;
  if p_left is not null and p_left < p_joined then raise exception 'The leaving date cannot be before the joining date.' using errcode = '22023'; end if;
  if h.left_at is null and p_left is not null then raise exception 'The player is still in the squad. Remove the player from the team to set a leaving date.' using errcode = '22023'; end if;
  if h.left_at is not null and p_left is null then raise exception 'A past membership needs a leaving date.' using errcode = '22023'; end if;
  if exists (select 1 from public.team_membership_history o where o.team_id = h.team_id and o.player_id = h.player_id and o.id <> h.id
             and o.joined_at < coalesce(p_left, 'infinity'::timestamptz) and coalesce(o.left_at, 'infinity'::timestamptz) > p_joined) then
    raise exception 'These dates overlap another time this player was in the same team.' using errcode = '22023';
  end if;
  update public.team_membership_history set joined_at = p_joined, left_at = p_left, changed_by = uid where id = p_history_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, target_user_id, metadata)
  values (uid, 'MEMBERSHIP_DATES_SET', 'players', h.player_id::text, null,
          jsonb_build_object('team_id', h.team_id, 'player_id', h.player_id, 'joined_at', p_joined, 'left_at', p_left, 'was_joined_at', h.joined_at, 'was_left_at', h.left_at));
  return public.get_player_team_history(h.player_id);
end;
$$;

-- ---------- #338 duplicate detection and merge ----------
create table if not exists public.player_merges (
  id uuid primary key default gen_random_uuid(),
  kept_id uuid not null,
  merged_id uuid not null,
  merged_snapshot jsonb not null,
  moved jsonb not null default '{}'::jsonb,
  reason text,
  merged_by uuid,
  created_at timestamptz not null default now()
);
alter table public.player_merges enable row level security;

create or replace function public.find_duplicate_players(p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Only an Admin or Super-Admin can look for duplicate players.' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(x) from (
    select jsonb_build_object(
      'reason', case when length(regexp_replace(coalesce(a.mobile_number, ''), '\D', '', 'g')) >= 10 and right(regexp_replace(a.mobile_number, '\D', '', 'g'), 10) = right(regexp_replace(coalesce(b.mobile_number, ''), '\D', '', 'g'), 10) then 'Same mobile number' else 'Same name and date of birth' end,
      'a', jsonb_build_object('id', a.id, 'name', a.display_name, 'mobile', a.mobile_number, 'dob', a.date_of_birth, 'code', a.player_code, 'has_account', a.profile_id is not null,
             'teams', (select count(*) from public.team_members tm where tm.player_id = a.id), 'matches', (select count(*) from public.match_players mp where mp.player_id = a.id)),
      'b', jsonb_build_object('id', b.id, 'name', b.display_name, 'mobile', b.mobile_number, 'dob', b.date_of_birth, 'code', b.player_code, 'has_account', b.profile_id is not null,
             'teams', (select count(*) from public.team_members tm where tm.player_id = b.id), 'matches', (select count(*) from public.match_players mp where mp.player_id = b.id)),
      'can_merge', not (a.profile_id is not null and b.profile_id is not null)) as x
    from public.players a join public.players b on a.id < b.id
    where (length(regexp_replace(coalesce(a.mobile_number, ''), '\D', '', 'g')) >= 10 and right(regexp_replace(a.mobile_number, '\D', '', 'g'), 10) = right(regexp_replace(coalesce(b.mobile_number, ''), '\D', '', 'g'), 10))
       or (a.date_of_birth is not null and a.date_of_birth = b.date_of_birth and lower(btrim(a.display_name)) = lower(btrim(b.display_name)))
    order by a.display_name
    limit greatest(1, least(coalesce(p_limit, 50), 200))) s), '[]'::jsonb);
end;
$$;

-- Core merge without the permission check, so it can be tested; the public wrapper below checks Admin.
create or replace function private.merge_players_core(p_keep uuid, p_merge uuid, p_actor uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare k public.players%rowtype; m public.players%rowtype; r record; rec record; n int; moved jsonb := '{}'::jsonb;
begin
  if p_keep = p_merge then raise exception 'Choose two different players.' using errcode = '22023'; end if;
  select * into k from public.players where id = p_keep; if not found then raise exception 'Player to keep not found.' using errcode = '22023'; end if;
  select * into m from public.players where id = p_merge; if not found then raise exception 'Player to merge not found.' using errcode = '22023'; end if;
  if k.profile_id is not null and m.profile_id is not null then
    raise exception 'Both players belong to different registered accounts. They cannot be merged.' using errcode = '22023';
  end if;
  -- the registered account (if any) always ends up on the kept player
  if m.profile_id is not null then
    update public.players set profile_id = null where id = p_merge;
    update public.players set profile_id = m.profile_id where id = p_keep;
  end if;
  for r in
    select c.conrelid::regclass::text as tbl, a.attname::text as col
      from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
     where c.contype = 'f' and c.confrelid = 'public.players'::regclass
  loop
    begin
      execute format('update %s set %I = $1 where %I = $2', r.tbl, r.col, r.col) using p_keep, p_merge;
      get diagnostics n = row_count;
    exception when unique_violation then
      -- the kept player already has an equivalent row for some of these (same team, same match...): move the rest one by one
      n := 0;
      for rec in execute format('select ctid::text as c from %s where %I = $1', r.tbl, r.col) using p_merge loop
        begin
          execute format('update %s set %I = $1 where ctid = $2::tid', r.tbl, r.col) using p_keep, rec.c;
          n := n + 1;
        exception when unique_violation then
          execute format('delete from %s where ctid = $1::tid', r.tbl) using rec.c;
        end;
      end loop;
    end;
    if n > 0 then moved := moved || jsonb_build_object(r.tbl || '.' || r.col, n); end if;
  end loop;
  insert into public.player_merges (kept_id, merged_id, merged_snapshot, moved, reason, merged_by)
  values (p_keep, p_merge, to_jsonb(m), moved, nullif(btrim(coalesce(p_reason, '')), ''), p_actor);
  delete from public.players where id = p_merge;
  update public.players set
    mobile_number = coalesce(nullif(btrim(k.mobile_number), ''), m.mobile_number),
    photo_url = coalesce(k.photo_url, m.photo_url),
    date_of_birth = coalesce(k.date_of_birth, m.date_of_birth),
    location = coalesce(k.location, m.location),
    player_role = coalesce(k.player_role, m.player_role),
    batting_style = coalesce(k.batting_style, m.batting_style),
    bowling_style = coalesce(k.bowling_style, m.bowling_style),
    updated_at = now()
   where id = p_keep;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (p_actor, 'PLAYERS_MERGED', 'players', p_keep::text, jsonb_build_object('kept', p_keep, 'merged', p_merge, 'merged_name', m.display_name, 'moved', moved, 'reason', p_reason));
  return jsonb_build_object('kept', p_keep, 'merged', p_merge, 'moved', moved);
end;
$$;

create or replace function public.merge_players(p_keep uuid, p_merge uuid, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  if not private.is_admin() then raise exception 'Only an Admin or Super-Admin can merge players.' using errcode = '42501'; end if;
  return private.merge_players_core(p_keep, p_merge, (select auth.uid()), p_reason);
end;
$$;

revoke all on function private.log_team_membership() from public, anon, authenticated;
revoke all on function private.merge_players_core(uuid, uuid, uuid, text) from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array[
    'public.set_membership_dates(uuid,timestamptz,timestamptz)', 'public.find_duplicate_players(integer)', 'public.merge_players(uuid,uuid,text)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  foreach f in array array['public.get_player_team_history(uuid)', 'public.was_team_member_on(uuid,uuid,timestamptz)'] loop
    execute format('revoke execute on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;
end $$;
