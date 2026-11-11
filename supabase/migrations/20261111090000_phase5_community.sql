-- Phase 5 / Category H – Cricket community and marketplace (#160–#176).
-- Open platform: anyone signed in can list their academy, coaching centre, shop, nets, club or commentator
-- profile, sell or rent equipment and post on the community board. Contact happens through private enquiries,
-- so phone numbers are only shown where the owner chose to publish one.

create table if not exists public.directory_listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('academy','coaching','shop','nets','club','commentator')),
  name text not null check (pg_catalog.length(name) between 2 and 100),
  city text check (city is null or pg_catalog.length(city) <= 80),
  address text check (address is null or pg_catalog.length(address) <= 250),
  latitude numeric(9,6) check (latitude is null or latitude between -90 and 90),
  longitude numeric(9,6) check (longitude is null or longitude between -180 and 180),
  phone text check (phone is null or pg_catalog.length(phone) <= 20),
  website text check (website is null or (pg_catalog.length(website) <= 200 and website ~* '^https?://')),
  description text check (description is null or pg_catalog.length(description) <= 2000),
  timings text check (timings is null or pg_catalog.length(timings) <= 200),
  fees text check (fees is null or pg_catalog.length(fees) <= 200),
  tags text[] not null default '{}',
  ground_id uuid references public.grounds(id) on delete set null,
  cover_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists directory_listings_kind_idx on public.directory_listings (kind, lower(city));
create index if not exists directory_listings_owner_idx on public.directory_listings (owner_id);
create index if not exists directory_listings_ground_idx on public.directory_listings (ground_id);

create table if not exists public.market_items (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid references public.directory_listings(id) on delete set null,
  category text not null check (category in ('bat','ball','pads','gloves','helmet','kit_bag','shoes','clothing','stumps','full_kit','other')),
  title text not null check (pg_catalog.length(title) between 3 and 100),
  description text check (description is null or pg_catalog.length(description) <= 1500),
  condition text not null default 'used' check (condition in ('new','like_new','used')),
  mode text not null default 'sale' check (mode in ('sale','rent','both')),
  price numeric(10,2) check (price is null or price >= 0),
  rent_per_day numeric(10,2) check (rent_per_day is null or rent_per_day >= 0),
  deposit numeric(10,2) check (deposit is null or deposit >= 0),
  city text check (city is null or pg_catalog.length(city) <= 80),
  photo_url text,
  status text not null default 'available' check (status in ('available','reserved','sold','rented','hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (mode = 'rent' or price is not null),
  check (mode = 'sale' or rent_per_day is not null)
);
create index if not exists market_items_category_idx on public.market_items (category, status);
create index if not exists market_items_seller_idx on public.market_items (seller_id);
create index if not exists market_items_listing_idx on public.market_items (listing_id);

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('players_wanted','team_wanted','match_wanted','ground_wanted','officials_wanted','other')),
  title text not null check (pg_catalog.length(title) between 3 and 120),
  body text check (body is null or pg_catalog.length(body) <= 2000),
  city text check (city is null or pg_catalog.length(city) <= 80),
  event_date date,
  team_id uuid references public.teams(id) on delete set null,
  status text not null default 'open' check (status in ('open','closed')),
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now()
);
create index if not exists community_posts_kind_idx on public.community_posts (kind, status, created_at desc);
create index if not exists community_posts_author_idx on public.community_posts (author_id);
create index if not exists community_posts_team_idx on public.community_posts (team_id);

create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('listing','item','post')),
  target_id uuid not null,
  from_user uuid not null references auth.users(id) on delete cascade,
  to_user uuid not null references auth.users(id) on delete cascade,
  message text not null check (pg_catalog.length(message) between 2 and 1000),
  contact text check (contact is null or pg_catalog.length(contact) <= 60),
  reply text check (reply is null or pg_catalog.length(reply) <= 1000),
  status text not null default 'open' check (status in ('open','replied','closed')),
  created_at timestamptz not null default now(),
  replied_at timestamptz
);
create index if not exists enquiries_to_idx on public.enquiries (to_user, created_at desc);
create index if not exists enquiries_from_idx on public.enquiries (from_user, created_at desc);
create index if not exists enquiries_target_idx on public.enquiries (target_type, target_id);

