-- Phase 4 / Category G – Ground and venue management (#147–#159).
-- Open platform: anyone can register a ground and controls the grounds they registered.
-- Anyone signed in can ask to book a slot; the ground owner confirms or rejects it.

create table if not exists public.grounds (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (pg_catalog.length(name) between 2 and 100),
  city text check (city is null or pg_catalog.length(city) <= 80),
  address text check (address is null or pg_catalog.length(address) <= 250),
  latitude numeric(9,6) check (latitude is null or latitude between -90 and 90),
  longitude numeric(9,6) check (longitude is null or longitude between -180 and 180),
  description text check (description is null or pg_catalog.length(description) <= 1500),
  contact_phone text check (contact_phone is null or pg_catalog.length(contact_phone) <= 20),
  pitch_type text check (pitch_type is null or pitch_type in ('turf','matting','cement','astroturf','mud','mixed')),
  pitch_count int check (pitch_count is null or pitch_count between 1 and 20),
  pitch_notes text check (pitch_notes is null or pg_catalog.length(pitch_notes) <= 500),
  boundary_straight_m int check (boundary_straight_m is null or boundary_straight_m between 15 and 120),
  boundary_square_m int check (boundary_square_m is null or boundary_square_m between 15 and 120),
  boundary_notes text check (boundary_notes is null or pg_catalog.length(boundary_notes) <= 500),
  facilities text[] not null default '{}',
  open_time time, close_time time,
  hourly_rate numeric(10,2) check (hourly_rate is null or hourly_rate >= 0),
  half_day_rate numeric(10,2) check (half_day_rate is null or half_day_rate >= 0),
  full_day_rate numeric(10,2) check (full_day_rate is null or full_day_rate >= 0),
  night_extra numeric(10,2) check (night_extra is null or night_extra >= 0),
  rental_notes text check (rental_notes is null or pg_catalog.length(rental_notes) <= 500),
  booking_open boolean not null default true,
  cover_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists grounds_owner_idx on public.grounds (owner_id);
create index if not exists grounds_city_idx on public.grounds (lower(city));

create table if not exists public.ground_photos (
  id uuid primary key default gen_random_uuid(),
  ground_id uuid not null references public.grounds(id) on delete cascade,
  url text not null,
  caption text check (caption is null or pg_catalog.length(caption) <= 120),
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists ground_photos_ground_idx on public.ground_photos (ground_id);
create index if not exists ground_photos_uploaded_by_idx on public.ground_photos (uploaded_by);

create table if not exists public.ground_bookings (
  id uuid primary key default gen_random_uuid(),
  ground_id uuid not null references public.grounds(id) on delete cascade,
  kind text not null default 'booking' check (kind in ('booking','blocked')),
  booked_by uuid references auth.users(id) on delete set null,
  match_id uuid references public.matches(id) on delete set null,
  title text check (title is null or pg_catalog.length(title) <= 120),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'requested' check (status in ('requested','confirmed','rejected','cancelled')),
  amount numeric(10,2),
  paid boolean not null default false,
  note text check (note is null or pg_catalog.length(note) <= 500),
  owner_note text check (owner_note is null or pg_catalog.length(owner_note) <= 500),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists ground_bookings_ground_idx on public.ground_bookings (ground_id, starts_at);
create index if not exists ground_bookings_booked_by_idx on public.ground_bookings (booked_by);
create index if not exists ground_bookings_match_idx on public.ground_bookings (match_id);
create index if not exists ground_bookings_decided_by_idx on public.ground_bookings (decided_by);

create table if not exists public.ground_pitch_logs (
  id uuid primary key default gen_random_uuid(),
  ground_id uuid not null references public.grounds(id) on delete cascade,
  pitch_label text check (pitch_label is null or pg_catalog.length(pitch_label) <= 40),
  prepared_on date not null,
  work text[] not null default '{}',
  condition text check (condition is null or condition in ('excellent','good','fair','poor')),
  notes text check (notes is null or pg_catalog.length(notes) <= 1000),
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists ground_pitch_logs_ground_idx on public.ground_pitch_logs (ground_id, prepared_on desc);
create index if not exists ground_pitch_logs_recorded_by_idx on public.ground_pitch_logs (recorded_by);

create table if not exists public.ground_inspections (
  id uuid primary key default gen_random_uuid(),
  ground_id uuid not null references public.grounds(id) on delete cascade,
  match_id uuid references public.matches(id) on delete set null,
  inspector_id uuid references auth.users(id) on delete set null,
  inspected_on date not null default current_date,
  pitch_rating int check (pitch_rating between 1 and 5),
  outfield_rating int check (outfield_rating between 1 and 5),
  facilities_rating int check (facilities_rating between 1 and 5),
  safety_rating int check (safety_rating between 1 and 5),
  fit_for_play boolean not null default true,
  notes text check (notes is null or pg_catalog.length(notes) <= 1500),
  created_at timestamptz not null default now()
);
create index if not exists ground_inspections_ground_idx on public.ground_inspections (ground_id, inspected_on desc);
create index if not exists ground_inspections_match_idx on public.ground_inspections (match_id);
create index if not exists ground_inspections_inspector_idx on public.ground_inspections (inspector_id);

alter table public.matches add column if not exists ground_id uuid references public.grounds(id) on delete set null;
create index if not exists matches_ground_idx on public.matches (ground_id);

alter table public.grounds enable row level security;
alter table public.ground_photos enable row level security;
alter table public.ground_bookings enable row level security;
alter table public.ground_pitch_logs enable row level security;
alter table public.ground_inspections enable row level security;
revoke all on public.grounds, public.ground_photos, public.ground_bookings, public.ground_pitch_logs, public.ground_inspections from anon, authenticated;

create or replace function private.require_ground_owner(p_ground_id uuid)
returns public.grounds language plpgsql stable security definer set search_path = ''
as $$
declare g public.grounds%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  select * into g from public.grounds where id = p_ground_id;
  if not found then raise exception 'Ground not found.' using errcode = '22023'; end if;
  if g.owner_id <> (select auth.uid()) and not private.is_admin() then raise exception 'Only the ground owner can do this.' using errcode = '42501'; end if;
  if exists (select 1 from public.profiles where id = (select auth.uid()) and account_status in ('suspended','disabled')) then
    raise exception 'Your account is suspended.' using errcode = '42501';
  end if;
  return g;
end;
$$;

-- Ground photos live in the media bucket under grounds/<ground id>/.
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
  end if;
  return false;
end;
$$;

-- #147 #148 #150–#153 #156 Register or update a ground.
create or replace function public.save_ground(p_ground_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := (select auth.uid()); gid uuid := p_ground_id; fac text[]; t text := '';
  allowed text[] := array['floodlights','changing_rooms','toilets','drinking_water','parking','scoreboard','sight_screens','practice_nets','canteen','seating','first_aid','covers','wifi','power_backup'];
begin
  if uid is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  if gid is not null then perform private.require_ground_owner(gid);
  elsif exists (select 1 from public.profiles where id = uid and account_status in ('suspended','disabled')) then raise exception 'Your account is suspended.' using errcode = '42501';
  end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p->>'name', ''))) < 2 then raise exception 'Enter the ground name.' using errcode = '22023'; end if;
  select coalesce(array_agg(distinct f), '{}') into fac from jsonb_array_elements_text(coalesce(p->'facilities', '[]'::jsonb)) f where f = any(allowed);
  if (p->>'latitude') is not null and (p->>'longitude') is null or (p->>'latitude') is null and (p->>'longitude') is not null then
    raise exception 'Enter both latitude and longitude (or neither).' using errcode = '22023';
  end if;
  if gid is null then
    insert into public.grounds (owner_id, name) values (uid, pg_catalog.btrim(p->>'name')) returning id into gid;
  end if;
  update public.grounds set
    name = pg_catalog.btrim(p->>'name'),
    city = nullif(pg_catalog.btrim(coalesce(p->>'city', '')), ''), address = nullif(pg_catalog.btrim(coalesce(p->>'address', '')), ''),
    latitude = nullif(p->>'latitude', '')::numeric, longitude = nullif(p->>'longitude', '')::numeric,
    description = nullif(pg_catalog.btrim(coalesce(p->>'description', '')), ''), contact_phone = nullif(pg_catalog.btrim(coalesce(p->>'contact_phone', '')), ''),
    pitch_type = nullif(p->>'pitch_type', ''), pitch_count = nullif(p->>'pitch_count', '')::int, pitch_notes = nullif(pg_catalog.btrim(coalesce(p->>'pitch_notes', '')), ''),
    boundary_straight_m = nullif(p->>'boundary_straight_m', '')::int, boundary_square_m = nullif(p->>'boundary_square_m', '')::int,
    boundary_notes = nullif(pg_catalog.btrim(coalesce(p->>'boundary_notes', '')), ''), facilities = fac,
    open_time = nullif(p->>'open_time', '')::time, close_time = nullif(p->>'close_time', '')::time,
    hourly_rate = nullif(p->>'hourly_rate', '')::numeric, half_day_rate = nullif(p->>'half_day_rate', '')::numeric,
    full_day_rate = nullif(p->>'full_day_rate', '')::numeric, night_extra = nullif(p->>'night_extra', '')::numeric,
    rental_notes = nullif(pg_catalog.btrim(coalesce(p->>'rental_notes', '')), ''),
    booking_open = coalesce((p->>'booking_open')::boolean, true), is_active = coalesce((p->>'is_active')::boolean, true),
    updated_at = now()
  where id = gid;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, case when p_ground_id is null then 'GROUND_REGISTERED' else 'GROUND_UPDATED' end, 'grounds', gid::text, jsonb_build_object('name', p->>'name'));
  return public.get_ground(gid);
end;
$$;

-- #149 Photos (uploaded to storage first; the URL must point at this ground's folder).
create or replace function public.add_ground_photo(p_ground_id uuid, p_url text, p_caption text default null, p_make_cover boolean default false)
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_ground_owner(p_ground_id);
  if p_url is null or p_url not like '%/storage/v1/object/public/media/grounds/' || p_ground_id::text || '/%' then
    raise exception 'Upload the photo first.' using errcode = '22023';
  end if;
  if (select count(*) from public.ground_photos where ground_id = p_ground_id) >= 20 then raise exception 'A ground can have up to 20 photos.' using errcode = '22023'; end if;
  insert into public.ground_photos (ground_id, url, caption, uploaded_by) values (p_ground_id, p_url, nullif(pg_catalog.btrim(coalesce(p_caption, '')), ''), (select auth.uid()));
  if p_make_cover or not exists (select 1 from public.grounds where id = p_ground_id and cover_url is not null) then
    update public.grounds set cover_url = p_url where id = p_ground_id;
  end if;
  return public.get_ground(p_ground_id);
end;
$$;

create or replace function public.remove_ground_photo(p_photo_id uuid, p_make_cover boolean default false)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare ph public.ground_photos%rowtype;
begin
  select * into ph from public.ground_photos where id = p_photo_id;
  if not found then raise exception 'Photo not found.' using errcode = '22023'; end if;
  perform private.require_ground_owner(ph.ground_id);
  if p_make_cover then
    update public.grounds set cover_url = ph.url where id = ph.ground_id;
  else
    delete from public.ground_photos where id = ph.id;
    update public.grounds set cover_url = (select url from public.ground_photos where ground_id = ph.ground_id order by created_at limit 1)
     where id = ph.ground_id and cover_url = ph.url;
  end if;
  return public.get_ground(ph.ground_id);
end;
$$;

-- List / search grounds.
create or replace function public.list_grounds(p jsonb default '{}'::jsonb)
returns jsonb language sql stable security definer set search_path = ''
as $$
  with q as (select nullif(pg_catalog.btrim(coalesce(p->>'query', '')), '') as txt, nullif(pg_catalog.btrim(coalesce(p->>'city', '')), '') as city,
                    coalesce((p->>'mine')::boolean, false) as mine, nullif(p->>'facility', '') as fac)
  select coalesce(jsonb_agg(x order by x->>'name'), '[]'::jsonb) from (
    select jsonb_build_object('id', g.id, 'name', g.name, 'city', g.city, 'address', g.address, 'cover_url', g.cover_url, 'pitch_type', g.pitch_type,
             'facilities', g.facilities, 'hourly_rate', g.hourly_rate, 'full_day_rate', g.full_day_rate, 'booking_open', g.booking_open,
             'is_mine', g.owner_id = (select auth.uid()), 'is_active', g.is_active,
             'matches', (select count(*) from public.matches m where m.ground_id = g.id and m.status in ('live','completed')),
             'rating', (select round(avg((coalesce(i.pitch_rating,0) + coalesce(i.outfield_rating,0) + coalesce(i.facilities_rating,0) + coalesce(i.safety_rating,0))::numeric
                                         / nullif((i.pitch_rating is not null)::int + (i.outfield_rating is not null)::int + (i.facilities_rating is not null)::int + (i.safety_rating is not null)::int, 0)), 1)
                          from public.ground_inspections i where i.ground_id = g.id)) as x
      from public.grounds g, q
     where (g.is_active or g.owner_id = (select auth.uid()))
       and (not q.mine or g.owner_id = (select auth.uid()))
       and (q.txt is null or g.name ilike '%' || q.txt || '%' or g.address ilike '%' || q.txt || '%')
       and (q.city is null or g.city ilike '%' || q.city || '%')
       and (q.fac is null or q.fac = any(g.facilities))
     limit 60) y;
$$;

-- #148 #159 Full ground profile with match history and statistics.
create or replace function public.get_ground(p_ground_id uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  with g as (select * from public.grounds where id = p_ground_id),
  owner as (select (select auth.uid()) is not null and ((select owner_id from g) = (select auth.uid()) or private.is_admin()) as v),
  hm as (select m.* from public.matches m where m.ground_id = p_ground_id),
  first_inn as (select i.runs, i.batting_team_id, m.winner_team_id from public.innings i join hm m on m.id = i.match_id
                 where i.innings_no = 1 and not i.is_super_over and m.status = 'completed')
  select jsonb_build_object(
    'ground', (select to_jsonb(g) - 'owner_id' from g),
    'owner_name', (select display_name from public.profiles where id = (select owner_id from g)),
    'is_owner', (select v from owner),
    'photos', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'url', url, 'caption', caption) order by created_at) from public.ground_photos where ground_id = p_ground_id), '[]'::jsonb),
    'stats', jsonb_build_object(
      'matches', (select count(*) from hm where status in ('live','completed')),
      'average_first_innings', (select round(avg(runs), 0) from first_inn),
      'highest_total', (select max(runs) from public.innings i join hm on hm.id = i.match_id where not i.is_super_over),
      'won_batting_first', (select count(*) from first_inn where winner_team_id = batting_team_id),
      'won_chasing', (select count(*) from first_inn where winner_team_id is not null and winner_team_id <> batting_team_id)),
    'history', coalesce((select jsonb_agg(jsonb_build_object('match_id', m.id, 'date', coalesce(m.started_at, m.scheduled_at), 'status', m.status, 'result', m.result_summary,
                           'teams', (select name from public.teams where id = m.team_a_id) || ' vs ' || (select name from public.teams where id = m.team_b_id),
                           'tournament', (select name from public.tournaments where id = m.tournament_id)) order by coalesce(m.started_at, m.scheduled_at) desc nulls last)
                         from (select * from hm order by coalesce(started_at, scheduled_at) desc nulls last limit 40) m), '[]'::jsonb),
    'pitch_logs', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'pitch_label', pitch_label, 'prepared_on', prepared_on, 'work', work, 'condition', condition, 'notes', notes,
                           'by', (select display_name from public.profiles where id = recorded_by)) order by prepared_on desc, created_at desc)
                         from (select * from public.ground_pitch_logs where ground_id = p_ground_id order by prepared_on desc, created_at desc limit 30) x), '[]'::jsonb),
    'inspections', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'inspected_on', inspected_on, 'pitch', pitch_rating, 'outfield', outfield_rating,
                           'facilities', facilities_rating, 'safety', safety_rating, 'fit_for_play', fit_for_play, 'notes', notes, 'match_id', match_id,
                           'by', (select display_name from public.profiles where id = inspector_id)) order by inspected_on desc, created_at desc)
                         from (select * from public.ground_inspections where ground_id = p_ground_id order by inspected_on desc, created_at desc limit 30) x), '[]'::jsonb)
  )
  where exists (select 1 from g);
