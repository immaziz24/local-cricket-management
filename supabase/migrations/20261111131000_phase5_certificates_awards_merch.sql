-- Phase 5 – Category J part 2: digital certificates (#196), trophies and awards (#197), tournament merchandise (#198),
-- tournament reports for sponsors (#199), and upload folders for sponsor logos/banners, adverts and merchandise photos.
-- Merchandise orders are paid to the organiser directly until online payments arrive (Category O).

-- ---------- #197 awards ----------
create table if not exists public.tournament_awards (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  award text not null check (award in ('player_of_tournament','best_batter','best_bowler','best_fielder','best_wicketkeeper','emerging_player','fair_play','winner','runner_up','custom')),
  label text not null check (length(label) between 2 and 80),
  player_id uuid references public.players(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  note text check (note is null or length(note) <= 200),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (player_id is not null or team_id is not null)
);
create unique index if not exists tournament_awards_one_each on public.tournament_awards (tournament_id, award) where award <> 'custom';
alter table public.tournament_awards enable row level security;
revoke all on public.tournament_awards from anon, authenticated;

-- ---------- #196 certificates ----------
create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  player_id uuid not null references public.players(id) on delete cascade,
  tournament_id uuid references public.tournaments(id) on delete cascade,
  match_id uuid references public.matches(id) on delete cascade,
  award_id uuid references public.tournament_awards(id) on delete set null,
  kind text not null check (kind in ('participation','winner','runner_up','player_of_match','award','achievement','custom')),
  title text not null check (length(title) between 3 and 120),
  detail text check (detail is null or length(detail) <= 200),
  issued_by uuid references auth.users(id) on delete set null,
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_reason text,
  check (tournament_id is not null or match_id is not null)
);
create index if not exists certificates_player_idx on public.certificates (player_id);
create index if not exists certificates_tournament_idx on public.certificates (tournament_id);
alter table public.certificates enable row level security;
revoke all on public.certificates from anon, authenticated;

create or replace function private.new_cert_code()
returns text language plpgsql volatile set search_path = ''
as $$
declare chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; c text; i int;
begin
  loop
    c := 'LC-';
    for i in 1..8 loop
      c := c || substr(chars, 1 + floor(random() * 32)::int, 1);
      if i = 4 then c := c || '-'; end if;
    end loop;
    exit when not exists (select 1 from public.certificates where code = c);
  end loop;
  return c;
end;
$$;

-- Players who took part: in an approved team of the tournament, or in a playing XI / ball of its matches.
create or replace function private.tournament_player(p_tournament_id uuid, p_player_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.tournament_teams tt join public.team_members tm on tm.team_id = tt.team_id
                  where tt.tournament_id = p_tournament_id and tt.status = 'approved' and tm.player_id = p_player_id)
      or exists (select 1 from public.match_players mp join public.matches m on m.id = mp.match_id where m.tournament_id = p_tournament_id and mp.player_id = p_player_id)
      or exists (select 1 from public.balls b join public.matches m on m.id = b.match_id
                  where m.tournament_id = p_tournament_id and p_player_id in (b.striker_id, b.bowler_id, b.fielder_id));
$$;

create or replace function private.cert_json(c public.certificates)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select to_jsonb(c) - 'issued_by' || jsonb_build_object(
    'player', (select jsonb_build_object('id', p.id, 'name', p.display_name, 'player_code', p.player_code, 'photo_url', p.photo_url) from public.players p where p.id = c.player_id),
    'tournament', (select jsonb_build_object('id', t.id, 'name', t.name, 'code', t.code, 'start_date', t.start_date, 'end_date', t.end_date, 'venue', t.venue, 'city', t.city,
                                             'organizer_name', coalesce(t.organizer_name, (select display_name from public.profiles where id = t.owner_id)), 'logo_url', t.logo_url, 'banner_color', t.banner_color)
                   from public.tournaments t where t.id = c.tournament_id),
    'match', (select jsonb_build_object('id', m.id, 'title', coalesce(m.title, ta.name || ' vs ' || tb.name), 'date', coalesce(m.started_at, m.scheduled_at), 'venue', m.venue)
              from public.matches m left join public.teams ta on ta.id = m.team_a_id left join public.teams tb on tb.id = m.team_b_id where m.id = c.match_id),
    'issuer', (select display_name from public.profiles where id = c.issued_by));
$$;

create or replace function private.issue_one_certificate(p_player uuid, p_tournament uuid, p_match uuid, p_award uuid, p_kind text, p_title text, p_detail text, p_uid uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare cid uuid; prof uuid;
begin
  if exists (select 1 from public.certificates where player_id = p_player and tournament_id is not distinct from p_tournament and match_id is not distinct from p_match
               and kind = p_kind and title = p_title and revoked_at is null) then return null; end if;
  insert into public.certificates (code, player_id, tournament_id, match_id, award_id, kind, title, detail, issued_by)
  values (private.new_cert_code(), p_player, p_tournament, p_match, p_award, p_kind, p_title, p_detail, p_uid) returning id into cid;
  select profile_id into prof from public.players where id = p_player;
  if prof is not null and prof <> p_uid then
    insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
    values (prof, 'certificate_issued', 'You received a certificate', p_title, jsonb_build_object('certificate_id', cid));
  end if;
  return cid;
end;
$$;

create or replace function public.issue_certificates(p jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := private.require_active_user();
  v_tid uuid := nullif(p->>'tournament_id', '')::uuid; v_mid uuid := nullif(p->>'match_id', '')::uuid; v_team uuid := nullif(p->>'team_id', '')::uuid;
  v_kind text := coalesce(nullif(p->>'kind', ''), 'participation');
  v_title text := pg_catalog.btrim(coalesce(p->>'title', '')); v_detail text := nullif(pg_catalog.left(pg_catalog.btrim(coalesce(p->>'detail', '')), 200), '');
  ids uuid[] := '{}'; pid uuid; issued int := 0; skipped int := 0; r uuid;
begin
  if v_kind not in ('participation','winner','runner_up','player_of_match','award','achievement','custom') then raise exception 'Unknown certificate type.' using errcode = '22023'; end if;
  if pg_catalog.length(v_title) < 3 then raise exception 'Enter the certificate title.' using errcode = '22023'; end if;
  if v_tid is null and v_mid is null then raise exception 'Choose a tournament or match.' using errcode = '22023'; end if;
  if v_mid is not null and v_tid is null then
    select tournament_id into v_tid from public.matches where id = v_mid;
    if v_tid is null and not private.can_manage_match(v_mid) then raise exception 'Only the match organiser can issue certificates for this match.' using errcode = '42501'; end if;
  end if;
  if v_tid is not null then perform private.require_tournament_organiser(v_tid); end if;
  if jsonb_typeof(p->'player_ids') = 'array' then select array_agg(distinct x::uuid) into ids from jsonb_array_elements_text(p->'player_ids') x; end if;
  ids := coalesce(ids, '{}');
  if v_team is not null then
    if v_tid is not null and not exists (select 1 from public.tournament_teams where tournament_id = v_tid and team_id = v_team and status = 'approved') then
      raise exception 'That team is not in this tournament.' using errcode = '22023';
    end if;
    ids := ids || coalesce((select array_agg(player_id) from public.team_members where team_id = v_team), '{}');
  end if;
  if coalesce((p->>'all_players')::boolean, false) and v_tid is not null then
    ids := ids || coalesce((select array_agg(distinct tm.player_id) from public.tournament_teams tt join public.team_members tm on tm.team_id = tt.team_id
                             where tt.tournament_id = v_tid and tt.status = 'approved'), '{}');
  end if;
  select array_agg(distinct x) into ids from unnest(ids) x;
  if ids is null or cardinality(ids) = 0 then raise exception 'Choose at least one player.' using errcode = '22023'; end if;
  if cardinality(ids) > 500 then raise exception 'You can issue up to 500 certificates at once.' using errcode = '22023'; end if;
  foreach pid in array ids loop
    if v_tid is not null and not private.tournament_player(v_tid, pid) then raise exception 'One of the players did not take part in this tournament.' using errcode = '22023'; end if;
    if v_tid is null and not exists (select 1 from public.match_players where match_id = v_mid and player_id = pid)
       and not exists (select 1 from public.matches m join public.team_members tm on tm.team_id in (m.team_a_id, m.team_b_id) where m.id = v_mid and tm.player_id = pid) then
      raise exception 'One of the players did not play in this match.' using errcode = '22023';
    end if;
    r := private.issue_one_certificate(pid, v_tid, v_mid, null, v_kind, v_title, v_detail, uid);
    if r is null then skipped := skipped + 1; else issued := issued + 1; end if;
  end loop;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, 'CERTIFICATES_ISSUED', 'certificates', coalesce(v_tid, v_mid)::text, jsonb_build_object('kind', v_kind, 'title', v_title, 'issued', issued, 'skipped', skipped));
  return jsonb_build_object('issued', issued, 'skipped', skipped);
end;
$$;

create or replace function public.revoke_certificate(p_certificate_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := private.require_active_user(); c public.certificates;
begin
  select * into c from public.certificates where id = p_certificate_id for update;
  if not found then raise exception 'Certificate not found.' using errcode = '22023'; end if;
  if c.tournament_id is not null then perform private.require_tournament_organiser(c.tournament_id);
  elsif not private.can_manage_match(c.match_id) then raise exception 'Only the organiser can withdraw this certificate.' using errcode = '42501'; end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_reason, ''))) < 3 then raise exception 'Give a reason.' using errcode = '22023'; end if;
  update public.certificates set revoked_at = now(), revoked_reason = pg_catalog.left(pg_catalog.btrim(p_reason), 200) where id = c.id returning * into c;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata) values (uid, 'CERTIFICATE_REVOKED', 'certificates', c.id::text, jsonb_build_object('code', c.code));
  return private.cert_json(c);
