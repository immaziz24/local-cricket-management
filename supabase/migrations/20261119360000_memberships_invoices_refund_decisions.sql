-- Batch 16, category O: #271 free membership, #272 premium, #273 organiser packages (activation on payment),
-- #277 invoices and receipts, #278 refund decisions, #282 revenue dashboard, #283 payment history.
-- Prices are not set here: offers are the owner's decision. Everything runs in Razorpay TEST mode until he switches keys.

alter table private.payment_offers add column if not exists plan_code text;
alter table private.payment_offers add column if not exists duration_days integer not null default 30 check (duration_days between 1 and 3660);
alter table private.payment_records add column if not exists offer_id uuid;
alter table private.payment_refund_requests add column if not exists status text not null default 'open' check (status in ('open','approved','rejected'));

create table if not exists private.user_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, offer_id uuid, plan_code text not null, kind text not null,
  starts_at timestamptz not null default now(), ends_at timestamptz not null,
  status text not null default 'active' check (status in ('active','refunded')),
  source_payment_id uuid unique, created_at timestamptz not null default now()
);
create index if not exists user_memberships_user on private.user_memberships (user_id, ends_at desc);

create sequence if not exists private.invoice_seq;
create table if not exists private.invoices (
  payment_id uuid primary key, invoice_no text not null unique, payer_id uuid not null,
  payer_name text, description text not null, amount_paise integer not null, issued_at timestamptz not null default now()
);
create table if not exists private.invoice_settings (
  id boolean primary key default true check (id), seller_name text not null default 'Cricnotch', seller_address text, seller_gstin text, footer text,
  updated_at timestamptz not null default now()
);
insert into private.invoice_settings (id) values (true) on conflict do nothing;

