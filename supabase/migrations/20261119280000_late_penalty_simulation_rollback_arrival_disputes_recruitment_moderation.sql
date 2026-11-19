-- Batch 13: #399 late penalty simulation, #400 penalty rollback with audit trail, #398 arrival dispute evidence,
--           #368 player recruitment postings, #370 community moderation queue.

-- ---------- #400 penalty history + rollback ----------
do $$
declare c text;
begin
  select conname into c from pg_constraint where conrelid = 'public.late_penalties'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%proposed%';
  if c is not null then execute format('alter table public.late_penalties drop constraint %I', c); end if;
end $$;
alter table public.late_penalties add constraint late_penalties_status_check check (status in ('proposed', 'approved', 'rejected', 'appealed', 'waived', 'rolled_back'));

create table if not exists public.late_penalty_events (
  id uuid primary key default gen_random_uuid(),
  penalty_id uuid not null references public.late_penalties(id) on delete cascade,
  match_id uuid not null,
  action text not null,
  from_status text,
  to_status text,
  applied boolean,
  minutes_late integer,
  value integer,
  actor_id uuid,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists late_penalty_events_match_idx on public.late_penalty_events (match_id, created_at);
alter table public.late_penalty_events enable row level security;

create or replace function private.late_penalty_events_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.matches where id = old.match_id) and exists (select 1 from public.late_penalties where id = old.penalty_id) then raise exception 'Penalty history cannot be deleted.' using errcode = '42501'; end if;
    return old;
  end if;
  raise exception 'Penalty history cannot be changed.' using errcode = '42501';
end;
$$;
revoke all on function private.late_penalty_events_guard() from public, anon, authenticated;
drop trigger if exists late_penalty_events_immutable on public.late_penalty_events;
create trigger late_penalty_events_immutable before update or delete on public.late_penalty_events for each row execute function private.late_penalty_events_guard();

create or replace function private.log_late_penalty_event() returns trigger language plpgsql security definer set search_path = '' as $$
declare act text; nt text;
begin
  if tg_op = 'INSERT' then
    insert into public.late_penalty_events (penalty_id, match_id, action, to_status, applied, minutes_late, value, actor_id, note)
    values (new.id, new.match_id, case when new.auto_created then 'auto_proposed' else 'proposed' end, new.status, new.applied, new.minutes_late, new.value, (select auth.uid()), null);
    return new;
  end if;
  if new.status is distinct from old.status then
    act := case when old.status = 'appealed' and new.status in ('approved', 'proposed') then 'appeal_turned_down'
                when new.status = 'proposed' then 'proposed' else new.status end;
    nt := case when new.status = 'appealed' then new.appeal_reason else new.decision_note end;
  elsif new.minutes_late is distinct from old.minutes_late or new.value is distinct from old.value then
    act := 'adjusted'; nt := new.decision_note;
  elsif new.fine_amount is distinct from old.fine_amount then act := 'fine_set'; nt := null;
  elsif new.fine_paid is distinct from old.fine_paid then act := case when new.fine_paid then 'fine_paid' else 'fine_unpaid' end; nt := null;
  else return new;
  end if;
  insert into public.late_penalty_events (penalty_id, match_id, action, from_status, to_status, applied, minutes_late, value, actor_id, note)
  values (new.id, new.match_id, act, old.status, new.status, new.applied, new.minutes_late, new.value, (select auth.uid()), nt);
  return new;
end;
$$;
revoke all on function private.log_late_penalty_event() from public, anon, authenticated;
drop trigger if exists late_penalty_log on public.late_penalties;
create trigger late_penalty_log after insert or update on public.late_penalties for each row execute function private.log_late_penalty_event();

insert into public.late_penalty_events (penalty_id, match_id, action, to_status, applied, minutes_late, value, actor_id, created_at)
select lp.id, lp.match_id, case when lp.auto_created then 'auto_proposed' else 'proposed' end, 'proposed', false, lp.minutes_late, lp.value, lp.proposed_by, lp.created_at
  from public.late_penalties lp where not exists (select 1 from public.late_penalty_events e where e.penalty_id = lp.id);