alter table public.directory_listings enable row level security;
alter table public.market_items enable row level security;
alter table public.community_posts enable row level security;
alter table public.enquiries enable row level security;
revoke all on public.directory_listings, public.market_items, public.community_posts, public.enquiries from anon, authenticated;

create or replace function private.require_active_user()
returns uuid language plpgsql stable security definer set search_path = ''
as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  if exists (select 1 from public.profiles where id = uid and account_status in ('suspended','disabled')) then raise exception 'Your account is suspended.' using errcode = '42501'; end if;
  return uid;
end;
$$;

-- Photos for listings and items live in the media bucket under listings/<id>/ and items/<id>/.
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
  end if;
  return false;
end;
$$;

-- ---------- #160 #161 #162 #166 #167 #172 Directory ----------
create or replace function public.save_listing(p_listing_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := private.require_active_user(); lid uuid := p_listing_id; v_tags text[];
begin
  if lid is not null and not exists (select 1 from public.directory_listings where id = lid and (owner_id = uid or private.is_admin())) then
    raise exception 'Only the owner can change this listing.' using errcode = '42501';
  end if;
  if (p->>'kind') not in ('academy','coaching','shop','nets','club','commentator') then raise exception 'Choose what you are listing.' using errcode = '22023'; end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p->>'name', ''))) < 2 then raise exception 'Enter a name.' using errcode = '22023'; end if;
  if nullif(p->>'website', '') is not null and (p->>'website') !~* '^https?://' then raise exception 'The website must start with http:// or https://' using errcode = '22023'; end if;
  if lid is null and (select count(*) from public.directory_listings where owner_id = uid) >= 20 then raise exception 'You can have up to 20 listings.' using errcode = '22023'; end if;
  select coalesce(array_agg(distinct pg_catalog.lower(pg_catalog.btrim(t))), '{}') into v_tags
    from (select jsonb_array_elements_text(coalesce(p->'tags', '[]'::jsonb)) t limit 12) x where pg_catalog.length(pg_catalog.btrim(t)) between 1 and 30;
  if nullif(p->>'ground_id', '') is not null and not exists (select 1 from public.grounds where id = (p->>'ground_id')::uuid) then raise exception 'Ground not found.' using errcode = '22023'; end if;
  if lid is null then
    insert into public.directory_listings (owner_id, kind, name) values (uid, p->>'kind', pg_catalog.btrim(p->>'name')) returning id into lid;
  end if;
  update public.directory_listings set kind = p->>'kind', name = pg_catalog.btrim(p->>'name'),
    city = nullif(pg_catalog.btrim(coalesce(p->>'city', '')), ''), address = nullif(pg_catalog.btrim(coalesce(p->>'address', '')), ''),
    latitude = nullif(p->>'latitude', '')::numeric, longitude = nullif(p->>'longitude', '')::numeric,
    phone = nullif(pg_catalog.btrim(coalesce(p->>'phone', '')), ''), website = nullif(pg_catalog.btrim(coalesce(p->>'website', '')), ''),
    description = nullif(pg_catalog.btrim(coalesce(p->>'description', '')), ''), timings = nullif(pg_catalog.btrim(coalesce(p->>'timings', '')), ''),
    fees = nullif(pg_catalog.btrim(coalesce(p->>'fees', '')), ''), tags = v_tags, ground_id = nullif(p->>'ground_id', '')::uuid,
    is_active = coalesce((p->>'is_active')::boolean, true), updated_at = now()
  where id = lid;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, case when p_listing_id is null then 'LISTING_CREATED' else 'LISTING_UPDATED' end, 'directory_listings', lid::text, jsonb_build_object('kind', p->>'kind'));
  return public.get_listing(lid);
end;
$$;

