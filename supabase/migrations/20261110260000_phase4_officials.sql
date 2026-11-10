-- Phase 4 / Category F – Umpires, scorers and officials (#135–#146).
-- Open platform: anyone can create an official profile (no approval). The match / tournament owner invites
-- officials to a match; the official accepts or declines. An accepted scorer can score that match only;
-- umpires (and accepted scorers) can file match reports. Nothing here hands out platform-wide roles.

create table if not exists public.official_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_umpire boolean not null default false,
  is_scorer boolean not null default false,
  city text check (city is null or pg_catalog.length(city) <= 80),
  experience_years int check (experience_years is null or experience_years between 0 and 60),
  languages text check (languages is null or pg_catalog.length(languages) <= 120),
  fee_note text check (fee_note is null or pg_catalog.length(fee_note) <= 120),
  bio text check (bio is null or pg_catalog.length(bio) <= 600),
  available_days int[] not null default '{0,1,2,3,4,5,6}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (is_umpire or is_scorer)
);
create index if not exists official_profiles_city_idx on public.official_profiles (lower(city));

create table if not exists public.official_unavailability (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  note text check (note is null or pg_catalog.length(note) <= 120),
  primary key (user_id, day)
);

create table if not exists public.match_officials (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('umpire','scorer','third_umpire','match_referee')),
  status text not null default 'invited' check (status in ('invited','accepted','declined','cancelled')),
  invited_by uuid references auth.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  responded_at timestamptz,
  fee numeric(10,2) check (fee is null or fee >= 0),
  paid boolean not null default false,
  paid_at timestamptz,
  payment_note text check (payment_note is null or pg_catalog.length(payment_note) <= 200),
  unique (match_id, user_id, role)
);
create index if not exists match_officials_user_idx on public.match_officials (user_id, status);
create index if not exists match_officials_match_idx on public.match_officials (match_id);
create index if not exists match_officials_invited_by_idx on public.match_officials (invited_by);

