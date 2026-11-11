-- Site header search (layout work, not a blueprint feature): one search across players, teams, matches,
-- tournaments, grounds, places (academies, shops, nets, clubs…) and umpires/scorers, with optional "near me".
-- Near me: things with a map position (grounds, places, matches at a registered ground) are kept within the radius
-- (default 30 km); things that only have a city are matched to the visitor's city and the cities of mapped
-- grounds/places inside the radius.

create or replace function private.km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable set search_path = ''
as $$
  select 6371.0 * 2 * asin(sqrt(power(sin(radians(lat2 - lat1) / 2), 2)
         + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)));
$$;

create or replace function public.global_search(p jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  q text := nullif(pg_catalog.btrim(coalesce(p->>'q', '')), '');
  pat text;
  lat double precision; lng double precision;
  r double precision := least(greatest(coalesce((p->>'radius_km')::double precision, 30), 1), 100);
  near boolean := false;
  cities text[] := '{}';
  lim int := least(greatest(coalesce((p->>'limit')::int, 6), 1), 20);
  res jsonb;
begin
  if q is not null and pg_catalog.length(q) > 60 then q := pg_catalog.left(q, 60); end if;
  pat := case when q is null then null else '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%' end;
  begin lat := (p->>'lat')::double precision; lng := (p->>'lng')::double precision; exception when others then lat := null; lng := null; end;
  near := lat is not null and lng is not null and lat between -90 and 90 and lng between -180 and 180;
  if near then
    select coalesce(array_agg(distinct lower(c)), '{}') into cities from (
      select nullif(pg_catalog.btrim(p->>'city'), '') c
      union select g.city from public.grounds g where g.is_active and g.latitude is not null and private.km(lat, lng, g.latitude, g.longitude) <= r
      union select l.city from public.directory_listings l where l.is_active and l.latitude is not null and private.km(lat, lng, l.latitude, l.longitude) <= r
    ) x where c is not null and c <> '';
  end if;

  select jsonb_build_object(
    'near', near, 'radius_km', r, 'cities', to_jsonb(cities),
    'matches', coalesce((select jsonb_agg(x.j order by x.ord, x.dist nulls last) from (
        select jsonb_build_object('id', m.id, 'type', 'match', 'route', 'match-centre',
                 'title', coalesce(ta.name, '?') || ' vs ' || coalesce(tb.name, '?'),
                 'subtitle', concat_ws(' · ', case m.status when 'live' then 'LIVE' when 'scheduled' then 'Upcoming' when 'completed' then coalesce(m.result_summary, 'Finished') else m.status end,
                                       t.name, coalesce(g.name, m.venue), coalesce(g.city, m.city)),
                 'status', m.status, 'when', coalesce(m.scheduled_at, m.started_at),
                 'distance_km', case when near and g.latitude is not null then round(private.km(lat, lng, g.latitude, g.longitude)::numeric, 1) end) j,
               case m.status when 'live' then 0 when 'paused' then 0 when 'scheduled' then 1 else 2 end ord,
               case when near and g.latitude is not null then private.km(lat, lng, g.latitude, g.longitude) end dist
          from public.matches m
          left join public.teams ta on ta.id = m.team_a_id left join public.teams tb on tb.id = m.team_b_id
          left join public.tournaments t on t.id = m.tournament_id left join public.grounds g on g.id = m.ground_id
         where m.status in ('live', 'paused', 'scheduled', 'completed')
           and (q is null and (near or m.status in ('live', 'paused', 'scheduled'))
                or ta.name ilike pat or tb.name ilike pat or m.title ilike pat or m.venue ilike pat or t.name ilike pat or g.name ilike pat)
           and (not near or (g.latitude is not null and private.km(lat, lng, g.latitude, g.longitude) <= r)
                or lower(coalesce(g.city, m.city, '')) = any(cities) or lower(coalesce(ta.city, '')) = any(cities) or lower(coalesce(tb.city, '')) = any(cities)
                or exists (select 1 from unnest(cities) c where m.venue ilike '%' || c || '%'))
         order by ord, coalesce(m.scheduled_at, m.started_at) desc nulls last limit lim) x), '[]'::jsonb),
    'tournaments', coalesce((select jsonb_agg(x.j) from (
        select jsonb_build_object('id', t.id, 'type', 'tournament', 'route', 'tournament-details', 'title', t.name,
                 'subtitle', concat_ws(' · ', case when t.registration_open then 'Registration open' else initcap(t.status) end, t.venue, t.city,
                                       to_char(t.start_date, 'DD Mon YYYY')), 'status', t.status) j
          from public.tournaments t
         where t.status <> 'cancelled'
           and (q is null and (near or t.status in ('registration', 'upcoming', 'ongoing')) or t.name ilike pat or t.code ilike pat or t.venue ilike pat or t.city ilike pat)
           and (not near or lower(coalesce(t.city, '')) = any(cities) or exists (select 1 from unnest(cities) c where t.venue ilike '%' || c || '%'))
         order by case t.status when 'ongoing' then 0 when 'registration' then 1 when 'upcoming' then 2 else 3 end, t.start_date desc limit lim) x), '[]'::jsonb),
    'teams', coalesce((select jsonb_agg(x.j) from (
        select jsonb_build_object('id', t.id, 'type', 'team', 'route', 'team-details', 'title', t.name, 'logo_url', t.logo_url,
                 'subtitle', concat_ws(' · ', t.city, (select count(*) from public.team_members tm where tm.team_id = t.id) || ' players')) j
          from public.teams t
         where ((q is not null and (t.name ilike pat or t.short_name ilike pat or t.city ilike pat)) or (q is null and near))
           and (not near or lower(coalesce(t.city, '')) = any(cities))
         order by t.name limit lim) x), '[]'::jsonb),
    'players', coalesce((select jsonb_agg(x.j) from (
        select jsonb_build_object('id', pl.id, 'type', 'player', 'route', 'player-profile', 'title', pl.display_name, 'photo_url', pl.photo_url,
                 'subtitle', concat_ws(' · ', replace(initcap(coalesce(pl.player_role, '')), '_', '-'),
                   (select string_agg(t.name, ', ') from public.team_members tm join public.teams t on t.id = tm.team_id where tm.player_id = pl.id), pl.player_code)) j
          from public.players pl
         where q is not null and (pl.display_name ilike pat or pl.player_code ilike pat)
           and not exists (select 1 from public.user_privacy_settings s where s.user_id = pl.profile_id and s.profile_visibility = 'private')
           and (not near or exists (select 1 from public.team_members tm join public.teams t on t.id = tm.team_id where tm.player_id = pl.id and lower(coalesce(t.city, '')) = any(cities)))
         order by pl.display_name limit lim) x), '[]'::jsonb),
    'grounds', coalesce((select jsonb_agg(x.j order by x.dist nulls last) from (
        select jsonb_build_object('id', g.id, 'type', 'ground', 'route', 'ground', 'title', g.name,
                 'subtitle', concat_ws(' · ', g.city, case when g.hourly_rate is not null then '₹' || g.hourly_rate || '/hr' end, case when g.booking_open then 'Booking open' end),
                 'distance_km', case when near and g.latitude is not null then round(private.km(lat, lng, g.latitude, g.longitude)::numeric, 1) end) j,
               case when near and g.latitude is not null then private.km(lat, lng, g.latitude, g.longitude) end dist
          from public.grounds g
         where g.is_active and (q is null and near or g.name ilike pat or g.city ilike pat or g.address ilike pat)
           and (not near or (g.latitude is not null and private.km(lat, lng, g.latitude, g.longitude) <= r) or (g.latitude is null and lower(coalesce(g.city, '')) = any(cities)))
         order by dist nulls last, g.name limit lim) x), '[]'::jsonb),
    'places', coalesce((select jsonb_agg(x.j order by x.dist nulls last) from (
        select jsonb_build_object('id', l.id, 'type', 'place', 'route', 'community', 'title', l.name, 'kind', l.kind,
                 'subtitle', concat_ws(' · ', initcap(l.kind), l.city),
                 'distance_km', case when near and l.latitude is not null then round(private.km(lat, lng, l.latitude, l.longitude)::numeric, 1) end) j,
               case when near and l.latitude is not null then private.km(lat, lng, l.latitude, l.longitude) end dist
          from public.directory_listings l
         where l.is_active and (q is null and near or l.name ilike pat or l.city ilike pat or exists (select 1 from unnest(l.tags) tg where tg ilike pat))
           and (not near or (l.latitude is not null and private.km(lat, lng, l.latitude, l.longitude) <= r) or (l.latitude is null and lower(coalesce(l.city, '')) = any(cities)))
         order by dist nulls last, l.name limit lim) x), '[]'::jsonb),
    'officials', coalesce((select jsonb_agg(x.j) from (
        select jsonb_build_object('id', o.user_id, 'type', 'official', 'route', 'official-profile', 'title', pr.display_name,
                 'subtitle', concat_ws(' · ', concat_ws(' & ', case when o.is_umpire then 'Umpire' end, case when o.is_scorer then 'Scorer' end), o.city)) j
          from public.official_profiles o join public.profiles pr on pr.id = o.user_id
         where o.is_active and coalesce(pr.account_status, 'active') not in ('suspended', 'disabled')
           and (q is null and near or pr.display_name ilike pat or o.city ilike pat
                or (q is not null and lower(q) in ('umpire', 'umpires') and o.is_umpire) or (q is not null and lower(q) in ('scorer', 'scorers') and o.is_scorer))
           and (not near or lower(coalesce(o.city, '')) = any(cities))
         order by pr.display_name limit lim) x), '[]'::jsonb)
  ) into res;
  return res;
end;
$$;

revoke all on function private.km(double precision, double precision, double precision, double precision) from public, anon, authenticated;
revoke all on function public.global_search(jsonb) from public;
grant execute on function public.global_search(jsonb) to anon, authenticated;