create or replace function private.can_see_late(p_match_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and (private.can_manage_match(p_match_id) or private.is_match_official(p_match_id) or private.can_approve_late(p_match_id)
    or exists (select 1 from public.matches m join public.teams t on t.id in (m.team_a_id, m.team_b_id) where m.id = p_match_id and t.owner_id = (select auth.uid())));
$$;
revoke all on function private.can_see_late(uuid) from public, anon, authenticated;

create or replace function public.rollback_late_penalty(p_penalty_id uuid, p_reason text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare lp public.late_penalties%rowtype; m public.matches%rowtype; uid uuid := (select auth.uid()); why text := btrim(coalesce(p_reason, '')); late_name text;
begin
  if uid is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  select * into lp from public.late_penalties where id = p_penalty_id for update;
  if not found then raise exception 'Penalty not found.' using errcode = '22023'; end if;
  if not private.can_approve_late(lp.match_id) then raise exception 'Only the organiser (or an umpire, if the rules allow) can roll back a penalty.' using errcode = '42501'; end if;
  select * into m from public.matches where id = lp.match_id;
  if m.status in ('completed', 'abandoned') then raise exception 'The match is over. Use a waiver with a reason to remove this penalty.' using errcode = '22023'; end if;
  if lp.status not in ('approved', 'appealed') or not lp.applied then raise exception 'Only a penalty that is in effect can be rolled back.' using errcode = '22023'; end if;
  if lp.fine_paid then raise exception 'The fine for this penalty was marked paid. Mark it unpaid first.' using errcode = '22023'; end if;
  if char_length(why) < 5 or char_length(why) > 1000 then raise exception 'Give the reason for the rollback (5 to 1000 characters).' using errcode = '22023'; end if;
  perform private.apply_late_penalty(lp.id, -1);
  update public.late_penalties set status = 'rolled_back', decision_note = why, approved_by = uid, approved_at = now(), fine_amount = null where id = lp.id;
  late_name := (select name from public.teams where id = lp.late_team_id);
  insert into public.match_reports (match_id, kind, team_id, title, details, created_by)
  values (lp.match_id, 'decision', lp.late_team_id, 'Late-arrival penalty rolled back', 'The penalty on ' || late_name || ' was rolled back: ' || why, uid);
  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  select distinct u, 'late_penalty', 'Late-arrival penalty rolled back', late_name || ': ' || why, jsonb_build_object('match_id', lp.match_id, 'penalty_id', lp.id)
    from (select owner_id as u from public.teams where id in (lp.late_team_id, lp.beneficiary_team_id) union select owner_id from public.tournaments where id = m.tournament_id union select m.created_by) x
   where u is not null and u <> uid;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, 'LATE_PENALTY_ROLLED_BACK', 'late_penalties', lp.id::text, jsonb_build_object('match_id', lp.match_id, 'reason', why, 'method', lp.method, 'value', lp.value));
  return public.get_match_readiness(lp.match_id);
end;
$$;

create or replace function public.list_late_penalty_events(p_match_id uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_see_late(p_match_id) then raise exception 'Only the match organisers, officials and the two team owners can see this.' using errcode = '42501'; end if;
  return jsonb_build_object('items', coalesce((
    select jsonb_agg(jsonb_build_object('id', e.id, 'penalty_id', e.penalty_id, 'action', e.action, 'from_status', e.from_status, 'to_status', e.to_status,
             'minutes_late', e.minutes_late, 'value', e.value, 'applied', e.applied, 'note', e.note, 'at', e.created_at,
             'by', (select display_name from public.profiles where id = e.actor_id),
             'team', (select t.name from public.late_penalties lp join public.teams t on t.id = lp.late_team_id where lp.id = e.penalty_id),
             'method', (select lp.method from public.late_penalties lp where lp.id = e.penalty_id)) order by e.created_at, e.id)
      from public.late_penalty_events e where e.match_id = p_match_id), '[]'::jsonb));
end;
$$;

-- ---------- #399 simulation: runs the real apply code, then rolls everything back ----------
create or replace function private.penalty_snapshot(p_match_id uuid) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
begin
  return jsonb_build_object(
    'innings', coalesce((select jsonb_agg(jsonb_build_object('innings_no', i.innings_no, 'team', (select name from public.teams where id = i.batting_team_id), 'team_id', i.batting_team_id,
              'runs', i.runs, 'wickets', i.wickets, 'legal_balls', i.legal_balls, 'overs_limit', i.overs_limit, 'penalty_runs', i.penalty_runs, 'target', i.target, 'status', i.status) order by i.innings_no)
              from public.innings i where i.match_id = p_match_id and not i.is_super_over), '[]'::jsonb),
    'late_effects', (select late_effects from public.matches where id = p_match_id),
    'pending_penalty', (select pending_penalty from public.matches where id = p_match_id),
    'overs_per_innings', (select overs_per_innings from public.matches where id = p_match_id));
end;
$$;
revoke all on function private.penalty_snapshot(uuid) from public, anon, authenticated;

create or replace function public.simulate_late_penalty(p_match_id uuid, p_late_team_id uuid, p_minutes integer default null, p_penalty_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare m public.matches%rowtype; lp public.late_penalties%rowtype; cfg jsonb; mins int; val int; other uuid; lid uuid; b jsonb; a jsonb; res jsonb; err text; d text; method text; active boolean; names jsonb;
begin
  if (select auth.uid()) is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  select * into m from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found.' using errcode = '22023'; end if;
  if not private.can_see_late(p_match_id) then raise exception 'Only the match organisers, officials and the two team owners can see this.' using errcode = '42501'; end if;
  names := jsonb_build_object('late', (select name from public.teams where id = p_late_team_id));
  if p_penalty_id is not null then
    select * into lp from public.late_penalties where id = p_penalty_id and match_id = p_match_id;
    if not found then raise exception 'Penalty not found.' using errcode = '22023'; end if;
    if lp.applied then return jsonb_build_object('ok', false, 'already_applied', true, 'method', lp.method, 'value', lp.value, 'minutes', lp.minutes_late, 'message', 'This penalty is already in effect.'); end if;
    lid := lp.id; method := lp.method; val := lp.value; mins := lp.minutes_late; p_late_team_id := lp.late_team_id;
    names := jsonb_build_object('late', (select name from public.teams where id = lp.late_team_id), 'beneficiary', (select name from public.teams where id = lp.beneficiary_team_id));
  else
    if p_late_team_id not in (m.team_a_id, m.team_b_id) then raise exception 'Choose the late team.' using errcode = '22023'; end if;
    cfg := private.late_config(p_match_id);
    method := cfg ->> 'late_method';
    if method = 'none' then return jsonb_build_object('ok', false, 'method', 'none', 'message', 'This match has no late-arrival penalty set in its playing conditions.'); end if;
    mins := coalesce(p_minutes, (select minutes_late from public.match_arrivals where match_id = p_match_id and team_id = p_late_team_id));
    if mins is null then raise exception 'Check the team in first, or enter the minutes late.' using errcode = '22023'; end if;
    if mins < 0 or mins > 600 then raise exception 'Minutes late must be between 0 and 600.' using errcode = '22023'; end if;
    val := private.late_penalty_value(cfg, mins, m.overs_per_innings);
    if val <= 0 then return jsonb_build_object('ok', true, 'no_penalty', true, 'method', method, 'minutes', mins, 'value', 0, 'message', 'At ' || mins || ' minutes late, the rules give no penalty.'); end if;
    other := case when p_late_team_id = m.team_a_id then m.team_b_id else m.team_a_id end;
    names := jsonb_build_object('late', (select name from public.teams where id = p_late_team_id), 'beneficiary', (select name from public.teams where id = other));
  end if;
  active := exists (select 1 from public.late_penalties where match_id = p_match_id and late_team_id = p_late_team_id and status in ('proposed', 'approved', 'appealed') and id is distinct from lid);
  begin
    if lid is null then
      insert into public.late_penalties (match_id, late_team_id, beneficiary_team_id, minutes_late, method, rate, value, proposed_by)
      values (p_match_id, p_late_team_id, other, mins, method, cfg, val, (select auth.uid())) returning id into lid;
    end if;
    b := private.penalty_snapshot(p_match_id);
    perform private.apply_late_penalty(lid, 1);
    a := private.penalty_snapshot(p_match_id);
    raise exception 'simulation done' using errcode = 'P0777', detail = jsonb_build_object('before', b, 'after', a)::text;
  exception
    when sqlstate 'P0777' then
      get stacked diagnostics d = pg_exception_detail;
      res := d::jsonb;
    when others then
      err := sqlerrm;
  end;
  if err is not null then
    return jsonb_build_object('ok', false, 'method', method, 'minutes', mins, 'value', val, 'names', names, 'active_penalty_exists', active, 'message', err);
  end if;
  return jsonb_build_object('ok', true, 'method', method, 'minutes', mins, 'value', val, 'names', names, 'active_penalty_exists', active,
                            'before', res -> 'before', 'after', res -> 'after');
end;
$$;

-- ---------- #398 arrival disputes ----------
create table if not exists public.arrival_disputes (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  penalty_id uuid references public.late_penalties(id) on delete set null,
  recorded_arrival_at timestamptz not null,
  recorded_minutes_late integer not null,
  claimed_arrival_at timestamptz not null,
  reason text not null check (char_length(btrim(reason)) between 5 and 1000),
  status text not null default 'open' check (status in ('open', 'accepted', 'rejected', 'withdrawn')),
  created_by uuid not null,
  decided_by uuid,
  decided_at timestamptz,
  decision_note text check (decision_note is null or char_length(decision_note) <= 1000),
  created_at timestamptz not null default now()
);
create unique index if not exists arrival_disputes_one_open on public.arrival_disputes (match_id, team_id) where status = 'open';
create index if not exists arrival_disputes_match_idx on public.arrival_disputes (match_id, created_at desc);
alter table public.arrival_disputes enable row level security;

create table if not exists public.arrival_evidence (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.arrival_disputes(id) on delete cascade,
  added_by uuid not null,
  side text not null check (side in ('late_team', 'other_team', 'official')),
  kind text not null check (kind in ('photo_link', 'video_link', 'message', 'witness', 'other')),
  url text check (url is null or (url ~* '^https?://' and char_length(url) <= 500)),
  statement text check (statement is null or char_length(statement) <= 1000),
  created_at timestamptz not null default now(),
  check (url is not null or char_length(btrim(coalesce(statement, ''))) >= 3)
);
create index if not exists arrival_evidence_dispute_idx on public.arrival_evidence (dispute_id, created_at);
alter table public.arrival_evidence enable row level security;

create or replace function private.arrival_dispute_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.matches where id = old.match_id) then raise exception 'Dispute history cannot be deleted.' using errcode = '42501'; end if;
    return old;
  end if;
  if old.status <> 'open' or new.status = 'open' or new.match_id <> old.match_id or new.team_id <> old.team_id or new.reason <> old.reason
     or new.claimed_arrival_at <> old.claimed_arrival_at or new.recorded_arrival_at <> old.recorded_arrival_at or new.created_by <> old.created_by then
    raise exception 'Dispute history cannot be changed.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.arrival_dispute_guard() from public, anon, authenticated;
drop trigger if exists arrival_dispute_immutable on public.arrival_disputes;
create trigger arrival_dispute_immutable before update or delete on public.arrival_disputes for each row execute function private.arrival_dispute_guard();

create or replace function private.arrival_evidence_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.arrival_disputes where id = old.dispute_id) then raise exception 'Evidence cannot be deleted.' using errcode = '42501'; end if;
    return old;
  end if;
  raise exception 'Evidence cannot be changed.' using errcode = '42501';
end;
$$;
revoke all on function private.arrival_evidence_guard() from public, anon, authenticated;
drop trigger if exists arrival_evidence_immutable on public.arrival_evidence;
create trigger arrival_evidence_immutable before update or delete on public.arrival_evidence for each row execute function private.arrival_evidence_guard();

create or replace function public.list_arrival_disputes(p_match_id uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := (select auth.uid());
begin
  if not private.can_see_late(p_match_id) then raise exception 'Only the match organisers, officials and the two team owners can see this.' using errcode = '42501'; end if;
  return jsonb_build_object('can_decide', private.can_approve_late(p_match_id),
    'my_teams', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name)) from public.matches m join public.teams t on t.id in (m.team_a_id, m.team_b_id) where m.id = p_match_id and t.owner_id = uid), '[]'::jsonb),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'team_id', d.team_id, 'team', (select name from public.teams where id = d.team_id), 'status', d.status,
        'recorded_arrival_at', d.recorded_arrival_at, 'recorded_minutes_late', d.recorded_minutes_late, 'claimed_arrival_at', d.claimed_arrival_at, 'reason', d.reason,
        'penalty_id', d.penalty_id, 'decision_note', d.decision_note, 'decided_at', d.decided_at, 'created_at', d.created_at,
        'by', (select display_name from public.profiles where id = d.created_by), 'decided_by', (select display_name from public.profiles where id = d.decided_by),
        'can_withdraw', d.status = 'open' and d.created_by = uid,
        'can_add_evidence', d.status = 'open',
        'evidence', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'kind', e.kind, 'url', e.url, 'statement', e.statement, 'side', e.side, 'at', e.created_at,
                       'by', (select display_name from public.profiles where id = e.added_by)) order by e.created_at) from public.arrival_evidence e where e.dispute_id = d.id), '[]'::jsonb))
        order by d.created_at desc) from public.arrival_disputes d where d.match_id = p_match_id), '[]'::jsonb));