create or replace function public.set_listing_photo(p_listing_id uuid, p_url text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := private.require_active_user();
begin
  if not exists (select 1 from public.directory_listings where id = p_listing_id and (owner_id = uid or private.is_admin())) then raise exception 'Only the owner can change this listing.' using errcode = '42501'; end if;
  if p_url is not null and p_url not like '%/storage/v1/object/public/media/listings/' || p_listing_id::text || '/%' then raise exception 'Upload the photo first.' using errcode = '22023'; end if;
  update public.directory_listings set cover_url = p_url, updated_at = now() where id = p_listing_id;
  return public.get_listing(p_listing_id);
end;
$$;

create or replace function public.delete_listing(p_listing_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := private.require_active_user();
begin
  if not exists (select 1 from public.directory_listings where id = p_listing_id and (owner_id = uid or private.is_admin())) then raise exception 'Only the owner can delete this listing.' using errcode = '42501'; end if;
  delete from public.directory_listings where id = p_listing_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id) values (uid, 'LISTING_DELETED', 'directory_listings', p_listing_id::text);
  return jsonb_build_object('deleted', true);
end;
$$;

create or replace function public.get_listing(p_listing_id uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('listing', to_jsonb(l) - 'owner_id', 'owner_name', (select display_name from public.profiles where id = l.owner_id),
           'is_owner', l.owner_id = (select auth.uid()) or private.is_admin(),
           'ground', (select jsonb_build_object('id', g.id, 'name', g.name) from public.grounds g where g.id = l.ground_id),
           'items', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'title', i.title, 'category', i.category, 'mode', i.mode, 'price', i.price,
                       'rent_per_day', i.rent_per_day, 'photo_url', i.photo_url, 'status', i.status) order by i.created_at desc)
                     from public.market_items i where i.listing_id = l.id and i.status in ('available','reserved')), '[]'::jsonb))
    from public.directory_listings l
   where l.id = p_listing_id and (l.is_active or l.owner_id = (select auth.uid()) or private.is_admin());
$$;

create or replace function public.list_listings(p jsonb default '{}'::jsonb)
returns jsonb language sql stable security definer set search_path = ''
as $$
  with q as (select nullif(p->>'kind', '') as kind, nullif(pg_catalog.btrim(coalesce(p->>'city', '')), '') as city,
                    nullif(pg_catalog.btrim(coalesce(p->>'query', '')), '') as txt, coalesce((p->>'mine')::boolean, false) as mine)
  select coalesce(jsonb_agg(x order by x->>'name'), '[]'::jsonb) from (
    select jsonb_build_object('id', l.id, 'kind', l.kind, 'name', l.name, 'city', l.city, 'address', l.address, 'cover_url', l.cover_url,
             'timings', l.timings, 'fees', l.fees, 'tags', l.tags, 'is_mine', l.owner_id = (select auth.uid()), 'is_active', l.is_active,
             'description', pg_catalog.left(l.description, 160)) as x
      from public.directory_listings l, q
     where (l.is_active or l.owner_id = (select auth.uid()))
       and (q.kind is null or l.kind = q.kind)
       and (not q.mine or l.owner_id = (select auth.uid()))
       and (q.city is null or l.city ilike '%' || q.city || '%')
       and (q.txt is null or l.name ilike '%' || q.txt || '%' or l.description ilike '%' || q.txt || '%' or q.txt = any(l.tags))
     limit 80) y;
$$;

-- #168 Tournament organisers directory (everyone who has created a tournament).
create or replace function public.list_organisers(p_query text default null)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(x order by (x->>'tournaments')::int desc, x->>'name'), '[]'::jsonb) from (
    select jsonb_build_object('user_id', t.owner_id, 'name', coalesce(max(t.organizer_name), pr.display_name),
             'tournaments', count(*), 'completed', count(*) filter (where t.status = 'completed'),
             'cities', (select string_agg(distinct c, ', ') from unnest(array_agg(t.city)) c where c is not null),
             'latest', (select jsonb_build_object('id', t2.id, 'name', t2.name) from public.tournaments t2 where t2.owner_id = t.owner_id order by t2.created_at desc limit 1)) as x
      from public.tournaments t join public.profiles pr on pr.id = t.owner_id
     where coalesce(pr.account_status, 'active') not in ('suspended','disabled')
     group by t.owner_id, pr.display_name
    having p_query is null or pg_catalog.btrim(p_query) = '' or pr.display_name ilike '%' || pg_catalog.btrim(p_query) || '%'
        or max(t.organizer_name) ilike '%' || pg_catalog.btrim(p_query) || '%'
        or bool_or(t.city ilike '%' || pg_catalog.btrim(p_query) || '%')
     limit 60) y;
