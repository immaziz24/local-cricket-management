-- Batch 14 part B: #378 sponsor placement impression analytics, #379 automatic sponsor campaign report, #376 branded tournament microsites.

-- ---------- #378 daily numbers per placement ----------
create table if not exists public.placement_stats_daily (
  ad_id uuid not null references public.ad_placements(id) on delete cascade,
  day date not null,
  impressions integer not null default 0 check (impressions >= 0),
  clicks integer not null default 0 check (clicks >= 0),
  primary key (ad_id, day)
);
alter table public.placement_stats_daily enable row level security;

create or replace function public.record_ad_event(p_ad_id uuid, p_kind text) returns void language plpgsql security definer set search_path = '' as $$
declare d date := (now() at time zone 'Asia/Calcutta')::date;
begin
  if p_kind not in ('view', 'click') then return; end if;
  update public.ad_placements set impressions = impressions + case when p_kind = 'view' then 1 else 0 end,
                                  clicks = clicks + case when p_kind = 'click' then 1 else 0 end
   where id = p_ad_id;
  if not found then return; end if;
  insert into public.placement_stats_daily (ad_id, day, impressions, clicks)
  values (p_ad_id, d, case when p_kind = 'view' then 1 else 0 end, case when p_kind = 'click' then 1 else 0 end)
  on conflict (ad_id, day) do update set impressions = public.placement_stats_daily.impressions + excluded.impressions, clicks = public.placement_stats_daily.clicks + excluded.clicks;
end;
$$;

create or replace function private.can_see_placement(p_ad_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.ad_placements a where a.id = p_ad_id
       and (private.is_admin() or (a.tournament_id is not null and private.is_tournament_organiser(a.tournament_id))
            or (a.sponsor_id is not null and private.is_sponsor_owner(a.sponsor_id)) or a.created_by = (select auth.uid())));
$$;
revoke all on function private.can_see_placement(uuid) from public, anon, authenticated;

-- p: { tournament_id? , sponsor_id?, days? (7..90) }. Returns totals, per-placement rows and per-day series.
create or replace function public.placement_analytics(p jsonb) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  tid uuid := nullif(p ->> 'tournament_id', '')::uuid; sid uuid := nullif(p ->> 'sponsor_id', '')::uuid;
  dn int := least(greatest(coalesce((p ->> 'days')::int, 14), 7), 90); d0 date := (now() at time zone 'Asia/Calcutta')::date - (least(greatest(coalesce((p ->> 'days')::int, 14), 7), 90) - 1);
  ids uuid[]; tracked_from date;
begin
  perform private.require_active_user();
  if tid is null and sid is null then raise exception 'Choose a tournament or a sponsor.' using errcode = '22023'; end if;
  select coalesce(array_agg(a.id), '{}') into ids from public.ad_placements a
   where (tid is null or a.tournament_id = tid) and (sid is null or a.sponsor_id = sid) and private.can_see_placement(a.id);
  if cardinality(ids) = 0 and not (private.is_admin() or (tid is not null and private.is_tournament_organiser(tid)) or (sid is not null and private.is_sponsor_owner(sid))) then
    raise exception 'Only the organiser or the sponsor can see these numbers.' using errcode = '42501';
  end if;
  select min(day) into tracked_from from public.placement_stats_daily where ad_id = any(ids);
  return jsonb_build_object(
    'days', dn, 'tracked_from', tracked_from,
    'totals', (select jsonb_build_object('impressions', coalesce(sum(impressions), 0), 'clicks', coalesce(sum(clicks), 0),
                 'ctr', case when coalesce(sum(impressions), 0) = 0 then 0 else round(100.0 * sum(clicks) / sum(impressions), 2) end, 'placements', count(*)) from public.ad_placements where id = any(ids)),
    'untracked', (select coalesce(sum(a.impressions) - coalesce((select sum(s.impressions) from public.placement_stats_daily s where s.ad_id = any(ids)), 0), 0) from public.ad_placements a where a.id = any(ids)),
    'placements', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'slot', a.slot, 'is_active', a.is_active, 'starts_on', a.starts_on, 'ends_on', a.ends_on,
                   'impressions', a.impressions, 'clicks', a.clicks, 'ctr', case when a.impressions = 0 then 0 else round(100.0 * a.clicks / a.impressions, 2) end,
                   'last_7_impressions', (select coalesce(sum(s.impressions), 0) from public.placement_stats_daily s where s.ad_id = a.id and s.day > (now() at time zone 'Asia/Calcutta')::date - 7)) order by a.impressions desc)
                 from public.ad_placements a where a.id = any(ids)), '[]'::jsonb),
    'slots', coalesce((select jsonb_agg(jsonb_build_object('slot', slot, 'impressions', imp, 'clicks', clk) order by imp desc)
                 from (select slot, sum(impressions) imp, sum(clicks) clk from public.ad_placements where id = any(ids) group by slot) q), '[]'::jsonb),
    'series', (select coalesce(jsonb_agg(jsonb_build_object('day', g.day, 'impressions', coalesce(x.imp, 0), 'clicks', coalesce(x.clk, 0)) order by g.day), '[]'::jsonb)
                 from generate_series(d0, (now() at time zone 'Asia/Calcutta')::date, interval '1 day') as g(day)
                 left join (select day, sum(impressions) imp, sum(clicks) clk from public.placement_stats_daily where ad_id = any(ids) group by day) x on x.day = g.day::date));