end;
$$;

create or replace function public.open_arrival_dispute(p_match_id uuid, p_team_id uuid, p_claimed_arrival_at timestamptz, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare m public.matches%rowtype; uid uuid := (select auth.uid()); a public.match_arrivals%rowtype; why text := btrim(coalesce(p_reason, '')); lp_id uuid; other uuid;
begin
  if uid is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  select * into m from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found.' using errcode = '22023'; end if;
  if p_team_id not in (m.team_a_id, m.team_b_id) then raise exception 'Choose one of the two teams.' using errcode = '22023'; end if;
  if not exists (select 1 from public.teams where id = p_team_id and owner_id = uid) then raise exception 'Only the owner of the team can dispute its arrival time.' using errcode = '42501'; end if;
  if m.status in ('completed', 'abandoned') then raise exception 'This match is over.' using errcode = '22023'; end if;
  select * into a from public.match_arrivals where match_id = p_match_id and team_id = p_team_id;
  if not found then raise exception 'This team has not been checked in, so there is no arrival time to dispute.' using errcode = '22023'; end if;
  if p_claimed_arrival_at is null or p_claimed_arrival_at >= a.arrived_at then raise exception 'The time you claim must be earlier than the recorded arrival.' using errcode = '22023'; end if;
  if p_claimed_arrival_at < coalesce(m.scheduled_at, a.arrived_at) - interval '12 hours' then raise exception 'That time is too early.' using errcode = '22023'; end if;
  if char_length(why) < 5 or char_length(why) > 1000 then raise exception 'Say why the recorded time is wrong (5 to 1000 characters).' using errcode = '22023'; end if;
  select id into lp_id from public.late_penalties where match_id = p_match_id and late_team_id = p_team_id and status in ('proposed', 'approved', 'appealed') order by created_at desc limit 1;
  begin
    insert into public.arrival_disputes (match_id, team_id, penalty_id, recorded_arrival_at, recorded_minutes_late, claimed_arrival_at, reason, created_by)
    values (p_match_id, p_team_id, lp_id, a.arrived_at, a.minutes_late, p_claimed_arrival_at, why, uid);
  exception when unique_violation then raise exception 'This team already has an open arrival dispute for this match.' using errcode = '22023'; end;
  other := case when p_team_id = m.team_a_id then m.team_b_id else m.team_a_id end;
  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  select distinct u, 'arrival_dispute', 'Arrival time disputed', (select name from public.teams where id = p_team_id) || ' says it arrived earlier than recorded: ' || why, jsonb_build_object('match_id', p_match_id)
    from (select m.created_by as u union select owner_id from public.tournaments where id = m.tournament_id union select owner_id from public.teams where id = other) x where u is not null and u <> uid;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, 'ARRIVAL_DISPUTE_OPENED', 'matches', p_match_id::text, jsonb_build_object('team_id', p_team_id, 'claimed', p_claimed_arrival_at));
  return public.list_arrival_disputes(p_match_id);
