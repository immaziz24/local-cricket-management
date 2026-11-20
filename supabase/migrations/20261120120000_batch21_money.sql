-- Batch 21 (money): #275 tournament registration payments, #276 sponsorship payments, #279 subscription renewals,
-- #280 advertising revenue, #281 platform commission, #388 organiser payout reconciliation, #389 sponsor package billing automation,
-- #390 tournament fee settlement reporting, #391 subscription entitlement enforcement.
-- Owner decisions (2026-11-20): Razorpay; percentage commission set by an admin; the platform collects every payment and pays organisers out.
-- Everything stays in Razorpay TEST mode until live keys are set in the edge function secrets. Commission starts at 0%.

-- ===== settings =====
create table if not exists private.fee_settings (
  id boolean primary key default true check (id),
  commission_bps integer not null default 0 check (commission_bps between 0 and 3000),
  updated_by uuid, updated_at timestamptz not null default now()
);
insert into private.fee_settings (id) values (true) on conflict do nothing;
alter table private.fee_settings enable row level security;
revoke all on private.fee_settings from public, anon, authenticated;

-- ===== payments learn what they were for and how they were split =====
alter table private.payment_records add column if not exists purpose text not null default 'membership';
alter table private.payment_records drop constraint if exists payment_records_purpose_check;
alter table private.payment_records add constraint payment_records_purpose_check check (purpose in ('membership', 'registration', 'sponsorship', 'ad', 'other'));
alter table private.payment_records add column if not exists tournament_id uuid;
alter table private.payment_records add column if not exists team_id uuid;
alter table private.payment_records add column if not exists bill_id uuid;
alter table private.payment_records add column if not exists commission_bps integer not null default 0;
alter table private.payment_records add column if not exists commission_paise integer not null default 0 check (commission_paise >= 0);
alter table private.payment_records add column if not exists organiser_share_paise integer not null default 0 check (organiser_share_paise >= 0);
alter table private.payment_records add column if not exists is_test boolean not null default true;
alter table private.payment_records add column if not exists needs_review text;
create index if not exists payment_records_tournament_idx on private.payment_records (tournament_id) where tournament_id is not null;

-- ===== #275 entry fee =====
alter table public.tournaments add column if not exists entry_fee_paise integer;
alter table public.tournaments drop constraint if exists tournaments_entry_fee_paise_range;
alter table public.tournaments add constraint tournaments_entry_fee_paise_range check (entry_fee_paise is null or entry_fee_paise between 100 and 50000000);
alter table public.tournament_teams add column if not exists fee_paid_paise integer not null default 0;
alter table public.tournament_teams add column if not exists fee_payment_id uuid;
alter table public.tournament_teams add column if not exists fee_paid_at timestamptz;
alter table public.tournament_sponsors add column if not exists paid_paise integer not null default 0;

-- ===== bills (sponsor packages #389, advert charges #280) =====
create table if not exists private.bills (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('sponsor_package', 'ad_campaign')),
  tournament_id uuid, sponsor_id uuid, ref_id uuid not null, period text not null default '',
  payer_id uuid not null,
  amount_paise integer not null check (amount_paise > 0),
  description text not null,
  status text not null default 'due' check (status in ('due', 'paid', 'cancelled')),
  due_on date not null default ((now() at time zone 'Asia/Kolkata')::date + 14),
  payment_id uuid, paid_at timestamptz,
  reminder_count integer not null default 0, last_reminder_at timestamptz,
  created_at timestamptz not null default now(),
  unique (kind, ref_id, period)
);
create index if not exists bills_payer_idx on private.bills (payer_id, status);
create index if not exists bills_tournament_idx on private.bills (tournament_id) where tournament_id is not null;
alter table private.bills enable row level security;
revoke all on private.bills from public, anon, authenticated;

-- ===== #388 payouts =====
create table if not exists private.payouts (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete restrict,
  organiser_id uuid,
  amount_paise integer not null check (amount_paise > 0),
  reference text not null check (char_length(btrim(reference)) between 2 and 80),
  note text check (note is null or char_length(note) <= 300),
  paid_at timestamptz not null default now(),
  created_by uuid, created_at timestamptz not null default now()
);
create index if not exists payouts_tournament_idx on private.payouts (tournament_id);
alter table private.payouts enable row level security;
revoke all on private.payouts from public, anon, authenticated;

-- ===== #280 advert rates =====
alter table public.ad_placements add column if not exists flat_fee_paise integer not null default 0 check (flat_fee_paise >= 0);
alter table public.ad_placements add column if not exists cpm_paise integer not null default 0 check (cpm_paise >= 0);
alter table public.ad_placements add column if not exists cpc_paise integer not null default 0 check (cpc_paise >= 0);

