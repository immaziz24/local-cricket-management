-- Phase 5 – Category J part 1: tournament website (#189), QR (#190, made in the browser), sponsors (#191–#193),
-- advertising placements (#194), promotional campaigns (#195), page-view counters for sponsor reports (#199).
-- Payments for sponsorships and adverts come later with Category O (#276, #280).

-- ---------- helpers ----------
create or replace function private.is_tournament_organiser(p_tournament_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and (
    exists (select 1 from public.tournaments where id = p_tournament_id and owner_id = (select auth.uid()))
    or exists (select 1 from public.user_role_assignments where user_id = (select auth.uid()) and role = 'organiser'
               and scope_type = 'tournament' and scope_id = p_tournament_id and is_active)
    or private.is_admin())
  and not exists (select 1 from public.profiles where id = (select auth.uid()) and account_status in ('suspended', 'disabled'));
$$;

create or replace function private.clean_https(p_url text)
returns text language sql immutable set search_path = ''
as $$
  select case when nullif(pg_catalog.btrim(coalesce(p_url, '')), '') is null then null
              when pg_catalog.btrim(p_url) ~* '^https?://[^\s<>"]+$' and pg_catalog.length(pg_catalog.btrim(p_url)) <= 300 then pg_catalog.btrim(p_url)
              else 'INVALID' end;
$$;

-- ---------- page views (sponsor reports) ----------
create table if not exists public.page_views (
  kind text not null check (kind in ('tournament_site', 'tournament', 'sponsor', 'campaign')),
  ref_id uuid not null,
  day date not null default current_date,
  views integer not null default 0,
  primary key (kind, ref_id, day)
);
alter table public.page_views enable row level security;
revoke all on public.page_views from anon, authenticated;

create or replace function public.record_view(p_kind text, p_ref uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if p_kind not in ('tournament_site', 'tournament', 'sponsor') or p_ref is null then return; end if;
  insert into public.page_views (kind, ref_id, day, views) values (p_kind, p_ref, current_date, 1)
  on conflict (kind, ref_id, day) do update set views = public.page_views.views + 1;
end;
$$;

-- ---------- #189 tournament website settings ----------
alter table public.tournaments add column if not exists site jsonb not null default '{}'::jsonb;

create or replace function public.save_tournament_site(p_tournament_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := private.require_active_user(); v jsonb := '{}'::jsonb; k text; u text;
  allowed_sections text[] := array['fixtures','points','results','stats','teams','sponsors','gallery','awards','merch'];
begin
  perform private.require_tournament_organiser(p_tournament_id);
  if pg_catalog.length(coalesce(p->>'tagline', '')) > 120 then raise exception 'The tagline can be at most 120 characters.' using errcode = '22023'; end if;
  if pg_catalog.length(coalesce(p->>'about', '')) > 3000 then raise exception 'The about text can be at most 3000 characters.' using errcode = '22023'; end if;
  v := jsonb_strip_nulls(jsonb_build_object(
    'tagline', nullif(pg_catalog.btrim(coalesce(p->>'tagline', '')), ''),
    'about', nullif(pg_catalog.btrim(coalesce(p->>'about', '')), ''),
    'contact_name', nullif(pg_catalog.left(pg_catalog.btrim(coalesce(p->>'contact_name', '')), 60), ''),
    'contact_phone', nullif(pg_catalog.left(regexp_replace(coalesce(p->>'contact_phone', ''), '[^0-9+ ]', '', 'g'), 20), ''),
    'whatsapp', nullif(pg_catalog.left(regexp_replace(coalesce(p->>'whatsapp', ''), '[^0-9]', '', 'g'), 15), ''),
    'email', case when coalesce(p->>'email', '') ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then pg_catalog.left(p->>'email', 120) end,
    'theme', case when p->>'theme' in ('green','blue','red','purple','dark','orange') then p->>'theme' else 'green' end,
    'sections', (select coalesce(jsonb_agg(s), to_jsonb(allowed_sections)) from jsonb_array_elements_text(coalesce(p->'sections', to_jsonb(allowed_sections))) s where s = any(allowed_sections))
  ));
  foreach k in array array['instagram','facebook','youtube'] loop
    u := private.clean_https(p->>k);
    if u = 'INVALID' then raise exception 'The % link must start with https://', k using errcode = '22023'; end if;
    if u is not null then v := v || jsonb_build_object(k, u); end if;
  end loop;
  update public.tournaments set site = v, updated_at = now() where id = p_tournament_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, 'TOURNAMENT_SITE_UPDATED', 'tournaments', p_tournament_id::text, jsonb_build_object('sections', v->'sections'));
  return v;
end;
$$;

-- Public: look up a tournament by its code (e.g. AZIZ) or id, for the tournament website and QR codes.
create or replace function public.get_tournament_site(p_ref text)
returns jsonb language sql stable security definer set search_path = ''
as $$
  with t as (
    select * from public.tournaments
     where (case when p_ref ~* '^[0-9a-f-]{36}$' then id = p_ref::uuid else upper(code) = upper(pg_catalog.btrim(p_ref)) end)
     limit 1)
  select case when not exists (select 1 from t) then null else (select jsonb_build_object(
    'tournament', to_jsonb(t) - 'owner_id' - 'site',
    'site', t.site,
    'is_organiser', private.is_tournament_organiser(t.id),
    'teams', coalesce((select jsonb_agg(jsonb_build_object('id', tm.id, 'name', tm.name, 'short_name', tm.short_name, 'logo_url', tm.logo_url, 'city', tm.city) order by tm.name)
               from public.tournament_teams tt join public.teams tm on tm.id = tt.team_id where tt.tournament_id = t.id and tt.status = 'approved'), '[]'::jsonb),
    'views', (select coalesce(sum(views), 0) from public.page_views pv where pv.ref_id = t.id and pv.kind in ('tournament_site', 'tournament'))
  ) from t) end;
$$;

-- ---------- #191 sponsors ----------
create table if not exists public.sponsors (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(name) between 2 and 100),
  category text not null default 'business' check (category in ('business','shop','restaurant','academy','brand','media','individual','other')),
  logo_url text,
  website text check (website is null or website ~* '^https?://'),
  phone text check (phone is null or length(phone) <= 20),
  email text check (email is null or length(email) <= 120),
  city text check (city is null or length(city) <= 80),
  about text check (about is null or length(about) <= 1500),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sponsors_owner_idx on public.sponsors (owner_id);
alter table public.sponsors enable row level security;
revoke all on public.sponsors from anon, authenticated;

create table if not exists public.tournament_sponsors (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  sponsor_id uuid not null references public.sponsors(id) on delete cascade,
  tier text not null default 'partner' check (tier in ('title','powered_by','gold','silver','bronze','partner')),
  status text not null check (status in ('invited','applied','active','declined','ended')),
  banner_url text,
  link_url text check (link_url is null or link_url ~* '^https?://'),
  amount numeric(12,2) check (amount is null or amount >= 0),
  note text check (note is null or length(note) <= 500),
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  decided_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, sponsor_id)
);
create index if not exists tournament_sponsors_sponsor_idx on public.tournament_sponsors (sponsor_id);
alter table public.tournament_sponsors enable row level security;
revoke all on public.tournament_sponsors from anon, authenticated;

create or replace function private.is_sponsor_owner(p_sponsor_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and (exists (select 1 from public.sponsors where id = p_sponsor_id and owner_id = (select auth.uid())) or private.is_admin());
$$;

create or replace function public.save_sponsor(p_sponsor_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := private.require_active_user(); sid uuid := p_sponsor_id; w text;
begin
  if sid is not null and not private.is_sponsor_owner(sid) then raise exception 'Only the owner can change this sponsor.' using errcode = '42501'; end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p->>'name', ''))) < 2 then raise exception 'Enter the sponsor or business name.' using errcode = '22023'; end if;
  w := private.clean_https(p->>'website');
  if w = 'INVALID' then raise exception 'The website must start with https://' using errcode = '22023'; end if;
  if nullif(p->>'email', '') is not null and (p->>'email') !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid email address.' using errcode = '22023'; end if;
  if sid is null then
    if (select count(*) from public.sponsors where owner_id = uid) >= 5 then raise exception 'You can register up to 5 sponsors.' using errcode = '22023'; end if;
    insert into public.sponsors (owner_id, name) values (uid, pg_catalog.btrim(p->>'name')) returning id into sid;
  end if;
  update public.sponsors set
    name = pg_catalog.left(pg_catalog.btrim(p->>'name'), 100),
    category = case when p->>'category' in ('business','shop','restaurant','academy','brand','media','individual','other') then p->>'category' else 'business' end,
    website = w,
    phone = nullif(pg_catalog.left(regexp_replace(coalesce(p->>'phone', ''), '[^0-9+ ]', '', 'g'), 20), ''),
    email = nullif(pg_catalog.btrim(coalesce(p->>'email', '')), ''),
    city = nullif(pg_catalog.left(pg_catalog.btrim(coalesce(p->>'city', '')), 80), ''),
    about = nullif(pg_catalog.left(pg_catalog.btrim(coalesce(p->>'about', '')), 1500), ''),
    is_active = coalesce((p->>'is_active')::boolean, true),
    updated_at = now()
  where id = sid;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, case when p_sponsor_id is null then 'SPONSOR_REGISTERED' else 'SPONSOR_UPDATED' end, 'sponsors', sid::text, '{}'::jsonb);
  return public.get_sponsor(sid);
end;
$$;

create or replace function public.set_sponsor_logo(p_sponsor_id uuid, p_url text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_active_user();
  if not private.is_sponsor_owner(p_sponsor_id) then raise exception 'Only the owner can change this sponsor.' using errcode = '42501'; end if;
  if p_url is not null and p_url not like '%/storage/v1/object/public/media/sponsors/' || p_sponsor_id::text || '/%' then raise exception 'Upload the logo first.' using errcode = '22023'; end if;
  update public.sponsors set logo_url = p_url, updated_at = now() where id = p_sponsor_id;
  return public.get_sponsor(p_sponsor_id);
end;
$$;

create or replace function public.get_sponsor(p_sponsor_id uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'sponsor', to_jsonb(s) - 'owner_id',
    'owner_name', (select display_name from public.profiles where id = s.owner_id),
    'is_owner', private.is_sponsor_owner(s.id),
    'sponsorships', coalesce((select jsonb_agg(jsonb_build_object('id', ts.id, 'tier', ts.tier, 'status', ts.status,
                   'tournament', jsonb_build_object('id', t.id, 'name', t.name, 'code', t.code, 'status', t.status, 'start_date', t.start_date, 'logo_url', t.logo_url))
                   order by t.start_date desc)
             from public.tournament_sponsors ts join public.tournaments t on t.id = ts.tournament_id
            where ts.sponsor_id = s.id and (ts.status in ('active', 'ended') or private.is_sponsor_owner(s.id))), '[]'::jsonb))
  from public.sponsors s where s.id = p_sponsor_id and (s.is_active or private.is_sponsor_owner(s.id));
$$;

create or replace function public.list_sponsors(p jsonb default '{}'::jsonb)
returns jsonb language sql stable security definer set search_path = ''
as $$
  with q as (select nullif(pg_catalog.btrim(coalesce(p->>'query', '')), '') txt, nullif(pg_catalog.btrim(coalesce(p->>'city', '')), '') city,
                    coalesce((p->>'mine')::boolean, false) mine)
  select coalesce(jsonb_agg(x order by (x->>'active_count')::int desc, x->>'name'), '[]'::jsonb) from (
    select jsonb_build_object('id', s.id, 'name', s.name, 'category', s.category, 'logo_url', s.logo_url, 'city', s.city, 'website', s.website,
             'is_mine', s.owner_id = (select auth.uid()), 'is_active', s.is_active,
             'active_count', (select count(*) from public.tournament_sponsors ts where ts.sponsor_id = s.id and ts.status in ('active', 'ended'))) x
      from public.sponsors s, q
     where (case when q.mine then s.owner_id = (select auth.uid()) else s.is_active end)
       and (q.txt is null or s.name ilike '%' || q.txt || '%')
       and (q.city is null or s.city ilike '%' || q.city || '%')
     limit 200) y;
$$;

-- ---------- #192/#193 sponsorships (logos + banners on tournament pages) ----------
create or replace function private.sponsorship_json(ts public.tournament_sponsors, p_full boolean)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('id', ts.id, 'tier', ts.tier, 'status', ts.status, 'banner_url', ts.banner_url, 'link_url', coalesce(ts.link_url, s.website),
           'sort_order', ts.sort_order, 'created_at', ts.created_at,
           'sponsor', jsonb_build_object('id', s.id, 'name', s.name, 'logo_url', s.logo_url, 'category', s.category, 'city', s.city))
      || case when p_full then jsonb_build_object('amount', ts.amount, 'note', ts.note) else '{}'::jsonb end
  from public.sponsors s where s.id = ts.sponsor_id;
$$;

create or replace function public.invite_sponsor(p_tournament_id uuid, p_sponsor_id uuid, p_tier text default 'partner', p_amount numeric default null, p_note text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := private.require_active_user(); ts public.tournament_sponsors; s public.sponsors; direct boolean;
begin
  perform private.require_tournament_organiser(p_tournament_id);
  select * into s from public.sponsors where id = p_sponsor_id and is_active;
  if not found then raise exception 'Sponsor not found.' using errcode = '22023'; end if;
  if exists (select 1 from public.tournament_sponsors where tournament_id = p_tournament_id and sponsor_id = p_sponsor_id and status in ('invited','applied','active')) then
    raise exception 'This sponsor is already linked to the tournament.' using errcode = '22023';
  end if;
  if (select count(*) from public.tournament_sponsors where tournament_id = p_tournament_id and status in ('invited','applied','active')) >= 30 then
    raise exception 'A tournament can have up to 30 sponsors.' using errcode = '22023';
  end if;
  direct := s.owner_id = uid or private.is_admin();
  insert into public.tournament_sponsors (tournament_id, sponsor_id, tier, status, amount, note, created_by, decided_by)
  values (p_tournament_id, p_sponsor_id, case when p_tier in ('title','powered_by','gold','silver','bronze','partner') then p_tier else 'partner' end,
          case when direct then 'active' else 'invited' end, p_amount, nullif(pg_catalog.left(pg_catalog.btrim(coalesce(p_note, '')), 500), ''), uid, case when direct then uid end)
  on conflict (tournament_id, sponsor_id) do update set tier = excluded.tier, status = excluded.status, amount = excluded.amount, note = excluded.note,
     created_by = excluded.created_by, decided_by = excluded.decided_by, updated_at = now()
  returning * into ts;
  if not direct then
    insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
    values (s.owner_id, 'sponsor_invite', 'Sponsorship invitation', (select name from public.tournaments where id = p_tournament_id) || ' invited ' || s.name || ' to be a sponsor.',
            jsonb_build_object('tournament_id', p_tournament_id, 'sponsorship_id', ts.id));
  end if;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, 'SPONSOR_INVITED', 'tournament_sponsors', ts.id::text, jsonb_build_object('tournament_id', p_tournament_id, 'sponsor_id', p_sponsor_id, 'status', ts.status));
  return private.sponsorship_json(ts, true);
end;
$$;

create or replace function public.apply_to_sponsor(p_tournament_id uuid, p_sponsor_id uuid, p_tier text default 'partner', p_note text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := private.require_active_user(); ts public.tournament_sponsors; t public.tournaments;
begin
  if not private.is_sponsor_owner(p_sponsor_id) then raise exception 'Choose one of your own sponsors.' using errcode = '42501'; end if;
  select * into t from public.tournaments where id = p_tournament_id;
  if not found then raise exception 'Tournament not found.' using errcode = '22023'; end if;
  if exists (select 1 from public.tournament_sponsors where tournament_id = p_tournament_id and sponsor_id = p_sponsor_id and status in ('invited','applied','active')) then
    raise exception 'This sponsor is already linked to the tournament.' using errcode = '22023';
  end if;
  insert into public.tournament_sponsors (tournament_id, sponsor_id, tier, status, note, created_by)
  values (p_tournament_id, p_sponsor_id, case when p_tier in ('title','powered_by','gold','silver','bronze','partner') then p_tier else 'partner' end,
          'applied', nullif(pg_catalog.left(pg_catalog.btrim(coalesce(p_note, '')), 500), ''), uid)
  on conflict (tournament_id, sponsor_id) do update set tier = excluded.tier, status = 'applied', note = excluded.note, created_by = uid, decided_by = null, updated_at = now()
  returning * into ts;
  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  values (t.owner_id, 'sponsor_application', 'New sponsor offer', (select name from public.sponsors where id = p_sponsor_id) || ' wants to sponsor ' || t.name || '.',
          jsonb_build_object('tournament_id', t.id, 'sponsorship_id', ts.id));
  return private.sponsorship_json(ts, true);
end;
$$;

create or replace function public.respond_sponsorship(p_sponsorship_id uuid, p_accept boolean)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := private.require_active_user(); ts public.tournament_sponsors; notify uuid;
begin
  select * into ts from public.tournament_sponsors where id = p_sponsorship_id for update;
  if not found then raise exception 'Sponsorship not found.' using errcode = '22023'; end if;
  if ts.status = 'invited' and not private.is_sponsor_owner(ts.sponsor_id) then raise exception 'Only the sponsor can answer this invitation.' using errcode = '42501'; end if;
  if ts.status = 'applied' and not private.is_tournament_organiser(ts.tournament_id) then raise exception 'Only the organiser can answer this offer.' using errcode = '42501'; end if;
  if ts.status not in ('invited', 'applied') then raise exception 'This has already been answered.' using errcode = '22023'; end if;
  notify := case when ts.status = 'invited' then (select owner_id from public.tournaments where id = ts.tournament_id) else (select owner_id from public.sponsors where id = ts.sponsor_id) end;
  update public.tournament_sponsors set status = case when p_accept then 'active' else 'declined' end, decided_by = uid, updated_at = now() where id = ts.id returning * into ts;
  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  values (notify, 'sponsorship_' || ts.status, case when p_accept then 'Sponsorship confirmed' else 'Sponsorship declined' end,
          (select name from public.sponsors where id = ts.sponsor_id) || ' · ' || (select name from public.tournaments where id = ts.tournament_id),
          jsonb_build_object('tournament_id', ts.tournament_id, 'sponsorship_id', ts.id));
  return private.sponsorship_json(ts, true);
end;
$$;

create or replace function public.update_sponsorship(p_sponsorship_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := private.require_active_user(); ts public.tournament_sponsors; org boolean; own boolean; l text;
begin
  select * into ts from public.tournament_sponsors where id = p_sponsorship_id for update;
  if not found then raise exception 'Sponsorship not found.' using errcode = '22023'; end if;
  org := private.is_tournament_organiser(ts.tournament_id); own := private.is_sponsor_owner(ts.sponsor_id);
  if not org and not own then raise exception 'Only the organiser or the sponsor can change this.' using errcode = '42501'; end if;
  l := private.clean_https(p->>'link_url');
  if l = 'INVALID' then raise exception 'The link must start with https://' using errcode = '22023'; end if;
  if p ? 'status' and p->>'status' not in ('active', 'ended') then raise exception 'Unknown status.' using errcode = '22023'; end if;
  if p ? 'status' and ts.status not in ('active', 'ended') then raise exception 'Answer the invitation first.' using errcode = '22023'; end if;
  update public.tournament_sponsors set
    tier = case when org and p->>'tier' in ('title','powered_by','gold','silver','bronze','partner') then p->>'tier' else tier end,
    amount = case when org and p ? 'amount' then nullif(p->>'amount', '')::numeric else amount end,
    note = case when org and p ? 'note' then nullif(pg_catalog.left(pg_catalog.btrim(coalesce(p->>'note', '')), 500), '') else note end,
    sort_order = case when org and p ? 'sort_order' then coalesce((p->>'sort_order')::int, 0) else sort_order end,
    status = case when org and p ? 'status' then p->>'status' else status end,
    link_url = case when p ? 'link_url' then l else link_url end,
    updated_at = now()
  where id = ts.id returning * into ts;
  return private.sponsorship_json(ts, true);
end;
$$;

create or replace function public.set_sponsorship_banner(p_sponsorship_id uuid, p_url text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare ts public.tournament_sponsors;
begin
  perform private.require_active_user();
  select * into ts from public.tournament_sponsors where id = p_sponsorship_id;
  if not found then raise exception 'Sponsorship not found.' using errcode = '22023'; end if;
  if not private.is_tournament_organiser(ts.tournament_id) and not private.is_sponsor_owner(ts.sponsor_id) then raise exception 'Only the organiser or the sponsor can change this.' using errcode = '42501'; end if;
  if p_url is not null and p_url not like '%/storage/v1/object/public/media/sponsorships/' || ts.id::text || '/%' then raise exception 'Upload the banner first.' using errcode = '22023'; end if;
  update public.tournament_sponsors set banner_url = p_url, updated_at = now() where id = ts.id returning * into ts;
  return private.sponsorship_json(ts, true);
end;
$$;

create or replace function public.remove_sponsorship(p_sponsorship_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := private.require_active_user(); ts public.tournament_sponsors;
begin
  select * into ts from public.tournament_sponsors where id = p_sponsorship_id;
  if not found then raise exception 'Sponsorship not found.' using errcode = '22023'; end if;
  if not private.is_tournament_organiser(ts.tournament_id) and not private.is_sponsor_owner(ts.sponsor_id) then raise exception 'Only the organiser or the sponsor can remove this.' using errcode = '42501'; end if;
  delete from public.tournament_sponsors where id = ts.id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, 'SPONSORSHIP_REMOVED', 'tournament_sponsors', ts.id::text, jsonb_build_object('tournament_id', ts.tournament_id, 'sponsor_id', ts.sponsor_id));
  return jsonb_build_object('removed', true);
end;
$$;

-- Public list: active sponsors (title first). Organiser also sees pending ones and amounts; a sponsor sees its own row.
create or replace function public.list_tournament_sponsors(p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'is_organiser', private.is_tournament_organiser(p_tournament_id),
    'items', coalesce((select jsonb_agg(private.sponsorship_json(ts, private.is_tournament_organiser(ts.tournament_id) or private.is_sponsor_owner(ts.sponsor_id))
                 || jsonb_build_object('can_edit', private.is_tournament_organiser(ts.tournament_id) or private.is_sponsor_owner(ts.sponsor_id),
                                       'is_sponsor_owner', private.is_sponsor_owner(ts.sponsor_id))
                 order by array_position(array['title','powered_by','gold','silver','bronze','partner'], ts.tier), ts.sort_order, ts.created_at)
              from public.tournament_sponsors ts
             where ts.tournament_id = p_tournament_id
               and (ts.status = 'active' or private.is_tournament_organiser(ts.tournament_id) or private.is_sponsor_owner(ts.sponsor_id))), '[]'::jsonb));
$$;

-- ---------- #194 advertising placements ----------
create table if not exists public.ad_placements (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('site', 'tournament')),
  tournament_id uuid references public.tournaments(id) on delete cascade,
  sponsor_id uuid references public.sponsors(id) on delete set null,
  slot text not null check (slot in ('home_top','home_mid','matches','match_page','tournament_page','tournament_site','footer')),
  title text not null check (length(title) between 2 and 100),
  image_url text,
  link_url text check (link_url is null or link_url ~* '^https?://'),
  starts_on date not null default current_date,
  ends_on date,
  is_active boolean not null default true,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (scope = 'site' or tournament_id is not null),
  check (ends_on is null or ends_on >= starts_on)
);
create index if not exists ad_placements_slot_idx on public.ad_placements (slot, is_active);
create index if not exists ad_placements_tournament_idx on public.ad_placements (tournament_id);
alter table public.ad_placements enable row level security;
revoke all on public.ad_placements from anon, authenticated;

create or replace function private.can_manage_ad(a public.ad_placements)
returns boolean language sql stable security definer set search_path = ''
as $$
  select case when a.scope = 'site' then private.is_admin() else private.is_tournament_organiser(a.tournament_id) end;
$$;

create or replace function public.save_ad(p_ad_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := private.require_active_user(); a public.ad_placements; v_scope text; v_tid uuid; v_slot text; l text; aid uuid := p_ad_id;
begin
  if aid is not null then
    select * into a from public.ad_placements where id = aid for update;
    if not found then raise exception 'Advert not found.' using errcode = '22023'; end if;
    if not private.can_manage_ad(a) then raise exception 'You cannot change this advert.' using errcode = '42501'; end if;
    v_scope := a.scope; v_tid := a.tournament_id;
  else
    v_scope := coalesce(p->>'scope', 'tournament');
    v_tid := nullif(p->>'tournament_id', '')::uuid;
    if v_scope = 'site' and not private.is_admin() then raise exception 'Only admins can place adverts across the website.' using errcode = '42501'; end if;
    if v_scope = 'tournament' then perform private.require_tournament_organiser(v_tid); end if;
    if v_scope not in ('site', 'tournament') then raise exception 'Unknown advert type.' using errcode = '22023'; end if;
  end if;
  v_slot := p->>'slot';
  if v_scope = 'tournament' and v_slot not in ('tournament_page', 'tournament_site', 'match_page') then raise exception 'Tournament adverts can go on the tournament page, tournament website or its match pages.' using errcode = '22023'; end if;
  if v_scope = 'site' and v_slot not in ('home_top','home_mid','matches','match_page','tournament_page','footer') then raise exception 'Choose where the advert appears.' using errcode = '22023'; end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p->>'title', ''))) < 2 then raise exception 'Enter a title.' using errcode = '22023'; end if;
  l := private.clean_https(p->>'link_url');
  if l = 'INVALID' then raise exception 'The link must start with https://' using errcode = '22023'; end if;
  if nullif(p->>'sponsor_id', '') is not null and v_scope = 'tournament'
     and not exists (select 1 from public.tournament_sponsors where tournament_id = v_tid and sponsor_id = (p->>'sponsor_id')::uuid and status = 'active') then
    raise exception 'Choose an active sponsor of this tournament.' using errcode = '22023';
  end if;
  if aid is null then
    if v_scope = 'tournament' and (select count(*) from public.ad_placements where tournament_id = v_tid) >= 20 then raise exception 'A tournament can have up to 20 adverts.' using errcode = '22023'; end if;
    insert into public.ad_placements (scope, tournament_id, slot, title, created_by) values (v_scope, case when v_scope = 'tournament' then v_tid end, v_slot, pg_catalog.btrim(p->>'title'), uid) returning id into aid;
  end if;
  update public.ad_placements set
    slot = v_slot, title = pg_catalog.left(pg_catalog.btrim(p->>'title'), 100), link_url = l,
    sponsor_id = nullif(p->>'sponsor_id', '')::uuid,
    starts_on = coalesce(nullif(p->>'starts_on', '')::date, starts_on),
    ends_on = nullif(p->>'ends_on', '')::date,
    is_active = coalesce((p->>'is_active')::boolean, true)
  where id = aid returning * into a;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, case when p_ad_id is null then 'AD_CREATED' else 'AD_UPDATED' end, 'ad_placements', aid::text, jsonb_build_object('scope', v_scope, 'slot', v_slot));
  return to_jsonb(a);
end;
$$;

create or replace function public.set_ad_image(p_ad_id uuid, p_url text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare a public.ad_placements;
begin
  perform private.require_active_user();
  select * into a from public.ad_placements where id = p_ad_id;
  if not found or not private.can_manage_ad(a) then raise exception 'You cannot change this advert.' using errcode = '42501'; end if;
  if p_url is not null and p_url not like '%/storage/v1/object/public/media/ads/' || a.id::text || '/%' then raise exception 'Upload the picture first.' using errcode = '22023'; end if;
  update public.ad_placements set image_url = p_url where id = a.id returning * into a;
  return to_jsonb(a);
end;
$$;

create or replace function public.delete_ad(p_ad_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare a public.ad_placements; uid uuid := private.require_active_user();
begin
  select * into a from public.ad_placements where id = p_ad_id;
  if not found or not private.can_manage_ad(a) then raise exception 'You cannot remove this advert.' using errcode = '42501'; end if;
  delete from public.ad_placements where id = a.id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata) values (uid, 'AD_DELETED', 'ad_placements', a.id::text, '{}'::jsonb);
  return jsonb_build_object('deleted', true);
end;
$$;

-- Managers: all adverts of a tournament (organiser) or across the site (admins), with impressions and clicks.
create or replace function public.list_ads(p jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_tid uuid := nullif(p->>'tournament_id', '')::uuid;
begin
  if v_tid is not null then perform private.require_tournament_organiser(v_tid);
  elsif not private.is_admin() then raise exception 'Only admins can see website adverts.' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(a) || jsonb_build_object('sponsor_name', (select name from public.sponsors where id = a.sponsor_id),
                   'tournament_name', (select name from public.tournaments where id = a.tournament_id)) order by a.created_at desc)
    from public.ad_placements a where (case when v_tid is not null then a.tournament_id = v_tid else a.scope = 'site' end)), '[]'::jsonb);
end;
$$;

-- Public: adverts to show in one slot (site-wide ones plus, on tournament pages, that tournament's own).
create or replace function public.get_ads(p_slot text, p_tournament_id uuid default null)
returns jsonb language sql volatile security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'image_url', a.image_url, 'link_url', a.link_url, 'scope', a.scope,
           'sponsor', (select name from public.sponsors where id = a.sponsor_id))), '[]'::jsonb)
  from (select * from public.ad_placements a
         where a.slot = p_slot and a.is_active and a.image_url is not null and a.starts_on <= current_date and (a.ends_on is null or a.ends_on >= current_date)
           and (a.scope = 'site' or (p_tournament_id is not null and a.tournament_id = p_tournament_id))
         order by random() limit 3) a;