end;
$$;

create or replace function public.add_arrival_evidence(p_dispute_id uuid, p_kind text, p_url text, p_statement text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare d public.arrival_disputes%rowtype; m public.matches%rowtype; uid uuid := (select auth.uid()); sd text; u text := nullif(btrim(coalesce(p_url, '')), ''); s text := nullif(btrim(coalesce(p_statement, '')), '');
begin
  if uid is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  select * into d from public.arrival_disputes where id = p_dispute_id for update;
  if not found then raise exception 'Dispute not found.' using errcode = '22023'; end if;
  select * into m from public.matches where id = d.match_id;
  if d.status <> 'open' then raise exception 'This dispute is already closed.' using errcode = '22023'; end if;
  if exists (select 1 from public.teams where id = d.team_id and owner_id = uid) then sd := 'late_team';
  elsif exists (select 1 from public.teams t where t.id in (m.team_a_id, m.team_b_id) and t.id <> d.team_id and t.owner_id = uid) then sd := 'other_team';
  elsif private.can_manage_match(d.match_id) or private.is_match_official(d.match_id) then sd := 'official';
  else raise exception 'Only the two team owners and the match officials can add evidence.' using errcode = '42501'; end if;
  if p_kind not in ('photo_link', 'video_link', 'message', 'witness', 'other') then raise exception 'Choose the type of evidence.' using errcode = '22023'; end if;
  if u is null and (s is null or char_length(s) < 3) then raise exception 'Add a link or write a statement.' using errcode = '22023'; end if;
  if u is not null and u !~* '^https?://' then raise exception 'Links must start with http:// or https://.' using errcode = '22023'; end if;
  if (select count(*) from public.arrival_evidence where dispute_id = d.id) >= 15 then raise exception 'This dispute already has 15 pieces of evidence.' using errcode = '22023'; end if;
  insert into public.arrival_evidence (dispute_id, added_by, side, kind, url, statement) values (d.id, uid, sd, p_kind, u, s);
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, 'ARRIVAL_EVIDENCE_ADDED', 'matches', d.match_id::text, jsonb_build_object('dispute_id', d.id, 'side', sd, 'kind', p_kind));
  return public.list_arrival_disputes(d.match_id);
end;
$$;

create or replace function public.decide_arrival_dispute(p_dispute_id uuid, p_accept boolean, p_note text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare d public.arrival_disputes%rowtype; m public.matches%rowtype; uid uuid := (select auth.uid()); note text := btrim(coalesce(p_note, '')); newmins int; lp public.late_penalties%rowtype; val int; was_applied boolean; tname text; msg text;
begin
  if uid is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  select * into d from public.arrival_disputes where id = p_dispute_id for update;
  if not found then raise exception 'Dispute not found.' using errcode = '22023'; end if;
  if not private.can_approve_late(d.match_id) then raise exception 'Only the organiser (or an umpire, if the rules allow) can decide.' using errcode = '42501'; end if;
  if d.status <> 'open' then raise exception 'This dispute was already decided.' using errcode = '22023'; end if;
  if char_length(note) < 5 or char_length(note) > 1000 then raise exception 'Write the reason for your decision (5 to 1000 characters).' using errcode = '22023'; end if;
  select * into m from public.matches where id = d.match_id for update;
  tname := (select name from public.teams where id = d.team_id);
  if p_accept then
    if not exists (select 1 from public.arrival_evidence where dispute_id = d.id and side = 'late_team') then raise exception 'Ask the team for at least one piece of evidence before accepting.' using errcode = '22023'; end if;
    if m.status in ('completed', 'abandoned') then raise exception 'This match is over.' using errcode = '22023'; end if;
    newmins := case when m.scheduled_at is null then 0 else greatest(floor(extract(epoch from (d.claimed_arrival_at - m.scheduled_at)) / 60)::int, 0) end;
    update public.match_arrivals set arrived_at = d.claimed_arrival_at, minutes_late = newmins where match_id = d.match_id and team_id = d.team_id;
    select * into lp from public.late_penalties where id = d.penalty_id for update;
    if found and lp.status in ('proposed', 'approved', 'appealed') then
      was_applied := lp.applied;
      val := private.late_penalty_value(lp.rate, newmins, m.overs_per_innings);
      if was_applied then perform private.apply_late_penalty(lp.id, -1); end if;
      if val <= 0 then
        update public.late_penalties set minutes_late = newmins, value = 0, status = case when lp.status = 'proposed' then 'rejected' else 'waived' end,
               decision_note = 'Arrival corrected after a dispute: ' || note, approved_by = uid, approved_at = now() where id = lp.id;
        msg := 'The penalty was removed because the corrected arrival time gives no penalty.';
      else
        update public.late_penalties set minutes_late = newmins, value = val, decision_note = 'Arrival corrected after a dispute: ' || note where id = lp.id;
        if was_applied then perform private.apply_late_penalty(lp.id, 1); end if;
        msg := 'The penalty was recalculated for ' || newmins || ' minutes late.';
      end if;
    else
      msg := 'No penalty was affected.';
    end if;
    insert into public.match_reports (match_id, kind, team_id, title, details, created_by)
    values (d.match_id, 'decision', d.team_id, 'Arrival time corrected: ' || tname, 'After a dispute with evidence, the arrival time of ' || tname || ' was corrected to ' || newmins || ' minutes late. ' || msg || ' ' || note, uid);
  end if;
  update public.arrival_disputes set status = case when p_accept then 'accepted' else 'rejected' end, decided_by = uid, decided_at = now(), decision_note = note where id = d.id;
  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  select distinct u, 'arrival_dispute', case when p_accept then 'Arrival dispute accepted' else 'Arrival dispute rejected' end, tname || ': ' || note || coalesce(' ' || msg, ''), jsonb_build_object('match_id', d.match_id)
    from (select owner_id as u from public.teams where id in (m.team_a_id, m.team_b_id) union select d.created_by) x where u is not null and u <> uid;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, case when p_accept then 'ARRIVAL_DISPUTE_ACCEPTED' else 'ARRIVAL_DISPUTE_REJECTED' end, 'matches', d.match_id::text, jsonb_build_object('dispute_id', d.id, 'note', note, 'new_minutes_late', newmins));
  return public.list_arrival_disputes(d.match_id);
