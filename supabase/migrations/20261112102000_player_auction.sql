-- #231 Player auction: a saved auction board like a local league auction sheet.
-- Teams with a purse, a numbered player pool, sold / unsold / undo, and per-team totals:
-- budget, used, remaining, players bought, places left, average per place, max next bid, minimum required.
-- The creator (or the linked tournament's organiser) runs it; anyone with the link can watch it.

create table if not exists public.auctions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  tournament_id uuid references public.tournaments(id) on delete set null,
  name text not null check (length(name) between 3 and 120),
  base_price int not null default 100 check (base_price between 1 and 10000000),
  bid_step int not null default 50 check (bid_step between 1 and 10000000),
  squad_size int not null default 14 check (squad_size between 1 and 40),
  status text not null default 'open' check (status in ('open', 'finished')),
  current_player_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.auction_teams (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  budget int not null check (budget between 0 and 1000000000),
  team_id uuid references public.teams(id) on delete set null,
  position int not null default 0
);
create table if not exists public.auction_players (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions(id) on delete cascade,
  number int not null,
  name text not null check (length(name) between 1 and 80),
  role text check (role is null or role in ('batter', 'bowler', 'all_rounder', 'wicket_keeper')),
  base_price int check (base_price is null or base_price between 1 and 10000000),
  player_id uuid references public.players(id) on delete set null,
  status text not null default 'available' check (status in ('available', 'sold', 'unsold')),
  team_id uuid references public.auction_teams(id) on delete set null,
  price int check (price is null or price >= 0),
  sold_at timestamptz,
  sale_seq int,
  unique (auction_id, number)
);
create index if not exists auction_teams_auction_idx on public.auction_teams(auction_id);
create index if not exists auction_players_auction_idx on public.auction_players(auction_id);
create index if not exists auction_players_team_idx on public.auction_players(team_id);
create index if not exists auctions_owner_idx on public.auctions(owner_id);
create index if not exists auctions_tournament_idx on public.auctions(tournament_id);
alter table public.auctions enable row level security;
alter table public.auction_teams enable row level security;
alter table public.auction_players enable row level security;
revoke all on public.auctions, public.auction_teams, public.auction_players from anon, authenticated;

create or replace function private.can_run_auction(p_auction_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.auctions a where a.id = p_auction_id
                 and (a.owner_id = (select auth.uid()) or private.is_admin()
                      or (a.tournament_id is not null and private.is_tournament_organiser(a.tournament_id))));
$$;

create or replace function private.auction_json(p_auction_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with a as (select * from public.auctions where id = p_auction_id),
  t as (
    select at.*, coalesce(sum(ap.price) filter (where ap.status = 'sold'), 0)::int as used,
           count(ap.id) filter (where ap.status = 'sold')::int as bought
      from public.auction_teams at left join public.auction_players ap on ap.team_id = at.id
     where at.auction_id = p_auction_id group by at.id
  )
  select jsonb_build_object(
    'id', a.id, 'name', a.name, 'base_price', a.base_price, 'bid_step', a.bid_step, 'squad_size', a.squad_size,
    'status', a.status, 'current_player_id', a.current_player_id, 'tournament_id', a.tournament_id,
    'tournament', (select jsonb_build_object('id', tr.id, 'name', tr.name) from public.tournaments tr where tr.id = a.tournament_id),
    'created_at', a.created_at, 'updated_at', a.updated_at, 'can_run', private.can_run_auction(a.id),
    'teams', coalesce((select jsonb_agg(jsonb_build_object(
        'id', t.id, 'name', t.name, 'budget', t.budget, 'team_id', t.team_id, 'used', t.used, 'remaining', t.budget - t.used,
        'bought', t.bought, 'places_left', greatest(a.squad_size - t.bought, 0),
        'average', case when a.squad_size - t.bought > 0 then round((t.budget - t.used)::numeric / (a.squad_size - t.bought), 2) else 0 end,
        'min_required', greatest(a.squad_size - t.bought, 0) * a.base_price,
        'max_bid', case when a.squad_size - t.bought > 0 then greatest((t.budget - t.used) - (a.squad_size - t.bought - 1) * a.base_price, 0) else 0 end
      ) order by t.position, t.name) from t), '[]'::jsonb),
    'players', coalesce((select jsonb_agg(jsonb_build_object(
        'id', p.id, 'number', p.number, 'name', p.name, 'role', p.role, 'base_price', coalesce(p.base_price, a.base_price),
        'player_id', p.player_id, 'status', p.status, 'team_id', p.team_id, 'price', p.price, 'sold_at', p.sold_at, 'sale_seq', p.sale_seq
      ) order by p.number) from public.auction_players p where p.auction_id = a.id), '[]'::jsonb)
  ) from a;
$$;

-- Create or edit an auction (settings, teams). p: {name, base_price, bid_step, squad_size, tournament_id, teams:[{id?, name, budget}]}
create or replace function public.save_auction(p_auction_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); aid uuid := p_auction_id; tid uuid := nullif(p->>'tournament_id', '')::uuid; x jsonb; i int := 0; keep uuid[] := '{}';
begin
  perform private.require_active_user();
  if pg_catalog.length(pg_catalog.btrim(coalesce(p->>'name', ''))) < 3 then raise exception 'Give the auction a name.' using errcode = '22023'; end if;
  if tid is not null and not private.is_tournament_organiser(tid) and not private.is_admin() then
    raise exception 'Only the tournament organiser can link an auction to this tournament.' using errcode = '42501'; end if;
  if jsonb_typeof(p->'teams') <> 'array' or jsonb_array_length(p->'teams') < 2 or jsonb_array_length(p->'teams') > 32 then
    raise exception 'Add between 2 and 32 teams.' using errcode = '22023'; end if;
  if aid is null then
    if (select count(*) from public.auctions where owner_id = uid and created_at > now() - interval '1 day') >= 10 then
      raise exception 'You have created many auctions today. Please try again tomorrow.' using errcode = '22023'; end if;
    insert into public.auctions (owner_id, tournament_id, name, base_price, bid_step, squad_size)
    values (uid, tid, pg_catalog.btrim(p->>'name'), coalesce(nullif(p->>'base_price', '')::int, 100),
            coalesce(nullif(p->>'bid_step', '')::int, 50), coalesce(nullif(p->>'squad_size', '')::int, 14))
    returning id into aid;
  else
    if not private.can_run_auction(aid) then raise exception 'Only the auction organiser can change it.' using errcode = '42501'; end if;
    update public.auctions set name = pg_catalog.btrim(p->>'name'), tournament_id = tid,
      base_price = coalesce(nullif(p->>'base_price', '')::int, base_price), bid_step = coalesce(nullif(p->>'bid_step', '')::int, bid_step),
      squad_size = coalesce(nullif(p->>'squad_size', '')::int, squad_size), updated_at = now()
    where id = aid;
  end if;
  for x in select * from jsonb_array_elements(p->'teams') loop
    i := i + 1;
    if pg_catalog.length(pg_catalog.btrim(coalesce(x->>'name', ''))) = 0 then raise exception 'Team % needs a name.', i using errcode = '22023'; end if;
    if nullif(x->>'id', '') is not null and exists (select 1 from public.auction_teams where id = (x->>'id')::uuid and auction_id = aid) then
      update public.auction_teams set name = pg_catalog.btrim(x->>'name'), budget = coalesce(nullif(x->>'budget', '')::int, budget),
        team_id = nullif(x->>'team_id', '')::uuid, position = i where id = (x->>'id')::uuid;
      keep := keep || (x->>'id')::uuid;
    else
      insert into public.auction_teams (auction_id, name, budget, team_id, position)
      values (aid, pg_catalog.btrim(x->>'name'), coalesce(nullif(x->>'budget', '')::int, 0), nullif(x->>'team_id', '')::uuid, i)
      returning id into tid;
      keep := keep || tid;
    end if;
  end loop;
  if exists (select 1 from public.auction_players ap join public.auction_teams at on at.id = ap.team_id
             where at.auction_id = aid and not (at.id = any(keep))) then
    raise exception 'A team that has bought players cannot be removed. Undo its sales first.' using errcode = '22023'; end if;
  delete from public.auction_teams where auction_id = aid and not (id = any(keep));
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, case when p_auction_id is null then 'AUCTION_CREATED' else 'AUCTION_UPDATED' end, 'auctions', aid::text, jsonb_build_object('name', p->>'name'));
  return private.auction_json(aid);
end $$;

-- Add players. p_players: [{name, role, base_price, number?, player_id?}]
create or replace function public.add_auction_players(p_auction_id uuid, p_players jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare x jsonb; num int;
begin
  perform private.require_active_user();
  if not private.can_run_auction(p_auction_id) then raise exception 'Only the auction organiser can add players.' using errcode = '42501'; end if;
  if jsonb_typeof(p_players) <> 'array' or jsonb_array_length(p_players) = 0 then raise exception 'No players to add.' using errcode = '22023'; end if;
  if (select count(*) from public.auction_players where auction_id = p_auction_id) + jsonb_array_length(p_players) > 600 then
    raise exception 'An auction can have at most 600 players.' using errcode = '22023'; end if;
  for x in select * from jsonb_array_elements(p_players) loop
    if pg_catalog.length(pg_catalog.btrim(coalesce(x->>'name', ''))) = 0 then continue; end if;
    num := case when (x->>'number') ~ '^\d{1,4}$' then (x->>'number')::int end;
    if num is null or num < 1 or exists (select 1 from public.auction_players where auction_id = p_auction_id and number = num) then
      select coalesce(max(number), 0) + 1 into num from public.auction_players where auction_id = p_auction_id;
    end if;
    insert into public.auction_players (auction_id, number, name, role, base_price, player_id)
    values (p_auction_id, num, pg_catalog.left(pg_catalog.btrim(x->>'name'), 80),
            case when x->>'role' in ('batter', 'bowler', 'all_rounder', 'wicket_keeper') then x->>'role' end,
            case when (x->>'base_price') ~ '^\d{1,8}$' and (x->>'base_price')::int > 0 then (x->>'base_price')::int end,
            nullif(x->>'player_id', '')::uuid);
  end loop;
  update public.auctions set updated_at = now() where id = p_auction_id;
  return private.auction_json(p_auction_id);
end $$;

create or replace function public.remove_auction_player(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ap public.auction_players%rowtype;
begin
  select * into ap from public.auction_players where id = p_player_id;
  if not found then raise exception 'Player not found.' using errcode = '22023'; end if;
  if not private.can_run_auction(ap.auction_id) then raise exception 'Only the auction organiser can remove players.' using errcode = '42501'; end if;
  if ap.status = 'sold' then raise exception 'Undo the sale first.' using errcode = '22023'; end if;
  delete from public.auction_players where id = p_player_id;
  return private.auction_json(ap.auction_id);
end $$;

-- Put a player on the block (shown to everyone watching).
create or replace function public.set_auction_current(p_auction_id uuid, p_player_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_run_auction(p_auction_id) then raise exception 'Only the auction organiser can do this.' using errcode = '42501'; end if;
  if p_player_id is not null and not exists (select 1 from public.auction_players where id = p_player_id and auction_id = p_auction_id and status <> 'sold') then
    raise exception 'Choose a player who is not sold yet.' using errcode = '22023'; end if;
  update public.auctions set current_player_id = p_player_id, updated_at = now() where id = p_auction_id;
  return private.auction_json(p_auction_id);
end $$;

-- Sell a player: price must be at least the base price and within the team's max next bid.
create or replace function public.sell_auction_player(p_player_id uuid, p_team_id uuid, p_price int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ap public.auction_players%rowtype; a public.auctions%rowtype; tj jsonb; seq int;
begin
  perform private.require_active_user();
  select * into ap from public.auction_players where id = p_player_id for update;
  if not found then raise exception 'Player not found.' using errcode = '22023'; end if;
  select * into a from public.auctions where id = ap.auction_id for update;
  if not private.can_run_auction(a.id) then raise exception 'Only the auction organiser can sell players.' using errcode = '42501'; end if;
  if a.status = 'finished' then raise exception 'This auction is finished.' using errcode = '22023'; end if;
  if ap.status = 'sold' then raise exception 'This player is already sold.' using errcode = '22023'; end if;
  if not exists (select 1 from public.auction_teams where id = p_team_id and auction_id = a.id) then raise exception 'Choose a team in this auction.' using errcode = '22023'; end if;
  if p_price is null or p_price < coalesce(ap.base_price, a.base_price) then
    raise exception 'The price must be at least the base price (%).', coalesce(ap.base_price, a.base_price) using errcode = '22023'; end if;
  select x.value into tj from jsonb_array_elements(private.auction_json(a.id)->'teams') x where x.value->>'id' = p_team_id::text;
  if (tj->>'places_left')::int <= 0 then raise exception '% already has a full squad (% players).', tj->>'name', a.squad_size using errcode = '22023'; end if;
  if p_price > (tj->>'max_bid')::int then
    raise exception '% can bid at most % (it must keep % for each remaining place).', tj->>'name', tj->>'max_bid', a.base_price using errcode = '22023'; end if;
  select coalesce(max(sale_seq), 0) + 1 into seq from public.auction_players where auction_id = a.id;
  update public.auction_players set status = 'sold', team_id = p_team_id, price = p_price, sold_at = now(), sale_seq = seq where id = ap.id;
  update public.auctions set current_player_id = null, updated_at = now() where id = a.id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'AUCTION_SALE', 'auctions', a.id::text, jsonb_build_object('player', ap.name, 'team', tj->>'name', 'price', p_price));
  return private.auction_json(a.id);
end $$;

create or replace function public.mark_auction_unsold(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ap public.auction_players%rowtype;
begin
  select * into ap from public.auction_players where id = p_player_id for update;
  if not found then raise exception 'Player not found.' using errcode = '22023'; end if;
  if not private.can_run_auction(ap.auction_id) then raise exception 'Only the auction organiser can do this.' using errcode = '42501'; end if;
  if ap.status = 'sold' then raise exception 'Undo the sale first.' using errcode = '22023'; end if;
  update public.auction_players set status = case when status = 'unsold' then 'available' else 'unsold' end where id = ap.id;
  update public.auctions set current_player_id = null, updated_at = now() where id = ap.auction_id;
  return private.auction_json(ap.auction_id);
end $$;

-- Undo a sale (the given player, or the last sale when p_player_id is null).
create or replace function public.undo_auction_sale(p_auction_id uuid, p_player_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare pid uuid := p_player_id;
begin
  if not private.can_run_auction(p_auction_id) then raise exception 'Only the auction organiser can undo a sale.' using errcode = '42501'; end if;
  if pid is null then select id into pid from public.auction_players where auction_id = p_auction_id and status = 'sold' order by sale_seq desc limit 1; end if;
  if pid is null then raise exception 'Nothing to undo.' using errcode = '22023'; end if;
  update public.auction_players set status = 'available', team_id = null, price = null, sold_at = null, sale_seq = null
   where id = pid and auction_id = p_auction_id and status = 'sold';
  if not found then raise exception 'That player is not sold.' using errcode = '22023'; end if;
  update public.auctions set current_player_id = pid, updated_at = now() where id = p_auction_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'AUCTION_SALE_UNDONE', 'auctions', p_auction_id::text, jsonb_build_object('player_id', pid));
  return private.auction_json(p_auction_id);
end $$;

create or replace function public.finish_auction(p_auction_id uuid, p_finished boolean default true)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_run_auction(p_auction_id) then raise exception 'Only the auction organiser can do this.' using errcode = '42501'; end if;
  update public.auctions set status = case when p_finished then 'finished' else 'open' end, current_player_id = null, updated_at = now() where id = p_auction_id;
  return private.auction_json(p_auction_id);
end $$;

create or replace function public.delete_auction(p_auction_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.auctions where id = p_auction_id and (owner_id = (select auth.uid()) or private.is_admin())) then
    raise exception 'Only the person who created the auction can delete it.' using errcode = '42501'; end if;
  delete from public.auctions where id = p_auction_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id) values ((select auth.uid()), 'AUCTION_DELETED', 'auctions', p_auction_id::text);
  return jsonb_build_object('deleted', true);
end $$;

-- Anyone with the link can watch an auction.
create or replace function public.get_auction(p_auction_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$ select private.auction_json(p_auction_id); $$;

create or replace function public.list_auctions(p jsonb default '{}'::jsonb)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'status', a.status, 'created_at', a.created_at, 'updated_at', a.updated_at,
           'teams', (select count(*) from public.auction_teams t where t.auction_id = a.id),
           'players', (select count(*) from public.auction_players x where x.auction_id = a.id),
           'sold', (select count(*) from public.auction_players x where x.auction_id = a.id and x.status = 'sold'),
           'tournament_id', a.tournament_id, 'mine', a.owner_id = (select auth.uid())) order by a.updated_at desc), '[]'::jsonb)
    from public.auctions a
   where (nullif(p->>'tournament_id', '') is not null and a.tournament_id = (p->>'tournament_id')::uuid)
      or (nullif(p->>'tournament_id', '') is null and a.owner_id = (select auth.uid()));
$$;

do $$
declare f text;
begin
  foreach f in array array['public.save_auction(uuid, jsonb)', 'public.add_auction_players(uuid, jsonb)', 'public.remove_auction_player(uuid)',
    'public.set_auction_current(uuid, uuid)', 'public.sell_auction_player(uuid, uuid, int)', 'public.mark_auction_unsold(uuid)',
    'public.undo_auction_sale(uuid, uuid)', 'public.finish_auction(uuid, boolean)', 'public.delete_auction(uuid)', 'public.list_auctions(jsonb)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  execute 'revoke all on function public.get_auction(uuid) from public';
  execute 'grant execute on function public.get_auction(uuid) to anon, authenticated';
  execute 'revoke all on function private.auction_json(uuid) from public, anon, authenticated';
  execute 'revoke all on function private.can_run_auction(uuid) from public, anon, authenticated';
end $$;