$$;

create or replace function public.record_ad_event(p_ad_id uuid, p_kind text)
returns void language sql security definer set search_path = ''
as $$
  update public.ad_placements set impressions = impressions + case when p_kind = 'view' then 1 else 0 end,
                                  clicks = clicks + case when p_kind = 'click' then 1 else 0 end
   where id = p_ad_id and p_kind in ('view', 'click');
$$;

-- ---------- #195 promotional campaigns ----------
create table if not exists public.promo_campaigns (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  title text not null check (length(title) between 3 and 80),
  message text check (message is null or length(message) <= 300),
  cta text not null default 'follow' check (cta in ('register','follow','watch','buy','custom')),
  link_url text check (link_url is null or link_url ~* '^https?://'),
  city text check (city is null or length(city) <= 80),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  status text not null default 'active' check (status in ('active','paused','ended')),
  is_hidden boolean not null default false,
  views bigint not null default 0,
  clicks bigint not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists promo_campaigns_tournament_idx on public.promo_campaigns (tournament_id);
alter table public.promo_campaigns enable row level security;
revoke all on public.promo_campaigns from anon, authenticated;

create or replace function public.save_campaign(p_campaign_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := private.require_active_user(); c public.promo_campaigns; v_tid uuid; cid uuid := p_campaign_id; l text; v_start timestamptz; v_end timestamptz;
begin
  if cid is not null then
    select * into c from public.promo_campaigns where id = cid for update;
    if not found then raise exception 'Campaign not found.' using errcode = '22023'; end if;
    v_tid := c.tournament_id;
  else v_tid := nullif(p->>'tournament_id', '')::uuid; end if;
  perform private.require_tournament_organiser(v_tid);
  if pg_catalog.length(pg_catalog.btrim(coalesce(p->>'title', ''))) < 3 then raise exception 'Enter a short headline.' using errcode = '22023'; end if;
  l := private.clean_https(p->>'link_url');
  if l = 'INVALID' then raise exception 'The link must start with https://' using errcode = '22023'; end if;
  v_start := coalesce(nullif(p->>'starts_at', '')::timestamptz, c.starts_at, now());
  v_end := coalesce(nullif(p->>'ends_at', '')::timestamptz, c.ends_at, now() + interval '14 days');
  if v_end <= v_start then raise exception 'The end must be after the start.' using errcode = '22023'; end if;
  if v_end - v_start > interval '60 days' then raise exception 'A campaign can run for up to 60 days.' using errcode = '22023'; end if;
  if coalesce(p->>'status', c.status, 'active') = 'active' and (select count(*) from public.promo_campaigns
       where tournament_id = v_tid and status = 'active' and ends_at > now() and id is distinct from cid) >= 3 then
    raise exception 'A tournament can run up to 3 campaigns at a time. Pause or end one first.' using errcode = '22023';
  end if;
  if cid is null then
    insert into public.promo_campaigns (tournament_id, title, ends_at, created_by) values (v_tid, pg_catalog.btrim(p->>'title'), v_end, uid) returning id into cid;
  end if;
  update public.promo_campaigns set
    title = pg_catalog.left(pg_catalog.btrim(p->>'title'), 80),
    message = nullif(pg_catalog.left(pg_catalog.btrim(coalesce(p->>'message', '')), 300), ''),
    cta = case when p->>'cta' in ('register','follow','watch','buy','custom') then p->>'cta' else 'follow' end,
    link_url = l, city = nullif(pg_catalog.left(pg_catalog.btrim(coalesce(p->>'city', '')), 80), ''),
    starts_at = v_start, ends_at = v_end,
    status = case when p->>'status' in ('active','paused','ended') then p->>'status' else status end
  where id = cid returning * into c;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, case when p_campaign_id is null then 'CAMPAIGN_CREATED' else 'CAMPAIGN_UPDATED' end, 'promo_campaigns', cid::text, jsonb_build_object('tournament_id', v_tid, 'status', c.status));
  return to_jsonb(c);
end;
$$;

create or replace function public.list_campaigns(p_tournament_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_tournament_organiser(p_tournament_id);
  return coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at desc) from public.promo_campaigns c where c.tournament_id = p_tournament_id), '[]'::jsonb);