end;
$$;

create or replace function public.withdraw_arrival_dispute(p_dispute_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare d public.arrival_disputes%rowtype; uid uuid := (select auth.uid());
begin
  select * into d from public.arrival_disputes where id = p_dispute_id for update;
  if not found or d.created_by <> uid then raise exception 'Dispute not found.' using errcode = '22023'; end if;
  if d.status <> 'open' then raise exception 'This dispute is already closed.' using errcode = '22023'; end if;
  update public.arrival_disputes set status = 'withdrawn', decided_by = uid, decided_at = now() where id = d.id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata) values (uid, 'ARRIVAL_DISPUTE_WITHDRAWN', 'matches', d.match_id::text, jsonb_build_object('dispute_id', d.id));
  return public.list_arrival_disputes(d.match_id);
end;
$$;

-- ---------- #368 recruitment ----------
alter table public.community_posts add column if not exists roles text[];
alter table public.community_posts add column if not exists slots integer check (slots is null or slots between 1 and 30);
alter table public.community_posts add column if not exists level text check (level is null or level in ('any', 'beginner', 'intermediate', 'advanced'));
alter table public.community_posts add column if not exists filled integer not null default 0;
alter table public.community_posts add column if not exists hidden_at timestamptz;
alter table public.community_posts add column if not exists hidden_reason text;
alter table public.directory_listings add column if not exists moderation_hidden boolean not null default false;

create table if not exists public.recruitment_applications (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  applicant_id uuid not null,
  player_id uuid,
  message text check (message is null or char_length(message) <= 500),
  status text not null default 'applied' check (status in ('applied', 'shortlisted', 'accepted', 'declined', 'withdrawn')),
  decision_note text check (decision_note is null or char_length(decision_note) <= 300),
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (post_id, applicant_id)
);
create index if not exists recruitment_applications_post_idx on public.recruitment_applications (post_id, created_at);
alter table public.recruitment_applications enable row level security;

create or replace function private.can_run_post(p_post_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (select 1 from public.community_posts c where c.id = p_post_id
    and (c.author_id = (select auth.uid()) or private.is_admin() or exists (select 1 from public.teams t where t.id = c.team_id and t.owner_id = (select auth.uid()))));
$$;
revoke all on function private.can_run_post(uuid) from public, anon, authenticated;

create or replace function public.save_recruitment_post(p_post_id uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_active_user(); pid uuid := p_post_id; r text[]; sl int; lv text := coalesce(nullif(p->>'level', ''), 'any'); st text;
begin
  if pid is not null and not exists (select 1 from public.community_posts where id = pid and kind = 'players_wanted' and (author_id = uid or private.is_admin())) then raise exception 'Only the author can change this post.' using errcode = '42501'; end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p->>'title', ''))) < 3 or pg_catalog.length(p->>'title') > 120 then raise exception 'Enter a title (3 to 120 characters).' using errcode = '22023'; end if;
  sl := nullif(p->>'slots', '')::int;
  if sl is null or sl < 1 or sl > 30 then raise exception 'Say how many players you need (1 to 30).' using errcode = '22023'; end if;
  if lv not in ('any', 'beginner', 'intermediate', 'advanced') then raise exception 'Choose a level.' using errcode = '22023'; end if;
  select coalesce(array_agg(x), '{}') into r from (select distinct pg_catalog.btrim(value) as x from jsonb_array_elements_text(coalesce(p->'roles', '[]'::jsonb)) where pg_catalog.btrim(value) <> '') q;
  if cardinality(r) > 6 or exists (select 1 from unnest(r) x where char_length(x) > 30) then raise exception 'Choose up to 6 roles.' using errcode = '22023'; end if;
  if nullif(p->>'team_id', '') is not null and not exists (select 1 from public.teams where id = (p->>'team_id')::uuid and owner_id = uid) then raise exception 'You can only post for your own team.' using errcode = '42501'; end if;
  st := coalesce(nullif(p->>'status', ''), 'open');
  if st not in ('open', 'closed') then raise exception 'Unknown status.' using errcode = '22023'; end if;
  if pid is null and (select count(*) from public.community_posts where author_id = uid and created_at > now() - interval '1 day') >= 10 then raise exception 'You can post up to 10 times a day.' using errcode = '22023'; end if;
  if pid is null then insert into public.community_posts (author_id, kind, title) values (uid, 'players_wanted', pg_catalog.btrim(p->>'title')) returning id into pid; end if;
  if sl < (select filled from public.community_posts where id = pid) then raise exception 'You have already accepted more players than that.' using errcode = '22023'; end if;
  update public.community_posts set title = pg_catalog.btrim(p->>'title'), body = nullif(pg_catalog.btrim(coalesce(p->>'body', '')), ''), city = nullif(pg_catalog.btrim(coalesce(p->>'city', '')), ''),
    event_date = nullif(p->>'event_date', '')::date, team_id = nullif(p->>'team_id', '')::uuid, roles = r, slots = sl, level = lv,
    status = case when st = 'open' and filled >= sl then 'closed' else st end
   where id = pid;
  return jsonb_build_object('id', pid);
end;
$$;