$$;

-- ---------- #163 #164 #165 Marketplace ----------
create or replace function public.save_item(p_item_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := private.require_active_user(); iid uuid := p_item_id; md text := coalesce(nullif(p->>'mode', ''), 'sale');
begin
  if iid is not null and not exists (select 1 from public.market_items where id = iid and (seller_id = uid or private.is_admin())) then
    raise exception 'Only the seller can change this item.' using errcode = '42501';
  end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p->>'title', ''))) < 3 then raise exception 'Enter a title.' using errcode = '22023'; end if;
  if md in ('sale','both') and nullif(p->>'price', '') is null then raise exception 'Enter the selling price.' using errcode = '22023'; end if;
  if md in ('rent','both') and nullif(p->>'rent_per_day', '') is null then raise exception 'Enter the rent per day.' using errcode = '22023'; end if;
  if nullif(p->>'listing_id', '') is not null and not exists (select 1 from public.directory_listings where id = (p->>'listing_id')::uuid and owner_id = uid) then
    raise exception 'You can only link your own shop.' using errcode = '42501';
  end if;
  if iid is null and (select count(*) from public.market_items where seller_id = uid and status in ('available','reserved')) >= 100 then raise exception 'You can have up to 100 items listed.' using errcode = '22023'; end if;
  if iid is null then
    insert into public.market_items (seller_id, category, title, mode, price, rent_per_day)
    values (uid, coalesce(nullif(p->>'category', ''), 'other'), pg_catalog.btrim(p->>'title'), md, nullif(p->>'price', '')::numeric, nullif(p->>'rent_per_day', '')::numeric)
    returning id into iid;
  end if;
  update public.market_items set category = coalesce(nullif(p->>'category', ''), 'other'), title = pg_catalog.btrim(p->>'title'),
    description = nullif(pg_catalog.btrim(coalesce(p->>'description', '')), ''), condition = coalesce(nullif(p->>'condition', ''), 'used'), mode = md,
    price = case when md = 'rent' then null else nullif(p->>'price', '')::numeric end,
    rent_per_day = case when md = 'sale' then null else nullif(p->>'rent_per_day', '')::numeric end,
    deposit = case when md = 'sale' then null else nullif(p->>'deposit', '')::numeric end,
    city = nullif(pg_catalog.btrim(coalesce(p->>'city', '')), ''), listing_id = nullif(p->>'listing_id', '')::uuid,
    status = coalesce(nullif(p->>'status', ''), status), updated_at = now()
  where id = iid;
  return public.get_item(iid);
end;
$$;

