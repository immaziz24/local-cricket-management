-- Batch 20: #372 stream synchronization delay setting, #377 custom tournament domain mapping.
-- (#381 multilingual match story is built from existing scorecard data in the app; it needs no database change.)

-- ===== #372 Stream synchronization delay =====
-- Live video is usually 10 to 40 seconds behind the match. A delay on the score overlay keeps the score on screen in step with the picture.
alter table public.matches add column if not exists stream_delay_s smallint not null default 0;
alter table public.matches drop constraint if exists matches_stream_delay_range;
alter table public.matches add constraint matches_stream_delay_range check (stream_delay_s between 0 and 180);

create or replace function public.set_stream_delay(p_match_id uuid, p_seconds int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare old smallint;
begin
  perform private.require_scorer(p_match_id);
  if p_seconds is null or p_seconds < 0 or p_seconds > 180 then raise exception 'The delay must be between 0 and 180 seconds.' using errcode = '22023'; end if;
  select stream_delay_s into old from public.matches where id = p_match_id;
  update public.matches set stream_delay_s = p_seconds::smallint where id = p_match_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'STREAM_DELAY_SET', 'matches', p_match_id::text, jsonb_build_object('from', old, 'to', p_seconds));
  return jsonb_build_object('match_id', p_match_id, 'stream_delay_s', p_seconds);
end $$;

-- Public and read-only: the overlay page (no sign-in) asks for it.
create or replace function public.get_stream_delay(p_match_id uuid) returns int
language sql stable security definer set search_path = '' as $$
  select coalesce((select stream_delay_s::int from public.matches where id = p_match_id), 0);
$$;

-- ===== #377 Custom tournament domain mapping =====
create table if not exists public.tournament_domains (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  domain text not null,
  token text not null,
  status text not null default 'pending' check (status in ('pending', 'verified', 'failed')),
  verified_at timestamptz,
  last_checked_at timestamptz,
  last_error text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint tournament_domains_format check (domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$' and char_length(domain) <= 253)
);
alter table public.tournament_domains enable row level security;
revoke all on public.tournament_domains from public, anon, authenticated;
create unique index if not exists tournament_domains_tournament_domain_key on public.tournament_domains (tournament_id, domain);
-- Anyone can ask for a domain, but only the first to prove they control it (DNS record) gets it.
create unique index if not exists tournament_domains_verified_key on public.tournament_domains (domain) where status = 'verified';
create index if not exists tournament_domains_domain_idx on public.tournament_domains (domain);

-- Platform addresses can never be claimed.
create or replace function private.reserved_domain(p_domain text) returns boolean
language sql immutable set search_path = '' as $$
  select p_domain = any (array['plateria.in', 'localhost', 'cricnotch.com'])
      or p_domain like '%.plateria.in' or p_domain like '%.supabase.co' or p_domain like '%.supabase.in' or p_domain like '%.cricnotch.com';
$$;

create or replace function private.clean_domain(p_raw text) returns text
language sql immutable set search_path = '' as $$
  select pg_catalog.regexp_replace(pg_catalog.regexp_replace(pg_catalog.regexp_replace(pg_catalog.lower(pg_catalog.btrim(coalesce(p_raw, ''))), '^[a-z]+://', ''), '[/?#:].*$', ''), '\.+$', '');
$$;

create or replace function public.add_tournament_domain(p_tournament_id uuid, p_domain text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare d text := private.clean_domain(p_domain); r public.tournament_domains;
begin
  perform private.require_tournament_organiser(p_tournament_id);
  if d !~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$' or char_length(d) > 253 then
    raise exception 'That does not look like a web address. Use something like cup.myclub.com.' using errcode = '22023';
  end if;
  if private.reserved_domain(d) then raise exception 'That address belongs to the platform and cannot be used.' using errcode = '22023'; end if;
  if (select count(*) from public.tournament_domains where tournament_id = p_tournament_id) >= 3 then raise exception 'A tournament can have up to 3 addresses.' using errcode = '22023'; end if;
  if exists (select 1 from public.tournament_domains where domain = d and tournament_id = p_tournament_id) then raise exception 'You already added this address.' using errcode = '23505'; end if;
  if exists (select 1 from public.tournament_domains where domain = d and status = 'verified') then raise exception 'This address is already connected to another tournament.' using errcode = '23505'; end if;
  insert into public.tournament_domains (tournament_id, domain, token, created_by)
  values (p_tournament_id, d, pg_catalog.substr(pg_catalog.replace(gen_random_uuid()::text, '-', ''), 1, 24), (select auth.uid())) returning * into r;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'TOURNAMENT_DOMAIN_ADDED', 'tournaments', p_tournament_id::text, jsonb_build_object('domain', d));
  return to_jsonb(r) - 'created_by';
end $$;

create or replace function public.list_tournament_domains(p_tournament_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_tournament_organiser(p_tournament_id);
  return coalesce((select jsonb_agg(to_jsonb(x) - 'created_by' order by x.created_at) from public.tournament_domains x where x.tournament_id = p_tournament_id), '[]'::jsonb);
end $$;

create or replace function public.remove_tournament_domain(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.tournament_domains;
begin
  select * into r from public.tournament_domains where id = p_id;
  if not found then raise exception 'Address not found.' using errcode = '22023'; end if;
  perform private.require_tournament_organiser(r.tournament_id);
  delete from public.tournament_domains where id = p_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'TOURNAMENT_DOMAIN_REMOVED', 'tournaments', r.tournament_id::text, jsonb_build_object('domain', r.domain, 'was', r.status));
  return jsonb_build_object('removed', p_id);
end $$;

-- The check-domain function (runs with the person's sign-in) asks what to look for.
create or replace function public.get_domain_challenge(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r public.tournament_domains;
begin
  select * into r from public.tournament_domains where id = p_id;
  if not found then raise exception 'Address not found.' using errcode = '22023'; end if;
  perform private.require_tournament_organiser(r.tournament_id);
  return jsonb_build_object('id', r.id, 'domain', r.domain, 'token', r.token, 'record', '_cricnotch-verify.' || r.domain);
end $$;

-- Only the server-side check (service role) can record the result, so nobody can mark their own address verified.
create or replace function public.mark_domain_checked(p_id uuid, p_ok boolean, p_error text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.tournament_domains; st text;
begin
  select * into r from public.tournament_domains where id = p_id for update;
  if not found then return jsonb_build_object('status', 'missing'); end if;
  if p_ok and exists (select 1 from public.tournament_domains where domain = r.domain and status = 'verified' and id <> r.id) then
    update public.tournament_domains set status = 'failed', last_checked_at = now(), last_error = 'This address is already connected to another tournament.' where id = r.id;
    return jsonb_build_object('status', 'failed', 'error', 'This address is already connected to another tournament.');
  end if;
  st := case when p_ok then 'verified' else case when r.status = 'verified' then 'verified' else 'pending' end end;
  update public.tournament_domains
     set status = st, last_checked_at = now(), last_error = case when p_ok then null else left(coalesce(p_error, 'The record was not found yet.'), 200) end,
         verified_at = case when p_ok and verified_at is null then now() else verified_at end
   where id = r.id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (r.created_by, case when p_ok then 'TOURNAMENT_DOMAIN_VERIFIED' else 'TOURNAMENT_DOMAIN_CHECK_FAILED' end, 'tournaments', r.tournament_id::text, jsonb_build_object('domain', r.domain));
  return jsonb_build_object('status', st, 'error', case when p_ok then null else p_error end);
end $$;

-- Public: which tournament website lives at this web address? Verified addresses only.
create or replace function public.resolve_tournament_domain(p_host text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select (select jsonb_build_object('ref', coalesce(t.microsite_slug, t.code, t.id::text), 'tournament_id', t.id)
            from public.tournament_domains d join public.tournaments t on t.id = d.tournament_id
           where d.domain = private.clean_domain(p_host) and d.status = 'verified' limit 1);
$$;

do $$
declare f text;
begin
  foreach f in array array['public.set_stream_delay(uuid,int)', 'public.add_tournament_domain(uuid,text)', 'public.list_tournament_domains(uuid)',
                           'public.remove_tournament_domain(uuid)', 'public.get_domain_challenge(uuid)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  revoke execute on function public.get_stream_delay(uuid) from public;
  grant execute on function public.get_stream_delay(uuid) to anon, authenticated;
  revoke execute on function public.resolve_tournament_domain(text) from public;
  grant execute on function public.resolve_tournament_domain(text) to anon, authenticated;
  revoke execute on function public.mark_domain_checked(uuid,boolean,text) from public, anon, authenticated;
  grant execute on function public.mark_domain_checked(uuid,boolean,text) to service_role;
  revoke execute on function private.reserved_domain(text), private.clean_domain(text) from public, anon;
end $$;