create or replace function public.list_recruitment_posts(p jsonb default '{}'::jsonb) returns jsonb language sql stable security definer set search_path = '' as $$
  with q as (select nullif(pg_catalog.btrim(coalesce(p->>'city', '')), '') as city, nullif(p->>'role', '') as role, nullif(p->>'level', '') as level, coalesce((p->>'mine')::boolean, false) as mine)
  select coalesce(jsonb_agg(x order by (x->>'created_at') desc), '[]'::jsonb) from (
    select jsonb_build_object('id', c.id, 'title', c.title, 'body', c.body, 'city', c.city, 'event_date', c.event_date, 'status', c.status, 'roles', coalesce(c.roles, '{}'), 'slots', c.slots, 'filled', c.filled,
             'slots_left', greatest(c.slots - c.filled, 0), 'level', c.level, 'created_at', c.created_at, 'expires_at', c.expires_at,
             'author', (select display_name from public.profiles where id = c.author_id),
             'team', (select jsonb_build_object('id', t.id, 'name', t.name) from public.teams t where t.id = c.team_id),
             'is_mine', c.author_id = (select auth.uid()), 'can_run', private.can_run_post(c.id), 'hidden', c.hidden_at is not null,
             'applications', case when private.can_run_post(c.id) then (select count(*) from public.recruitment_applications a where a.post_id = c.id) end,
             'my_application', (select jsonb_build_object('id', a.id, 'status', a.status) from public.recruitment_applications a where a.post_id = c.id and a.applicant_id = (select auth.uid()))) as x
      from public.community_posts c, q
     where c.kind = 'players_wanted' and c.slots is not null
       and (case when q.mine then c.author_id = (select auth.uid()) else c.status = 'open' and c.expires_at > now() and c.hidden_at is null end)
       and (q.city is null or c.city ilike '%' || q.city || '%') and (q.role is null or q.role = any(c.roles) or c.roles = '{}')
       and (q.level is null or c.level = q.level or c.level = 'any')
     order by c.created_at desc limit 100) y;
$$;

create or replace function public.apply_to_recruitment(p_post_id uuid, p_message text, p_player_id uuid default null) returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_active_user(); c public.community_posts%rowtype; msg text := nullif(btrim(coalesce(p_message, '')), ''); aid uuid;
begin
  select * into c from public.community_posts where id = p_post_id;
  if not found or c.kind <> 'players_wanted' or c.slots is null then raise exception 'Post not found.' using errcode = '22023'; end if;
  if c.status <> 'open' or c.expires_at <= now() or c.hidden_at is not null then raise exception 'This post is not taking applications.' using errcode = '22023'; end if;
  if c.filled >= c.slots then raise exception 'All places are filled.' using errcode = '22023'; end if;
  if c.author_id = uid then raise exception 'You cannot apply to your own post.' using errcode = '22023'; end if;
  if msg is not null and char_length(msg) > 500 then raise exception 'The message can be at most 500 characters.' using errcode = '22023'; end if;
  if p_player_id is not null and not exists (select 1 from public.players where id = p_player_id and profile_id = uid) then raise exception 'Choose your own player profile.' using errcode = '22023'; end if;
  if (select count(*) from public.recruitment_applications where applicant_id = uid and created_at > now() - interval '1 day') >= 10 then raise exception 'You can apply to 10 posts a day.' using errcode = '22023'; end if;
  insert into public.recruitment_applications (post_id, applicant_id, player_id, message) values (p_post_id, uid, p_player_id, msg)
  on conflict (post_id, applicant_id) do update set message = excluded.message, player_id = excluded.player_id, status = 'applied', decision_note = null, decided_by = null, decided_at = null
    where public.recruitment_applications.status = 'withdrawn'
  returning id into aid;
  if aid is null then raise exception 'You have already applied to this post.' using errcode = '22023'; end if;
  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  select distinct u, 'recruitment', 'New player application', (select display_name from public.profiles where id = uid) || ' applied to: ' || c.title, jsonb_build_object('post_id', c.id, 'application_id', aid)
    from (select c.author_id as u union select owner_id from public.teams where id = c.team_id) x where u is not null and u <> uid;
  return jsonb_build_object('id', aid, 'status', 'applied');
end;
$$;

create or replace function public.list_recruitment_applications(p_post_id uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); run boolean;
begin
  if uid is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  run := private.can_run_post(p_post_id);
  return jsonb_build_object('can_run', run, 'items', coalesce((
    select jsonb_agg(jsonb_build_object('id', a.id, 'status', a.status, 'message', a.message, 'created_at', a.created_at, 'decision_note', a.decision_note,
             'name', (select display_name from public.profiles where id = a.applicant_id), 'user_id', a.applicant_id,
             'player', (select jsonb_build_object('id', pl.id, 'name', pl.display_name, 'role', pl.player_role, 'code', pl.player_code) from public.players pl where pl.id = a.player_id),
             'is_me', a.applicant_id = uid) order by a.created_at)
      from public.recruitment_applications a where a.post_id = p_post_id and (run or a.applicant_id = uid)), '[]'::jsonb));
end;
$$;

create or replace function public.decide_recruitment_application(p_app_id uuid, p_action text, p_note text default null) returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.recruitment_applications%rowtype; c public.community_posts%rowtype; uid uuid := (select auth.uid()); note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  select * into a from public.recruitment_applications where id = p_app_id for update;
  if not found then raise exception 'Application not found.' using errcode = '22023'; end if;
  select * into c from public.community_posts where id = a.post_id for update;
  if not private.can_run_post(c.id) then raise exception 'Only the person who posted (or the team owner) can decide.' using errcode = '42501'; end if;
  if p_action not in ('shortlist', 'accept', 'decline') then raise exception 'Unknown action.' using errcode = '22023'; end if;
  if note is not null and char_length(note) > 300 then raise exception 'The note can be at most 300 characters.' using errcode = '22023'; end if;
  if a.status in ('withdrawn', 'declined') or (a.status = 'accepted' and p_action <> 'decline') then raise exception 'This application is already closed.' using errcode = '22023'; end if;
  if p_action = 'accept' then
    if c.filled >= c.slots then raise exception 'All places are filled.' using errcode = '22023'; end if;
    update public.community_posts set filled = filled + 1, status = case when filled + 1 >= slots then 'closed' else status end where id = c.id;
  elsif p_action = 'decline' and a.status = 'accepted' then
    update public.community_posts set filled = greatest(filled - 1, 0), status = case when status = 'closed' and expires_at > now() then 'open' else status end where id = c.id;
  end if;
  update public.recruitment_applications set status = case p_action when 'shortlist' then 'shortlisted' when 'accept' then 'accepted' else 'declined' end, decision_note = note, decided_by = uid, decided_at = now() where id = a.id;
  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  values (a.applicant_id, 'recruitment', case p_action when 'accept' then 'You were accepted' when 'shortlist' then 'You were shortlisted' else 'Application declined' end,
          c.title || coalesce(' - ' || note, ''), jsonb_build_object('post_id', c.id, 'application_id', a.id));
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, target_user_id, metadata)
  values (uid, 'RECRUITMENT_' || upper(p_action), 'community_posts', c.id::text, a.applicant_id, jsonb_build_object('application_id', a.id));
  return public.list_recruitment_applications(c.id);