end;
$$;

create or replace function public.verify_certificate(p_code text)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select private.cert_json(c) from public.certificates c where c.code = upper(pg_catalog.btrim(coalesce(p_code, '')));
$$;

create or replace function public.list_certificates(p jsonb)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(private.cert_json(c) order by c.issued_at desc), '[]'::jsonb)
  from public.certificates c
  where (nullif(p->>'player_id', '') is null or c.player_id = (p->>'player_id')::uuid)
    and (nullif(p->>'tournament_id', '') is null or c.tournament_id = (p->>'tournament_id')::uuid)
    and (nullif(p->>'match_id', '') is null or c.match_id = (p->>'match_id')::uuid)
    and (nullif(p->>'player_id', '') is not null or nullif(p->>'tournament_id', '') is not null or nullif(p->>'match_id', '') is not null)
    and (c.revoked_at is null or (c.tournament_id is not null and private.is_tournament_organiser(c.tournament_id)));
$$;

-- ---------- #197 awards ----------
create or replace function private.award_json(a public.tournament_awards)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select to_jsonb(a) - 'created_by' || jsonb_build_object(
    'player', (select jsonb_build_object('id', p.id, 'name', p.display_name, 'photo_url', p.photo_url, 'player_code', p.player_code) from public.players p where p.id = a.player_id),
    'team', (select jsonb_build_object('id', t.id, 'name', t.name, 'logo_url', t.logo_url) from public.teams t where t.id = a.team_id),
    'tournament', (select jsonb_build_object('id', t.id, 'name', t.name, 'code', t.code, 'start_date', t.start_date) from public.tournaments t where t.id = a.tournament_id));
