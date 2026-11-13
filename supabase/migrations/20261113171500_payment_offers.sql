-- Server-managed offers. Prices are expressed in paise.
create table private.payment_offers (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('premium', 'organiser')),
  name text not null check (length(btrim(name)) between 1 and 100),
  amount_paise integer not null check (amount_paise > 0),
  active boolean not null default false
);

alter table private.payment_offers enable row level security;
revoke all on private.payment_offers from public, anon, authenticated;

create function public.list_payment_offers()
returns table(id uuid, kind text, name text, amount_paise integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_active_user();
  return query
    select o.id, o.kind, o.name, o.amount_paise
    from private.payment_offers o
    where o.active
    order by o.kind, o.amount_paise, o.id;
end;
$$;

revoke all on function public.list_payment_offers() from public, anon, authenticated;
grant execute on function public.list_payment_offers() to authenticated;