end;
$$;

create or replace function public.withdraw_recruitment_application(p_app_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.recruitment_applications%rowtype; uid uuid := (select auth.uid());
begin
  select * into a from public.recruitment_applications where id = p_app_id for update;
  if not found or a.applicant_id <> uid then raise exception 'Application not found.' using errcode = '22023'; end if;
  if a.status not in ('applied', 'shortlisted') then raise exception 'This application cannot be withdrawn now.' using errcode = '22023'; end if;
  update public.recruitment_applications set status = 'withdrawn' where id = a.id;
  return public.list_recruitment_applications(a.post_id);
end;
$$;

create or replace function public.my_recruitment_applications() returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'status', a.status, 'created_at', a.created_at, 'decision_note', a.decision_note, 'post_id', c.id, 'title', c.title, 'city', c.city,
           'team', (select name from public.teams where id = c.team_id)) order by a.created_at desc), '[]'::jsonb)
    from public.recruitment_applications a join public.community_posts c on c.id = a.post_id where a.applicant_id = (select auth.uid());
$$;

-- ---------- #370 moderation ----------
create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('post', 'listing')),
  target_id uuid not null,
  reporter_id uuid not null,
  reason text not null check (reason in ('spam', 'scam', 'offensive', 'wrong_info', 'duplicate', 'other')),
  details text check (details is null or char_length(details) <= 500),
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  handled_by uuid,
  handled_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);
create unique index if not exists community_reports_one_open on public.community_reports (target_type, target_id, reporter_id) where status = 'open';
create index if not exists community_reports_queue_idx on public.community_reports (status, created_at);
alter table public.community_reports enable row level security;

create or replace function private.keep_post_hidden() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.hidden_at is not null and new.hidden_at is null and not private.is_admin() then new.hidden_at := old.hidden_at; new.hidden_reason := old.hidden_reason; end if;
  return new;
end;
$$;
revoke all on function private.keep_post_hidden() from public, anon, authenticated;
drop trigger if exists keep_post_hidden on public.community_posts;
create trigger keep_post_hidden before update on public.community_posts for each row execute function private.keep_post_hidden();

create or replace function private.keep_listing_hidden() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.moderation_hidden and not private.is_admin() then new.moderation_hidden := true; new.is_active := false; end if;
  return new;
end;
$$;
revoke all on function private.keep_listing_hidden() from public, anon, authenticated;
drop trigger if exists keep_listing_hidden on public.directory_listings;
create trigger keep_listing_hidden before update on public.directory_listings for each row execute function private.keep_listing_hidden();

create or replace function private.block_hidden_enquiry() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.target_type = 'post' and exists (select 1 from public.community_posts where id = new.target_id and hidden_at is not null) then raise exception 'This post is not available.' using errcode = '22023'; end if;
  if new.target_type = 'listing' and exists (select 1 from public.directory_listings where id = new.target_id and moderation_hidden) then raise exception 'This listing is not available.' using errcode = '22023'; end if;
  return new;
end;
$$;
revoke all on function private.block_hidden_enquiry() from public, anon, authenticated;
drop trigger if exists block_hidden_enquiry on public.enquiries;
create trigger block_hidden_enquiry before insert on public.enquiries for each row execute function private.block_hidden_enquiry();