$$;

create or replace function public.set_award(p_tournament_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := private.require_active_user(); a public.tournament_awards;
  v_award text := p->>'award'; v_player uuid := nullif(p->>'player_id', '')::uuid; v_team uuid := nullif(p->>'team_id', '')::uuid;
  v_label text; issued int := 0; pid uuid; t_name text;
  defaults jsonb := '{"player_of_tournament":"Player of the Tournament","best_batter":"Best Batter","best_bowler":"Best Bowler","best_fielder":"Best Fielder",
                      "best_wicketkeeper":"Best Wicket-keeper","emerging_player":"Emerging Player","fair_play":"Fair Play Award","winner":"Champions","runner_up":"Runners-up"}';
begin
  perform private.require_tournament_organiser(p_tournament_id);
  if v_award not in ('player_of_tournament','best_batter','best_bowler','best_fielder','best_wicketkeeper','emerging_player','fair_play','winner','runner_up','custom') then
    raise exception 'Choose the award.' using errcode = '22023';
  end if;
  v_label := coalesce(nullif(pg_catalog.left(pg_catalog.btrim(coalesce(p->>'label', '')), 80), ''), defaults->>v_award);
  if v_label is null or pg_catalog.length(v_label) < 2 then raise exception 'Enter the award name.' using errcode = '22023'; end if;
  if v_award in ('winner', 'runner_up', 'fair_play') then
    v_player := null;
    if v_team is null or not exists (select 1 from public.tournament_teams where tournament_id = p_tournament_id and team_id = v_team and status = 'approved') then
      raise exception 'Choose a team from this tournament.' using errcode = '22023';
    end if;
  elsif v_award <> 'custom' or v_player is not null then
    v_team := null;
    if v_player is null or not private.tournament_player(p_tournament_id, v_player) then raise exception 'Choose a player who took part in this tournament.' using errcode = '22023'; end if;
  elsif v_team is null or not exists (select 1 from public.tournament_teams where tournament_id = p_tournament_id and team_id = v_team and status = 'approved') then
    raise exception 'Choose a player or a team from this tournament.' using errcode = '22023';
  end if;
  if v_award <> 'custom' then
    update public.certificates set revoked_at = now(), revoked_reason = 'Award given to someone else'
     where award_id in (select id from public.tournament_awards where tournament_id = p_tournament_id and award = v_award) and revoked_at is null;
    delete from public.tournament_awards where tournament_id = p_tournament_id and award = v_award;
  end if;
  insert into public.tournament_awards (tournament_id, award, label, player_id, team_id, note, created_by)
  values (p_tournament_id, v_award, v_label, v_player, v_team, nullif(pg_catalog.left(pg_catalog.btrim(coalesce(p->>'note', '')), 200), ''), uid) returning * into a;
  if coalesce((p->>'issue_certificate')::boolean, true) then
    select name into t_name from public.tournaments where id = p_tournament_id;
    if v_player is not null then
      if private.issue_one_certificate(v_player, p_tournament_id, null, a.id, 'award', v_label || ' – ' || t_name, a.note, uid) is not null then issued := 1; end if;
    else
      for pid in select player_id from public.team_members where team_id = v_team loop
        if private.issue_one_certificate(pid, p_tournament_id, null, a.id, case v_award when 'winner' then 'winner' when 'runner_up' then 'runner_up' else 'award' end,
             v_label || ' – ' || t_name, a.note, uid) is not null then issued := issued + 1; end if;
      end loop;
    end if;
  end if;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, 'AWARD_GIVEN', 'tournament_awards', a.id::text, jsonb_build_object('tournament_id', p_tournament_id, 'award', v_award, 'certificates', issued));
  return private.award_json(a) || jsonb_build_object('certificates_issued', issued);