end;
$$;

-- ---------- #379 sponsor reports kept as dated snapshots ----------
create table if not exists public.sponsor_report_snapshots (
  id uuid primary key default gen_random_uuid(),
  sponsorship_id uuid not null references public.tournament_sponsors(id) on delete cascade,
  kind text not null check (kind in ('weekly', 'final', 'manual')),
  data jsonb not null,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists sponsor_report_snapshots_idx on public.sponsor_report_snapshots (sponsorship_id, created_at desc);
create unique index if not exists sponsor_report_snapshots_one_final on public.sponsor_report_snapshots (sponsorship_id) where kind = 'final';
alter table public.sponsor_report_snapshots enable row level security;

create or replace function private.sponsor_snapshots_immutable() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.tournament_sponsors where id = old.sponsorship_id) then return old; end if;
  raise exception 'Sponsor report snapshots cannot be changed.' using errcode = '42501';
end;
$$;
revoke all on function private.sponsor_snapshots_immutable() from public, anon, authenticated;
drop trigger if exists sponsor_snapshots_immutable on public.sponsor_report_snapshots;
create trigger sponsor_snapshots_immutable before update or delete on public.sponsor_report_snapshots for each row execute function private.sponsor_snapshots_immutable();

-- The existing report body, without the permission check, so snapshots can be taken by the system too.
create or replace function private.sponsor_report_data(p_sponsorship_id uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare ts public.tournament_sponsors; t public.tournaments; res jsonb;
begin
  select * into ts from public.tournament_sponsors where id = p_sponsorship_id;
  if not found then return null; end if;
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
revoke all on function private.sponsor_report_data(uuid) from public, anon, authenticated;

create or replace function public.sponsor_report(p_sponsorship_id uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare ts public.tournament_sponsors;
begin
  perform private.require_active_user();
  select * into ts from public.tournament_sponsors where id = p_sponsorship_id;
  if not found then raise exception 'Sponsorship not found.' using errcode = '22023'; end if;
  if not private.is_tournament_organiser(ts.tournament_id) and not private.is_sponsor_owner(ts.sponsor_id) then
    raise exception 'Only the organiser or the sponsor can see this report.' using errcode = '42501';
  end if;
  return private.sponsor_report_data(p_sponsorship_id);
end;
$$;

create or replace function private.snapshot_row(p_sponsorship_id uuid, p_kind text, p_by uuid) returns uuid language plpgsql security definer set search_path = '' as $$
declare d jsonb := private.sponsor_report_data(p_sponsorship_id); nid uuid;
begin
  if d is null then return null; end if;
  insert into public.sponsor_report_snapshots (sponsorship_id, kind, data, created_by) values (p_sponsorship_id, p_kind, d, p_by)
  on conflict do nothing returning id into nid;
  return nid;
end;
$$;
revoke all on function private.snapshot_row(uuid, text, uuid) from public, anon, authenticated;

-- When a tournament is marked completed, every active sponsor gets a final report automatically.
create or replace function private.final_sponsor_snapshots() returns trigger language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    for r in select id from public.tournament_sponsors where tournament_id = new.id and status in ('active', 'ended') loop
      perform private.snapshot_row(r.id, 'final', null);
    end loop;
  end if;
  return new;
end;
$$;
revoke all on function private.final_sponsor_snapshots() from public, anon, authenticated;
drop trigger if exists final_sponsor_snapshots on public.tournaments;
create trigger final_sponsor_snapshots after update of status on public.tournaments for each row execute function private.final_sponsor_snapshots();

create or replace function public.take_sponsor_snapshot(p_sponsorship_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_active_user(); ts public.tournament_sponsors; nid uuid;
begin
  select * into ts from public.tournament_sponsors where id = p_sponsorship_id;
  if not found then raise exception 'Sponsorship not found.' using errcode = '22023'; end if;
  if not private.is_tournament_organiser(ts.tournament_id) and not private.is_sponsor_owner(ts.sponsor_id) then raise exception 'Only the organiser or the sponsor can save a report.' using errcode = '42501'; end if;
  if (select count(*) from public.sponsor_report_snapshots where sponsorship_id = ts.id and kind = 'manual' and created_at > now() - interval '1 day') >= 10 then raise exception 'You can save 10 reports a day.' using errcode = '22023'; end if;
  nid := private.snapshot_row(ts.id, 'manual', uid);
  return public.list_sponsor_snapshots(ts.id);
end;
$$;

-- Opening the report list also files the weekly report when a week has passed (no scheduler needed).
create or replace function public.list_sponsor_snapshots(p_sponsorship_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare ts public.tournament_sponsors; t public.tournaments;
begin
  perform private.require_active_user();
  select * into ts from public.tournament_sponsors where id = p_sponsorship_id;
  if not found then raise exception 'Sponsorship not found.' using errcode = '22023'; end if;
  if not private.is_tournament_organiser(ts.tournament_id) and not private.is_sponsor_owner(ts.sponsor_id) then raise exception 'Only the organiser or the sponsor can see these reports.' using errcode = '42501'; end if;
  select * into t from public.tournaments where id = ts.tournament_id;
  if ts.status = 'active' and t.status <> 'completed' and not exists (select 1 from public.sponsor_report_snapshots where sponsorship_id = ts.id and created_at > now() - interval '7 days') then
    perform private.snapshot_row(ts.id, 'weekly', null);
  end if;
  if t.status = 'completed' and ts.status in ('active', 'ended') then perform private.snapshot_row(ts.id, 'final', null); end if;
  return jsonb_build_object('items', coalesce((
    select jsonb_agg(jsonb_build_object('id', s.id, 'kind', s.kind, 'created_at', s.created_at,
             'impressions', coalesce((s.data -> 'exposure' ->> 'ad_impressions')::int, 0), 'clicks', coalesce((s.data -> 'exposure' ->> 'ad_clicks')::int, 0),
             'page_views', coalesce((s.data -> 'exposure' ->> 'tournament_page_views')::int, 0), 'matches_played', coalesce((s.data -> 'cricket' ->> 'matches_played')::int, 0)) order by s.created_at desc)
      from public.sponsor_report_snapshots s where s.sponsorship_id = ts.id), '[]'::jsonb));
end;
$$;

create or replace function public.get_sponsor_snapshot(p_id uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare s public.sponsor_report_snapshots; ts public.tournament_sponsors;
begin
  perform private.require_active_user();
  select * into s from public.sponsor_report_snapshots where id = p_id;
  if not found then raise exception 'Report not found.' using errcode = '22023'; end if;
  select * into ts from public.tournament_sponsors where id = s.sponsorship_id;
  if not private.is_tournament_organiser(ts.tournament_id) and not private.is_sponsor_owner(ts.sponsor_id) then raise exception 'Only the organiser or the sponsor can see this report.' using errcode = '42501'; end if;
  return jsonb_build_object('id', s.id, 'kind', s.kind, 'created_at', s.created_at, 'data', s.data);
end;
$$;

-- ---------- #376 branded microsites ----------
alter table public.tournaments add column if not exists microsite_slug text;
alter table public.tournaments add column if not exists microsite jsonb not null default '{}'::jsonb;
create unique index if not exists tournaments_microsite_slug_key on public.tournaments (lower(microsite_slug)) where microsite_slug is not null;
alter table public.tournaments drop constraint if exists tournaments_microsite_slug_format;
alter table public.tournaments add constraint tournaments_microsite_slug_format check (microsite_slug is null or microsite_slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$');

create or replace function public.check_microsite_slug(p_tournament_id uuid, p_slug text) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare s text := lower(btrim(coalesce(p_slug, '')));
begin
  perform private.require_tournament_organiser(p_tournament_id);
  if s !~ '^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$' then return jsonb_build_object('ok', false, 'reason', 'Use 3 to 40 letters, numbers or hyphens. It cannot start or end with a hyphen.'); end if;
  if s ~ '^[0-9a-f-]{36}$' or s in ('admin', 'api', 'login', 'signup', 'tournament', 'tournaments', 'match', 'matches', 'team', 'teams', 'player', 'players', 'overlay', 'help', 'about', 'privacy', 'terms', 'sponsor', 'sponsors', 'news', 'stream', 'live', 'www', 'app') then
    return jsonb_build_object('ok', false, 'reason', 'This name is reserved. Choose another.');
  end if;
  if exists (select 1 from public.tournaments where lower(microsite_slug) = s and id <> p_tournament_id) or exists (select 1 from public.tournaments where upper(code) = upper(s) and id <> p_tournament_id) then
    return jsonb_build_object('ok', false, 'reason', 'This name is already taken.');
  end if;
  return jsonb_build_object('ok', true, 'slug', s);
end;
$$;

-- p: { slug, brand_color (#rrggbb), hero_url (https), footer (<=160), standalone (bool) }
create or replace function public.save_microsite(p_tournament_id uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_active_user(); s text := lower(nullif(btrim(coalesce(p ->> 'slug', '')), '')); chk jsonb; col text := nullif(btrim(coalesce(p ->> 'brand_color', '')), ''); hero text; ft text := nullif(btrim(coalesce(p ->> 'footer', '')), ''); v jsonb;
begin
  perform private.require_tournament_organiser(p_tournament_id);
  if s is not null then
    chk := public.check_microsite_slug(p_tournament_id, s);
    if not (chk ->> 'ok')::boolean then raise exception '%', chk ->> 'reason' using errcode = '22023'; end if;
  end if;
  if col is not null and col !~* '^#[0-9a-f]{6}$' then raise exception 'The brand colour must look like #1a7f37.' using errcode = '22023'; end if;
  hero := private.clean_https(p ->> 'hero_url');
  if hero = 'INVALID' then raise exception 'The banner image link must start with https://' using errcode = '22023'; end if;
  if ft is not null and char_length(ft) > 160 then raise exception 'The footer text can be at most 160 characters.' using errcode = '22023'; end if;
  v := jsonb_strip_nulls(jsonb_build_object('brand_color', lower(col), 'hero_url', hero, 'footer', ft, 'standalone', coalesce((p ->> 'standalone')::boolean, false)));
  update public.tournaments set microsite_slug = s, microsite = v, updated_at = now() where id = p_tournament_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata) values (uid, 'MICROSITE_SAVED', 'tournaments', p_tournament_id::text, jsonb_build_object('slug', s));
  return jsonb_build_object('slug', s, 'microsite', v);
end;
$$;

create or replace function public.get_tournament_site(p_ref text) returns jsonb language sql stable security definer set search_path = '' as $$
  with t as (
    select * from public.tournaments
     where (case when p_ref ~* '^[0-9a-f-]{36}$' then id = p_ref::uuid
                 else upper(code) = upper(pg_catalog.btrim(p_ref)) or lower(microsite_slug) = lower(pg_catalog.btrim(p_ref)) end)
     limit 1)
  select case when not exists (select 1 from t) then null else (select jsonb_build_object(
    'tournament', to_jsonb(t) - 'owner_id' - 'site' - 'media_policy',
    'site', t.site,
    'microsite', t.microsite,
    'is_organiser', private.is_tournament_organiser(t.id),
    'teams', coalesce((select jsonb_agg(jsonb_build_object('id', tm.id, 'name', tm.name, 'short_name', tm.short_name, 'logo_url', tm.logo_url, 'city', tm.city) order by tm.name)
               from public.tournament_teams tt join public.teams tm on tm.id = tt.team_id where tt.tournament_id = t.id and tt.status = 'approved'), '[]'::jsonb),
    'views', (select coalesce(sum(views), 0) from public.page_views pv where pv.ref_id = t.id and pv.kind in ('tournament_site', 'tournament'))
  ) from t) end;
$$;

do $$
declare f text;
begin
  foreach f in array array['public.take_sponsor_snapshot(uuid)', 'public.list_sponsor_snapshots(uuid)', 'public.get_sponsor_snapshot(uuid)', 'public.placement_analytics(jsonb)',
                           'public.check_microsite_slug(uuid,text)', 'public.save_microsite(uuid,jsonb)', 'public.sponsor_report(uuid)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  revoke execute on function public.record_ad_event(uuid, text) from public;
  grant execute on function public.record_ad_event(uuid, text) to anon, authenticated;
  revoke execute on function public.get_tournament_site(text) from public;
  grant execute on function public.get_tournament_site(text) to anon, authenticated;
end $$;