$$;

-- Booking price from the ground's rates (#156).
create or replace function private.booking_amount(g public.grounds, p_start timestamptz, p_end timestamptz)
returns numeric language plpgsql stable set search_path = ''
as $$
declare hrs numeric := ceil(extract(epoch from (p_end - p_start)) / 1800.0) / 2.0; amt numeric;
begin
  if g.hourly_rate is not null then amt := hrs * g.hourly_rate; end if;
  if hrs >= 8 and g.full_day_rate is not null then amt := least(coalesce(amt, g.full_day_rate), g.full_day_rate);
  elsif hrs >= 4 and g.half_day_rate is not null then amt := least(coalesce(amt, g.half_day_rate), g.half_day_rate); end if;
  if amt is not null and g.night_extra is not null and (p_end at time zone 'Asia/Kolkata')::time > time '18:30' then amt := amt + g.night_extra; end if;
  return amt;
end;
$$;

-- #154 Ask to book a slot (or, for the owner, block a slot).
create or replace function public.request_ground_booking(p_ground_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare g public.grounds%rowtype; uid uuid := (select auth.uid()); s timestamptz := (p->>'starts_at')::timestamptz; e timestamptz := (p->>'ends_at')::timestamptz;
        mid uuid := nullif(p->>'match_id', '')::uuid; is_block boolean := coalesce((p->>'block')::boolean, false); bid uuid; is_owner boolean;
begin
  if uid is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  select * into g from public.grounds where id = p_ground_id;
  if not found or not g.is_active then raise exception 'Ground not found.' using errcode = '22023'; end if;
  is_owner := g.owner_id = uid or private.is_admin();
  if is_block and not is_owner then raise exception 'Only the ground owner can block slots.' using errcode = '42501'; end if;
  if not is_block and not g.booking_open and not is_owner then raise exception 'This ground is not taking bookings right now.' using errcode = '22023'; end if;
  if exists (select 1 from public.profiles where id = uid and account_status in ('suspended','disabled')) then raise exception 'Your account is suspended.' using errcode = '42501'; end if;
  if s is null or e is null or e <= s then raise exception 'Choose a start and an end time.' using errcode = '22023'; end if;
  if e - s > interval '16 hours' then raise exception 'One booking can be at most 16 hours.' using errcode = '22023'; end if;
  if s < now() - interval '1 hour' and not is_owner then raise exception 'That time has already passed.' using errcode = '22023'; end if;
  if mid is not null and not private.can_manage_match(mid) then raise exception 'You can only link a match you manage.' using errcode = '42501'; end if;
  if exists (select 1 from public.ground_bookings b where b.ground_id = p_ground_id and b.status = 'confirmed' and b.starts_at < e and b.ends_at > s) then
    raise exception 'That time overlaps a confirmed booking.' using errcode = '22023';
  end if;
  if not is_block and (select count(*) from public.ground_bookings where booked_by = uid and status = 'requested' and ground_id = p_ground_id) >= 10 then
    raise exception 'You already have 10 requests waiting at this ground.' using errcode = '22023';
  end if;
  insert into public.ground_bookings (ground_id, kind, booked_by, match_id, title, starts_at, ends_at, status, amount, note, decided_by, decided_at)
  values (p_ground_id, case when is_block then 'blocked' else 'booking' end, uid, mid, nullif(pg_catalog.btrim(coalesce(p->>'title', '')), ''), s, e,
          case when is_block or is_owner then 'confirmed' else 'requested' end,
          case when is_block then null else private.booking_amount(g, s, e) end, nullif(pg_catalog.btrim(coalesce(p->>'note', '')), ''),
          case when is_block or is_owner then uid end, case when is_block or is_owner then now() end)
  returning id into bid;
  if mid is not null and (is_owner) then
    update public.matches set ground_id = p_ground_id, venue = coalesce(venue, g.name), city = coalesce(city, g.city) where id = mid;
  end if;
  if not is_owner then
    insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
    values (g.owner_id, 'ground_booking', 'Booking request',
            (select display_name from public.profiles where id = uid) || ' asked to book ' || g.name || ' on ' ||
            to_char(s at time zone 'Asia/Kolkata', 'DD Mon, HH12:MI AM') || ' – ' || to_char(e at time zone 'Asia/Kolkata', 'HH12:MI AM') || '.',
            jsonb_build_object('ground_id', p_ground_id, 'booking_id', bid));
  end if;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, case when is_block then 'GROUND_SLOT_BLOCKED' else 'GROUND_BOOKING_REQUESTED' end, 'ground_bookings', bid::text, jsonb_build_object('ground_id', p_ground_id));
  return jsonb_build_object('id', bid, 'status', case when is_block or is_owner then 'confirmed' else 'requested' end);