-- ===== #391 plan limits and #279 reminders =====
create table if not exists private.plan_limits (
  plan_code text not null, limit_key text not null check (limit_key in ('max_tournaments', 'max_teams')),
  limit_value integer not null check (limit_value between 0 and 100000),
  primary key (plan_code, limit_key)
);
alter table private.plan_limits enable row level security;
revoke all on private.plan_limits from public, anon, authenticated;
create table if not exists private.membership_reminders (
  membership_id uuid not null, stage integer not null, sent_at timestamptz not null default now(),
  primary key (membership_id, stage)
);
alter table private.membership_reminders enable row level security;
revoke all on private.membership_reminders from public, anon, authenticated;

-- ===== #281 commission =====
create or replace function private.commission_for(p_amount integer) returns integer
language sql stable security definer set search_path = '' as $$
  select round(p_amount::numeric * (select commission_bps from private.fee_settings where id) / 10000)::int;
$$;

create or replace function public.get_fee_settings() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return (select jsonb_build_object('commission_bps', commission_bps, 'updated_at', updated_at) from private.fee_settings where id);
end $$;

create or replace function public.set_commission(p_bps integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_admin(); old int;
begin
  if p_bps is null or p_bps < 0 or p_bps > 3000 then raise exception 'The commission must be between 0%% and 30%%.' using errcode = '22023'; end if;
  select commission_bps into old from private.fee_settings where id;
  update private.fee_settings set commission_bps = p_bps, updated_by = uid, updated_at = now() where id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, 'COMMISSION_SET', 'settings', 'commission', jsonb_build_object('from_bps', old, 'to_bps', p_bps));
  return jsonb_build_object('commission_bps', p_bps);
end $$;

-- ===== #275 organiser sets the entry fee =====
create or replace function public.set_tournament_entry_fee(p_tournament_id uuid, p_rupees numeric) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare paise integer;
begin
  perform private.require_tournament_organiser(p_tournament_id);
  if p_rupees is null or p_rupees = 0 then paise := null;
  else
    if p_rupees < 1 or p_rupees > 500000 then raise exception 'The entry fee must be between 1 and 500000 rupees (or empty for no online fee).' using errcode = '22023'; end if;
    paise := round(p_rupees * 100)::int;
  end if;
  update public.tournaments set entry_fee_paise = paise where id = p_tournament_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'ENTRY_FEE_SET', 'tournaments', p_tournament_id::text, jsonb_build_object('entry_fee_paise', paise));
  return jsonb_build_object('entry_fee_paise', paise);
end $$;