end;
$$;

create or replace function public.remove_award(p_award_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := private.require_active_user(); a public.tournament_awards;
begin
  select * into a from public.tournament_awards where id = p_award_id;
  if not found then raise exception 'Award not found.' using errcode = '22023'; end if;
  perform private.require_tournament_organiser(a.tournament_id);
  update public.certificates set revoked_at = now(), revoked_reason = 'Award removed' where award_id = a.id and revoked_at is null;
  delete from public.tournament_awards where id = a.id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata) values (uid, 'AWARD_REMOVED', 'tournament_awards', a.id::text, jsonb_build_object('award', a.award));
  return jsonb_build_object('removed', true);
end;
$$;

create or replace function public.list_awards(p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('is_organiser', private.is_tournament_organiser(p_tournament_id),
    'items', coalesce((select jsonb_agg(private.award_json(a) order by array_position(array['winner','runner_up','player_of_tournament','best_batter','best_bowler','best_fielder','best_wicketkeeper','emerging_player','fair_play','custom'], a.award), a.created_at)
              from public.tournament_awards a where a.tournament_id = p_tournament_id), '[]'::jsonb),
    'certificates', (select count(*) from public.certificates c where c.tournament_id = p_tournament_id and c.revoked_at is null));
$$;

-- Player trophy cabinet: individual awards, team titles won while in the squad, certificates.
create or replace function public.player_awards(p_player_id uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'awards', coalesce((select jsonb_agg(private.award_json(a) order by a.created_at desc) from public.tournament_awards a
               where a.player_id = p_player_id
                  or (a.team_id is not null and a.award in ('winner', 'runner_up', 'fair_play')
                      and exists (select 1 from public.team_members tm where tm.team_id = a.team_id and tm.player_id = p_player_id))), '[]'::jsonb),
    'certificates', coalesce((select jsonb_agg(private.cert_json(c) order by c.issued_at desc) from public.certificates c
               where c.player_id = p_player_id and c.revoked_at is null), '[]'::jsonb));
$$;

-- ---------- #198 merchandise ----------
create table if not exists public.merch_items (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  name text not null check (length(name) between 2 and 80),
  description text check (description is null or length(description) <= 600),
  price numeric(10,2) not null check (price >= 0),
  sizes text[] not null default '{}',
  photo_url text,
  stock integer check (stock is null or stock >= 0),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists merch_items_tournament_idx on public.merch_items (tournament_id);
alter table public.merch_items enable row level security;
revoke all on public.merch_items from anon, authenticated;

create table if not exists public.merch_orders (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.merch_items(id) on delete cascade,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  size text,
  qty integer not null check (qty between 1 and 20),
  amount numeric(10,2) not null,
  buyer_name text not null check (length(buyer_name) between 2 and 80),
  phone text not null check (length(phone) between 6 and 20),
  note text check (note is null or length(note) <= 300),
  status text not null default 'requested' check (status in ('requested','confirmed','paid','ready','delivered','cancelled')),
  stock_taken boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists merch_orders_tournament_idx on public.merch_orders (tournament_id);
create index if not exists merch_orders_buyer_idx on public.merch_orders (buyer_id);
alter table public.merch_orders enable row level security;
revoke all on public.merch_orders from anon, authenticated;

create or replace function public.save_merch_item(p_item_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := private.require_active_user(); m public.merch_items; v_tid uuid; mid uuid := p_item_id; v_sizes text[];
begin
  if mid is not null then
    select * into m from public.merch_items where id = mid for update;
    if not found then raise exception 'Item not found.' using errcode = '22023'; end if;
    v_tid := m.tournament_id;
  else v_tid := nullif(p->>'tournament_id', '')::uuid; end if;
  perform private.require_tournament_organiser(v_tid);
  if pg_catalog.length(pg_catalog.btrim(coalesce(p->>'name', ''))) < 2 then raise exception 'Enter the item name.' using errcode = '22023'; end if;
  if nullif(p->>'price', '') is null or (p->>'price')::numeric < 0 then raise exception 'Enter the price.' using errcode = '22023'; end if;
  select coalesce(array_agg(distinct pg_catalog.left(pg_catalog.btrim(s), 12)) filter (where pg_catalog.btrim(s) <> ''), '{}') into v_sizes
    from jsonb_array_elements_text(coalesce(p->'sizes', '[]'::jsonb)) s;
  if cardinality(v_sizes) > 12 then raise exception 'Up to 12 sizes.' using errcode = '22023'; end if;
  if mid is null then
    if (select count(*) from public.merch_items where tournament_id = v_tid) >= 30 then raise exception 'A tournament can list up to 30 items.' using errcode = '22023'; end if;
    insert into public.merch_items (tournament_id, name, price, created_by) values (v_tid, pg_catalog.btrim(p->>'name'), (p->>'price')::numeric, uid) returning id into mid;
  end if;
  update public.merch_items set
    name = pg_catalog.left(pg_catalog.btrim(p->>'name'), 80), price = round((p->>'price')::numeric, 2),
    description = nullif(pg_catalog.left(pg_catalog.btrim(coalesce(p->>'description', '')), 600), ''),
    sizes = v_sizes, stock = nullif(p->>'stock', '')::int, is_active = coalesce((p->>'is_active')::boolean, true), updated_at = now()
  where id = mid returning * into m;
  return to_jsonb(m);
end;
$$;

create or replace function public.set_merch_photo(p_item_id uuid, p_url text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare m public.merch_items;
begin
  perform private.require_active_user();
  select * into m from public.merch_items where id = p_item_id;
  if not found then raise exception 'Item not found.' using errcode = '22023'; end if;
  perform private.require_tournament_organiser(m.tournament_id);
  if p_url is not null and p_url not like '%/storage/v1/object/public/media/merch/' || m.id::text || '/%' then raise exception 'Upload the photo first.' using errcode = '22023'; end if;
  update public.merch_items set photo_url = p_url, updated_at = now() where id = m.id returning * into m;
  return to_jsonb(m);
end;
$$;

create or replace function public.delete_merch_item(p_item_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare m public.merch_items;
begin
  perform private.require_active_user();
  select * into m from public.merch_items where id = p_item_id;
  if not found then raise exception 'Item not found.' using errcode = '22023'; end if;
  perform private.require_tournament_organiser(m.tournament_id);
  if exists (select 1 from public.merch_orders where item_id = m.id and status not in ('cancelled')) then
    update public.merch_items set is_active = false, updated_at = now() where id = m.id;
    return jsonb_build_object('deleted', false, 'hidden', true);
  end if;
  delete from public.merch_items where id = m.id;
  return jsonb_build_object('deleted', true);
end;
$$;

create or replace function public.list_merch(p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('is_organiser', private.is_tournament_organiser(p_tournament_id),
    'items', coalesce((select jsonb_agg(to_jsonb(m) - 'created_by' || case when private.is_tournament_organiser(p_tournament_id) then jsonb_build_object(
                   'orders', (select count(*) from public.merch_orders o where o.item_id = m.id and o.status <> 'cancelled'),
                   'sold', (select coalesce(sum(qty), 0) from public.merch_orders o where o.item_id = m.id and o.status in ('paid', 'ready', 'delivered'))) else '{}'::jsonb end
                 order by m.created_at)
              from public.merch_items m where m.tournament_id = p_tournament_id and (m.is_active or private.is_tournament_organiser(p_tournament_id))), '[]'::jsonb));
$$;

create or replace function public.order_merch(p_item_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := private.require_active_user(); m public.merch_items; o public.merch_orders; v_qty int := coalesce(nullif(p->>'qty', '')::int, 1); v_size text := nullif(p->>'size', '');
begin
  select * into m from public.merch_items where id = p_item_id and is_active;
  if not found then raise exception 'This item is not available.' using errcode = '22023'; end if;
  if v_qty < 1 or v_qty > 20 then raise exception 'Order between 1 and 20.' using errcode = '22023'; end if;
  if cardinality(m.sizes) > 0 and (v_size is null or not v_size = any(m.sizes)) then raise exception 'Choose a size.' using errcode = '22023'; end if;
  if m.stock is not null and m.stock < v_qty then raise exception 'Only % left.', m.stock using errcode = '22023'; end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p->>'name', ''))) < 2 then raise exception 'Enter your name.' using errcode = '22023'; end if;
  if pg_catalog.length(regexp_replace(coalesce(p->>'phone', ''), '[^0-9]', '', 'g')) < 6 then raise exception 'Enter a phone number the organiser can call.' using errcode = '22023'; end if;
  if (select count(*) from public.merch_orders where buyer_id = uid and tournament_id = m.tournament_id and status in ('requested', 'confirmed')) >= 10 then
    raise exception 'You already have 10 open orders for this tournament.' using errcode = '22023';
  end if;
  insert into public.merch_orders (item_id, tournament_id, buyer_id, size, qty, amount, buyer_name, phone, note)
  values (m.id, m.tournament_id, uid, case when cardinality(m.sizes) > 0 then v_size end, v_qty, m.price * v_qty,
          pg_catalog.left(pg_catalog.btrim(p->>'name'), 80), pg_catalog.left(regexp_replace(p->>'phone', '[^0-9+ ]', '', 'g'), 20),
          nullif(pg_catalog.left(pg_catalog.btrim(coalesce(p->>'note', '')), 300), ''))
  returning * into o;
  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  select t.owner_id, 'merch_order', 'New merchandise order', o.qty || ' × ' || m.name || coalesce(' (' || o.size || ')', '') || ' – ' || o.buyer_name,
         jsonb_build_object('tournament_id', t.id, 'order_id', o.id)
    from public.tournaments t where t.id = m.tournament_id and t.owner_id <> uid;
  return to_jsonb(o) || jsonb_build_object('item_name', m.name);
end;
$$;

create or replace function public.update_merch_order(p_order_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := private.require_active_user(); o public.merch_orders; m public.merch_items; org boolean;
begin
  select * into o from public.merch_orders where id = p_order_id for update;
  if not found then raise exception 'Order not found.' using errcode = '22023'; end if;
  org := private.is_tournament_organiser(o.tournament_id);
  if p_status not in ('requested','confirmed','paid','ready','delivered','cancelled') then raise exception 'Unknown status.' using errcode = '22023'; end if;
  if not org then
    if o.buyer_id <> uid then raise exception 'Order not found.' using errcode = '22023'; end if;
    if p_status <> 'cancelled' or o.status <> 'requested' then raise exception 'You can cancel only before the organiser confirms. Contact the organiser.' using errcode = '42501'; end if;
  end if;
  select * into m from public.merch_items where id = o.item_id for update;
  if p_status in ('confirmed','paid','ready','delivered') and not o.stock_taken and m.stock is not null then
    if m.stock < o.qty then raise exception 'Not enough stock left (% left).', m.stock using errcode = '22023'; end if;
    update public.merch_items set stock = stock - o.qty where id = m.id;
    o.stock_taken := true;
  elsif p_status = 'cancelled' and o.stock_taken and m.stock is not null then
    update public.merch_items set stock = stock + o.qty where id = m.id;
    o.stock_taken := false;
  end if;
  update public.merch_orders set status = p_status, stock_taken = o.stock_taken, updated_at = now() where id = o.id returning * into o;
  if org and o.buyer_id <> uid then
    insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
    values (o.buyer_id, 'merch_order_update', 'Your order is ' || replace(p_status, '_', ' '), m.name || ' × ' || o.qty, jsonb_build_object('order_id', o.id));
  end if;
  return to_jsonb(o) || jsonb_build_object('item_name', m.name);
end;
$$;

create or replace function public.list_merch_orders(p_tournament_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_tournament_organiser(p_tournament_id);
  return coalesce((select jsonb_agg(to_jsonb(o) - 'buyer_id' || jsonb_build_object('item_name', m.name) order by o.created_at desc)
    from public.merch_orders o join public.merch_items m on m.id = o.item_id where o.tournament_id = p_tournament_id), '[]'::jsonb);
end;
$$;

create or replace function public.my_merch_orders()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(o) - 'buyer_id' || jsonb_build_object('item_name', m.name, 'photo_url', m.photo_url,
           'tournament', jsonb_build_object('id', t.id, 'name', t.name)) order by o.created_at desc), '[]'::jsonb)
  from public.merch_orders o join public.merch_items m on m.id = o.item_id join public.tournaments t on t.id = o.tournament_id
  where o.buyer_id = (select auth.uid());
$$;

-- ---------- #199 report for a sponsor ----------
create or replace function public.sponsor_report(p_sponsorship_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare ts public.tournament_sponsors; t public.tournaments; res jsonb;
begin
  perform private.require_active_user();
  select * into ts from public.tournament_sponsors where id = p_sponsorship_id;
  if not found then raise exception 'Sponsorship not found.' using errcode = '22023'; end if;
  if not private.is_tournament_organiser(ts.tournament_id) and not private.is_sponsor_owner(ts.sponsor_id) then
    raise exception 'Only the organiser or the sponsor can see this report.' using errcode = '42501';
  end if;
  select * into t from public.tournaments where id = ts.tournament_id;
  select jsonb_build_object(
    'generated_at', now(),
    'sponsorship', private.sponsorship_json(ts, true),
    'tournament', jsonb_build_object('id', t.id, 'name', t.name, 'code', t.code, 'status', t.status, 'start_date', t.start_date, 'end_date', t.end_date,
                                     'venue', t.venue, 'city', t.city, 'logo_url', t.logo_url, 'organizer_name', coalesce(t.organizer_name, (select display_name from public.profiles where id = t.owner_id))),
    'cricket', (select jsonb_build_object(
        'teams', (select count(*) from public.tournament_teams where tournament_id = t.id and status = 'approved'),
        'players', (select count(distinct tm.player_id) from public.tournament_teams tt join public.team_members tm on tm.team_id = tt.team_id where tt.tournament_id = t.id and tt.status = 'approved'),
        'matches_total', (select count(*) from public.matches where tournament_id = t.id),
        'matches_played', (select count(*) from public.matches where tournament_id = t.id and status = 'completed'),
        'runs', coalesce(sum(b.runs_bat + coalesce(b.extra_runs, 0)), 0),
        'fours', count(*) filter (where b.runs_bat = 4), 'sixes', count(*) filter (where b.runs_bat = 6),
        'wickets', count(*) filter (where b.is_wicket), 'balls', count(*) filter (where b.is_legal))
      from public.balls b join public.matches m on m.id = b.match_id join public.innings i on i.id = b.innings_id
      where m.tournament_id = t.id and not i.is_super_over),
    'exposure', jsonb_build_object(
        'tournament_page_views', (select coalesce(sum(views), 0) from public.page_views where ref_id = t.id and kind in ('tournament', 'tournament_site')),
        'tournament_page_views_since_joined', (select coalesce(sum(views), 0) from public.page_views where ref_id = t.id and kind in ('tournament', 'tournament_site') and day >= ts.created_at::date),
        'sponsor_profile_views', (select coalesce(sum(views), 0) from public.page_views where ref_id = ts.sponsor_id and kind = 'sponsor'),
        'ads', coalesce((select jsonb_agg(jsonb_build_object('title', a.title, 'slot', a.slot, 'impressions', a.impressions, 'clicks', a.clicks, 'is_active', a.is_active))
                 from public.ad_placements a where a.sponsor_id = ts.sponsor_id and (a.tournament_id = t.id or a.scope = 'site')), '[]'::jsonb),
        'ad_impressions', (select coalesce(sum(impressions), 0) from public.ad_placements a where a.sponsor_id = ts.sponsor_id and (a.tournament_id = t.id or a.scope = 'site')),
        'ad_clicks', (select coalesce(sum(clicks), 0) from public.ad_placements a where a.sponsor_id = ts.sponsor_id and (a.tournament_id = t.id or a.scope = 'site')),
        'campaign_views', (select coalesce(sum(views), 0) from public.promo_campaigns where tournament_id = t.id),
        'campaign_clicks', (select coalesce(sum(clicks), 0) from public.promo_campaigns where tournament_id = t.id),
        'photos_videos', (select count(*) from public.media_items mi where mi.status = 'visible' and mi.url is not null
                           and ((mi.scope = 'tournament' and mi.scope_id = t.id) or (mi.scope = 'match' and mi.scope_id in (select id from public.matches where tournament_id = t.id)))),
        'certificates', (select count(*) from public.certificates where tournament_id = t.id and revoked_at is null)),
    'awards', coalesce((select jsonb_agg(private.award_json(a)) from public.tournament_awards a where a.tournament_id = t.id), '[]'::jsonb)
  ) into res;
  return res;
end;
$$;

-- ---------- upload folders: sponsors/, sponsorships/, ads/, merch/ ----------
create or replace function private.can_edit_media(p_name text)
returns boolean language plpgsql stable security definer set search_path = ''
as $$
declare parts text[] := storage.foldername(p_name); target uuid;
begin
  if (select auth.uid()) is null or pg_catalog.array_length(parts, 1) < 2 then return false; end if;
  begin target := parts[2]::uuid; exception when others then return false; end;
  if parts[1] = 'teams' then
    return exists (select 1 from public.teams where id = target and owner_id = (select auth.uid()));
  elsif parts[1] = 'players' then
    return exists (select 1 from public.players where id = target
                   and (profile_id = (select auth.uid()) or (profile_id is null and created_by = (select auth.uid()))));
  elsif parts[1] = 'tournaments' then
    return exists (select 1 from public.tournaments where id = target and owner_id = (select auth.uid()))
        or exists (select 1 from public.user_role_assignments where user_id = (select auth.uid()) and role = 'organiser'
                   and scope_type = 'tournament' and scope_id = target and is_active)
        or private.is_admin();
  elsif parts[1] = 'grounds' then
    return exists (select 1 from public.grounds where id = target and owner_id = (select auth.uid())) or private.is_admin();
  elsif parts[1] = 'listings' then
    return exists (select 1 from public.directory_listings where id = target and owner_id = (select auth.uid())) or private.is_admin();
  elsif parts[1] = 'items' then
    return exists (select 1 from public.market_items where id = target and seller_id = (select auth.uid())) or private.is_admin();
  elsif parts[1] in ('gallery', 'clips') then
    return exists (select 1 from public.media_items mi where mi.id = target
                   and (mi.uploader_id = (select auth.uid()) or private.can_moderate_media(mi.scope, mi.scope_id)));
  elsif parts[1] = 'sponsors' then
    return private.is_sponsor_owner(target);
  elsif parts[1] = 'sponsorships' then
    return exists (select 1 from public.tournament_sponsors ts where ts.id = target
                   and (private.is_tournament_organiser(ts.tournament_id) or private.is_sponsor_owner(ts.sponsor_id)));
  elsif parts[1] = 'ads' then
    return exists (select 1 from public.ad_placements a where a.id = target and private.can_manage_ad(a));
  elsif parts[1] = 'merch' then
    return exists (select 1 from public.merch_items m where m.id = target and private.is_tournament_organiser(m.tournament_id));
  end if;
  return false;
end;
$$;

-- ---------- grants ----------
revoke all on function private.new_cert_code() from public, anon, authenticated;
revoke all on function private.tournament_player(uuid, uuid) from public, anon, authenticated;
revoke all on function private.cert_json(public.certificates) from public, anon, authenticated;
revoke all on function private.issue_one_certificate(uuid, uuid, uuid, uuid, text, text, text, uuid) from public, anon, authenticated;
revoke all on function private.award_json(public.tournament_awards) from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array['issue_certificates(jsonb)', 'revoke_certificate(uuid, text)', 'set_award(uuid, jsonb)', 'remove_award(uuid)',
    'save_merch_item(uuid, jsonb)', 'set_merch_photo(uuid, text)', 'delete_merch_item(uuid)', 'order_merch(uuid, jsonb)', 'update_merch_order(uuid, text)',
    'list_merch_orders(uuid)', 'my_merch_orders()', 'sponsor_report(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['verify_certificate(text)', 'list_certificates(jsonb)', 'list_awards(uuid)', 'player_awards(uuid)', 'list_merch(uuid)'] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
end $$;