end;
$$;

-- Owner confirms / rejects; booker or owner cancels; owner marks paid.
create or replace function public.decide_ground_booking(p_booking_id uuid, p_action text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare b public.ground_bookings%rowtype; g public.grounds%rowtype; uid uuid := (select auth.uid()); is_owner boolean;
begin
  if uid is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  select * into b from public.ground_bookings where id = p_booking_id for update;
  if not found then raise exception 'Booking not found.' using errcode = '22023'; end if;
  select * into g from public.grounds where id = b.ground_id for update;
  is_owner := g.owner_id = uid or private.is_admin();
  if p_action not in ('confirm','reject','cancel','paid','unpaid') then raise exception 'Unknown action.' using errcode = '22023'; end if;
  if p_action = 'cancel' then
    if not is_owner and b.booked_by is distinct from uid then raise exception 'Only the person who booked or the ground owner can cancel.' using errcode = '42501'; end if;
    if b.status not in ('requested','confirmed') then raise exception 'This booking is already closed.' using errcode = '22023'; end if;
  elsif not is_owner then raise exception 'Only the ground owner can do this.' using errcode = '42501';
  end if;
  if p_action = 'confirm' then
    if b.status <> 'requested' then raise exception 'Only waiting requests can be confirmed.' using errcode = '22023'; end if;
    if exists (select 1 from public.ground_bookings x where x.ground_id = b.ground_id and x.id <> b.id and x.status = 'confirmed' and x.starts_at < b.ends_at and x.ends_at > b.starts_at) then
      raise exception 'That time now overlaps another confirmed booking.' using errcode = '22023';
    end if;
  end if;
  if p_action = 'reject' and b.status <> 'requested' then raise exception 'Only waiting requests can be rejected.' using errcode = '22023'; end if;
  update public.ground_bookings set
    status = case p_action when 'confirm' then 'confirmed' when 'reject' then 'rejected' when 'cancel' then 'cancelled' else status end,
    paid = case p_action when 'paid' then true when 'unpaid' then false else paid end,
    owner_note = coalesce(nullif(pg_catalog.btrim(coalesce(p_note, '')), ''), owner_note),
    decided_by = case when p_action in ('confirm','reject') then uid else decided_by end,
    decided_at = case when p_action in ('confirm','reject') then now() else decided_at end
  where id = b.id;
  if p_action = 'confirm' and b.match_id is not null then
    update public.matches set ground_id = b.ground_id, venue = coalesce(venue, g.name), city = coalesce(city, g.city) where id = b.match_id;
  end if;
  if b.booked_by is not null and b.booked_by <> uid and p_action in ('confirm','reject','cancel') then
    insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
    values (b.booked_by, 'ground_booking', 'Booking ' || case p_action when 'confirm' then 'confirmed' when 'reject' then 'rejected' else 'cancelled' end,
            g.name || ', ' || to_char(b.starts_at at time zone 'Asia/Kolkata', 'DD Mon, HH12:MI AM') || coalesce(' – ' || nullif(pg_catalog.btrim(coalesce(p_note, '')), ''), ''),
            jsonb_build_object('ground_id', g.id, 'booking_id', b.id));
  elsif p_action = 'cancel' and not is_owner then
    insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
    values (g.owner_id, 'ground_booking', 'Booking cancelled', g.name || ', ' || to_char(b.starts_at at time zone 'Asia/Kolkata', 'DD Mon, HH12:MI AM') || ' was cancelled by the booker.',
            jsonb_build_object('ground_id', g.id, 'booking_id', b.id));
  end if;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, 'GROUND_BOOKING_' || upper(p_action), 'ground_bookings', b.id::text, jsonb_build_object('ground_id', g.id));
  return jsonb_build_object('ok', true);