-- ===== checkout quote: the server decides what is owed; the edge function creates the Razorpay link from this =====
create or replace function public.get_checkout_quote(p_purpose text, p_ref uuid, p_team uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := private.require_active_user(); t record; tt record; b private.bills; tn text;
begin
  if p_purpose = 'registration' then
    if p_team is null then raise exception 'Choose your team.' using errcode = '22023'; end if;
    perform private.require_team_owner(p_team);
    select id, name, entry_fee_paise into t from public.tournaments where id = p_ref;
    if not found then raise exception 'Tournament not found.' using errcode = '22023'; end if;
    if t.entry_fee_paise is null then raise exception 'This tournament has no online entry fee.' using errcode = '22023'; end if;
    select * into tt from public.tournament_teams where tournament_id = p_ref and team_id = p_team;
    if not found or tt.status in ('rejected', 'withdrawn') then raise exception 'Register your team for this tournament first.' using errcode = '22023'; end if;
    if tt.fee_paid_paise >= t.entry_fee_paise then raise exception 'The entry fee for this team is already paid.' using errcode = '22023'; end if;
    select name into tn from public.teams where id = p_team;
    return jsonb_build_object('purpose', 'registration', 'amount_paise', t.entry_fee_paise, 'description', left('Entry fee: ' || coalesce(tn, 'team') || ' in ' || t.name, 100),
                              'tournament_id', t.id, 'team_id', p_team);
  elsif p_purpose = 'bill' then
    select * into b from private.bills where id = p_ref;
    if not found or b.payer_id <> uid then raise exception 'This bill is not yours.' using errcode = '42501'; end if;
    if b.status <> 'due' then raise exception 'This bill is already %.', b.status using errcode = '22023'; end if;
    return jsonb_build_object('purpose', case when b.kind = 'ad_campaign' then 'ad' else 'sponsorship' end, 'amount_paise', b.amount_paise,
                              'description', left(b.description, 100), 'tournament_id', b.tournament_id, 'bill_id', b.id);
  end if;
  raise exception 'Unknown payment type.' using errcode = '22023';
end $$;

-- ===== the one place a captured Razorpay payment is recorded (service role only) =====
create or replace function public.record_gateway_payment(
  p_payer uuid, p_payment text, p_description text, p_amount integer, p_captured_at timestamptz,
  p_purpose text default 'membership', p_offer uuid default null, p_tournament uuid default null, p_team uuid default null, p_bill uuid default null, p_test boolean default true)
returns void language plpgsql security definer set search_path = '' as $$
declare pid uuid; fee int; comm int := 0; share int := 0; bps int := 0; review text; b private.bills; t record; org_id uuid; purpose text := coalesce(p_purpose, 'membership');
begin
  if purpose not in ('membership', 'registration', 'sponsorship', 'ad') then purpose := 'other'; end if;
  if purpose = 'registration' then
    select id, name, owner_id, entry_fee_paise into t from public.tournaments where id = p_tournament;
    if not found then review := 'Tournament not found'; else fee := t.entry_fee_paise; org_id := t.owner_id; end if;
    if fee is not null and p_amount < fee then review := 'Paid less than the entry fee'; end if;
  elsif purpose in ('sponsorship', 'ad') then
    select * into b from private.bills where id = p_bill;
    if not found then review := 'Bill not found';
    elsif b.status <> 'due' then review := 'Bill was already ' || b.status;
    elsif p_amount < b.amount_paise then review := 'Paid less than the bill'; end if;
  end if;
  if purpose in ('registration', 'sponsorship') then
    bps := (select commission_bps from private.fee_settings where id);
    comm := round(p_amount::numeric * bps / 10000)::int; share := p_amount - comm;
  end if;
  insert into private.payment_records (payer_id, provider_payment_id, description, amount_paise, captured_at, offer_id, purpose, tournament_id, team_id, bill_id,
                                       commission_bps, commission_paise, organiser_share_paise, is_test, needs_review)
  values (p_payer, p_payment, case when p_test then 'Test payment — ' else '' end || p_description, p_amount, p_captured_at, p_offer, purpose,
          coalesce(p_tournament, b.tournament_id), p_team, p_bill, bps, comm, share, p_test, review)
  on conflict (provider_payment_id) do nothing returning id into pid;
  if pid is null then return; end if;
  perform private.issue_invoice(pid);
  if purpose = 'membership' then
    perform private.activate_membership(pid);
  elsif purpose = 'registration' and review is distinct from 'Tournament not found' then
    update public.tournament_teams set fee_paid_paise = fee_paid_paise + p_amount, fee_payment_id = pid, fee_paid_at = p_captured_at
     where tournament_id = p_tournament and team_id = p_team;
    insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
    values (p_payer, 'entry_fee_paid', 'Entry fee received', 'Your entry fee for ' || t.name || ' is paid.', jsonb_build_object('payment_id', pid, 'tournament_id', p_tournament));
    if org_id is not null and org_id <> p_payer then
      insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
      values (org_id, 'entry_fee_paid', 'Entry fee paid online', (select name from public.teams where id = p_team) || ' paid the entry fee for ' || t.name || '.', jsonb_build_object('payment_id', pid, 'tournament_id', p_tournament));
    end if;
  elsif purpose in ('sponsorship', 'ad') and b.id is not null and b.status = 'due' then
    update private.bills set status = case when review is null then 'paid' else status end, payment_id = pid, paid_at = case when review is null then p_captured_at else null end where id = b.id;
    if review is null and purpose = 'sponsorship' then update public.tournament_sponsors set paid_paise = paid_paise + p_amount where id = b.ref_id; end if;
    insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
    values (p_payer, 'bill_paid', 'Payment received', 'Thank you. ' || b.description || ' is paid.', jsonb_build_object('payment_id', pid, 'bill_id', b.id));
  end if;
end $$;

-- ===== #389 sponsor package billing: a bill appears by itself when a sponsorship becomes active =====
create or replace function private.sync_sponsor_bill() returns trigger
language plpgsql security definer set search_path = '' as $$
declare paise integer; payer uuid; tn text; sn text; b private.bills;
begin
  paise := case when new.amount is null then 0 else round(new.amount * 100)::int end;
  select owner_id, name into payer, sn from public.sponsors where id = new.sponsor_id;
  select name into tn from public.tournaments where id = new.tournament_id;
  select * into b from private.bills where kind = 'sponsor_package' and ref_id = new.id and period = '';
  if new.status = 'active' and paise > 0 and payer is not null then
    if not found then
      insert into private.bills (kind, tournament_id, sponsor_id, ref_id, payer_id, amount_paise, description)
      values ('sponsor_package', new.tournament_id, new.sponsor_id, new.id, payer, paise, left('Sponsorship (' || new.tier || '): ' || coalesce(sn, 'sponsor') || ' for ' || coalesce(tn, 'tournament'), 200))
      returning * into b;
      insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
      values (payer, 'bill_due', 'Sponsorship bill', 'A bill for ' || (paise / 100) || ' rupees is ready for ' || coalesce(tn, 'the tournament') || '. Pay it from Account, Payments.', jsonb_build_object('bill_id', b.id));
    elsif b.status = 'due' and b.amount_paise <> paise then
      update private.bills set amount_paise = paise where id = b.id;
    end if;
  elsif found and b.status = 'due' and new.status in ('declined', 'ended') then
    update private.bills set status = 'cancelled' where id = b.id;
  end if;
  return new;
end $$;
drop trigger if exists tournament_sponsors_bill on public.tournament_sponsors;
create trigger tournament_sponsors_bill after insert or update of status, amount on public.tournament_sponsors for each row execute function private.sync_sponsor_bill();

create or replace function public.generate_sponsor_bills(p_tournament_id uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer := 0; ts record;
begin
  perform private.require_tournament_organiser(p_tournament_id);
  for ts in select id from public.tournament_sponsors where tournament_id = p_tournament_id and status = 'active' and coalesce(amount, 0) > 0
              and not exists (select 1 from private.bills b where b.kind = 'sponsor_package' and b.ref_id = tournament_sponsors.id) loop
    update public.tournament_sponsors set amount = amount where id = ts.id; -- the trigger writes the bill
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.list_my_bills() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := private.require_active_user();
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'description', description, 'amount_paise', amount_paise, 'status', status, 'due_on', due_on,
                    'paid_at', paid_at, 'overdue', status = 'due' and due_on < (now() at time zone 'Asia/Kolkata')::date) order by (status = 'due') desc, due_on)
                   from (select * from private.bills where payer_id = uid order by created_at desc limit 50) x), '[]'::jsonb);