end;
$$;

-- Public: campaigns running now (visitor's city first). Admins can hide any campaign.
create or replace function public.active_campaigns(p jsonb default '{}'::jsonb)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(x.j order by x.local desc, x.created_at desc), '[]'::jsonb) from (
    select jsonb_build_object('id', c.id, 'title', c.title, 'message', c.message, 'cta', c.cta, 'link_url', c.link_url, 'city', c.city, 'ends_at', c.ends_at,
             'tournament', jsonb_build_object('id', t.id, 'name', t.name, 'code', t.code, 'logo_url', t.logo_url, 'banner_color', t.banner_color,
                                              'start_date', t.start_date, 'venue', t.venue, 'city', t.city, 'registration_open', t.registration_open)) j,
           (nullif(p->>'city', '') is not null and (c.city ilike p->>'city' or t.city ilike p->>'city')) local, c.created_at
      from public.promo_campaigns c join public.tournaments t on t.id = c.tournament_id
     where c.status = 'active' and not c.is_hidden and now() between c.starts_at and c.ends_at
     order by 2 desc, c.created_at desc
     limit least(greatest(coalesce((p->>'limit')::int, 4), 1), 12)) x;
$$;

create or replace function public.record_campaign_event(p_campaign_id uuid, p_kind text)
returns void language sql security definer set search_path = ''
as $$
  update public.promo_campaigns set views = views + case when p_kind = 'view' then 1 else 0 end, clicks = clicks + case when p_kind = 'click' then 1 else 0 end
   where id = p_campaign_id and p_kind in ('view', 'click');
