-- Batch 12: #361 digital assignment acceptance, #363 scorer handover authorization,
--           #365 ground availability conflict alerts, #366 ground conditions inspection checklist.

-- ---------- #361 digital acceptance ----------
alter table public.match_officials add column if not exists accepted_at timestamptz;
alter table public.match_officials add column if not exists acceptance_text text;
alter table public.match_officials add column if not exists decline_reason text;
alter table public.match_officials add column if not exists last_reminded_at timestamptz;

-- other accepted assignments of this person that start within 4 hours of this match
create or replace function private.official_conflicts(p_user_id uuid, p_match_id uuid) returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('match_id', o.id, 'role', mo.role, 'scheduled_at', o.scheduled_at,
           'teams', (select name from public.teams where id = o.team_a_id) || ' vs ' || (select name from public.teams where id = o.team_b_id)) order by o.scheduled_at), '[]'::jsonb)
    from public.matches m
    join public.matches o on o.id <> m.id and o.status in ('scheduled', 'live') and o.scheduled_at is not null
         and abs(extract(epoch from (o.scheduled_at - m.scheduled_at))) < 4 * 3600
    join public.match_officials mo on mo.match_id = o.id and mo.user_id = p_user_id and mo.status = 'accepted'
   where m.id = p_match_id and m.scheduled_at is not null;
$$;
revoke all on function private.official_conflicts(uuid, uuid) from public, anon, authenticated;

drop function if exists public.respond_official_invite(uuid, boolean);
create or replace function public.respond_official_invite(p_assignment_id uuid, p_accept boolean, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.match_officials%rowtype; m public.matches%rowtype; uid uuid := (select auth.uid()); conf jsonb; why text := nullif(btrim(coalesce(p_reason, '')), ''); decl text;
begin
  select * into a from public.match_officials where id = p_assignment_id for update;
  if not found or a.user_id <> uid then raise exception 'Invitation not found.' using errcode = '22023'; end if;
  select * into m from public.matches where id = a.match_id;
  if m.status in ('completed', 'abandoned') then raise exception 'This match is already over.' using errcode = '22023'; end if;
  if a.status = 'cancelled' then raise exception 'This invitation was cancelled.' using errcode = '22023'; end if;
  if why is not null and char_length(why) > 300 then raise exception 'The reason can be at most 300 characters.' using errcode = '22023'; end if;
  if p_accept then
    conf := private.official_conflicts(uid, a.match_id);
    if jsonb_array_length(conf) > 0 then
      raise exception 'You have already accepted % at about the same time (%). Decline one of them first.', conf -> 0 ->> 'teams',
        to_char((conf -> 0 ->> 'scheduled_at')::timestamptz at time zone 'Asia/Kolkata', 'DD Mon, HH12:MI AM') using errcode = '22023';
    end if;
    decl := 'I, ' || (select display_name from public.profiles where id = uid) || ', accept the role of ' || replace(a.role, '_', ' ') || ' for '
         || (select name from public.teams where id = m.team_a_id) || ' vs ' || (select name from public.teams where id = m.team_b_id)
         || coalesce(' on ' || to_char(m.scheduled_at at time zone 'Asia/Kolkata', 'DD Mon YYYY, HH12:MI AM'), '')
         || coalesce(' at ' || m.venue, '') || coalesce(', fee ' || a.fee::text, '') || '.';
  end if;
  update public.match_officials set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now(),
         accepted_at = case when p_accept then now() else accepted_at end, acceptance_text = case when p_accept then decl else acceptance_text end,
         decline_reason = case when p_accept then null else why end where id = a.id;
  if a.invited_by is not null and a.invited_by <> uid then
    insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
    values (a.invited_by, 'official_response', case when p_accept then 'Official accepted' else 'Official declined' end,
            (select display_name from public.profiles where id = uid) || case when p_accept then ' accepted' else ' declined' end || ' the ' || replace(a.role, '_', ' ') || ' invitation for '
            || (select name from public.teams where id = m.team_a_id) || ' vs ' || (select name from public.teams where id = m.team_b_id) || '.' || coalesce(' Reason: ' || why, ''),
            jsonb_build_object('match_id', a.match_id, 'assignment_id', a.id));
  end if;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, case when p_accept then 'OFFICIAL_ACCEPTED' else 'OFFICIAL_DECLINED' end, 'match_officials', a.id::text, jsonb_build_object('match_id', a.match_id, 'reason', why));
  return public.my_official_schedule();
end;
$$;