end $$;

create or replace function public.list_tournament_bills(p_tournament_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_tournament_organiser(p_tournament_id);
  return coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'description', b.description, 'amount_paise', b.amount_paise, 'status', b.status, 'due_on', b.due_on,
                    'paid_at', b.paid_at, 'reminders', b.reminder_count, 'sponsor', (select name from public.sponsors where id = b.sponsor_id)) order by (b.status = 'due') desc, b.due_on)
                   from private.bills b where b.tournament_id = p_tournament_id and b.kind = 'sponsor_package'), '[]'::jsonb);
end $$;

-- Reminders for unpaid bills (at most one every 3 days) and for plans that are about to end. An admin runs it, or a schedule can call it.
create or replace function public.send_bill_reminders() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer := 0; b private.bills;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then perform private.require_admin(); end if;
  for b in select * from private.bills where status = 'due' and due_on <= (now() at time zone 'Asia/Kolkata')::date + 3
                and (last_reminder_at is null or last_reminder_at < now() - interval '3 days') loop
    insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
    values (b.payer_id, 'bill_reminder', case when b.due_on < (now() at time zone 'Asia/Kolkata')::date then 'Bill overdue' else 'Bill due soon' end,
            left(b.description, 120) || ' - ' || (b.amount_paise / 100) || ' rupees, due ' || to_char(b.due_on, 'DD Mon YYYY') || '.', jsonb_build_object('bill_id', b.id));
    update private.bills set reminder_count = reminder_count + 1, last_reminder_at = now() where id = b.id;
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.send_renewal_reminders() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer := 0; m record; stg integer; days integer;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then perform private.require_admin(); end if;
  for m in select * from private.user_memberships um where status = 'active' and ends_at > now() and ends_at <= now() + interval '7 days'
             and not exists (select 1 from private.user_memberships x where x.user_id = um.user_id and x.plan_code = um.plan_code and x.status = 'active' and x.ends_at > um.ends_at) loop
    days := greatest(0, ceil(extract(epoch from (m.ends_at - now())) / 86400))::int;
    stg := case when days <= 1 then 1 else 7 end;
    if exists (select 1 from private.membership_reminders where membership_id = m.id and membership_reminders.stage = stg) then continue; end if;
    insert into private.membership_reminders (membership_id, stage) values (m.id, stg) on conflict do nothing;
    insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
    values (m.user_id, 'membership_renewal', 'Your plan ends in ' || days || ' day' || case when days = 1 then '' else 's' end,
            'Renew from Account, Paid plans. The new time is added after your end date, so nothing is lost.', jsonb_build_object('membership_id', m.id, 'offer_id', m.offer_id));
    n := n + 1;
  end loop;
  return n;
end $$;

-- ===== #280 advert rates, report and billing =====
create or replace function public.set_ad_rates(p_ad_id uuid, p_flat_paise integer, p_cpm_paise integer, p_cpc_paise integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_admin();
begin
  if least(coalesce(p_flat_paise, 0), coalesce(p_cpm_paise, 0), coalesce(p_cpc_paise, 0)) < 0 then raise exception 'Rates cannot be negative.' using errcode = '22023'; end if;
  update public.ad_placements set flat_fee_paise = coalesce(p_flat_paise, 0), cpm_paise = coalesce(p_cpm_paise, 0), cpc_paise = coalesce(p_cpc_paise, 0) where id = p_ad_id;
  if not found then raise exception 'Advert not found.' using errcode = '22023'; end if;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, 'AD_RATES_SET', 'ad_placements', p_ad_id::text, jsonb_build_object('flat', p_flat_paise, 'cpm', p_cpm_paise, 'cpc', p_cpc_paise));
  return jsonb_build_object('ad_id', p_ad_id);
