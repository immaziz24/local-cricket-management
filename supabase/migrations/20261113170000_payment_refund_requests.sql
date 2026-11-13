create table private.payment_refund_requests (
  payment_id uuid primary key references private.payment_records(id),
  reason text not null,
  requested_at timestamptz not null default now()
);
alter table private.payment_refund_requests enable row level security;

create function public.request_payment_refund(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.require_active_user();
  reason text := btrim(coalesce(p_reason, ''));
begin
  if length(reason) not between 1 and 500 then
    raise exception 'Enter a refund reason of 1 to 500 characters.';
  end if;
  perform 1 from private.payment_records
    where id = p_id and payer_id = actor and refunded_paise < amount_paise for update;
  if not found then raise exception 'This payment is unavailable for a refund request.'; end if;
  insert into private.payment_refund_requests(payment_id, reason)
    values(p_id, reason) on conflict (payment_id) do nothing;
end;
$$;

create function public.list_payment_refund_requests()
returns table(payment_id uuid, description text, reason text, requested_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return query
    select p.id, p.description, r.reason, r.requested_at
    from private.payment_refund_requests r join private.payment_records p on p.id = r.payment_id
    where p.refunded_paise < p.amount_paise order by r.requested_at desc;
end;
$$;

revoke all on function public.request_payment_refund(uuid,text), public.list_payment_refund_requests() from public, anon;
grant execute on function public.request_payment_refund(uuid,text), public.list_payment_refund_requests() to authenticated;