create or replace function public.list_official_acceptances(p_match_id uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  return jsonb_build_object('can_manage', private.can_manage_match(p_match_id), 'items', coalesce((
    select jsonb_agg(jsonb_build_object('id', mo.id, 'user_id', mo.user_id, 'name', pr.display_name, 'role', mo.role, 'status', mo.status, 'invited_at', mo.invited_at,
             'accepted_at', mo.accepted_at, 'responded_at', mo.responded_at, 'acceptance_text', mo.acceptance_text, 'decline_reason', mo.decline_reason,
             'can_remind', mo.status = 'invited' and (mo.last_reminded_at is null or mo.last_reminded_at < now() - interval '12 hours'),
             'is_me', mo.user_id = uid,
             'conflicts', case when mo.status in ('invited', 'accepted') then private.official_conflicts(mo.user_id, p_match_id) else '[]'::jsonb end)
             order by mo.invited_at)
      from public.match_officials mo join public.profiles pr on pr.id = mo.user_id
     where mo.match_id = p_match_id and (private.can_manage_match(p_match_id) or mo.user_id = uid)), '[]'::jsonb));
end;
$$;

create or replace function public.remind_official(p_assignment_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.match_officials%rowtype; m public.matches%rowtype; uid uuid := (select auth.uid());
begin
  select * into a from public.match_officials where id = p_assignment_id for update;
  if not found then raise exception 'Assignment not found.' using errcode = '22023'; end if;
  if not private.can_manage_match(a.match_id) then raise exception 'Only the match creator or tournament organiser can send a reminder.' using errcode = '42501'; end if;
  if a.status <> 'invited' then raise exception 'This invitation is not waiting for an answer.' using errcode = '22023'; end if;
  if a.last_reminded_at is not null and a.last_reminded_at > now() - interval '12 hours' then raise exception 'A reminder was already sent in the last 12 hours.' using errcode = '22023'; end if;
  select * into m from public.matches where id = a.match_id;
  update public.match_officials set last_reminded_at = now() where id = a.id;
  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  values (a.user_id, 'official_invite', 'Reminder: please answer your match invitation',
          'You are invited as ' || replace(a.role, '_', ' ') || ' for ' || (select name from public.teams where id = m.team_a_id) || ' vs ' || (select name from public.teams where id = m.team_b_id) || '. Please accept or decline.',
          jsonb_build_object('match_id', a.match_id, 'assignment_id', a.id));
  return public.list_official_acceptances(a.match_id);
end;
$$;

-- ---------- #363 scorer handover ----------
create table if not exists public.scorer_handovers (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  from_user uuid not null,
  to_user uuid not null,
  requested_by uuid not null,
  reason text not null check (char_length(btrim(reason)) between 5 and 300),
  status text not null default 'requested' check (status in ('requested', 'authorised', 'completed', 'rejected', 'declined', 'cancelled')),
  authorised_by uuid,
  authorised_at timestamptz,
  decision_note text,
  responded_at timestamptz,
  completed_at timestamptz,
  snapshot jsonb,
  created_at timestamptz not null default now(),
  check (from_user <> to_user)
);
create unique index if not exists scorer_handovers_one_open on public.scorer_handovers (match_id) where status in ('requested', 'authorised');
create index if not exists scorer_handovers_match_idx on public.scorer_handovers (match_id, created_at desc);
alter table public.scorer_handovers enable row level security;

create or replace function private.scorer_handover_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.matches where id = old.match_id) then raise exception 'Handover history cannot be deleted.' using errcode = '42501'; end if;
    return old;
  end if;
  if old.status in ('completed', 'rejected', 'declined', 'cancelled') or new.match_id <> old.match_id or new.from_user <> old.from_user
     or new.to_user <> old.to_user or new.requested_by <> old.requested_by or new.reason <> old.reason or new.created_at <> old.created_at then
    raise exception 'Handover history cannot be changed.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.scorer_handover_guard() from public, anon, authenticated;
drop trigger if exists scorer_handover_immutable on public.scorer_handovers;
create trigger scorer_handover_immutable before update or delete on public.scorer_handovers for each row execute function private.scorer_handover_guard();

create or replace function public.list_scorer_handovers(p_match_id uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); mgr boolean; seen boolean;
begin
  if uid is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  mgr := private.can_manage_match(p_match_id);
  seen := mgr or private.is_match_official(p_match_id);
  return jsonb_build_object('can_manage', mgr,
    'current_scorers', coalesce((select jsonb_agg(jsonb_build_object('user_id', mo.user_id, 'name', pr.display_name, 'is_me', mo.user_id = uid))
                                   from public.match_officials mo join public.profiles pr on pr.id = mo.user_id
                                  where mo.match_id = p_match_id and mo.role = 'scorer' and mo.status = 'accepted'), '[]'::jsonb),
    'items', case when not seen then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('id', h.id, 'status', h.status, 'reason', h.reason, 'created_at', h.created_at, 'completed_at', h.completed_at,
               'decision_note', h.decision_note, 'snapshot', h.snapshot,
               'from_user', h.from_user, 'to_user', h.to_user,
               'from_name', (select display_name from public.profiles where id = h.from_user), 'to_name', (select display_name from public.profiles where id = h.to_user),
               'requested_by_name', (select display_name from public.profiles where id = h.requested_by),
               'authorised_by_name', (select display_name from public.profiles where id = h.authorised_by),
               'can_decide', mgr and h.status = 'requested',
               'can_respond', h.to_user = uid and h.status = 'authorised',
               'can_cancel', h.status in ('requested', 'authorised') and (mgr or h.requested_by = uid or h.from_user = uid)) order by h.created_at desc)
        from public.scorer_handovers h where h.match_id = p_match_id), '[]'::jsonb) end);