end $$;

create or replace function private.ad_charge(p_ad uuid, p_from date, p_to date, p_include_flat boolean) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('impressions', s.imp, 'clicks', s.clk,
    'usage_paise', floor(s.imp::numeric / 1000 * a.cpm_paise)::int + s.clk * a.cpc_paise,
    'flat_paise', case when p_include_flat then a.flat_fee_paise else 0 end,
    'total_paise', floor(s.imp::numeric / 1000 * a.cpm_paise)::int + s.clk * a.cpc_paise + case when p_include_flat then a.flat_fee_paise else 0 end)
  from public.ad_placements a,
       lateral (select coalesce(sum(impressions), 0)::int imp, coalesce(sum(clicks), 0)::int clk from public.placement_stats_daily d where d.ad_id = a.id and d.day between p_from and p_to) s
  where a.id = p_ad;
$$;

create or replace function public.ad_revenue_report(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare f date := coalesce(p_from, date_trunc('month', now() at time zone 'Asia/Kolkata')::date); t date := coalesce(p_to, (now() at time zone 'Asia/Kolkata')::date);
begin
  perform private.require_admin();
  if t < f then raise exception 'The end date is before the start date.' using errcode = '22023'; end if;
  return (select jsonb_build_object('from', f, 'to', t,
    'rows', coalesce(jsonb_agg(r.j order by (r.j->>'total_paise')::int desc), '[]'::jsonb),
    'accrued_paise', coalesce(sum((r.j->>'total_paise')::int), 0),
    'billed_paise', coalesce(sum((r.j->>'billed_paise')::int), 0),
    'paid_paise', coalesce(sum((r.j->>'paid_paise')::int), 0))
    from (select jsonb_build_object('ad_id', a.id, 'title', a.title, 'sponsor', (select name from public.sponsors where id = a.sponsor_id), 'scope', a.scope,
            'impressions', (c.j->>'impressions')::int, 'clicks', (c.j->>'clicks')::int, 'usage_paise', (c.j->>'usage_paise')::int, 'flat_paise', (c.j->>'flat_paise')::int,
            'total_paise', (c.j->>'total_paise')::int, 'flat_fee_paise', a.flat_fee_paise, 'cpm_paise', a.cpm_paise, 'cpc_paise', a.cpc_paise,
            'billed_paise', coalesce((select sum(amount_paise) from private.bills b where b.kind = 'ad_campaign' and b.ref_id = a.id and b.status <> 'cancelled' and b.period = f::text || '..' || t::text), 0),
            'paid_paise', coalesce((select sum(amount_paise) from private.bills b where b.kind = 'ad_campaign' and b.ref_id = a.id and b.status = 'paid' and b.period = f::text || '..' || t::text), 0)) j
            from public.ad_placements a,
                 lateral (select private.ad_charge(a.id, f, t, coalesce(a.starts_on, (a.created_at at time zone 'Asia/Kolkata')::date) between f and t) j) c
           where (c.j->>'total_paise')::int > 0 or (c.j->>'impressions')::int > 0 or a.flat_fee_paise + a.cpm_paise + a.cpc_paise > 0) r);
end $$;

create or replace function public.bill_ad_placement(p_ad_id uuid, p_from date, p_to date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_admin(); a public.ad_placements; payer uuid; c jsonb; amt int; b private.bills; per text;
begin
  if p_from is null or p_to is null or p_to < p_from then raise exception 'Choose the period to bill.' using errcode = '22023'; end if;
  select * into a from public.ad_placements where id = p_ad_id;
  if not found then raise exception 'Advert not found.' using errcode = '22023'; end if;
  select owner_id into payer from public.sponsors where id = a.sponsor_id;
  if payer is null then raise exception 'This advert has no sponsor account to bill.' using errcode = '22023'; end if;
  c := private.ad_charge(p_ad_id, p_from, p_to, coalesce(a.starts_on, (a.created_at at time zone 'Asia/Kolkata')::date) between p_from and p_to);
  amt := (c->>'total_paise')::int;
  if amt <= 0 then raise exception 'There is nothing to bill for this period. Set the advert rates first.' using errcode = '22023'; end if;
  per := p_from::text || '..' || p_to::text;
  if exists (select 1 from private.bills where kind = 'ad_campaign' and ref_id = p_ad_id and period = per and status <> 'cancelled') then
    raise exception 'This period is already billed.' using errcode = '23505';
  end if;
  insert into private.bills (kind, tournament_id, sponsor_id, ref_id, period, payer_id, amount_paise, description)
  values ('ad_campaign', a.tournament_id, a.sponsor_id, p_ad_id, per, payer, amt, left('Advert "' || a.title || '" ' || p_from::text || ' to ' || p_to::text, 200))
  on conflict (kind, ref_id, period) do update set status = 'due', amount_paise = excluded.amount_paise, payer_id = excluded.payer_id, description = excluded.description
  returning * into b;
  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  values (payer, 'bill_due', 'Advert bill', 'A bill for ' || (amt / 100) || ' rupees is ready. Pay it from Account, Payments.', jsonb_build_object('bill_id', b.id));
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, 'AD_BILLED', 'ad_placements', p_ad_id::text, jsonb_build_object('amount_paise', amt, 'period', per));
  return jsonb_build_object('bill_id', b.id, 'amount_paise', amt);
end $$;

-- ===== #390 settlement and #388 reconciliation =====
create or replace function private.settlement(p_tournament_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with p as (
    select pr.*, round(pr.organiser_share_paise::numeric * pr.refunded_paise / pr.amount_paise)::int as share_back,
           round(pr.commission_paise::numeric * pr.refunded_paise / pr.amount_paise)::int as comm_back
      from private.payment_records pr where pr.tournament_id = p_tournament_id and pr.purpose in ('registration', 'sponsorship')),
  s as (
    select coalesce(sum(amount_paise), 0)::int gross, coalesce(sum(refunded_paise), 0)::int refunded, coalesce(sum(commission_paise - comm_back), 0)::int commission,
           coalesce(sum(organiser_share_paise - share_back), 0)::int net,
           coalesce(sum(amount_paise) filter (where purpose = 'registration'), 0)::int reg_gross, count(*) filter (where purpose = 'registration')::int reg_count,
           coalesce(sum(amount_paise) filter (where purpose = 'sponsorship'), 0)::int spo_gross, count(*) filter (where purpose = 'sponsorship')::int spo_count,
           count(*) filter (where needs_review is not null)::int review_count
      from p),
  o as (select coalesce(sum(amount_paise), 0)::int paid_out from private.payouts where tournament_id = p_tournament_id)
  select jsonb_build_object(
    'gross_paise', s.gross, 'refunded_paise', s.refunded, 'commission_paise', s.commission, 'net_paise', s.net, 'paid_out_paise', o.paid_out, 'balance_paise', s.net - o.paid_out,
    'registration', jsonb_build_object('count', s.reg_count, 'gross_paise', s.reg_gross), 'sponsorship', jsonb_build_object('count', s.spo_count, 'gross_paise', s.spo_gross),
    'review_count', s.review_count,
    'lines', coalesce((select jsonb_agg(jsonb_build_object('payment_id', p.id, 'date', p.captured_at, 'kind', p.purpose, 'description', p.description, 'amount_paise', p.amount_paise,
                         'refunded_paise', p.refunded_paise, 'commission_paise', p.commission_paise - p.comm_back, 'net_paise', p.organiser_share_paise - p.share_back,
                         'is_test', p.is_test, 'needs_review', p.needs_review) order by p.captured_at desc) from p), '[]'::jsonb),
    'payouts', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'amount_paise', x.amount_paise, 'reference', x.reference, 'note', x.note, 'paid_at', x.paid_at) order by x.paid_at desc)
                         from private.payouts x where x.tournament_id = p_tournament_id), '[]'::jsonb))
  from s, o;