end;
$$;

-- #155 Availability calendar: busy slots are public; details only for the owner and the booker.
create or replace function public.get_ground_calendar(p_ground_id uuid, p_from date, p_to date)
returns jsonb language sql stable security definer set search_path = ''
as $$
  with g as (select * from public.grounds where id = p_ground_id),
  me as (select (select auth.uid()) as uid, ((select owner_id from g) = (select auth.uid()) or private.is_admin()) as owner)
  select jsonb_build_object(
    'open_time', (select open_time from g), 'close_time', (select close_time from g),
    'slots', coalesce((select jsonb_agg(jsonb_build_object(
        'id', b.id, 'kind', b.kind, 'status', b.status, 'starts_at', b.starts_at, 'ends_at', b.ends_at,
        'title', case when me.owner or b.booked_by = me.uid then b.title when b.kind = 'blocked' then 'Not available' else 'Booked' end,
        'mine', b.booked_by = me.uid,
        'booked_by', case when me.owner then (select display_name from public.profiles where id = b.booked_by) end,
        'amount', case when me.owner or b.booked_by = me.uid then b.amount end,
        'paid', case when me.owner or b.booked_by = me.uid then b.paid end,
        'note', case when me.owner or b.booked_by = me.uid then b.note end,
        'owner_note', case when me.owner or b.booked_by = me.uid then b.owner_note end,
        'match_id', b.match_id) order by b.starts_at)
      from public.ground_bookings b, me
     where b.ground_id = p_ground_id
       and b.starts_at < ((least(p_to, p_from + 62) + 1)::timestamp at time zone 'Asia/Kolkata')
       and b.ends_at > (p_from::timestamp at time zone 'Asia/Kolkata')
       and (b.status = 'confirmed' or ((me.owner or b.booked_by = me.uid) and b.status = 'requested'))), '[]'::jsonb)
  );