$$;

create or replace function public.hide_campaign(p_campaign_id uuid, p_hidden boolean)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := private.require_active_user();
begin
  if not private.is_admin() then raise exception 'Only admins can hide campaigns.' using errcode = '42501'; end if;
  update public.promo_campaigns set is_hidden = p_hidden where id = p_campaign_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata) values (uid, 'CAMPAIGN_MODERATED', 'promo_campaigns', p_campaign_id::text, jsonb_build_object('hidden', p_hidden));
  return jsonb_build_object('hidden', p_hidden);
end;
$$;

-- ---------- grants ----------
revoke all on function private.is_tournament_organiser(uuid) from public, anon, authenticated;
revoke all on function private.clean_https(text) from public, anon, authenticated;
revoke all on function private.is_sponsor_owner(uuid) from public, anon, authenticated;
revoke all on function private.sponsorship_json(public.tournament_sponsors, boolean) from public, anon, authenticated;
revoke all on function private.can_manage_ad(public.ad_placements) from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array['save_tournament_site(uuid, jsonb)', 'save_sponsor(uuid, jsonb)', 'set_sponsor_logo(uuid, text)', 'invite_sponsor(uuid, uuid, text, numeric, text)',
    'apply_to_sponsor(uuid, uuid, text, text)', 'respond_sponsorship(uuid, boolean)', 'update_sponsorship(uuid, jsonb)', 'set_sponsorship_banner(uuid, text)',
    'remove_sponsorship(uuid)', 'save_ad(uuid, jsonb)', 'set_ad_image(uuid, text)', 'delete_ad(uuid)', 'list_ads(jsonb)', 'save_campaign(uuid, jsonb)',
    'list_campaigns(uuid)', 'hide_campaign(uuid, boolean)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['get_tournament_site(text)', 'record_view(text, uuid)', 'get_sponsor(uuid)', 'list_sponsors(jsonb)', 'list_tournament_sponsors(uuid)',
    'get_ads(text, uuid)', 'record_ad_event(uuid, text)', 'active_campaigns(jsonb)', 'record_campaign_event(uuid, text)'] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
end $$;