$$;

create or replace function public.get_tournament_settlement(p_tournament_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare t record; res jsonb;
begin
  if not private.is_admin() then perform private.require_tournament_organiser(p_tournament_id); end if;
  select id, name, entry_fee_paise, owner_id into t from public.tournaments where id = p_tournament_id;
  if not found then raise exception 'Tournament not found.' using errcode = '22023'; end if;
  res := private.settlement(p_tournament_id);
  return res || jsonb_build_object('tournament', jsonb_build_object('id', t.id, 'name', t.name, 'entry_fee_paise', t.entry_fee_paise),
    'commission_bps_now', (select commission_bps from private.fee_settings where id),
    'teams', jsonb_build_object('approved', (select count(*) from public.tournament_teams where tournament_id = p_tournament_id and status = 'approved'),
                                'paid', (select count(*) from public.tournament_teams where tournament_id = p_tournament_id and status in ('pending', 'approved') and fee_paid_paise > 0),
                                'unpaid', (select count(*) from public.tournament_teams where tournament_id = p_tournament_id and status in ('pending', 'approved') and fee_paid_paise = 0 and t.entry_fee_paise is not null)),
    'unpaid_teams', coalesce((select jsonb_agg(tm.name order by tm.name) from public.tournament_teams tt join public.teams tm on tm.id = tt.team_id
                               where tt.tournament_id = p_tournament_id and tt.status in ('pending', 'approved') and tt.fee_paid_paise = 0 and t.entry_fee_paise is not null), '[]'::jsonb));
end $$;

create or replace function public.get_payout_reconciliation() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return (select jsonb_build_object(
    'commission_bps', (select commission_bps from private.fee_settings where id),
    'rows', coalesce(jsonb_agg(x.j order by (x.j->>'balance_paise')::int desc), '[]'::jsonb),
    'owed_paise', coalesce(sum(greatest((x.j->>'balance_paise')::int, 0)), 0),
    'overpaid_paise', coalesce(sum(greatest(-(x.j->>'balance_paise')::int, 0)), 0),
    'commission_paise', coalesce(sum((x.j->>'commission_paise')::int), 0),
    'review_count', coalesce(sum((x.j->>'review_count')::int), 0))
    from (select jsonb_build_object('tournament_id', t.id, 'name', t.name, 'organiser', (select display_name from public.profiles where id = t.owner_id),
                 'gross_paise', (s.v->>'gross_paise')::int, 'refunded_paise', (s.v->>'refunded_paise')::int, 'commission_paise', (s.v->>'commission_paise')::int,
                 'net_paise', (s.v->>'net_paise')::int, 'paid_out_paise', (s.v->>'paid_out_paise')::int, 'balance_paise', (s.v->>'balance_paise')::int,
                 'review_count', (s.v->>'review_count')::int,
                 'status', case when (s.v->>'balance_paise')::int > 0 then 'owed' when (s.v->>'balance_paise')::int < 0 then 'overpaid' else 'settled' end) j
            from public.tournaments t, lateral (select private.settlement(t.id) v) s
           where (s.v->>'gross_paise')::int > 0 or (s.v->>'paid_out_paise')::int > 0) x);
end $$;

create or replace function public.record_payout(p_tournament_id uuid, p_amount_paise integer, p_reference text, p_note text default null, p_paid_at timestamptz default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_admin(); t record; s jsonb; bal int; pid uuid; ref text := btrim(coalesce(p_reference, ''));
begin
  select id, name, owner_id into t from public.tournaments where id = p_tournament_id for update;
  if not found then raise exception 'Tournament not found.' using errcode = '22023'; end if;
  if p_amount_paise is null or p_amount_paise <= 0 then raise exception 'Enter an amount greater than zero.' using errcode = '22023'; end if;
  if char_length(ref) < 2 then raise exception 'Enter the bank or UPI reference of the transfer.' using errcode = '22023'; end if;
  s := private.settlement(p_tournament_id); bal := (s->>'balance_paise')::int;
  if p_amount_paise > bal then raise exception 'That is more than the organiser is owed (% paise).', bal using errcode = '22023'; end if;
  insert into private.payouts (tournament_id, organiser_id, amount_paise, reference, note, paid_at, created_by)
  values (p_tournament_id, t.owner_id, p_amount_paise, left(ref, 80), nullif(left(btrim(coalesce(p_note, '')), 300), ''), coalesce(p_paid_at, now()), uid) returning id into pid;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, 'PAYOUT_RECORDED', 'tournaments', p_tournament_id::text, jsonb_build_object('amount_paise', p_amount_paise, 'reference', left(ref, 80)));
  if t.owner_id is not null then
    insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
    values (t.owner_id, 'payout_sent', 'Payout sent', (p_amount_paise / 100) || ' rupees for ' || t.name || ' was sent. Reference ' || left(ref, 80) || '.', jsonb_build_object('tournament_id', p_tournament_id, 'payout_id', pid));
  end if;
  return jsonb_build_object('payout_id', pid, 'balance_paise', bal - p_amount_paise);
end $$;

-- ===== #391 plan entitlements =====
create or replace function public.set_plan_limit(p_plan text, p_key text, p_value integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_admin(); plan text := lower(btrim(coalesce(p_plan, '')));
begin
  if p_key not in ('max_tournaments', 'max_teams') then raise exception 'Unknown limit.' using errcode = '22023'; end if;
  if plan <> 'free' and not exists (select 1 from private.payment_offers where plan_code = plan) then raise exception 'There is no plan with that code. Use free or the code of a paid plan.' using errcode = '22023'; end if;
  if p_value is null then delete from private.plan_limits where plan_code = plan and limit_key = p_key;
  else
    if p_value < 0 or p_value > 100000 then raise exception 'The limit must be between 0 and 100000.' using errcode = '22023'; end if;
    insert into private.plan_limits (plan_code, limit_key, limit_value) values (plan, p_key, p_value) on conflict (plan_code, limit_key) do update set limit_value = excluded.limit_value;
  end if;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, 'PLAN_LIMIT_SET', 'settings', plan || ':' || p_key, jsonb_build_object('value', p_value));
  return jsonb_build_object('plan', plan, 'key', p_key, 'value', p_value);
end $$;

create or replace function public.list_plan_limits() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return jsonb_build_object(
    'plans', (select coalesce(jsonb_agg(distinct pc order by pc), '[]'::jsonb) from (select 'free' pc union select plan_code from private.payment_offers where plan_code is not null) q),
    'limits', coalesce((select jsonb_agg(jsonb_build_object('plan', plan_code, 'key', limit_key, 'value', limit_value) order by plan_code, limit_key) from private.plan_limits), '[]'::jsonb));
end $$;

-- the limit that applies to a person: unlimited if any of their plans (free always counts) has no limit set, otherwise the highest
create or replace function private.effective_limit(p_user uuid, p_key text) returns integer
language plpgsql stable security definer set search_path = '' as $$
declare codes text[]; c text; v integer; best integer := null; unlimited boolean := false;
begin
  codes := array['free'] || coalesce((select array_agg(distinct plan_code) from private.user_memberships where user_id = p_user and status = 'active' and ends_at > now()), '{}');
  foreach c in array codes loop
    select limit_value into v from private.plan_limits where plan_code = c and limit_key = p_key;
    if v is null then unlimited := true; else best := greatest(coalesce(best, 0), v); end if;
  end loop;
  if unlimited then return null; end if;
  return best;
end $$;

create or replace function public.get_my_entitlements() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := private.require_active_user(); lt integer; lm integer;
begin
  lt := private.effective_limit(uid, 'max_tournaments'); lm := private.effective_limit(uid, 'max_teams');
  return jsonb_build_object(
    'max_tournaments', jsonb_build_object('limit', lt, 'used', (select count(*) from public.tournaments where owner_id = uid)),
    'max_teams', jsonb_build_object('limit', lm, 'used', (select count(*) from public.teams where owner_id = uid)),
    'is_admin', private.is_admin());
end $$;

create or replace function private.enforce_plan_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare k text := tg_argv[0]; lim integer; used integer; who uuid := new.owner_id;
begin
  if who is null or private.is_admin() then return new; end if;
  lim := private.effective_limit(who, k);
  if lim is null then return new; end if;
  if tg_table_name = 'tournaments' then select count(*) into used from public.tournaments where owner_id = who;
  else select count(*) into used from public.teams where owner_id = who; end if;
  if used >= lim then
    raise exception 'Your plan allows % %. See Account, Paid plans, to get more.', lim, case when k = 'max_tournaments' then 'tournaments' else 'teams' end using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists tournaments_plan_limit on public.tournaments;
create trigger tournaments_plan_limit before insert on public.tournaments for each row execute function private.enforce_plan_limit('max_tournaments');
drop trigger if exists teams_plan_limit on public.teams;
create trigger teams_plan_limit before insert on public.teams for each row execute function private.enforce_plan_limit('max_teams');

-- offers now say which plan they belong to, so a plan can be renewed with one tap
drop function if exists public.list_payment_offers();
create or replace function public.list_payment_offers()
returns table(id uuid, kind text, name text, amount_paise integer, plan_code text, duration_days integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_active_user();
  return query select o.id, o.kind, o.name, o.amount_paise, o.plan_code, o.duration_days from private.payment_offers o where o.active order by o.kind, o.amount_paise, o.id;
end $$;

-- ===== grants =====
do $$
declare f text;
begin
  foreach f in array array['public.get_fee_settings()', 'public.set_commission(integer)', 'public.set_tournament_entry_fee(uuid,numeric)', 'public.get_checkout_quote(text,uuid,uuid)',
      'public.generate_sponsor_bills(uuid)', 'public.list_my_bills()', 'public.list_tournament_bills(uuid)', 'public.send_bill_reminders()', 'public.send_renewal_reminders()',
      'public.set_ad_rates(uuid,integer,integer,integer)', 'public.ad_revenue_report(date,date)', 'public.bill_ad_placement(uuid,date,date)',
      'public.get_tournament_settlement(uuid)', 'public.get_payout_reconciliation()', 'public.record_payout(uuid,integer,text,text,timestamptz)',
      'public.set_plan_limit(text,text,integer)', 'public.list_plan_limits()', 'public.get_my_entitlements()', 'public.list_payment_offers()'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  revoke execute on function public.record_gateway_payment(uuid, text, text, integer, timestamptz, text, uuid, uuid, uuid, uuid, boolean) from public, anon, authenticated;
  grant execute on function public.record_gateway_payment(uuid, text, text, integer, timestamptz, text, uuid, uuid, uuid, uuid, boolean) to service_role;
  grant execute on function public.send_bill_reminders(), public.send_renewal_reminders() to service_role;
  revoke execute on function private.commission_for(integer), private.settlement(uuid), private.ad_charge(uuid, date, date, boolean), private.effective_limit(uuid, text),
    private.sync_sponsor_bill(), private.enforce_plan_limit() from public, anon, authenticated;
end $$;
