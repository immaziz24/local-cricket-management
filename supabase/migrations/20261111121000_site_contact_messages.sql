-- Site "Contact us" page (layout work, not a blueprint feature). Visitors and members send a message;
-- Admin / Super-Admin read it in the admin panel and get a notification.
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null check (length(name) between 2 and 80),
  contact text not null check (length(contact) between 5 and 120),
  topic text not null default 'general' check (topic in ('general', 'support', 'organiser', 'ground', 'sponsor', 'report', 'privacy')),
  message text not null check (length(message) between 10 and 2000),
  status text not null default 'new' check (status in ('new', 'read', 'replied', 'closed')),
  created_at timestamptz not null default now()
);
create index if not exists contact_messages_created_idx on public.contact_messages (created_at desc);
alter table public.contact_messages enable row level security;
revoke all on public.contact_messages from anon, authenticated;

create or replace function public.send_contact_message(p jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v_name text := pg_catalog.btrim(coalesce(p->>'name', ''));
  v_contact text := pg_catalog.btrim(coalesce(p->>'contact', ''));
  v_topic text := coalesce(nullif(p->>'topic', ''), 'general');
  v_msg text := pg_catalog.btrim(coalesce(p->>'message', ''));
  mid uuid;
begin
  if pg_catalog.length(v_name) < 2 then raise exception 'Please enter your name.' using errcode = '22023'; end if;
  if pg_catalog.length(v_contact) < 5 then raise exception 'Please enter your email or phone number so we can reply.' using errcode = '22023'; end if;
  if pg_catalog.length(v_msg) < 10 then raise exception 'Please write a little more (at least 10 characters).' using errcode = '22023'; end if;
  if pg_catalog.length(v_msg) > 2000 then raise exception 'Please keep the message under 2000 characters.' using errcode = '22023'; end if;
  if v_topic not in ('general', 'support', 'organiser', 'ground', 'sponsor', 'report', 'privacy') then v_topic := 'general'; end if;
  if (select count(*) from public.contact_messages where (uid is not null and user_id = uid or lower(contact) = lower(v_contact)) and created_at > now() - interval '1 day') >= 5 then
    raise exception 'You have sent several messages today. We will reply soon.' using errcode = '22023';
  end if;
  if (select count(*) from public.contact_messages where created_at > now() - interval '1 hour') >= 60 then
    raise exception 'Too many messages right now. Please try again in a while.' using errcode = '22023';
  end if;
  insert into public.contact_messages (user_id, name, contact, topic, message)
  values (uid, pg_catalog.left(v_name, 80), pg_catalog.left(v_contact, 120), v_topic, v_msg) returning id into mid;
  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  select distinct r.user_id, 'contact_message', 'New contact message', pg_catalog.left(v_name || ': ' || v_msg, 200), jsonb_build_object('message_id', mid)
    from public.user_role_assignments r where r.role in ('admin', 'super_admin') and r.is_active;
  return jsonb_build_object('sent', true);
end;
$$;

create or replace function public.list_contact_messages(p_status text default null)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_admin() then raise exception 'Only admins can read contact messages.' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at desc) from (
    select * from public.contact_messages where p_status is null or status = p_status order by created_at desc limit 200) c), '[]'::jsonb);
end;
$$;

create or replace function public.set_contact_message_status(p_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_admin() then raise exception 'Only admins can change contact messages.' using errcode = '42501'; end if;
  if p_status not in ('new', 'read', 'replied', 'closed') then raise exception 'Unknown status.' using errcode = '22023'; end if;
  update public.contact_messages set status = p_status where id = p_id;
  return jsonb_build_object('id', p_id, 'status', p_status);
end;
$$;

revoke all on function public.send_contact_message(jsonb) from public;
revoke all on function public.list_contact_messages(text) from public, anon;
revoke all on function public.set_contact_message_status(uuid, text) from public, anon;
grant execute on function public.send_contact_message(jsonb) to anon, authenticated;
grant execute on function public.list_contact_messages(text) to authenticated;
grant execute on function public.set_contact_message_status(uuid, text) to authenticated;