end;
$$;

create or replace function public.request_scorer_handover(p_match_id uuid, p_to_user uuid, p_reason text, p_from_user uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare m public.matches%rowtype; uid uuid := (select auth.uid()); mgr boolean; frm uuid; why text := btrim(coalesce(p_reason, '')); o public.official_profiles%rowtype; v_day date; conf jsonb; hid uuid; st text; n int;
begin
  if uid is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  select * into m from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found.' using errcode = '22023'; end if;
  if m.status in ('completed', 'abandoned', 'cancelled') then raise exception 'This match is already over.' using errcode = '22023'; end if;
  mgr := private.can_manage_match(p_match_id);
  if p_from_user is not null and not mgr and p_from_user <> uid then raise exception 'Only the organiser can hand over someone else''s scoring.' using errcode = '42501'; end if;
  frm := coalesce(p_from_user, case when exists (select 1 from public.match_officials where match_id = p_match_id and user_id = uid and role = 'scorer' and status = 'accepted') then uid end);
  if frm is null then
    select count(*), min(user_id::text)::uuid into n, frm from public.match_officials where match_id = p_match_id and role = 'scorer' and status = 'accepted';
    if n <> 1 or not mgr then raise exception 'Choose which scorer is handing over.' using errcode = '22023'; end if;
  end if;
  if not exists (select 1 from public.match_officials where match_id = p_match_id and user_id = frm and role = 'scorer' and status = 'accepted') then raise exception 'That person is not the assigned scorer.' using errcode = '22023'; end if;
  if not mgr and frm <> uid then raise exception 'Only the scorer or the organiser can ask for a handover.' using errcode = '42501'; end if;
  if p_to_user = frm then raise exception 'Choose a different person.' using errcode = '22023'; end if;
  if char_length(why) < 5 then raise exception 'Give a reason (at least 5 characters).' using errcode = '22023'; end if;
  select * into o from public.official_profiles where user_id = p_to_user;
  if not found or not o.is_active or not o.is_scorer then raise exception 'That person is not a registered scorer.' using errcode = '22023'; end if;
  if exists (select 1 from public.profiles where id = p_to_user and account_status in ('suspended', 'disabled')) then raise exception 'That account is suspended.' using errcode = '22023'; end if;
  v_day := (m.scheduled_at at time zone 'Asia/Kolkata')::date;
  if v_day is not null and exists (select 1 from public.official_unavailability u where u.user_id = p_to_user and u.day = v_day) then raise exception 'That scorer has marked this day as unavailable.' using errcode = '22023'; end if;
  conf := private.official_conflicts(p_to_user, p_match_id);
  if jsonb_array_length(conf) > 0 then raise exception 'That scorer is already booked for % at about the same time.', conf -> 0 ->> 'teams' using errcode = '22023'; end if;
  st := case when mgr then 'authorised' else 'requested' end;
  begin
    insert into public.scorer_handovers (match_id, from_user, to_user, requested_by, reason, status, authorised_by, authorised_at)
    values (p_match_id, frm, p_to_user, uid, why, st, case when mgr then uid end, case when mgr then now() end) returning id into hid;
  exception when unique_violation then raise exception 'A handover is already waiting for this match. Finish or cancel it first.' using errcode = '22023'; end;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, target_user_id, metadata)
  values (uid, 'SCORER_HANDOVER_REQUESTED', 'matches', p_match_id::text, p_to_user, jsonb_build_object('handover_id', hid, 'from_user', frm, 'reason', why, 'status', st));
  if st = 'requested' then
    insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
    select distinct r, 'scorer_handover', 'Scorer handover needs your approval', 'A scorer wants to hand over: ' || why, jsonb_build_object('match_id', p_match_id, 'handover_id', hid)
      from (select m.created_by as r union select t.owner_id from public.tournaments t where t.id = m.tournament_id) x where r is not null and r <> uid;
  else
    insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
    values (p_to_user, 'scorer_handover', 'Please take over scoring', 'You have been asked to take over scoring a match. Open the match to accept.', jsonb_build_object('match_id', p_match_id, 'handover_id', hid));
  end if;
  return public.list_scorer_handovers(p_match_id);