create or replace function public.set_item_photo(p_item_id uuid, p_url text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := private.require_active_user();
begin
  if not exists (select 1 from public.market_items where id = p_item_id and (seller_id = uid or private.is_admin())) then raise exception 'Only the seller can change this item.' using errcode = '42501'; end if;
  if p_url is not null and p_url not like '%/storage/v1/object/public/media/items/' || p_item_id::text || '/%' then raise exception 'Upload the photo first.' using errcode = '22023'; end if;
  update public.market_items set photo_url = p_url, updated_at = now() where id = p_item_id;
  return public.get_item(p_item_id);
end;
$$;

create or replace function public.delete_item(p_item_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := private.require_active_user();
begin
  if not exists (select 1 from public.market_items where id = p_item_id and (seller_id = uid or private.is_admin())) then raise exception 'Only the seller can delete this item.' using errcode = '42501'; end if;
  delete from public.market_items where id = p_item_id;
  return jsonb_build_object('deleted', true);
end;
$$;

create or replace function public.get_item(p_item_id uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('item', to_jsonb(i) - 'seller_id', 'seller_name', (select display_name from public.profiles where id = i.seller_id),
           'is_mine', i.seller_id = (select auth.uid()) or private.is_admin(),
           'shop', (select jsonb_build_object('id', l.id, 'name', l.name) from public.directory_listings l where l.id = i.listing_id))
    from public.market_items i where i.id = p_item_id and (i.status <> 'hidden' or i.seller_id = (select auth.uid()) or private.is_admin());
$$;

create or replace function public.list_items(p jsonb default '{}'::jsonb)
returns jsonb language sql stable security definer set search_path = ''
as $$
  with q as (select nullif(p->>'category', '') as cat, nullif(p->>'mode', '') as md, nullif(pg_catalog.btrim(coalesce(p->>'city', '')), '') as city,
                    nullif(pg_catalog.btrim(coalesce(p->>'query', '')), '') as txt, coalesce((p->>'mine')::boolean, false) as mine,
                    nullif(p->>'max_price', '')::numeric as maxp)
  select coalesce(jsonb_agg(x order by (x->>'created_at') desc), '[]'::jsonb) from (
    select jsonb_build_object('id', i.id, 'title', i.title, 'category', i.category, 'condition', i.condition, 'mode', i.mode, 'price', i.price,
             'rent_per_day', i.rent_per_day, 'deposit', i.deposit, 'city', i.city, 'photo_url', i.photo_url, 'status', i.status, 'created_at', i.created_at,
             'is_mine', i.seller_id = (select auth.uid()), 'seller_name', (select display_name from public.profiles where id = i.seller_id),
             'shop', (select l.name from public.directory_listings l where l.id = i.listing_id)) as x
      from public.market_items i, q
     where (case when q.mine then i.seller_id = (select auth.uid()) else i.status in ('available','reserved') end)
       and (q.cat is null or i.category = q.cat or (q.cat = 'bat_ball' and i.category in ('bat','ball')))
       and (q.md is null or i.mode = q.md or i.mode = 'both')
       and (q.city is null or i.city ilike '%' || q.city || '%')
       and (q.txt is null or i.title ilike '%' || q.txt || '%' or i.description ilike '%' || q.txt || '%')
       and (q.maxp is null or coalesce(i.price, i.rent_per_day) <= q.maxp)
     order by i.created_at desc limit 100) y;
$$;

-- ---------- #176 Community board ----------
create or replace function public.save_post(p_post_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := private.require_active_user(); pid uuid := p_post_id;
begin
  if pid is not null and not exists (select 1 from public.community_posts where id = pid and (author_id = uid or private.is_admin())) then raise exception 'Only the author can change this post.' using errcode = '42501'; end if;
  if (p->>'kind') not in ('players_wanted','team_wanted','match_wanted','ground_wanted','officials_wanted','other') then raise exception 'Choose the type of post.' using errcode = '22023'; end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p->>'title', ''))) < 3 then raise exception 'Enter a title.' using errcode = '22023'; end if;
  if nullif(p->>'team_id', '') is not null and not exists (select 1 from public.teams where id = (p->>'team_id')::uuid and owner_id = uid) then raise exception 'You can only post for your own team.' using errcode = '42501'; end if;
  if pid is null and (select count(*) from public.community_posts where author_id = uid and created_at > now() - interval '1 day') >= 10 then raise exception 'You can post up to 10 times a day.' using errcode = '22023'; end if;
  if pid is null then
    insert into public.community_posts (author_id, kind, title) values (uid, p->>'kind', pg_catalog.btrim(p->>'title')) returning id into pid;
  end if;
  update public.community_posts set kind = p->>'kind', title = pg_catalog.btrim(p->>'title'), body = nullif(pg_catalog.btrim(coalesce(p->>'body', '')), ''),
    city = nullif(pg_catalog.btrim(coalesce(p->>'city', '')), ''), event_date = nullif(p->>'event_date', '')::date, team_id = nullif(p->>'team_id', '')::uuid,
    status = coalesce(nullif(p->>'status', ''), status)
  where id = pid;
  return jsonb_build_object('id', pid);
end;
$$;

create or replace function public.delete_post(p_post_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := private.require_active_user();
begin
  if not exists (select 1 from public.community_posts where id = p_post_id and (author_id = uid or private.is_admin())) then raise exception 'Only the author can delete this post.' using errcode = '42501'; end if;
  delete from public.community_posts where id = p_post_id;
  return jsonb_build_object('deleted', true);
end;
$$;

create or replace function public.list_posts(p jsonb default '{}'::jsonb)
returns jsonb language sql stable security definer set search_path = ''
as $$
  with q as (select nullif(p->>'kind', '') as kind, nullif(pg_catalog.btrim(coalesce(p->>'city', '')), '') as city, coalesce((p->>'mine')::boolean, false) as mine)
  select coalesce(jsonb_agg(x order by (x->>'created_at') desc), '[]'::jsonb) from (
    select jsonb_build_object('id', c.id, 'kind', c.kind, 'title', c.title, 'body', c.body, 'city', c.city, 'event_date', c.event_date, 'status', c.status,
             'created_at', c.created_at, 'expires_at', c.expires_at, 'author', (select display_name from public.profiles where id = c.author_id),
             'team', (select jsonb_build_object('id', t.id, 'name', t.name) from public.teams t where t.id = c.team_id),
             'is_mine', c.author_id = (select auth.uid()),
             'replies', case when c.author_id = (select auth.uid()) then (select count(*) from public.enquiries e where e.target_type = 'post' and e.target_id = c.id) end) as x
      from public.community_posts c, q
     where (case when q.mine then c.author_id = (select auth.uid()) else c.status = 'open' and c.expires_at > now() end)
       and (q.kind is null or c.kind = q.kind)
       and (q.city is null or c.city ilike '%' || q.city || '%')
     order by c.created_at desc limit 100) y;
$$;

-- ---------- #176 Enquiries (private messages to an owner / seller / poster) ----------
create or replace function public.send_enquiry(p_target_type text, p_target_id uuid, p_message text, p_contact text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := private.require_active_user(); owner uuid; label text; msg text := pg_catalog.btrim(coalesce(p_message, '')); eid uuid;
begin
  if p_target_type = 'listing' then select owner_id, name into owner, label from public.directory_listings where id = p_target_id and is_active;
  elsif p_target_type = 'item' then select seller_id, title into owner, label from public.market_items where id = p_target_id and status in ('available','reserved');
  elsif p_target_type = 'post' then select author_id, title into owner, label from public.community_posts where id = p_target_id and status = 'open';
  else raise exception 'Unknown enquiry.' using errcode = '22023'; end if;
  if owner is null then raise exception 'This is no longer available.' using errcode = '22023'; end if;
  if owner = uid then raise exception 'This is your own.' using errcode = '22023'; end if;
  if pg_catalog.length(msg) < 2 or pg_catalog.length(msg) > 1000 then raise exception 'Write a message (up to 1000 characters).' using errcode = '22023'; end if;
  if p_contact is not null and pg_catalog.length(p_contact) > 60 then raise exception 'Contact details can be at most 60 characters.' using errcode = '22023'; end if;
  if (select count(*) from public.enquiries where from_user = uid and created_at > now() - interval '1 day') >= 30 then raise exception 'You can send up to 30 enquiries a day.' using errcode = '22023'; end if;
  insert into public.enquiries (target_type, target_id, from_user, to_user, message, contact)
  values (p_target_type, p_target_id, uid, owner, msg, nullif(pg_catalog.btrim(coalesce(p_contact, '')), '')) returning id into eid;
  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  values (owner, 'enquiry', 'New enquiry', (select display_name from public.profiles where id = uid) || ' asked about “' || label || '”.',
          jsonb_build_object('enquiry_id', eid, 'target_type', p_target_type, 'target_id', p_target_id));
  return jsonb_build_object('id', eid);
end;
$$;

create or replace function public.reply_enquiry(p_enquiry_id uuid, p_reply text, p_close boolean default false)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := private.require_active_user(); e public.enquiries%rowtype; rep text := nullif(pg_catalog.btrim(coalesce(p_reply, '')), '');
begin
  select * into e from public.enquiries where id = p_enquiry_id for update;
  if not found or e.to_user <> uid then raise exception 'Enquiry not found.' using errcode = '22023'; end if;
  if rep is not null and pg_catalog.length(rep) > 1000 then raise exception 'The reply can be at most 1000 characters.' using errcode = '22023'; end if;
  if rep is null and not p_close then raise exception 'Write a reply.' using errcode = '22023'; end if;
  update public.enquiries set reply = coalesce(rep, reply), status = case when p_close then 'closed' else 'replied' end,
         replied_at = case when rep is not null then now() else replied_at end where id = e.id;
  if rep is not null then
    insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
    values (e.from_user, 'enquiry_reply', 'Reply to your enquiry', pg_catalog.left(rep, 200), jsonb_build_object('enquiry_id', e.id));
  end if;
  return public.my_enquiries();
end;
$$;

create or replace function public.my_enquiries()
returns jsonb language sql stable security definer set search_path = ''
as $$
  with e as (select e.*, case e.target_type
                when 'listing' then (select name from public.directory_listings where id = e.target_id)
                when 'item' then (select title from public.market_items where id = e.target_id)
                else (select title from public.community_posts where id = e.target_id) end as label
               from public.enquiries e where e.from_user = (select auth.uid()) or e.to_user = (select auth.uid()))
  select jsonb_build_object(
    'received', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'target_type', target_type, 'target_id', target_id, 'about', label, 'message', message,
                 'contact', contact, 'reply', reply, 'status', status, 'created_at', created_at, 'from', (select display_name from public.profiles where id = from_user))
                 order by created_at desc) from e where to_user = (select auth.uid())), '[]'::jsonb),
    'sent', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'target_type', target_type, 'target_id', target_id, 'about', label, 'message', message,
                 'reply', reply, 'status', status, 'created_at', created_at, 'replied_at', replied_at, 'to', (select display_name from public.profiles where id = to_user))
                 order by created_at desc) from e where from_user = (select auth.uid())), '[]'::jsonb),
    'unread', (select count(*) from e where to_user = (select auth.uid()) and status = 'open')
  );
