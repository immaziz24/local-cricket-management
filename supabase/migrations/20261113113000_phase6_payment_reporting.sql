create table private.payment_records (
  id uuid primary key default gen_random_uuid(),
  payer_id uuid references auth.users(id) on delete set null,
  provider_payment_id text not null unique,
  description text not null,
  amount_paise integer not null check (amount_paise > 0),
  refunded_paise integer not null default 0 check (refunded_paise between 0 and amount_paise),
  captured_at timestamptz not null
);

alter table private.payment_records enable row level security;
revoke all on private.payment_records from public, anon, authenticated;

create function public.get_my_payment_history()
returns table (id uuid, description text, amount_paise integer, refunded_paise integer, captured_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  member_id uuid := private.require_active_user();
begin
  return query
    select p.id, p.description, p.amount_paise, p.refunded_paise, p.captured_at
    from private.payment_records p
    where p.payer_id = member_id
    order by p.captured_at desc, p.id
    limit 100;
end;
$$;

create index payment_records_payer_date_idx on private.payment_records (payer_id, captured_at desc, id);

create function public.get_revenue_dashboard()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return (
    select jsonb_build_object(
      'payment_count', count(*),
      'captured_paise', coalesce(sum(amount_paise), 0),
      'refunded_paise', coalesce(sum(refunded_paise), 0)
    ) from private.payment_records
  );
end;
$$;

revoke all on function public.get_my_payment_history(), public.get_revenue_dashboard() from public, anon, authenticated;
grant execute on function public.get_my_payment_history(), public.get_revenue_dashboard() to authenticated;