end;
$$;

create or replace function public.decide_scorer_handover(p_handover_id uuid, p_authorise boolean, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare h public.scorer_handovers%rowtype; uid uuid := (select auth.uid()); note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  select * into h from public.scorer_handovers where id = p_handover_id for update;
  if not found then raise exception 'Handover not found.' using errcode = '22023'; end if;
  if not private.can_manage_match(h.match_id) then raise exception 'Only the match creator or tournament organiser can decide.' using errcode = '42501'; end if;
  if h.status <> 'requested' then raise exception 'This request was already decided.' using errcode = '22023'; end if;
  if note is not null and char_length(note) > 300 then raise exception 'The note can be at most 300 characters.' using errcode = '22023'; end if;
  update public.scorer_handovers set status = case when p_authorise then 'authorised' else 'rejected' end, authorised_by = case when p_authorise then uid end,
         authorised_at = case when p_authorise then now() end, decision_note = note where id = h.id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, target_user_id, metadata)
  values (uid, case when p_authorise then 'SCORER_HANDOVER_AUTHORISED' else 'SCORER_HANDOVER_REJECTED' end, 'matches', h.match_id::text, h.to_user, jsonb_build_object('handover_id', h.id, 'note', note));
  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  select distinct r, 'scorer_handover', case when p_authorise then 'Scorer handover approved' else 'Scorer handover rejected' end,
         case when p_authorise then 'The organiser approved the handover. The new scorer must accept.' else 'The organiser rejected the handover.' end || coalesce(' (' || note || ')', ''),
         jsonb_build_object('match_id', h.match_id, 'handover_id', h.id)
    from (select h.requested_by as r union select h.from_user where p_authorise union select h.to_user where p_authorise) x where r is not null and r <> uid;
  return public.list_scorer_handovers(h.match_id);
end;
$$;