$$;

-- ---------- #169–#175 Find (one search across the website) ----------
create or replace function public.community_search(p jsonb)
returns jsonb language sql stable security definer set search_path = ''
as $$
  with q as (select p->>'kind' as kind, nullif(pg_catalog.btrim(coalesce(p->>'query', '')), '') as txt,
                    nullif(pg_catalog.btrim(coalesce(p->>'city', '')), '') as city, nullif(p->>'role', '') as role)
  select case (select kind from q)
    when 'teams' then coalesce((select jsonb_agg(x order by x->>'name') from (
        select jsonb_build_object('id', t.id, 'name', t.name, 'short_name', t.short_name, 'city', t.city, 'logo_url', t.logo_url,
                 'players', (select count(*) from public.team_members tm where tm.team_id = t.id),
                 'matches', (select count(*) from public.matches m where t.id in (m.team_a_id, m.team_b_id) and m.status = 'completed')) as x
          from public.teams t, q
         where (q.txt is null or t.name ilike '%' || q.txt || '%' or t.short_name ilike q.txt) and (q.city is null or t.city ilike '%' || q.city || '%')
         limit 60) y), '[]'::jsonb)
    when 'players' then coalesce((select jsonb_agg(x order by x->>'name') from (
        select jsonb_build_object('id', pl.id, 'name', pl.display_name, 'player_code', pl.player_code, 'photo_url', pl.photo_url, 'role', pl.player_role,
                 'batting_style', pl.batting_style, 'bowling_style', pl.bowling_style,
                 'teams', (select string_agg(t.name, ', ') from public.team_members tm join public.teams t on t.id = tm.team_id where tm.player_id = pl.id)) as x
          from public.players pl, q
         where (q.txt is null or pl.display_name ilike '%' || q.txt || '%' or pl.player_code ilike q.txt)
           and (q.role is null or pl.player_role = q.role)
           and (q.city is null or exists (select 1 from public.team_members tm join public.teams t on t.id = tm.team_id where tm.player_id = pl.id and t.city ilike '%' || q.city || '%'))
           and not exists (select 1 from public.user_privacy_settings s where s.user_id = pl.profile_id and s.profile_visibility = 'private')
         limit 60) y), '[]'::jsonb)
    when 'tournaments' then coalesce((select jsonb_agg(x order by x->>'start_date' desc nulls last) from (
        select jsonb_build_object('id', t.id, 'name', t.name, 'code', t.code, 'city', t.city, 'venue', t.venue, 'status', t.status, 'start_date', t.start_date,
                 'registration_open', t.registration_open, 'teams_count', t.teams_count, 'entry_fee', t.entry_fee, 'logo_url', t.logo_url,
                 'overs', t.overs_per_innings, 'ball_type', t.ball_type) as x
          from public.tournaments t, q
         where (q.txt is null or t.name ilike '%' || q.txt || '%' or t.code ilike q.txt) and (q.city is null or t.city ilike '%' || q.city || '%' or t.venue ilike '%' || q.city || '%')
           and (q.role is null or (q.role = 'open' and t.registration_open) or t.status = q.role)
         limit 60) y), '[]'::jsonb)
    else '[]'::jsonb end;