create or replace function private.issue_invoice(p_payment uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare p private.payment_records; no text; nm text;
begin
  select * into p from private.payment_records where id = p_payment;
  if not found then return null; end if;
  select invoice_no into no from private.invoices where payment_id = p_payment;
  if no is not null then return no; end if;
  select display_name into nm from public.profiles where id = p.payer_id;
  no := 'CN-' || to_char(p.captured_at at time zone 'Asia/Kolkata', 'YYYY') || '-' || lpad(nextval('private.invoice_seq')::text, 6, '0');
  insert into private.invoices (payment_id, invoice_no, payer_id, payer_name, description, amount_paise, issued_at)
  values (p_payment, no, p.payer_id, nm, p.description, p.amount_paise, p.captured_at) on conflict do nothing;
  return no;
end $$;

create or replace function private.activate_membership(p_payment uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare p private.payment_records; o private.payment_offers; start_at timestamptz;
begin
  select * into p from private.payment_records where id = p_payment;
  if not found or p.offer_id is null then return; end if;
  select * into o from private.payment_offers where id = p.offer_id;
  if not found or o.plan_code is null then return; end if;
  -- renewing early adds time after the current end, never overlaps
  select greatest(now(), coalesce(max(ends_at), now())) into start_at from private.user_memberships
    where user_id = p.payer_id and plan_code = o.plan_code and status = 'active';
  insert into private.user_memberships (user_id, offer_id, plan_code, kind, starts_at, ends_at, source_payment_id)
  values (p.payer_id, o.id, o.plan_code, o.kind, start_at, start_at + make_interval(days => o.duration_days), p_payment)
  on conflict (source_payment_id) do nothing;
  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  values (p.payer_id, 'membership_active', 'Your plan is active: ' || o.name, 'Valid until ' || to_char((start_at + make_interval(days => o.duration_days)) at time zone 'Asia/Kolkata', 'DD Mon YYYY') || '.', jsonb_build_object('payment_id', p_payment));
end $$;

drop function if exists public.record_razorpay_test_payment(uuid, text, text, integer, timestamptz);
create or replace function public.record_razorpay_test_payment(p_payer uuid, p_payment text, p_description text, p_amount integer, p_captured_at timestamptz, p_offer uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare pid uuid;
begin
  insert into private.payment_records (payer_id, provider_payment_id, description, amount_paise, captured_at, offer_id)
  values (p_payer, p_payment, 'Test payment — ' || p_description, p_amount, p_captured_at, p_offer)
  on conflict (provider_payment_id) do nothing returning id into pid;
  if pid is null then return; end if;
  perform private.issue_invoice(pid);
  perform private.activate_membership(pid);
end $$;
revoke all on function public.record_razorpay_test_payment(uuid, text, text, integer, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.record_razorpay_test_payment(uuid, text, text, integer, timestamptz, uuid) to service_role;

create or replace function public.get_my_membership() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := private.require_active_user(); m private.user_memberships;
begin
  select * into m from private.user_memberships where user_id = uid and status = 'active' and ends_at > now() order by (kind = 'premium') desc, ends_at desc limit 1;
  if not found then
    return jsonb_build_object('plan', 'free', 'kind', 'free', 'is_free', true, 'active', true, 'ends_at', null, 'days_left', null,
      'all', coalesce((select jsonb_agg(jsonb_build_object('plan', plan_code, 'kind', kind, 'ends_at', ends_at, 'status', case when status = 'refunded' then 'refunded' else 'expired' end) order by ends_at desc)
                       from (select * from private.user_memberships where user_id = uid order by ends_at desc limit 5) h), '[]'::jsonb));
  end if;
  return jsonb_build_object('plan', m.plan_code, 'kind', m.kind, 'is_free', false, 'active', true, 'ends_at', m.ends_at,
    'days_left', greatest(0, ceil(extract(epoch from (m.ends_at - now())) / 86400))::int,
    'all', coalesce((select jsonb_agg(jsonb_build_object('plan', plan_code, 'kind', kind, 'ends_at', ends_at, 'status', case when status = 'refunded' then 'refunded' when ends_at > now() then 'active' else 'expired' end) order by ends_at desc)
                     from (select * from private.user_memberships where user_id = uid order by ends_at desc limit 5) h), '[]'::jsonb));
end $$;

create or replace function public.get_my_invoice(p_payment_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := private.require_active_user(); i private.invoices; s private.invoice_settings; r int;
begin
  select * into i from private.invoices where payment_id = p_payment_id;
  if not found then raise exception 'No invoice for this payment.' using errcode = '22023'; end if;
  if i.payer_id <> uid and not private.is_admin() then raise exception 'This invoice belongs to someone else.' using errcode = '42501'; end if;
  select * into s from private.invoice_settings where id;
  select refunded_paise into r from private.payment_records where id = p_payment_id;
  return jsonb_build_object('invoice_no', i.invoice_no, 'issued_at', i.issued_at, 'payer_name', i.payer_name, 'description', i.description,
    'amount_paise', i.amount_paise, 'refunded_paise', coalesce(r, 0), 'seller_name', s.seller_name, 'seller_address', s.seller_address,
    'seller_gstin', s.seller_gstin, 'footer', s.footer, 'test_mode', i.description like 'Test payment%');
end $$;

create or replace function public.set_invoice_settings(p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  update private.invoice_settings set seller_name = coalesce(nullif(left(btrim(p->>'seller_name'), 120), ''), seller_name),
    seller_address = nullif(left(btrim(coalesce(p->>'seller_address', '')), 300), ''), seller_gstin = nullif(left(upper(btrim(coalesce(p->>'seller_gstin', ''))), 20), ''),
    footer = nullif(left(btrim(coalesce(p->>'footer', '')), 200), ''), updated_at = now() where id;
end $$;

create or replace function public.get_invoice_settings() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin perform private.require_admin(); return (select to_jsonb(s) - 'id' from private.invoice_settings s where id); end $$;

-- #278 admin decides a refund request. The gateway money movement is done in the Razorpay dashboard (or later by an automatic step); this records it.
create or replace function public.decide_payment_refund(p_payment_id uuid, p_approve boolean, p_amount_paise integer, p_note text, p_gateway_ref text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_admin(); p private.payment_records; q private.payment_refund_requests; amt int; note text := btrim(coalesce(p_note, ''));
begin
  select * into q from private.payment_refund_requests where payment_id = p_payment_id for update;
  if not found or q.status <> 'open' then raise exception 'There is no open refund request for this payment.' using errcode = '22023'; end if;
  select * into p from private.payment_records where id = p_payment_id for update;
  if length(note) < 3 then raise exception 'Add a short note for the member (at least 3 characters).' using errcode = '22023'; end if;
  if p_approve then
    amt := coalesce(p_amount_paise, p.amount_paise - p.refunded_paise);
    if amt <= 0 or amt > p.amount_paise - p.refunded_paise then raise exception 'The refund amount must be between 1 paise and what is left to refund.' using errcode = '22023'; end if;
    update private.payment_records set refunded_paise = refunded_paise + amt where id = p_payment_id;
    update private.payment_refund_requests set status = 'approved' where payment_id = p_payment_id;
    if p.amount_paise - p.refunded_paise - amt = 0 then update private.user_memberships set status = 'refunded', ends_at = least(ends_at, now()) where source_payment_id = p_payment_id; end if;
  else
    update private.payment_refund_requests set status = 'rejected' where payment_id = p_payment_id;
  end if;
  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  values (p.payer_id, 'payment_refund', case when p_approve then 'Refund approved' else 'Refund request declined' end,
    left(note, 300), jsonb_build_object('payment_id', p_payment_id, 'amount_paise', amt, 'gateway_ref', nullif(left(btrim(coalesce(p_gateway_ref, '')), 60), '')));
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, case when p_approve then 'PAYMENT_REFUND_APPROVED' else 'PAYMENT_REFUND_REJECTED' end, 'payment', p_payment_id::text, jsonb_build_object('amount_paise', amt, 'note', left(note, 200)));
  return jsonb_build_object('ok', true, 'approved', p_approve, 'amount_paise', amt);
end $$;

drop function if exists public.list_payment_refund_requests();
create or replace function public.list_payment_refund_requests()
returns table(payment_id uuid, description text, reason text, requested_at timestamptz, amount_paise integer, refunded_paise integer, payer_name text)
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return query
    select p.id, p.description, r.reason, r.requested_at, p.amount_paise, p.refunded_paise, (select pr.display_name from public.profiles pr where pr.id = p.payer_id)
    from private.payment_refund_requests r join private.payment_records p on p.id = r.payment_id
    where r.status = 'open' and p.refunded_paise < p.amount_paise order by r.requested_at desc;
end $$;

drop function if exists public.get_my_payment_history();
create or replace function public.get_my_payment_history()
returns table(id uuid, description text, amount_paise integer, refunded_paise integer, captured_at timestamptz, invoice_no text, refund_status text)
language plpgsql security definer set search_path = '' as $$
declare member_id uuid := private.require_active_user();
begin
  return query
    select p.id, p.description, p.amount_paise, p.refunded_paise, p.captured_at, i.invoice_no, r.status
    from private.payment_records p left join private.invoices i on i.payment_id = p.id left join private.payment_refund_requests r on r.payment_id = p.id
    where p.payer_id = member_id order by p.captured_at desc, p.id limit 100;
end $$;

create or replace function public.get_revenue_dashboard() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return (select jsonb_build_object(
    'payment_count', count(*), 'captured_paise', coalesce(sum(amount_paise), 0), 'refunded_paise', coalesce(sum(refunded_paise), 0),
    'net_paise', coalesce(sum(amount_paise - refunded_paise), 0),
    'open_refunds', (select count(*) from private.payment_refund_requests where status = 'open'),
    'active_members', (select count(distinct user_id) from private.user_memberships where status = 'active' and ends_at > now()),
    'by_month', coalesce((select jsonb_agg(jsonb_build_object('month', m, 'count', c, 'captured_paise', a, 'refunded_paise', f) order by m desc)
        from (select to_char(captured_at at time zone 'Asia/Kolkata', 'YYYY-MM') m, count(*) c, sum(amount_paise) a, sum(refunded_paise) f from private.payment_records
              where captured_at > now() - interval '12 months' group by 1) x), '[]'::jsonb),
    'by_kind', coalesce((select jsonb_agg(jsonb_build_object('kind', k, 'count', c, 'captured_paise', a) order by a desc)
        from (select coalesce(o.kind, 'other') k, count(*) c, sum(p.amount_paise) a from private.payment_records p left join private.payment_offers o on o.id = p.offer_id group by 1) y), '[]'::jsonb)
  ) from private.payment_records);
end $$;

revoke all on function public.get_my_membership(), public.get_my_invoice(uuid), public.set_invoice_settings(jsonb), public.get_invoice_settings(),
  public.decide_payment_refund(uuid, boolean, integer, text, text), public.list_payment_refund_requests(), public.get_my_payment_history(), public.get_revenue_dashboard() from public, anon;
grant execute on function public.get_my_membership(), public.get_my_invoice(uuid), public.set_invoice_settings(jsonb), public.get_invoice_settings(),
  public.decide_payment_refund(uuid, boolean, integer, text, text), public.list_payment_refund_requests(), public.get_my_payment_history(), public.get_revenue_dashboard() to authenticated;
revoke all on function private.issue_invoice(uuid), private.activate_membership(uuid) from public, anon, authenticated;