create or replace function public.respond_scorer_handover(p_handover_id uuid, p_accept boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare h public.scorer_handovers%rowtype; m public.matches%rowtype; uid uuid := (select auth.uid()); old_a public.match_officials%rowtype; i public.innings%rowtype; snap jsonb; conf jsonb;
begin
  select * into h from public.scorer_handovers where id = p_handover_id for update;
  if not found or h.to_user <> uid then raise exception 'Handover not found.' using errcode = '22023'; end if;
  if h.status <> 'authorised' then raise exception 'This handover is not waiting for you.' using errcode = '22023'; end if;
  select * into m from public.matches where id = h.match_id for update;
  if m.status in ('completed', 'abandoned', 'cancelled') then raise exception 'This match is already over.' using errcode = '22023'; end if;
  if not p_accept then
    update public.scorer_handovers set status = 'declined', responded_at = now() where id = h.id;
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, target_user_id, metadata) values (uid, 'SCORER_HANDOVER_DECLINED', 'matches', h.match_id::text, h.from_user, jsonb_build_object('handover_id', h.id));
    insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
    select distinct r, 'scorer_handover', 'Scorer handover declined', (select display_name from public.profiles where id = uid) || ' declined to take over scoring.', jsonb_build_object('match_id', h.match_id, 'handover_id', h.id)
      from (select h.requested_by as r union select h.authorised_by union select h.from_user) x where r is not null and r <> uid;
    return public.list_scorer_handovers(h.match_id);
  end if;
  select * into old_a from public.match_officials where match_id = h.match_id and user_id = h.from_user and role = 'scorer' and status = 'accepted' for update;
  if not found then raise exception 'The outgoing scorer is no longer assigned, so this handover cannot go ahead.' using errcode = '22023'; end if;
  conf := private.official_conflicts(uid, h.match_id);
  if jsonb_array_length(conf) > 0 then raise exception 'You are already booked for % at about the same time.', conf -> 0 ->> 'teams' using errcode = '22023'; end if;
  select * into i from public.innings where match_id = h.match_id and status = 'in_progress' order by innings_no desc limit 1;
  snap := case when found then jsonb_build_object('innings_no', i.innings_no, 'runs', i.runs, 'wickets', i.wickets, 'legal_balls', i.legal_balls,
                  'overs', (i.legal_balls / 6) || '.' || (i.legal_balls % 6)) else jsonb_build_object('innings_no', null) end;
  update public.match_officials set status = 'cancelled', responded_at = now() where id = old_a.id;
  insert into public.match_officials (match_id, user_id, role, status, invited_by, invited_at, responded_at, accepted_at, acceptance_text, fee, permissions)
  values (h.match_id, uid, 'scorer', 'accepted', h.authorised_by, now(), now(), now(),
          'I, ' || (select display_name from public.profiles where id = uid) || ', accept taking over scoring for this match from ' || (select display_name from public.profiles where id = h.from_user) || '.',
          old_a.fee, old_a.permissions)
  on conflict (match_id, user_id, role) do update set status = 'accepted', responded_at = now(), accepted_at = now(), permissions = excluded.permissions, invited_by = excluded.invited_by;
  if m.scorer_id = h.from_user then update public.matches set scorer_id = uid where id = m.id; end if;
  update public.scorer_handovers set status = 'completed', responded_at = now(), completed_at = now(), snapshot = snap where id = h.id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, target_user_id, metadata)
  values (uid, 'SCORER_HANDOVER_COMPLETED', 'matches', h.match_id::text, h.from_user, jsonb_build_object('handover_id', h.id, 'from_user', h.from_user, 'to_user', uid, 'at', snap));
  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  select distinct r, 'scorer_handover', 'Scoring handed over', (select display_name from public.profiles where id = uid) || ' is now the scorer.', jsonb_build_object('match_id', h.match_id, 'handover_id', h.id)
    from (select h.requested_by as r union select h.authorised_by union select h.from_user) x where r is not null and r <> uid;
  return public.list_scorer_handovers(h.match_id);
end;
$$;

create or replace function public.cancel_scorer_handover(p_handover_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare h public.scorer_handovers%rowtype; uid uuid := (select auth.uid());
begin
  select * into h from public.scorer_handovers where id = p_handover_id for update;
  if not found then raise exception 'Handover not found.' using errcode = '22023'; end if;
  if not (private.can_manage_match(h.match_id) or h.requested_by = uid or h.from_user = uid) then raise exception 'You cannot cancel this handover.' using errcode = '42501'; end if;
  if h.status not in ('requested', 'authorised') then raise exception 'This handover is already finished.' using errcode = '22023'; end if;
  update public.scorer_handovers set status = 'cancelled' where id = h.id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata) values (uid, 'SCORER_HANDOVER_CANCELLED', 'matches', h.match_id::text, jsonb_build_object('handover_id', h.id));
  return public.list_scorer_handovers(h.match_id);
end;
$$;