$$;

revoke all on function private.require_active_user() from public, anon, authenticated;
revoke all on function public.save_listing(uuid, jsonb) from public, anon;
revoke all on function public.set_listing_photo(uuid, text) from public, anon;
revoke all on function public.delete_listing(uuid) from public, anon;
revoke all on function public.get_listing(uuid) from public;
revoke all on function public.list_listings(jsonb) from public;
revoke all on function public.list_organisers(text) from public;
revoke all on function public.save_item(uuid, jsonb) from public, anon;
revoke all on function public.set_item_photo(uuid, text) from public, anon;
revoke all on function public.delete_item(uuid) from public, anon;
revoke all on function public.get_item(uuid) from public;
revoke all on function public.list_items(jsonb) from public;
revoke all on function public.save_post(uuid, jsonb) from public, anon;
revoke all on function public.delete_post(uuid) from public, anon;
revoke all on function public.list_posts(jsonb) from public;
revoke all on function public.send_enquiry(text, uuid, text, text) from public, anon;
revoke all on function public.reply_enquiry(uuid, text, boolean) from public, anon;
revoke all on function public.my_enquiries() from public, anon;
revoke all on function public.community_search(jsonb) from public;
grant execute on function public.save_listing(uuid, jsonb) to authenticated;
grant execute on function public.set_listing_photo(uuid, text) to authenticated;
grant execute on function public.delete_listing(uuid) to authenticated;
grant execute on function public.get_listing(uuid) to anon, authenticated;
grant execute on function public.list_listings(jsonb) to anon, authenticated;
grant execute on function public.list_organisers(text) to anon, authenticated;
grant execute on function public.save_item(uuid, jsonb) to authenticated;
grant execute on function public.set_item_photo(uuid, text) to authenticated;
grant execute on function public.delete_item(uuid) to authenticated;
grant execute on function public.get_item(uuid) to anon, authenticated;
grant execute on function public.list_items(jsonb) to anon, authenticated;
grant execute on function public.save_post(uuid, jsonb) to authenticated;
grant execute on function public.delete_post(uuid) to authenticated;
grant execute on function public.list_posts(jsonb) to anon, authenticated;
grant execute on function public.send_enquiry(text, uuid, text, text) to authenticated;
grant execute on function public.reply_enquiry(uuid, text, boolean) to authenticated;
grant execute on function public.my_enquiries() to authenticated;
grant execute on function public.community_search(jsonb) to anon, authenticated;
