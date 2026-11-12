-- #231 Player auction: full player details – ID number (a Local Cricket ID like LC-000214 links the
-- registered player and fills in their details), role, batting hand, batting position and bowling style.
-- Players can be edited; teams can carry a short name and an owner / captain name.

alter table public.auction_players add column if not exists player_code text check (player_code is null or length(player_code) <= 40);
alter table public.auction_players add column if not exists batting_style text check (batting_style is null or batting_style in ('right_hand', 'left_hand'));
alter table public.auction_players add column if not exists batting_position text check (batting_position is null or batting_position in ('opener', 'top_order', 'middle_order', 'finisher', 'lower_order'));
alter table public.auction_players add column if not exists bowling_style text check (bowling_style is null or bowling_style in
  ('right_arm_fast', 'right_arm_medium', 'right_arm_off_spin', 'right_arm_leg_spin', 'left_arm_fast', 'left_arm_medium', 'left_arm_orthodox', 'left_arm_chinaman', 'none'));
alter table public.auction_players add column if not exists note text check (note is null or length(note) <= 200);
alter table public.auction_teams add column if not exists short_name text check (short_name is null or length(short_name) <= 10);
alter table public.auction_teams add column if not exists owner_name text check (owner_name is null or length(owner_name) <= 80);

-- Clean one player row from the client; fills blanks from a registered player found by code.
create or replace function private.auction_player_fields(x jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare code text := nullif(pg_catalog.upper(pg_catalog.btrim(coalesce(x->>'player_code', ''))), ''); pl public.players%rowtype;
begin
  if code is not null then select * into pl from public.players where pg_catalog.upper(player_code) = code limit 1; end if;
  return jsonb_build_object(
    'name', coalesce(nullif(pg_catalog.left(pg_catalog.btrim(coalesce(x->>'name', '')), 80), ''), pl.display_name),
    'player_code', code,
    'player_id', coalesce(nullif(x->>'player_id', ''), pl.id::text),
    'role', case when x->>'role' in ('batter', 'bowler', 'all_rounder', 'wicket_keeper') then x->>'role' else pl.player_role end,
    'batting_style', case when x->>'batting_style' in ('right_hand', 'left_hand') then x->>'batting_style' else pl.batting_style end,
    'batting_position', case when x->>'batting_position' in ('opener', 'top_order', 'middle_order', 'finisher', 'lower_order') then x->>'batting_position' end,
    'bowling_style', case when x->>'bowling_style' in ('right_arm_fast', 'right_arm_medium', 'right_arm_off_spin', 'right_arm_leg_spin', 'left_arm_fast', 'left_arm_medium', 'left_arm_orthodox', 'left_arm_chinaman', 'none')
                          then x->>'bowling_style' else pl.bowling_style end,
    'base_price', case when (x->>'base_price') ~ '^\d{1,8}$' and (x->>'base_price')::int > 0 then (x->>'base_price')::int end,
    'note', nullif(pg_catalog.left(pg_catalog.btrim(coalesce(x->>'note', '')), 200), ''));
end $$;

create or replace function public.add_auction_players(p_auction_id uuid, p_players jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare x jsonb; c jsonb; num int;
begin
  perform private.require_active_user();
  if not private.can_run_auction(p_auction_id) then raise exception 'Only the auction organiser can add players.' using errcode = '42501'; end if;
  if jsonb_typeof(p_players) <> 'array' or jsonb_array_length(p_players) = 0 then raise exception 'No players to add.' using errcode = '22023'; end if;
  if (select count(*) from public.auction_players where auction_id = p_auction_id) + jsonb_array_length(p_players) > 600 then
    raise exception 'An auction can have at most 600 players.' using errcode = '22023'; end if;
  for x in select * from jsonb_array_elements(p_players) loop
    c := private.auction_player_fields(x);
    if c->>'name' is null then continue; end if;
    num := case when (x->>'number') ~ '^\d{1,4}$' then (x->>'number')::int end;
    if num is null or num < 1 or exists (select 1 from public.auction_players where auction_id = p_auction_id and number = num) then
      select coalesce(max(number), 0) + 1 into num from public.auction_players where auction_id = p_auction_id;
    end if;
    insert into public.auction_players (auction_id, number, name, role, base_price, player_id, player_code, batting_style, batting_position, bowling_style, note)
    values (p_auction_id, num, c->>'name', c->>'role', (c->>'base_price')::int, nullif(c->>'player_id', '')::uuid, c->>'player_code',
            c->>'batting_style', c->>'batting_position', c->>'bowling_style', c->>'note');
  end loop;
  update public.auctions set updated_at = now() where id = p_auction_id;
  return private.auction_json(p_auction_id);
end $$;

create or replace function public.update_auction_player(p_player_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ap public.auction_players%rowtype; c jsonb; num int;
begin
  select * into ap from public.auction_players where id = p_player_id for update;
  if not found then raise exception 'Player not found.' using errcode = '22023'; end if;
  if not private.can_run_auction(ap.auction_id) then raise exception 'Only the auction organiser can edit players.' using errcode = '42501'; end if;
  c := private.auction_player_fields(p);
  if c->>'name' is null then raise exception 'The player needs a name.' using errcode = '22023'; end if;
  num := case when (p->>'number') ~ '^\d{1,4}$' then (p->>'number')::int else ap.number end;
  if num <> ap.number and exists (select 1 from public.auction_players where auction_id = ap.auction_id and number = num) then
    raise exception 'Number % is already used by another player.', num using errcode = '22023'; end if;
  update public.auction_players set number = num, name = c->>'name', role = c->>'role', base_price = (c->>'base_price')::int,
    player_id = nullif(c->>'player_id', '')::uuid, player_code = c->>'player_code', batting_style = c->>'batting_style',
    batting_position = c->>'batting_position', bowling_style = c->>'bowling_style', note = c->>'note'
  where id = ap.id;
  update public.auctions set updated_at = now() where id = ap.auction_id;
  return private.auction_json(ap.auction_id);
end $$;

-- Teams carry a short name and an owner / captain name.
do $$
declare d text; n text;
begin
  d := pg_get_functiondef('public.save_auction(uuid, jsonb)'::regprocedure);
  n := replace(d, E'team_id = nullif(x->>''team_id'', '''')::uuid, position = i where id = (x->>''id'')::uuid;',
    E'team_id = nullif(x->>''team_id'', '''')::uuid, position = i,\n        short_name = nullif(pg_catalog.left(pg_catalog.upper(pg_catalog.btrim(coalesce(x->>''short_name'', ''''))), 10), ''''),\n        owner_name = nullif(pg_catalog.left(pg_catalog.btrim(coalesce(x->>''owner_name'', '''')), 80), '''') where id = (x->>''id'')::uuid;');
  n := replace(n, E'insert into public.auction_teams (auction_id, name, budget, team_id, position)\n      values (aid, pg_catalog.btrim(x->>''name''), coalesce(nullif(x->>''budget'', '''')::int, 0), nullif(x->>''team_id'', '''')::uuid, i)',
    E'insert into public.auction_teams (auction_id, name, budget, team_id, position, short_name, owner_name)\n      values (aid, pg_catalog.btrim(x->>''name''), coalesce(nullif(x->>''budget'', '''')::int, 0), nullif(x->>''team_id'', '''')::uuid, i,\n              nullif(pg_catalog.left(pg_catalog.upper(pg_catalog.btrim(coalesce(x->>''short_name'', ''''))), 10), ''''), nullif(pg_catalog.left(pg_catalog.btrim(coalesce(x->>''owner_name'', '''')), 80), ''''))');
  if pg_catalog.length(n) - pg_catalog.length(d) < 300 then raise exception 'save_auction patch failed (%)', pg_catalog.length(n) - pg_catalog.length(d); end if;
  execute n;

  d := pg_get_functiondef('private.auction_json(uuid)'::regprocedure);
  n := replace(d, E'''id'', t.id, ''name'', t.name, ''budget'', t.budget,', E'''id'', t.id, ''name'', t.name, ''short_name'', t.short_name, ''owner_name'', t.owner_name, ''budget'', t.budget,');
  n := replace(n, E'''player_id'', p.player_id, ''status'', p.status,', E'''player_id'', p.player_id, ''player_code'', p.player_code, ''batting_style'', p.batting_style, ''batting_position'', p.batting_position, ''bowling_style'', p.bowling_style, ''note'', p.note, ''status'', p.status,');
  if pg_catalog.length(n) - pg_catalog.length(d) < 150 then raise exception 'auction_json patch failed'; end if;
  execute n;
end $$;

revoke all on function public.update_auction_player(uuid, jsonb) from public, anon;
grant execute on function public.update_auction_player(uuid, jsonb) to authenticated;
revoke all on function private.auction_player_fields(jsonb) from public, anon, authenticated;