create or replace function private.hide_target(p_type text, p_id uuid, p_reason text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_type = 'post' then update public.community_posts set hidden_at = coalesce(hidden_at, now()), hidden_reason = p_reason where id = p_id;
  else update public.directory_listings set moderation_hidden = true, is_active = false where id = p_id; end if;
end;
$$;
revoke all on function private.hide_target(text, uuid, text) from public, anon, authenticated;

create or replace function public.report_community_item(p_type text, p_id uuid, p_reason text, p_details text default null) returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_active_user(); owner uuid; n int; det text := nullif(btrim(coalesce(p_details, '')), '');
begin
  if p_type not in ('post', 'listing') then raise exception 'Unknown item type.' using errcode = '22023'; end if;
  if p_reason not in ('spam', 'scam', 'offensive', 'wrong_info', 'duplicate', 'other') then raise exception 'Choose a reason.' using errcode = '22023'; end if;
  if det is not null and char_length(det) > 500 then raise exception 'Details can be at most 500 characters.' using errcode = '22023'; end if;
  owner := case p_type when 'post' then (select author_id from public.community_posts where id = p_id) else (select owner_id from public.directory_listings where id = p_id) end;
  if owner is null then raise exception 'Item not found.' using errcode = '22023'; end if;
  if owner = uid then raise exception 'You cannot report your own item.' using errcode = '22023'; end if;
  if (select count(*) from public.community_reports where reporter_id = uid and created_at > now() - interval '1 day') >= 10 then raise exception 'You can send 10 reports a day.' using errcode = '22023'; end if;
  begin
    insert into public.community_reports (target_type, target_id, reporter_id, reason, details) values (p_type, p_id, uid, p_reason, det);
  exception when unique_violation then raise exception 'You have already reported this.' using errcode = '22023'; end;
  select count(distinct reporter_id) into n from public.community_reports where target_type = p_type and target_id = p_id and status = 'open';
  if n >= 3 then perform private.hide_target(p_type, p_id, 'Hidden automatically after ' || n || ' reports, waiting for review'); end if;
  return jsonb_build_object('ok', true, 'auto_hidden', n >= 3);
end;
$$;

create or replace function public.list_moderation_queue(p_status text default 'open', p_limit integer default 50) returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Only an admin can see the moderation queue.' using errcode = '42501'; end if;
  if p_status not in ('open', 'actioned', 'dismissed') then raise exception 'Unknown status.' using errcode = '22023'; end if;
  return jsonb_build_object('items', coalesce((
    select jsonb_agg(x order by (x ->> 'last_report') desc) from (
      select jsonb_build_object('target_type', r.target_type, 'target_id', r.target_id, 'reports', count(*), 'last_report', max(r.created_at), 'first_report', min(r.created_at),
               'reasons', jsonb_agg(distinct r.reason),
               'details', coalesce(jsonb_agg(r.details) filter (where r.details is not null), '[]'::jsonb),
               'title', case r.target_type when 'post' then (select title from public.community_posts where id = r.target_id) else (select name from public.directory_listings where id = r.target_id) end,
               'preview', case r.target_type when 'post' then (select pg_catalog.left(body, 240) from public.community_posts where id = r.target_id) else (select pg_catalog.left(description, 240) from public.directory_listings where id = r.target_id) end,
               'kind', case r.target_type when 'post' then (select kind from public.community_posts where id = r.target_id) else (select kind from public.directory_listings where id = r.target_id) end,
               'owner', (select display_name from public.profiles where id = case r.target_type when 'post' then (select author_id from public.community_posts where id = r.target_id) else (select owner_id from public.directory_listings where id = r.target_id) end),
               'hidden', case r.target_type when 'post' then (select hidden_at is not null from public.community_posts where id = r.target_id) else (select moderation_hidden from public.directory_listings where id = r.target_id) end,
               'last_note', max(r.note)) as x
        from public.community_reports r where r.status = p_status group by r.target_type, r.target_id
        order by max(r.created_at) desc limit greatest(least(coalesce(p_limit, 50), 200), 1)) y), '[]'::jsonb));
end;
$$;

create or replace function public.moderation_queue_count() returns integer language sql stable security definer set search_path = '' as $$
  select case when private.is_admin() then (select count(distinct (target_type, target_id))::int from public.community_reports where status = 'open') else 0 end;
$$;

create or replace function public.decide_moderation(p_type text, p_id uuid, p_action text, p_note text default null) returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); nt text := nullif(btrim(coalesce(p_note, '')), ''); owner uuid; ttl text;
begin
  if not private.is_admin() then raise exception 'Only an admin can moderate.' using errcode = '42501'; end if;
  if p_type not in ('post', 'listing') then raise exception 'Unknown item type.' using errcode = '22023'; end if;
  if p_action not in ('hide', 'restore', 'dismiss') then raise exception 'Unknown action.' using errcode = '22023'; end if;
  if nt is not null and char_length(nt) > 500 then raise exception 'The note can be at most 500 characters.' using errcode = '22023'; end if;
  if p_action = 'hide' and nt is null then raise exception 'Give a reason for hiding it. The owner will see it.' using errcode = '22023'; end if;
  owner := case p_type when 'post' then (select author_id from public.community_posts where id = p_id) else (select owner_id from public.directory_listings where id = p_id) end;
  ttl := case p_type when 'post' then (select title from public.community_posts where id = p_id) else (select name from public.directory_listings where id = p_id) end;
  if owner is null then raise exception 'Item not found.' using errcode = '22023'; end if;
  if p_action = 'hide' then
    perform private.hide_target(p_type, p_id, nt);
    update public.community_reports set status = 'actioned', handled_by = uid, handled_at = now(), note = nt where target_type = p_type and target_id = p_id and status = 'open';
  else
    if p_type = 'post' then update public.community_posts set hidden_at = null, hidden_reason = null where id = p_id;
    else update public.directory_listings set moderation_hidden = false, is_active = true where id = p_id; end if;
    update public.community_reports set status = 'dismissed', handled_by = uid, handled_at = now(), note = nt where target_type = p_type and target_id = p_id and status = 'open';
  end if;
  if p_action = 'hide' or p_action = 'restore' then
    insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
    values (owner, 'moderation', case when p_action = 'hide' then 'Your item was hidden' else 'Your item is visible again' end, ttl || coalesce(': ' || nt, ''), jsonb_build_object('target_type', p_type, 'target_id', p_id));
  end if;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, target_user_id, metadata)
  values (uid, 'COMMUNITY_' || upper(p_action), case p_type when 'post' then 'community_posts' else 'directory_listings' end, p_id::text, owner, jsonb_build_object('note', nt));
  return public.list_moderation_queue('open', 50);
end;
$$;

-- hidden posts leave the public list; the owner still sees theirs with a hidden mark. Recruitment fields are included.
create or replace function public.list_posts(p jsonb default '{}'::jsonb) returns jsonb language sql stable security definer set search_path = '' as $$
  with q as (select nullif(p->>'kind', '') as kind, nullif(pg_catalog.btrim(coalesce(p->>'city', '')), '') as city, coalesce((p->>'mine')::boolean, false) as mine)
  select coalesce(jsonb_agg(x order by (x->>'created_at') desc), '[]'::jsonb) from (
    select jsonb_build_object('id', c.id, 'kind', c.kind, 'title', c.title, 'body', c.body, 'city', c.city, 'event_date', c.event_date, 'status', c.status,
             'created_at', c.created_at, 'expires_at', c.expires_at, 'author', (select display_name from public.profiles where id = c.author_id),
             'team', (select jsonb_build_object('id', t.id, 'name', t.name) from public.teams t where t.id = c.team_id),
             'is_mine', c.author_id = (select auth.uid()),
             'hidden', c.hidden_at is not null, 'hidden_reason', case when c.author_id = (select auth.uid()) then c.hidden_reason end,
             'slots', c.slots, 'filled', c.filled, 'roles', c.roles, 'level', c.level,
             'replies', case when c.author_id = (select auth.uid()) then (select count(*) from public.enquiries e where e.target_type = 'post' and e.target_id = c.id) end) as x
      from public.community_posts c, q
     where (case when q.mine then c.author_id = (select auth.uid()) else c.status = 'open' and c.expires_at > now() and c.hidden_at is null end)
       and (q.kind is null or c.kind = q.kind)
       and (q.city is null or c.city ilike '%' || q.city || '%')
     order by c.created_at desc limit 100) y;
$$;

do $$
declare f text;
begin
  foreach f in array array['public.rollback_late_penalty(uuid,text)', 'public.list_late_penalty_events(uuid)', 'public.simulate_late_penalty(uuid,uuid,integer,uuid)',
    'public.list_arrival_disputes(uuid)', 'public.open_arrival_dispute(uuid,uuid,timestamptz,text)', 'public.add_arrival_evidence(uuid,text,text,text)',
    'public.decide_arrival_dispute(uuid,boolean,text)', 'public.withdraw_arrival_dispute(uuid)', 'public.save_recruitment_post(uuid,jsonb)',
    'public.apply_to_recruitment(uuid,text,uuid)', 'public.list_recruitment_applications(uuid)', 'public.decide_recruitment_application(uuid,text,text)',
    'public.withdraw_recruitment_application(uuid)', 'public.my_recruitment_applications()', 'public.report_community_item(text,uuid,text,text)',
    'public.list_moderation_queue(text,integer)', 'public.moderation_queue_count()', 'public.decide_moderation(text,uuid,text,text)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  execute 'grant execute on function public.list_recruitment_posts(jsonb) to anon, authenticated';
end $$;