create table if not exists public.official_feedback (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.match_officials(id) on delete cascade,
  rater_id uuid not null references auth.users(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text check (comment is null or pg_catalog.length(comment) <= 500),
  created_at timestamptz not null default now(),
  unique (assignment_id, rater_id)
);
create index if not exists official_feedback_rater_idx on public.official_feedback (rater_id);

create table if not exists public.match_disputes (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  raised_by uuid references auth.users(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  assignment_id uuid references public.match_officials(id) on delete set null,
  subject text not null check (pg_catalog.length(subject) between 3 and 120),
  details text check (details is null or pg_catalog.length(details) <= 2000),
  status text not null default 'open' check (status in ('open','under_review','resolved','rejected')),
  resolution text check (resolution is null or pg_catalog.length(resolution) <= 1000),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists match_disputes_match_idx on public.match_disputes (match_id);
create index if not exists match_disputes_raised_by_idx on public.match_disputes (raised_by);
create index if not exists match_disputes_team_idx on public.match_disputes (team_id);
create index if not exists match_disputes_assignment_idx on public.match_disputes (assignment_id);
create index if not exists match_disputes_resolved_by_idx on public.match_disputes (resolved_by);

alter table public.official_profiles enable row level security;
alter table public.official_unavailability enable row level security;
alter table public.match_officials enable row level security;
alter table public.official_feedback enable row level security;
alter table public.match_disputes enable row level security;
-- all access goes through the functions below
revoke all on public.official_profiles, public.official_unavailability, public.match_officials, public.official_feedback, public.match_disputes from anon, authenticated;

-- Who controls a match: its creator, the tournament organiser(s), admins.
create or replace function private.can_manage_match(p_match_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.matches m where m.id = p_match_id and (
      m.created_by = (select auth.uid()) or private.is_admin()
      or (m.tournament_id is not null and (
            exists (select 1 from public.tournaments t where t.id = m.tournament_id and t.owner_id = (select auth.uid()))
         or exists (select 1 from public.user_role_assignments r where r.user_id = (select auth.uid()) and r.role = 'organiser'
                    and r.scope_type = 'tournament' and r.scope_id = m.tournament_id and r.is_active)))))
  and not exists (select 1 from public.profiles where id = (select auth.uid()) and account_status in ('suspended','disabled'));
$$;

-- #139 An accepted scorer can score that match (open-platform rule: scorer is earned per match).
create or replace function private.can_score_match(p_match_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.matches m
     where m.id = p_match_id
       and (m.created_by = (select auth.uid()) or m.scorer_id = (select auth.uid()) or private.is_admin()
            or exists (select 1 from public.match_officials mo where mo.match_id = m.id and mo.user_id = (select auth.uid())
                       and mo.role = 'scorer' and mo.status = 'accepted')
            or (m.tournament_id is not null and (
                  exists (select 1 from public.tournaments t where t.id = m.tournament_id and t.owner_id = (select auth.uid()))
               or exists (select 1 from public.user_role_assignments r where r.user_id = (select auth.uid()) and r.role = 'organiser'
                          and r.scope_type = 'tournament' and r.scope_id = m.tournament_id and r.is_active))))
  ) and not exists (select 1 from public.profiles where id = (select auth.uid()) and account_status in ('suspended','disabled'));
$$;

-- Scorers plus accepted umpires / referees of the match.
create or replace function private.is_match_official(p_match_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.can_score_match(p_match_id) or (
    (select auth.uid()) is not null
    and exists (select 1 from public.match_officials mo where mo.match_id = p_match_id and mo.user_id = (select auth.uid()) and mo.status = 'accepted')
    and not exists (select 1 from public.profiles where id = (select auth.uid()) and account_status in ('suspended','disabled')));
$$;

create or replace function private.require_match_official(p_match_id uuid)
returns public.matches language plpgsql stable security definer set search_path = ''
as $$
declare m public.matches%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  select * into m from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found.' using errcode = '22023'; end if;
  if not private.is_match_official(p_match_id) then
    raise exception 'Only the match officials (scorer, umpires) or the organiser can do this.' using errcode = '42501';
  end if;
  return m;
end;
$$;

-- #135 #137 Register as an umpire and/or scorer (or update the profile).
create or replace function public.save_official_profile(p jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := (select auth.uid()); days int[];
begin
  if uid is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  if exists (select 1 from public.profiles where id = uid and account_status in ('suspended','disabled')) then
    raise exception 'Your account is suspended.' using errcode = '42501';
  end if;
  if not coalesce((p->>'is_umpire')::boolean, false) and not coalesce((p->>'is_scorer')::boolean, false) then
    raise exception 'Choose umpire, scorer or both.' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct d order by d), '{}') into days
    from (select (jsonb_array_elements_text(coalesce(p->'available_days', '[0,1,2,3,4,5,6]'::jsonb)))::int d) x where d between 0 and 6;
  insert into public.official_profiles (user_id, is_umpire, is_scorer, city, experience_years, languages, fee_note, bio, available_days, is_active, updated_at)
  values (uid, coalesce((p->>'is_umpire')::boolean, false), coalesce((p->>'is_scorer')::boolean, false),
          nullif(pg_catalog.btrim(p->>'city'), ''), nullif(p->>'experience_years', '')::int, nullif(pg_catalog.btrim(p->>'languages'), ''),
          nullif(pg_catalog.btrim(p->>'fee_note'), ''), nullif(pg_catalog.btrim(p->>'bio'), ''), days, coalesce((p->>'is_active')::boolean, true), now())
  on conflict (user_id) do update set is_umpire = excluded.is_umpire, is_scorer = excluded.is_scorer, city = excluded.city,
    experience_years = excluded.experience_years, languages = excluded.languages, fee_note = excluded.fee_note, bio = excluded.bio,
    available_days = excluded.available_days, is_active = excluded.is_active, updated_at = now();
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, 'OFFICIAL_PROFILE_SAVED', 'official_profiles', uid::text, jsonb_build_object('umpire', p->'is_umpire', 'scorer', p->'is_scorer'));
  return public.get_official_profile(uid);
end;
$$;

-- #140 Mark a day unavailable (or available again).
create or replace function public.set_official_unavailable(p_day date, p_unavailable boolean, p_note text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  if not exists (select 1 from public.official_profiles where user_id = uid) then raise exception 'Create your official profile first.' using errcode = '22023'; end if;
  if p_day is null or p_day < current_date or p_day > current_date + 400 then raise exception 'Choose a date in the next year.' using errcode = '22023'; end if;
  if p_unavailable then
    insert into public.official_unavailability (user_id, day, note) values (uid, p_day, nullif(pg_catalog.btrim(coalesce(p_note, '')), ''))
    on conflict (user_id, day) do update set note = excluded.note;
  else
    delete from public.official_unavailability where user_id = uid and day = p_day;
  end if;
  return public.get_official_profile(uid);
end;
$$;

-- #136 #138 #146 Public official profile with performance history (availability details only for the official).
create or replace function public.get_official_profile(p_user_id uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  with o as (select * from public.official_profiles where user_id = p_user_id),
  a as (select mo.*, m.status as match_status, coalesce(m.started_at, m.scheduled_at) as at, m.team_a_id, m.team_b_id, m.result_summary, m.tournament_id
          from public.match_officials mo join public.matches m on m.id = mo.match_id where mo.user_id = p_user_id),
  fb as (select f.* from public.official_feedback f join a on a.id = f.assignment_id)
  select case when not exists (select 1 from o) then null else jsonb_build_object(
    'user_id', p_user_id,
    'name', (select display_name from public.profiles where id = p_user_id),
    'is_umpire', o.is_umpire, 'is_scorer', o.is_scorer, 'city', o.city, 'experience_years', o.experience_years,
    'languages', o.languages, 'fee_note', o.fee_note, 'bio', o.bio, 'available_days', o.available_days, 'is_active', o.is_active,
    'is_me', p_user_id = (select auth.uid()),
    'verified', exists (select 1 from public.user_verifications v where v.user_id = p_user_id and v.status = 'approved' and v.verification_type in ('umpire','scorer')),
    'stats', jsonb_build_object(
       'matches', (select count(distinct match_id) from a where status = 'accepted' and match_status in ('live','completed')),
       'as_umpire', (select count(*) from a where status = 'accepted' and role in ('umpire','third_umpire','match_referee') and match_status in ('live','completed')),
       'as_scorer', (select count(*) from a where status = 'accepted' and role = 'scorer' and match_status in ('live','completed')),
       'upcoming', (select count(*) from a where status in ('invited','accepted') and match_status = 'scheduled'),
       'rating', (select round(avg(rating)::numeric, 1) from fb), 'ratings', (select count(*) from fb),
       'disputes', (select count(*) from public.match_disputes d join a on a.id = d.assignment_id),
       'decisions_logged', (select count(*) from public.match_reports r where r.created_by = p_user_id)),
    'recent_feedback', coalesce((select jsonb_agg(jsonb_build_object('rating', rating, 'comment', comment, 'created_at', created_at) order by created_at desc)
                                 from (select * from fb where comment is not null order by created_at desc limit 5) x), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(jsonb_build_object('match_id', match_id, 'role', role, 'date', at, 'status', match_status, 'result', result_summary,
                                 'teams', (select name from public.teams where id = team_a_id) || ' vs ' || (select name from public.teams where id = team_b_id),
                                 'rating', (select round(avg(f.rating)::numeric, 1) from public.official_feedback f where f.assignment_id = x.id)) order by at desc)
                         from (select * from a where status = 'accepted' and match_status in ('live','completed') order by at desc limit 30) x), '[]'::jsonb),
    'unavailable', case when p_user_id = (select auth.uid()) then coalesce((select jsonb_agg(jsonb_build_object('day', day, 'note', note) order by day)
                          from public.official_unavailability where user_id = p_user_id and day >= current_date), '[]'::jsonb) end
  ) end
  from o;
$$;

-- Find officials (optionally free on a date).
create or replace function public.search_officials(p jsonb default '{}'::jsonb)
returns jsonb language sql stable security definer set search_path = ''
as $$
  with q as (select nullif(pg_catalog.btrim(coalesce(p->>'query', '')), '') as txt, nullif(pg_catalog.btrim(coalesce(p->>'city', '')), '') as city,
                    nullif(p->>'kind', '') as kind, nullif(p->>'date', '')::date as day)
  select coalesce(jsonb_agg(x order by (x->>'rating')::numeric desc nulls last, x->>'name'), '[]'::jsonb) from (
    select jsonb_build_object('user_id', o.user_id, 'name', pr.display_name, 'city', o.city, 'is_umpire', o.is_umpire, 'is_scorer', o.is_scorer,
             'experience_years', o.experience_years, 'fee_note', o.fee_note,
             'rating', (select round(avg(f.rating)::numeric, 1) from public.official_feedback f join public.match_officials mo on mo.id = f.assignment_id where mo.user_id = o.user_id),
             'matches', (select count(*) from public.match_officials mo join public.matches m on m.id = mo.match_id where mo.user_id = o.user_id and mo.status = 'accepted' and m.status in ('live','completed')),
             'busy_that_day', case when q.day is null then null else exists (
                 select 1 from public.match_officials mo join public.matches m on m.id = mo.match_id
                  where mo.user_id = o.user_id and mo.status in ('invited','accepted') and (m.scheduled_at at time zone 'Asia/Kolkata')::date = q.day) end) as x
      from public.official_profiles o join public.profiles pr on pr.id = o.user_id, q
     where o.is_active and coalesce(pr.account_status, 'active') not in ('suspended','disabled')
       and (q.kind is null or (q.kind = 'umpire' and o.is_umpire) or (q.kind = 'scorer' and o.is_scorer))
       and (q.city is null or o.city ilike '%' || q.city || '%')
       and (q.txt is null or pr.display_name ilike '%' || q.txt || '%')
       and (q.day is null or (extract(dow from q.day)::int = any(o.available_days)
                              and not exists (select 1 from public.official_unavailability u where u.user_id = o.user_id and u.day = q.day)))
     limit 30) y;
$$;

-- #139 Invite an official to a match (match / tournament owner).
create or replace function public.invite_official(p_match_id uuid, p_user_id uuid, p_role text, p_fee numeric default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare m public.matches%rowtype; o public.official_profiles%rowtype; uid uuid := (select auth.uid()); v_day date; rid uuid;
begin
  if uid is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  select * into m from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found.' using errcode = '22023'; end if;
  if not private.can_manage_match(p_match_id) then raise exception 'Only the match creator or tournament organiser can choose officials.' using errcode = '42501'; end if;
  if m.status in ('completed','abandoned') then raise exception 'This match is already over.' using errcode = '22023'; end if;
  if p_role not in ('umpire','scorer','third_umpire','match_referee') then raise exception 'Unknown role.' using errcode = '22023'; end if;
  if p_fee is not null and (p_fee < 0 or p_fee > 1000000) then raise exception 'Enter a sensible fee.' using errcode = '22023'; end if;
  select * into o from public.official_profiles where user_id = p_user_id;
  if not found or not o.is_active then raise exception 'That person has no active official profile.' using errcode = '22023'; end if;
  if p_role = 'scorer' and not o.is_scorer then raise exception 'That person is not registered as a scorer.' using errcode = '22023'; end if;
  if p_role <> 'scorer' and not o.is_umpire then raise exception 'That person is not registered as an umpire.' using errcode = '22023'; end if;
  if exists (select 1 from public.profiles where id = p_user_id and account_status in ('suspended','disabled')) then raise exception 'That account is suspended.' using errcode = '22023'; end if;
  v_day := (m.scheduled_at at time zone 'Asia/Kolkata')::date;
  if v_day is not null and exists (select 1 from public.official_unavailability u where u.user_id = p_user_id and u.day = v_day) then
    raise exception 'That official has marked % as unavailable.', to_char(v_day, 'DD Mon') using errcode = '22023';
  end if;
  insert into public.match_officials (match_id, user_id, role, status, invited_by, invited_at, responded_at, fee)
  values (p_match_id, p_user_id, p_role, case when p_user_id = uid then 'accepted' else 'invited' end, uid, now(), case when p_user_id = uid then now() end, p_fee)
  on conflict (match_id, user_id, role) do update set status = case when excluded.user_id = uid then 'accepted' else 'invited' end,
     invited_by = excluded.invited_by, invited_at = now(), responded_at = excluded.responded_at, fee = coalesce(excluded.fee, public.match_officials.fee)
  returning id into rid;
  if p_user_id <> uid then
    insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
    values (p_user_id, 'official_invite', 'Match invitation',
            'You are invited as ' || replace(p_role, '_', ' ') || ' for ' || (select name from public.teams where id = m.team_a_id) || ' vs ' ||
            (select name from public.teams where id = m.team_b_id) || coalesce(' on ' || to_char(m.scheduled_at at time zone 'Asia/Kolkata', 'DD Mon, HH12:MI AM'), '') || '.',
            jsonb_build_object('match_id', p_match_id, 'assignment_id', rid));
  end if;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, 'OFFICIAL_INVITED', 'match_officials', rid::text, jsonb_build_object('match_id', p_match_id, 'user_id', p_user_id, 'role', p_role));
  return public.list_match_officials(p_match_id);
end;
$$;

-- The official answers an invitation (or withdraws later).
create or replace function public.respond_official_invite(p_assignment_id uuid, p_accept boolean)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare a public.match_officials%rowtype; m public.matches%rowtype; uid uuid := (select auth.uid());
begin
  select * into a from public.match_officials where id = p_assignment_id for update;
  if not found or a.user_id <> uid then raise exception 'Invitation not found.' using errcode = '22023'; end if;
  select * into m from public.matches where id = a.match_id;
  if m.status in ('completed','abandoned') then raise exception 'This match is already over.' using errcode = '22023'; end if;
  if a.status = 'cancelled' then raise exception 'This invitation was cancelled.' using errcode = '22023'; end if;
  update public.match_officials set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now() where id = a.id;
  if a.invited_by is not null and a.invited_by <> uid then
    insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
    values (a.invited_by, 'official_response', case when p_accept then 'Official accepted' else 'Official declined' end,
            (select display_name from public.profiles where id = uid) || case when p_accept then ' accepted' else ' declined' end || ' the ' ||
            replace(a.role, '_', ' ') || ' invitation for ' || (select name from public.teams where id = m.team_a_id) || ' vs ' || (select name from public.teams where id = m.team_b_id) || '.',
            jsonb_build_object('match_id', a.match_id, 'assignment_id', a.id));
  end if;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, case when p_accept then 'OFFICIAL_ACCEPTED' else 'OFFICIAL_DECLINED' end, 'match_officials', a.id::text, jsonb_build_object('match_id', a.match_id));
  return public.my_official_schedule();
end;
$$;

-- Cancel an invitation / assignment (match owner) – the official can also withdraw.
create or replace function public.cancel_official(p_assignment_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare a public.match_officials%rowtype; uid uuid := (select auth.uid()); by_owner boolean;
begin
  select * into a from public.match_officials where id = p_assignment_id for update;
  if not found then raise exception 'Assignment not found.' using errcode = '22023'; end if;
  by_owner := private.can_manage_match(a.match_id);
  if not by_owner and a.user_id is distinct from uid then raise exception 'Only the match owner or the official can cancel this.' using errcode = '42501'; end if;
  if exists (select 1 from public.matches where id = a.match_id and status in ('completed','abandoned')) then raise exception 'This match is already over.' using errcode = '22023'; end if;
  update public.match_officials set status = 'cancelled', responded_at = now() where id = a.id;
  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  select r, 'official_cancelled', 'Match official change',
         case when by_owner and a.user_id <> uid then 'Your ' || replace(a.role, '_', ' ') || ' assignment was cancelled by the match owner.'
              else (select display_name from public.profiles where id = a.user_id) || ' withdrew as ' || replace(a.role, '_', ' ') || '.' end,
         jsonb_build_object('match_id', a.match_id)
    from (select case when by_owner and a.user_id <> uid then a.user_id else a.invited_by end as r) x where r is not null and r <> uid;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, 'OFFICIAL_CANCELLED', 'match_officials', a.id::text, jsonb_build_object('match_id', a.match_id));
  return public.list_match_officials(a.match_id);
end;
$$;

-- #145 Payment record for an official (match owner).
create or replace function public.set_official_payment(p_assignment_id uuid, p_fee numeric, p_paid boolean, p_note text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare a public.match_officials%rowtype;
begin
  select * into a from public.match_officials where id = p_assignment_id for update;
  if not found then raise exception 'Assignment not found.' using errcode = '22023'; end if;
  if not private.can_manage_match(a.match_id) then raise exception 'Only the match owner can record payments.' using errcode = '42501'; end if;
  if p_fee is not null and (p_fee < 0 or p_fee > 1000000) then raise exception 'Enter a sensible fee.' using errcode = '22023'; end if;
  if p_note is not null and pg_catalog.length(p_note) > 200 then raise exception 'The note can be at most 200 characters.' using errcode = '22023'; end if;
  update public.match_officials set fee = p_fee, paid = coalesce(p_paid, false),
         paid_at = case when coalesce(p_paid, false) then coalesce(paid_at, now()) end, payment_note = nullif(pg_catalog.btrim(coalesce(p_note, '')), '')
   where id = a.id;
  if coalesce(p_paid, false) and not a.paid then
    insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
    values (a.user_id, 'official_paid', 'Payment recorded', 'Your fee' || coalesce(' of ₹' || p_fee::text, '') || ' was marked as paid.', jsonb_build_object('match_id', a.match_id));
  end if;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'OFFICIAL_PAYMENT_SET', 'match_officials', a.id::text, jsonb_build_object('fee', p_fee, 'paid', p_paid));
  return public.list_match_officials(a.match_id);
end;
$$;

-- Officials of a match. Fees are shown only to the match owner and to each official for themselves.
create or replace function public.list_match_officials(p_match_id uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'can_manage', private.can_manage_match(p_match_id),
    'can_rate', exists (select 1 from public.matches m where m.id = p_match_id and m.status = 'completed'
                        and (private.can_manage_match(p_match_id) or exists (select 1 from public.teams t where t.id in (m.team_a_id, m.team_b_id) and t.owner_id = (select auth.uid())))),
    'officials', coalesce((select jsonb_agg(jsonb_build_object(
        'id', mo.id, 'user_id', mo.user_id, 'name', pr.display_name, 'role', mo.role, 'status', mo.status, 'invited_at', mo.invited_at,
        'fee', case when private.can_manage_match(p_match_id) or mo.user_id = (select auth.uid()) then mo.fee end,
        'paid', case when private.can_manage_match(p_match_id) or mo.user_id = (select auth.uid()) then mo.paid end,
        'payment_note', case when private.can_manage_match(p_match_id) or mo.user_id = (select auth.uid()) then mo.payment_note end,
        'is_me', mo.user_id = (select auth.uid()),
        'my_rating', (select rating from public.official_feedback f where f.assignment_id = mo.id and f.rater_id = (select auth.uid())),
        'rating', (select round(avg(rating)::numeric, 1) from public.official_feedback f where f.assignment_id = mo.id))
        order by case mo.role when 'umpire' then 1 when 'third_umpire' then 2 when 'match_referee' then 3 else 4 end, mo.invited_at)
      from public.match_officials mo join public.profiles pr on pr.id = mo.user_id
     where mo.match_id = p_match_id and (mo.status in ('invited','accepted') or private.can_manage_match(p_match_id))), '[]'::jsonb)
  );
$$;

-- #141 My schedule as an official, with earnings (#145).
create or replace function public.my_official_schedule()
returns jsonb language sql stable security definer set search_path = ''
as $$
  with a as (select mo.*, m.status as match_status, m.scheduled_at, m.started_at, m.venue, m.city, m.team_a_id, m.team_b_id, m.result_summary, m.tournament_id
               from public.match_officials mo join public.matches m on m.id = mo.match_id where mo.user_id = (select auth.uid()))
  select jsonb_build_object(
    'profile', public.get_official_profile((select auth.uid())),
    'assignments', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'match_id', match_id, 'role', role, 'status', status, 'match_status', match_status, 'scheduled_at', coalesce(started_at, scheduled_at),
        'venue', venue, 'city', city, 'result', result_summary, 'fee', fee, 'paid', paid,
        'teams', (select name from public.teams where id = team_a_id) || ' vs ' || (select name from public.teams where id = team_b_id),
        'tournament', (select name from public.tournaments where id = tournament_id),
        'invited_by', (select display_name from public.profiles where id = invited_by)) order by coalesce(started_at, scheduled_at) desc nulls last)
      from a where status <> 'cancelled'), '[]'::jsonb),
    'earnings', jsonb_build_object('paid', coalesce((select sum(fee) from a where status = 'accepted' and paid), 0),
                                   'due', coalesce((select sum(fee) from a where status = 'accepted' and not paid and match_status in ('completed','live')), 0))
  );
