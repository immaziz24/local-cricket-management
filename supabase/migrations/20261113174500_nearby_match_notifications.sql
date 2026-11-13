create table private.nearby_match_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180)
);
alter table private.nearby_match_preferences enable row level security;

create function public.set_nearby_match_location(p_lat double precision, p_lng double precision)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.require_active_user();
begin
  if p_lat is null and p_lng is null then
    delete from private.nearby_match_preferences where user_id = actor;
  else
    insert into private.nearby_match_preferences values (actor, p_lat, p_lng)
    on conflict (user_id) do update set latitude = excluded.latitude, longitude = excluded.longitude;
  end if;
end;
$$;
revoke all on function public.set_nearby_match_location(double precision,double precision) from public, anon;
grant execute on function public.set_nearby_match_location(double precision,double precision) to authenticated;

create function private.notify_nearby_match_start()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  select p.user_id, 'nearby_match', 'Nearby match is live', 'A match has started at ' || g.name || '.',
         jsonb_build_object('match_id', new.id)
  from private.nearby_match_preferences p
  join public.grounds g on g.id = new.ground_id
  where g.latitude is not null and g.longitude is not null
    and private.km(p.latitude, p.longitude, g.latitude, g.longitude) <= 30;
  return new;
end;
$$;
revoke all on function private.notify_nearby_match_start() from public, anon, authenticated;
create trigger notify_nearby_match_start after update of status on public.matches
for each row when (old.status = 'scheduled' and new.status = 'live')
execute function private.notify_nearby_match_start();