$$;

-- My bookings (as a booker) and requests waiting at my grounds.
create or replace function public.my_ground_bookings()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'mine', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'ground_id', b.ground_id, 'ground', g.name, 'starts_at', b.starts_at, 'ends_at', b.ends_at,
               'status', b.status, 'amount', b.amount, 'paid', b.paid, 'title', b.title, 'owner_note', b.owner_note) order by b.starts_at desc)
             from public.ground_bookings b join public.grounds g on g.id = b.ground_id
            where b.booked_by = (select auth.uid()) and b.kind = 'booking' and g.owner_id <> (select auth.uid()) and b.starts_at > now() - interval '60 days'), '[]'::jsonb),
    'waiting', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'ground_id', b.ground_id, 'ground', g.name, 'starts_at', b.starts_at, 'ends_at', b.ends_at,
               'amount', b.amount, 'title', b.title, 'note', b.note, 'booked_by', (select display_name from public.profiles where id = b.booked_by)) order by b.starts_at)
             from public.ground_bookings b join public.grounds g on g.id = b.ground_id
            where g.owner_id = (select auth.uid()) and b.status = 'requested' and b.ends_at > now()), '[]'::jsonb)
  );
$$;

-- #157 Pitch preparation record (ground owner).
create or replace function public.add_pitch_log(p_ground_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare w text[];
begin
  perform private.require_ground_owner(p_ground_id);
  select coalesce(array_agg(distinct x), '{}') into w from jsonb_array_elements_text(coalesce(p->'work', '[]'::jsonb)) x
   where x in ('rolled','watered','mowed','covered','marked','repaired','rested','dried');
  if nullif(p->>'prepared_on', '') is null then raise exception 'Choose the date.' using errcode = '22023'; end if;
  if (p->>'prepared_on')::date > current_date + 30 then raise exception 'Choose a date no more than 30 days ahead.' using errcode = '22023'; end if;
  if cardinality(w) = 0 and nullif(pg_catalog.btrim(coalesce(p->>'notes', '')), '') is null then raise exception 'Tick the work done or write a note.' using errcode = '22023'; end if;
  insert into public.ground_pitch_logs (ground_id, pitch_label, prepared_on, work, condition, notes, recorded_by)
  values (p_ground_id, nullif(pg_catalog.btrim(coalesce(p->>'pitch_label', '')), ''), (p->>'prepared_on')::date, w, nullif(p->>'condition', ''),
          nullif(pg_catalog.btrim(coalesce(p->>'notes', '')), ''), (select auth.uid()));
  return public.get_ground(p_ground_id);
end;
$$;

-- #158 Inspection report: the ground owner, or an organiser / official of a match at this ground.
create or replace function public.add_ground_inspection(p_ground_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := (select auth.uid()); mid uuid := nullif(p->>'match_id', '')::uuid; ok boolean;
begin
  if uid is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  if not exists (select 1 from public.grounds where id = p_ground_id) then raise exception 'Ground not found.' using errcode = '22023'; end if;
  ok := exists (select 1 from public.grounds where id = p_ground_id and owner_id = uid) or private.is_admin()
        or (mid is not null and exists (select 1 from public.matches where id = mid and ground_id = p_ground_id)
            and (private.can_manage_match(mid) or private.is_match_official(mid)));
  if not ok then raise exception 'Only the ground owner, or the organiser / officials of a match at this ground, can file an inspection.' using errcode = '42501'; end if;
  if exists (select 1 from jsonb_each_text(p) where key in ('pitch_rating','outfield_rating','facilities_rating','safety_rating') and value <> '' and (value::int < 1 or value::int > 5)) then
    raise exception 'Ratings must be 1 to 5.' using errcode = '22023';
  end if;
  insert into public.ground_inspections (ground_id, match_id, inspector_id, inspected_on, pitch_rating, outfield_rating, facilities_rating, safety_rating, fit_for_play, notes)
  values (p_ground_id, mid, uid, coalesce(nullif(p->>'inspected_on', '')::date, current_date),
          nullif(p->>'pitch_rating', '')::int, nullif(p->>'outfield_rating', '')::int, nullif(p->>'facilities_rating', '')::int, nullif(p->>'safety_rating', '')::int,
          coalesce((p->>'fit_for_play')::boolean, true), nullif(pg_catalog.btrim(coalesce(p->>'notes', '')), ''));
  if not coalesce((p->>'fit_for_play')::boolean, true) then
    insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
    select g.owner_id, 'ground_inspection', 'Ground marked unfit', g.name || ' was marked unfit for play in an inspection.', jsonb_build_object('ground_id', g.id)
      from public.grounds g where g.id = p_ground_id and g.owner_id <> uid;
  end if;
  return public.get_ground(p_ground_id);
end;
$$;

-- #159 Link a match to a ground (match owner).
create or replace function public.set_match_ground(p_match_id uuid, p_ground_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare g public.grounds%rowtype;
begin
  if not private.can_manage_match(p_match_id) then raise exception 'Only the match creator or tournament organiser can set the ground.' using errcode = '42501'; end if;
  if p_ground_id is not null then
    select * into g from public.grounds where id = p_ground_id and is_active;
    if not found then raise exception 'Ground not found.' using errcode = '22023'; end if;
  end if;
  update public.matches set ground_id = p_ground_id,
         venue = case when p_ground_id is null then venue else g.name end, city = case when p_ground_id is null then city else coalesce(g.city, city) end
   where id = p_match_id;
  return jsonb_build_object('ground_id', p_ground_id, 'name', g.name);
end;
$$;

revoke all on function private.require_ground_owner(uuid) from public, anon, authenticated;
revoke all on function private.booking_amount(public.grounds, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.save_ground(uuid, jsonb) from public, anon;
revoke all on function public.add_ground_photo(uuid, text, text, boolean) from public, anon;
revoke all on function public.remove_ground_photo(uuid, boolean) from public, anon;
revoke all on function public.list_grounds(jsonb) from public;
revoke all on function public.get_ground(uuid) from public;
revoke all on function public.request_ground_booking(uuid, jsonb) from public, anon;
revoke all on function public.decide_ground_booking(uuid, text, text) from public, anon;
revoke all on function public.get_ground_calendar(uuid, date, date) from public;
revoke all on function public.my_ground_bookings() from public, anon;
revoke all on function public.add_pitch_log(uuid, jsonb) from public, anon;
revoke all on function public.add_ground_inspection(uuid, jsonb) from public, anon;
revoke all on function public.set_match_ground(uuid, uuid) from public, anon;
grant execute on function public.save_ground(uuid, jsonb) to authenticated;
grant execute on function public.add_ground_photo(uuid, text, text, boolean) to authenticated;
grant execute on function public.remove_ground_photo(uuid, boolean) to authenticated;
grant execute on function public.list_grounds(jsonb) to anon, authenticated;
grant execute on function public.get_ground(uuid) to anon, authenticated;
grant execute on function public.request_ground_booking(uuid, jsonb) to authenticated;
grant execute on function public.decide_ground_booking(uuid, text, text) to authenticated;
grant execute on function public.get_ground_calendar(uuid, date, date) to anon, authenticated;
grant execute on function public.my_ground_bookings() to authenticated;
grant execute on function public.add_pitch_log(uuid, jsonb) to authenticated;
grant execute on function public.add_ground_inspection(uuid, jsonb) to authenticated;
grant execute on function public.set_match_ground(uuid, uuid) to authenticated;

-- Match page shows the ground name and whether the viewer manages the match (applied as phase4_match_centre_ground).
do $mig$
declare d text; o text;
begin
  d := pg_get_functiondef('public.get_match_centre(uuid)'::regprocedure); o := d;
  d := replace(d, E'''scorer_name'', (select display_name from public.profiles where id = m.scorer_id),',
                  E'''scorer_name'', (select display_name from public.profiles where id = m.scorer_id),\n    ''ground_name'', (select g.name from public.grounds g where g.id = m.ground_id),\n    ''can_manage'', private.can_manage_match(p_match_id),');
  if d = o then raise exception 'get_match_centre patch failed'; end if;
  execute d;
end
$mig$;
