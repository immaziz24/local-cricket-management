-- Queue only recipients already selected by the 30 km match-start rule.
create table private.nearby_android_push_queue (
  notification_id uuid primary key references public.notifications(id) on delete cascade,
  queued_at timestamptz not null default now()
);

alter table private.nearby_android_push_queue enable row level security;
revoke all on private.nearby_android_push_queue from public, anon, authenticated;

create function private.enqueue_nearby_android_push()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into private.nearby_android_push_queue(notification_id) values (new.id);
  return new;
end;
$$;

revoke all on function private.enqueue_nearby_android_push() from public, anon, authenticated;

create trigger enqueue_nearby_android_push
after insert on public.notifications
for each row when (new.notification_type = 'nearby_match')
execute function private.enqueue_nearby_android_push();