-- ---------- #365 ground conflicts ----------
create or replace function public.check_ground_conflicts(p_ground_id uuid, p_starts timestamptz, p_ends timestamptz, p_exclude_booking uuid default null, p_exclude_match uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare g public.grounds%rowtype; hard jsonb; soft jsonb; outside boolean := false; ls time; le time;
begin
  if (select auth.uid()) is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  select * into g from public.grounds where id = p_ground_id;
  if not found then raise exception 'Ground not found.' using errcode = '22023'; end if;
  if p_starts is null or p_ends is null or p_ends <= p_starts then raise exception 'Choose a start and an end time.' using errcode = '22023'; end if;
  select coalesce(jsonb_agg(x order by x ->> 'starts_at'), '[]'::jsonb) into hard from (
    select jsonb_build_object('type', case when b.kind = 'blocked' then 'blocked' else 'booking' end, 'label', case when b.kind = 'blocked' then 'Not available (blocked by the owner)' else 'Already booked' end,
             'starts_at', b.starts_at, 'ends_at', b.ends_at) x
      from public.ground_bookings b where b.ground_id = p_ground_id and b.status = 'confirmed' and b.id is distinct from p_exclude_booking and b.starts_at < p_ends and b.ends_at > p_starts
    union all
    select jsonb_build_object('type', 'match', 'label', 'Another match is scheduled', 'starts_at', m.scheduled_at, 'ends_at', m.scheduled_at + interval '4 hours', 'match_id', m.id)
      from public.matches m where m.ground_id = p_ground_id and m.id is distinct from p_exclude_match and m.status in ('scheduled', 'live') and m.scheduled_at is not null
       and m.scheduled_at < p_ends and m.scheduled_at + interval '4 hours' > p_starts
       and not exists (select 1 from public.ground_bookings bb where bb.match_id = m.id and bb.status = 'confirmed' and bb.id is not distinct from p_exclude_booking)) q;
  select coalesce(jsonb_agg(jsonb_build_object('type', 'request', 'label', 'Another request is waiting for this time', 'starts_at', b.starts_at, 'ends_at', b.ends_at) order by b.starts_at), '[]'::jsonb) into soft
    from public.ground_bookings b where b.ground_id = p_ground_id and b.status = 'requested' and b.id is distinct from p_exclude_booking and b.starts_at < p_ends and b.ends_at > p_starts;
  begin ls := g.open_time::time; le := g.close_time::time; exception when others then ls := null; le := null; end;
  if ls is not null and le is not null and le > ls then
    outside := (p_starts at time zone 'Asia/Kolkata')::time < ls or (p_ends at time zone 'Asia/Kolkata')::time > le or (p_starts at time zone 'Asia/Kolkata')::date <> (p_ends at time zone 'Asia/Kolkata')::date;
  end if;
  return jsonb_build_object('ok', jsonb_array_length(hard) = 0 and not outside, 'hard', hard, 'soft', soft, 'outside_hours', outside,
                            'open_time', g.open_time, 'close_time', g.close_time, 'booking_open', g.booking_open);
end;
$$;

create or replace function public.list_ground_conflicts(p_ground_id uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare res jsonb;
begin
  if not exists (select 1 from public.grounds where id = p_ground_id and (owner_id = (select auth.uid()) or private.is_admin())) then
    raise exception 'Only the ground owner can see this.' using errcode = '42501';
  end if;
  with items as (
    select 'b:' || b.id as k, b.starts_at as s, b.ends_at as e, case when b.kind = 'blocked' then 'Blocked slot' else coalesce(b.title, 'Booking') end as label, b.match_id as linked
      from public.ground_bookings b where b.ground_id = p_ground_id and b.status = 'confirmed' and b.ends_at > now()
    union all
    select 'm:' || m.id, m.scheduled_at, m.scheduled_at + interval '4 hours',
           'Match: ' || coalesce((select name from public.teams where id = m.team_a_id), '?') || ' vs ' || coalesce((select name from public.teams where id = m.team_b_id), '?'), m.id
      from public.matches m where m.ground_id = p_ground_id and m.status in ('scheduled', 'live') and m.scheduled_at is not null and m.scheduled_at + interval '4 hours' > now())
  select coalesce(jsonb_agg(jsonb_build_object('a', a.label, 'b', b.label, 'a_starts', a.s, 'a_ends', a.e, 'b_starts', b.s, 'b_ends', b.e) order by greatest(a.s, b.s)), '[]'::jsonb) into res
    from items a join items b on a.k < b.k and a.s < b.e and a.e > b.s
   where not (a.linked is not null and a.linked is not distinct from b.linked);
  return jsonb_build_object('conflicts', res);
end;
$$;

create or replace function public.check_match_ground_conflict(p_match_id uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare m public.matches%rowtype; r jsonb; uid uuid := (select auth.uid()); linked boolean;
begin
  if uid is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  select * into m from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found.' using errcode = '22023'; end if;
  if not (private.can_manage_match(p_match_id) or private.is_match_official(p_match_id)) then raise exception 'Only the match organisers and officials can see this.' using errcode = '42501'; end if;
  if m.ground_id is null or m.scheduled_at is null then return jsonb_build_object('has_ground', m.ground_id is not null, 'has_time', m.scheduled_at is not null, 'ok', true, 'hard', '[]'::jsonb, 'soft', '[]'::jsonb); end if;
  r := public.check_ground_conflicts(m.ground_id, m.scheduled_at, m.scheduled_at + interval '4 hours', null, p_match_id);
  linked := exists (select 1 from public.ground_bookings where match_id = p_match_id and status = 'confirmed');
  return r || jsonb_build_object('has_ground', true, 'has_time', true, 'has_confirmed_booking', linked);
end;
$$;

-- ---------- #366 inspection checklist ----------
alter table public.ground_inspections add column if not exists checklist jsonb;
alter table public.ground_inspections add column if not exists checklist_pass integer;
alter table public.ground_inspections add column if not exists checklist_total integer;
alter table public.ground_inspections add column if not exists critical_failed text[];

create or replace function private.checklist_template() returns jsonb language sql immutable set search_path = '' as $$
  select '[
   {"key":"pitch_dry","group":"pitch","label":"Pitch is dry and covers are off","critical":false},
   {"key":"pitch_no_cracks","group":"pitch","label":"No dangerous cracks or uneven bounce","critical":true},
   {"key":"creases_marked","group":"pitch","label":"Creases are clearly marked","critical":false},
   {"key":"stumps_bails","group":"pitch","label":"Stumps and bails are available","critical":false},
   {"key":"outfield_even","group":"outfield","label":"Outfield is even, no holes","critical":true},
   {"key":"grass_cut","group":"outfield","label":"Grass is cut","critical":false},
   {"key":"boundary_marked","group":"outfield","label":"Boundary rope or markers are in place","critical":false},
   {"key":"no_standing_water","group":"outfield","label":"No standing water or wet patches","critical":true},
   {"key":"drinking_water","group":"facilities","label":"Drinking water is available","critical":false},
   {"key":"toilets","group":"facilities","label":"Toilets are usable","critical":false},
   {"key":"changing_room","group":"facilities","label":"Changing room or shelter for teams","critical":false},
   {"key":"scoring_area","group":"facilities","label":"Place for the scorer with shade and a table","critical":false},
   {"key":"first_aid","group":"safety","label":"First-aid kit is available","critical":true},
   {"key":"no_hazards","group":"safety","label":"Stones, glass and wires are cleared","critical":true},
   {"key":"emergency_access","group":"safety","label":"An ambulance can reach the ground","critical":false},
   {"key":"spectators_clear","group":"safety","label":"Spectators are kept clear of the boundary","critical":false},
   {"key":"lighting_ok","group":"safety","label":"Lighting is working (if play may go past dusk)","critical":false}
  ]'::jsonb;
$$;
revoke all on function private.checklist_template() from public, anon;

create or replace function public.get_inspection_checklist_template() returns jsonb language sql stable security definer set search_path = '' as $$ select private.checklist_template(); $$;

create or replace function public.add_ground_checklist_inspection(p_ground_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); mid uuid := nullif(p->>'match_id', '')::uuid; ok boolean; t jsonb; it jsonb; v text; ans jsonb := '{}'::jsonb; entry jsonb; note text; total int := 0; pass int := 0;
        crit text[] := '{}'; gp record; rt int[4]; idx int; fit boolean; gname text; n_items int := 0;
begin
  if uid is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  select name into gname from public.grounds where id = p_ground_id;
  if not found then raise exception 'Ground not found.' using errcode = '22023'; end if;
  ok := exists (select 1 from public.grounds where id = p_ground_id and owner_id = uid) or private.is_admin()
        or (mid is not null and exists (select 1 from public.matches where id = mid and ground_id = p_ground_id) and (private.can_manage_match(mid) or private.is_match_official(mid)));
  if not ok then raise exception 'Only the ground owner, or the organiser / officials of a match at this ground, can file an inspection.' using errcode = '42501'; end if;
  if jsonb_typeof(p -> 'checklist') <> 'object' then raise exception 'Fill in the checklist.' using errcode = '22023'; end if;
  t := private.checklist_template();
  for it in select * from jsonb_array_elements(t) loop
    n_items := n_items + 1;
    entry := p -> 'checklist' -> (it ->> 'key');
    v := entry ->> 'ok';
    note := nullif(btrim(coalesce(entry ->> 'note', '')), '');
    if note is not null and char_length(note) > 200 then raise exception 'Item notes can be at most 200 characters.' using errcode = '22023'; end if;
    if v is null or v = 'na' then
      ans := ans || jsonb_build_object(it ->> 'key', jsonb_build_object('ok', null, 'note', note));
      continue;
    end if;
    if v not in ('true', 'false') then raise exception 'Each item must be yes, no or not applicable.' using errcode = '22023'; end if;
    total := total + 1;
    if v = 'true' then pass := pass + 1;
    elsif (it ->> 'critical')::boolean then
      if note is null or char_length(note) < 3 then raise exception 'Say what is wrong with: %', it ->> 'label' using errcode = '22023'; end if;
      crit := crit || (it ->> 'label');
    end if;
    ans := ans || jsonb_build_object(it ->> 'key', jsonb_build_object('ok', v = 'true', 'note', note));
  end loop;
  if total < ceil(n_items * 0.6) then raise exception 'Answer at least % of the % checks.', ceil(n_items * 0.6)::int, n_items using errcode = '22023'; end if;
  rt := array[null, null, null, null];
  idx := 0;
  for gp in select x.g as grp, count(*) filter (where ans -> (x.e ->> 'key') ->> 'ok' is not null) as answered, count(*) filter (where ans -> (x.e ->> 'key') ->> 'ok' = 'true') as passed
              from (select e ->> 'group' as g, e from jsonb_array_elements(t) e) x group by x.g loop
    idx := case gp.grp when 'pitch' then 1 when 'outfield' then 2 when 'facilities' then 3 else 4 end;
    if gp.answered > 0 then rt[idx] := 1 + round(4.0 * gp.passed / gp.answered)::int; end if;
  end loop;
  fit := coalesce((p->>'fit_for_play')::boolean, true) and array_length(crit, 1) is null;
  insert into public.ground_inspections (ground_id, match_id, inspector_id, inspected_on, pitch_rating, outfield_rating, facilities_rating, safety_rating, fit_for_play, notes, checklist, checklist_pass, checklist_total, critical_failed)
  values (p_ground_id, mid, uid, coalesce(nullif(p->>'inspected_on', '')::date, current_date), rt[1], rt[2], rt[3], rt[4], fit,
          nullif(btrim(coalesce(p->>'notes', '')), ''), ans, pass, total, case when array_length(crit, 1) is null then null else crit end);
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, 'GROUND_CHECKLIST_FILED', 'grounds', p_ground_id::text, jsonb_build_object('match_id', mid, 'pass', pass, 'total', total, 'fit', fit, 'critical_failed', crit));
  if not fit then
    insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
    select g.owner_id, 'ground_inspection', 'Ground marked unfit', g.name || ' was marked unfit for play in an inspection.' || coalesce(' Failed: ' || array_to_string(crit, ', '), ''), jsonb_build_object('ground_id', g.id)
      from public.grounds g where g.id = p_ground_id and g.owner_id <> uid;
  end if;
  return public.list_ground_inspections(p_ground_id);
end;
$$;

create or replace function public.list_ground_inspections(p_ground_id uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); own boolean;
begin
  own := uid is not null and (exists (select 1 from public.grounds where id = p_ground_id and owner_id = uid) or private.is_admin());
  return jsonb_build_object('can_see_details', own, 'items', coalesce((
    select jsonb_agg(jsonb_build_object('id', i.id, 'inspected_on', i.inspected_on, 'fit_for_play', i.fit_for_play, 'match_id', i.match_id,
             'pitch_rating', i.pitch_rating, 'outfield_rating', i.outfield_rating, 'facilities_rating', i.facilities_rating, 'safety_rating', i.safety_rating,
             'checklist_pass', i.checklist_pass, 'checklist_total', i.checklist_total, 'critical_failed', i.critical_failed,
             'inspector', (select display_name from public.profiles where id = i.inspector_id),
             'notes', case when own or i.inspector_id = uid then i.notes end,
             'checklist', case when own or i.inspector_id = uid then i.checklist end) order by i.inspected_on desc, i.created_at desc)
      from (select * from public.ground_inspections where ground_id = p_ground_id order by inspected_on desc, created_at desc limit 30) i), '[]'::jsonb));
end;
$$;

do $$
declare f text;
begin
  foreach f in array array['public.respond_official_invite(uuid,boolean,text)', 'public.list_official_acceptances(uuid)', 'public.remind_official(uuid)',
    'public.list_scorer_handovers(uuid)', 'public.request_scorer_handover(uuid,uuid,text,uuid)', 'public.decide_scorer_handover(uuid,boolean,text)',
    'public.respond_scorer_handover(uuid,boolean)', 'public.cancel_scorer_handover(uuid)', 'public.check_ground_conflicts(uuid,timestamptz,timestamptz,uuid,uuid)',
    'public.list_ground_conflicts(uuid)', 'public.check_match_ground_conflict(uuid)', 'public.get_inspection_checklist_template()',
    'public.add_ground_checklist_inspection(uuid,jsonb)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  execute 'grant execute on function public.list_ground_inspections(uuid) to anon, authenticated';
end $$;