$$;

-- #142 Feedback on an official after the match (match owner and the two team owners).
create or replace function public.rate_official(p_assignment_id uuid, p_rating int, p_comment text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare a public.match_officials%rowtype; m public.matches%rowtype; uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  select * into a from public.match_officials where id = p_assignment_id;
  if not found or a.status <> 'accepted' then raise exception 'Official not found for this match.' using errcode = '22023'; end if;
  select * into m from public.matches where id = a.match_id;
  if m.status <> 'completed' then raise exception 'Feedback opens when the match is finished.' using errcode = '22023'; end if;
  if a.user_id = uid then raise exception 'You cannot rate yourself.' using errcode = '22023'; end if;
  if not (private.can_manage_match(a.match_id) or exists (select 1 from public.teams t where t.id in (m.team_a_id, m.team_b_id) and t.owner_id = uid)) then
    raise exception 'Only the match owner and the two team owners can give feedback.' using errcode = '42501';
  end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then raise exception 'Rating must be 1 to 5.' using errcode = '22023'; end if;
  if p_comment is not null and pg_catalog.length(p_comment) > 500 then raise exception 'Comment can be at most 500 characters.' using errcode = '22023'; end if;
  insert into public.official_feedback (assignment_id, rater_id, rating, comment) values (a.id, uid, p_rating, nullif(pg_catalog.btrim(coalesce(p_comment, '')), ''))
  on conflict (assignment_id, rater_id) do update set rating = excluded.rating, comment = excluded.comment, created_at = now();
  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  values (a.user_id, 'official_feedback', 'New feedback', 'You received a ' || p_rating || '-star rating for ' ||
          (select name from public.teams where id = m.team_a_id) || ' vs ' || (select name from public.teams where id = m.team_b_id) || '.', jsonb_build_object('match_id', m.id));
  return public.list_match_officials(a.match_id);
end;
$$;

-- #143 Disputes: a team owner (or the match owner) raises one; the match owner reviews and resolves it.
create or replace function public.raise_dispute(p_match_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare m public.matches%rowtype; uid uuid := (select auth.uid()); t uuid := nullif(p->>'team_id', '')::uuid; asg uuid := nullif(p->>'assignment_id', '')::uuid;
        subj text := pg_catalog.btrim(coalesce(p->>'subject', '')); det text := nullif(pg_catalog.btrim(coalesce(p->>'details', '')), ''); rid uuid;
begin
  if uid is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  select * into m from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found.' using errcode = '22023'; end if;
  if not (private.can_manage_match(p_match_id) or exists (select 1 from public.teams x where x.id in (m.team_a_id, m.team_b_id) and x.owner_id = uid)) then
    raise exception 'Only the two team owners or the match owner can raise a dispute.' using errcode = '42501';
  end if;
  if t is null then select id into t from public.teams where id in (m.team_a_id, m.team_b_id) and owner_id = uid limit 1; end if;
  if t is not null and t not in (m.team_a_id, m.team_b_id) then raise exception 'Choose one of the two teams.' using errcode = '22023'; end if;
  if asg is not null and not exists (select 1 from public.match_officials where id = asg and match_id = p_match_id) then raise exception 'Choose an official of this match.' using errcode = '22023'; end if;
  if pg_catalog.length(subj) < 3 or pg_catalog.length(subj) > 120 then raise exception 'Give a short subject (3–120 characters).' using errcode = '22023'; end if;
  if det is not null and pg_catalog.length(det) > 2000 then raise exception 'Details can be at most 2000 characters.' using errcode = '22023'; end if;
  insert into public.match_disputes (match_id, raised_by, team_id, assignment_id, subject, details) values (p_match_id, uid, t, asg, subj, det) returning id into rid;
  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  select distinct r, 'match_dispute', 'Dispute raised', subj || ' (' || (select name from public.teams where id = m.team_a_id) || ' vs ' || (select name from public.teams where id = m.team_b_id) || ')',
         jsonb_build_object('match_id', p_match_id, 'dispute_id', rid)
    from (select m.created_by as r union select tr.owner_id from public.tournaments tr where tr.id = m.tournament_id
          union select x.owner_id from public.teams x where x.id in (m.team_a_id, m.team_b_id)) y
   where r is not null and r <> uid;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, 'DISPUTE_RAISED', 'match_disputes', rid::text, jsonb_build_object('match_id', p_match_id));
  return public.list_match_disputes(p_match_id);
end;
$$;

create or replace function public.update_dispute(p_dispute_id uuid, p_status text, p_resolution text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare d public.match_disputes%rowtype; uid uuid := (select auth.uid()); res text := nullif(pg_catalog.btrim(coalesce(p_resolution, '')), '');
begin
  select * into d from public.match_disputes where id = p_dispute_id for update;
  if not found then raise exception 'Dispute not found.' using errcode = '22023'; end if;
  if not private.can_manage_match(d.match_id) then raise exception 'Only the match owner or tournament organiser can decide disputes.' using errcode = '42501'; end if;
  if p_status not in ('open','under_review','resolved','rejected') then raise exception 'Unknown status.' using errcode = '22023'; end if;
  if p_status in ('resolved','rejected') and res is null then raise exception 'Write the decision before closing the dispute.' using errcode = '22023'; end if;
  if res is not null and pg_catalog.length(res) > 1000 then raise exception 'The decision can be at most 1000 characters.' using errcode = '22023'; end if;
  update public.match_disputes set status = p_status, resolution = coalesce(res, resolution),
         resolved_by = case when p_status in ('resolved','rejected') then uid end, resolved_at = case when p_status in ('resolved','rejected') then now() end
   where id = d.id;
  if d.raised_by is not null and d.raised_by <> uid then
    insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
    values (d.raised_by, 'match_dispute', 'Dispute ' || replace(p_status, '_', ' '), d.subject || coalesce(' – ' || res, ''), jsonb_build_object('match_id', d.match_id, 'dispute_id', d.id));
  end if;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, 'DISPUTE_UPDATED', 'match_disputes', d.id::text, jsonb_build_object('status', p_status));
  return public.list_match_disputes(d.match_id);
end;
$$;

create or replace function public.list_match_disputes(p_match_id uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  with m as (select * from public.matches where id = p_match_id),
  ok as (select private.can_manage_match(p_match_id) or private.is_match_official(p_match_id)
                or exists (select 1 from public.teams t, m where t.id in (m.team_a_id, m.team_b_id) and t.owner_id = (select auth.uid())) as v)
  select jsonb_build_object(
    'can_see', (select v from ok),
    'can_raise', private.can_manage_match(p_match_id) or exists (select 1 from public.teams t, m where t.id in (m.team_a_id, m.team_b_id) and t.owner_id = (select auth.uid())),
    'can_decide', private.can_manage_match(p_match_id),
    'disputes', case when (select v from ok) then coalesce((select jsonb_agg(jsonb_build_object(
        'id', d.id, 'subject', d.subject, 'details', d.details, 'status', d.status, 'resolution', d.resolution, 'created_at', d.created_at, 'resolved_at', d.resolved_at,
        'team', (select name from public.teams where id = d.team_id), 'raised_by', (select display_name from public.profiles where id = d.raised_by),
        'official', (select pr.display_name || ' (' || replace(mo.role, '_', ' ') || ')' from public.match_officials mo join public.profiles pr on pr.id = mo.user_id where mo.id = d.assignment_id))
        order by d.created_at desc) from public.match_disputes d where d.match_id = p_match_id), '[]'::jsonb) else '[]'::jsonb end
  );
$$;

revoke all on function private.can_manage_match(uuid) from public, anon, authenticated;
revoke all on function private.is_match_official(uuid) from public, anon, authenticated;
revoke all on function private.require_match_official(uuid) from public, anon, authenticated;
revoke all on function public.save_official_profile(jsonb) from public, anon;
revoke all on function public.set_official_unavailable(date, boolean, text) from public, anon;
revoke all on function public.get_official_profile(uuid) from public;
revoke all on function public.search_officials(jsonb) from public;
revoke all on function public.invite_official(uuid, uuid, text, numeric) from public, anon;
revoke all on function public.respond_official_invite(uuid, boolean) from public, anon;
revoke all on function public.cancel_official(uuid) from public, anon;
revoke all on function public.set_official_payment(uuid, numeric, boolean, text) from public, anon;
revoke all on function public.list_match_officials(uuid) from public;
revoke all on function public.my_official_schedule() from public, anon;
revoke all on function public.rate_official(uuid, int, text) from public, anon;
revoke all on function public.raise_dispute(uuid, jsonb) from public, anon;
revoke all on function public.update_dispute(uuid, text, text) from public, anon;
revoke all on function public.list_match_disputes(uuid) from public;
grant execute on function public.save_official_profile(jsonb) to authenticated;
grant execute on function public.set_official_unavailable(date, boolean, text) to authenticated;
grant execute on function public.get_official_profile(uuid) to anon, authenticated;
grant execute on function public.search_officials(jsonb) to anon, authenticated;
grant execute on function public.invite_official(uuid, uuid, text, numeric) to authenticated;
grant execute on function public.respond_official_invite(uuid, boolean) to authenticated;
grant execute on function public.cancel_official(uuid) to authenticated;
grant execute on function public.set_official_payment(uuid, numeric, boolean, text) to authenticated;
grant execute on function public.list_match_officials(uuid) to anon, authenticated;
grant execute on function public.my_official_schedule() to authenticated;
grant execute on function public.rate_official(uuid, int, text) to authenticated;
grant execute on function public.raise_dispute(uuid, jsonb) to authenticated;
grant execute on function public.update_dispute(uuid, text, text) to authenticated;
grant execute on function public.list_match_disputes(uuid) to anon, authenticated;

-- #144 Umpires (accepted officials) can file and close match reports, not just scorers.
do $patch$
declare d text; o text;
begin
  d := pg_get_functiondef('public.add_match_report(uuid,jsonb)'::regprocedure); o := d;
  d := replace(d, 'm := private.require_scorer(p_match_id);', 'm := private.require_match_official(p_match_id);');
  if d = o then raise exception 'add_match_report patch failed'; end if; execute d;
  d := pg_get_functiondef('public.close_match_report(uuid,text)'::regprocedure); o := d;
  d := replace(d, 'perform private.require_scorer(r.match_id);', 'perform private.require_match_official(r.match_id);');
  if d = o then raise exception 'close_match_report patch failed'; end if; execute d;
  d := pg_get_functiondef('public.list_match_reports(uuid)'::regprocedure); o := d;
  d := replace(d, '''can_add'', private.can_score_match(p_match_id)', '''can_add'', private.is_match_official(p_match_id)');
  d := replace(d, 'can_see as (select private.can_score_match(p_match_id) or private.is_admin()', 'can_see as (select private.is_match_official(p_match_id) or private.is_admin()');
  if length(d) - length(o) <> 4 then raise exception 'list_match_reports patch failed %', length(d) - length(o); end if; execute d;
end
$patch$;
