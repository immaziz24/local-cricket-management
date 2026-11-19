-- Batch 11: #358 local-rule override approval and audit, #359 bowling eligibility, #360 versioned ruleset snapshot at match start,
--           #382 ball-count and legal-delivery validator.

-- ---------- #360 rule history: kinds, snapshot at start, history cannot be changed ----------
alter table public.rule_versions add column if not exists kind text not null default 'edit' check (kind in ('edit', 'override', 'snapshot'));
alter table public.rule_versions add column if not exists tournament_version integer;

create or replace function private.rule_versions_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if (old.match_id is not null and exists (select 1 from public.matches where id = old.match_id))
       or (old.tournament_id is not null and exists (select 1 from public.tournaments where id = old.tournament_id)) then
      raise exception 'Rule history cannot be deleted.' using errcode = '42501';
    end if;
    return old;
  end if;
  raise exception 'Rule history cannot be changed.' using errcode = '42501';
end;
$$;
revoke all on function private.rule_versions_guard() from public, anon, authenticated;
drop trigger if exists rule_versions_immutable on public.rule_versions;
create trigger rule_versions_immutable before update or delete on public.rule_versions for each row execute function private.rule_versions_guard();

create or replace function private.matches_rules_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.status <> 'scheduled' and new.rules is distinct from old.rules then
    raise exception 'The rules of a match that has started cannot be changed.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.matches_rules_guard() from public, anon, authenticated;
drop trigger if exists matches_rules_frozen on public.matches;
create trigger matches_rules_frozen before update of rules on public.matches for each row execute function private.matches_rules_guard();

create table if not exists public.rule_override_requests (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  requested_by uuid not null,
  changes jsonb not null,
  reason text not null check (char_length(btrim(reason)) between 5 and 300),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'expired')),
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now()
);
create index if not exists rule_override_requests_match_idx on public.rule_override_requests (match_id, created_at desc);
alter table public.rule_override_requests enable row level security;

create or replace function private.rule_override_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.matches where id = old.match_id) then raise exception 'Override history cannot be deleted.' using errcode = '42501'; end if;
    return old;
  end if;
  if old.status <> 'pending' or new.status not in ('approved', 'rejected', 'expired') or new.match_id <> old.match_id
     or new.requested_by <> old.requested_by or new.changes <> old.changes or new.reason <> old.reason or new.created_at <> old.created_at then
    raise exception 'Override history cannot be changed.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.rule_override_guard() from public, anon, authenticated;
drop trigger if exists rule_override_immutable on public.rule_override_requests;
create trigger rule_override_immutable before update or delete on public.rule_override_requests for each row execute function private.rule_override_guard();

-- the snapshot taken when the match starts is now a numbered, permanent entry in the rule history
create or replace function private.freeze_match_rules() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'live' and old.status = 'scheduled' then
    new.rules := private.effective_rules(new.id);
    insert into public.rule_versions (match_id, version, rules, note, changed_by, kind, tournament_version)
    values (new.id, coalesce((select max(version) from public.rule_versions where match_id = new.id), 0) + 1, new.rules,
            'Frozen when the match started', (select auth.uid()), 'snapshot',
            (select max(version) from public.rule_versions where tournament_id = new.tournament_id));
    update public.rule_override_requests set status = 'expired', decided_at = now(), decision_note = 'The match started before a decision.'
     where match_id = new.id and status = 'pending';
  end if;
  return new;
end;
$$;

-- matches that started before this change: record the rules they were frozen with
insert into public.rule_versions (match_id, version, rules, note, kind)
select m.id, coalesce((select max(v.version) from public.rule_versions v where v.match_id = m.id), 0) + 1, m.rules,
       'Rules in force when the match started (recorded afterwards)', 'snapshot'
  from public.matches m
 where m.status <> 'scheduled' and m.rules is not null
   and not exists (select 1 from public.rule_versions v where v.match_id = m.id and v.kind = 'snapshot');

-- ---------- #358 override requests ----------
create or replace function private.can_request_rule_override(p_match_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.matches m where m.id = p_match_id and m.tournament_id is not null and m.status = 'scheduled'
           and ((select auth.uid()) is not null) and (
             m.created_by = (select auth.uid()) or private.is_match_official(m.id)
             or exists (select 1 from public.teams t where t.id in (m.team_a_id, m.team_b_id) and t.owner_id = (select auth.uid()))));
$$;
revoke all on function private.can_request_rule_override(uuid) from public, anon, authenticated;

create or replace function public.request_rule_override(p_match_id uuid, p_changes jsonb, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare m public.matches%rowtype; uid uuid := (select auth.uid()); clean jsonb := private.clean_rules(p_changes); rid uuid; why text := btrim(coalesce(p_reason, ''));
begin
  if uid is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  select * into m from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found.' using errcode = '22023'; end if;
  if m.tournament_id is null then raise exception 'Friendly matches can change their own rules directly; no approval is needed.' using errcode = '22023'; end if;
  if m.status <> 'scheduled' then raise exception 'Rules are fixed once the match has started.' using errcode = '22023'; end if;
  if not private.can_request_rule_override(p_match_id) then raise exception 'Only a team owner, the match creator or a match official can ask for a rule change.' using errcode = '42501'; end if;
  if clean = '{}'::jsonb or clean = jsonb_build_object('notes', '{}'::jsonb) then raise exception 'Choose at least one rule to change.' using errcode = '22023'; end if;
  if char_length(why) < 5 then raise exception 'Give a reason (at least 5 characters).' using errcode = '22023'; end if;
  if (select count(*) from public.rule_override_requests where match_id = p_match_id and status = 'pending') >= 5 then raise exception 'Too many requests are waiting. Ask the organiser to decide them first.' using errcode = '22023'; end if;
  insert into public.rule_override_requests (match_id, requested_by, changes, reason) values (p_match_id, uid, clean, why) returning id into rid;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, 'MATCH_RULE_OVERRIDE_REQUESTED', 'matches', p_match_id::text, jsonb_build_object('request_id', rid, 'changes', clean, 'reason', why));
  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  select distinct u, 'rule_override', 'Rule change waiting for approval', 'A local rule change was requested for a match: ' || why, jsonb_build_object('match_id', p_match_id, 'request_id', rid)
    from (select t.owner_id as u from public.tournaments t where t.id = m.tournament_id
          union select tm.owner_id from public.teams tm where tm.id in (m.team_a_id, m.team_b_id)) x
   where u is not null and u <> uid;
  return public.list_rule_overrides(p_match_id);
end;
$$;

create or replace function public.decide_rule_override(p_request_id uuid, p_approve boolean, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.rule_override_requests%rowtype; m public.matches%rowtype; uid uuid := (select auth.uid()); note text := nullif(btrim(coalesce(p_note, '')), '');
        before_rules jsonb; merged jsonb; merged_notes jsonb; ver int;
begin
  select * into r from public.rule_override_requests where id = p_request_id for update;
  if not found then raise exception 'Request not found.' using errcode = '22023'; end if;
  select * into m from public.matches where id = r.match_id for update;
  if m.tournament_id is null then raise exception 'This match has no tournament.' using errcode = '22023'; end if;
  perform private.require_tournament_organiser(m.tournament_id);
  if r.status <> 'pending' then raise exception 'This request was already decided.' using errcode = '22023'; end if;
  if note is not null and char_length(note) > 300 then raise exception 'The note can be at most 300 characters.' using errcode = '22023'; end if;
  if p_approve then
    if m.status <> 'scheduled' then raise exception 'The match has already started; rules are fixed.' using errcode = '22023'; end if;
    before_rules := private.effective_rules(m.id);
    merged_notes := coalesce(m.rules -> 'notes', '{}'::jsonb) || coalesce(r.changes -> 'notes', '{}'::jsonb);
    merged := (coalesce(m.rules, '{}'::jsonb) - 'notes') || (r.changes - 'notes');
    if merged_notes <> '{}'::jsonb then merged := merged || jsonb_build_object('notes', merged_notes); end if;
    update public.matches set rules = merged where id = m.id;
    select coalesce(max(version), 0) + 1 into ver from public.rule_versions where match_id = m.id;
    insert into public.rule_versions (match_id, version, rules, note, changed_by, kind, tournament_version)
    values (m.id, ver, merged, 'Local override approved: ' || r.reason, uid, 'override', (select max(version) from public.rule_versions where tournament_id = m.tournament_id));
    update public.rule_override_requests set status = 'approved', decided_by = uid, decided_at = now(), decision_note = note where id = r.id;
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
    values (uid, 'MATCH_RULE_OVERRIDE_APPROVED', 'matches', m.id::text,
            jsonb_build_object('request_id', r.id, 'version', ver, 'requested_by', r.requested_by, 'changes', r.changes, 'before', before_rules, 'reason', r.reason, 'note', note));
  else
    update public.rule_override_requests set status = 'rejected', decided_by = uid, decided_at = now(), decision_note = note where id = r.id;
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
    values (uid, 'MATCH_RULE_OVERRIDE_REJECTED', 'matches', m.id::text, jsonb_build_object('request_id', r.id, 'requested_by', r.requested_by, 'changes', r.changes, 'reason', r.reason, 'note', note));
  end if;
  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  select distinct u, 'rule_override', case when p_approve then 'Local rule change approved' else 'Local rule change rejected' end,
         case when p_approve then 'The rule change for the match was approved: ' else 'The rule change for the match was rejected: ' end || r.reason || coalesce(' (' || note || ')', ''),
         jsonb_build_object('match_id', m.id, 'request_id', r.id)
    from (select r.requested_by as u union select tm.owner_id from public.teams tm where p_approve and tm.id in (m.team_a_id, m.team_b_id)) x
   where u is not null and u <> uid;
  return public.list_rule_overrides(m.id);
end;
$$;

create or replace function public.list_rule_overrides(p_match_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare m public.matches%rowtype; uid uuid := (select auth.uid()); is_org boolean := false; can_see boolean;
begin
  select * into m from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found.' using errcode = '22023'; end if;
  if m.tournament_id is not null then
    is_org := exists (select 1 from public.tournaments t where t.id = m.tournament_id and t.owner_id = uid)
      or exists (select 1 from public.user_role_assignments r where r.user_id = uid and r.role = 'organiser' and r.scope_type = 'tournament' and r.scope_id = m.tournament_id and r.is_active)
      or private.is_admin();
  end if;
  can_see := uid is not null and (is_org or m.created_by = uid or private.is_match_official(p_match_id)
             or exists (select 1 from public.teams t where t.id in (m.team_a_id, m.team_b_id) and t.owner_id = uid));
  return jsonb_build_object(
    'tournament_match', m.tournament_id is not null, 'locked', m.status <> 'scheduled',
    'can_request', private.can_request_rule_override(p_match_id), 'can_decide', is_org and m.status = 'scheduled',
    'effective', case when m.status = 'scheduled' then private.effective_rules(p_match_id) else m.rules end,
    'items', case when not can_see then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('id', o.id, 'status', o.status, 'changes', o.changes, 'reason', o.reason, 'created_at', o.created_at,
               'decided_at', o.decided_at, 'decision_note', o.decision_note,
               'requested_by', (select display_name from public.profiles where id = o.requested_by),
               'decided_by', (select display_name from public.profiles where id = o.decided_by)) order by o.created_at desc)
        from public.rule_override_requests o where o.match_id = p_match_id), '[]'::jsonb) end);
end;
$$;

-- ---------- #359 who may bowl ----------
create or replace function public.get_bowler_eligibility(p_match_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare m public.matches%rowtype; i public.innings%rowtype; lim int; in_over int; res jsonb;
begin
  if (select auth.uid()) is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  if not private.is_match_official(p_match_id) then raise exception 'Only the match scorers and organisers can see this.' using errcode = '42501'; end if;
  select * into m from public.matches where id = p_match_id;
  select * into i from public.innings where match_id = p_match_id and status = 'in_progress' order by innings_no desc limit 1;
  if not found then return jsonb_build_object('innings_in_progress', false, 'bowlers', '[]'::jsonb); end if;
  lim := (coalesce(m.rules, private.effective_rules(m.id)) ->> 'max_overs_per_bowler')::int;
  select count(*)::int into in_over from public.balls where innings_id = i.id and over_no = i.legal_balls / 6;
  select coalesce(jsonb_agg(x order by x ->> 'name'), '[]'::jsonb) into res from (
    select jsonb_build_object('player_id', p.id, 'name', p.display_name,
             'legal_balls', coalesce(b.lb, 0), 'overs', (coalesce(b.lb, 0) / 6) || '.' || (coalesce(b.lb, 0) % 6),
             'is_current', p.id = i.bowler_id, 'bowled_last_over', p.id = i.last_over_bowler_id,
             'replaced_out', exists (select 1 from public.bowler_replacements r where r.innings_id = i.id and r.original_id = p.id),
             'quota_reached', lim is not null and coalesce(b.lb, 0) >= lim * 6,
             'can_start_over', p.id is distinct from i.last_over_bowler_id and p.id is distinct from i.bowler_id
                 and not exists (select 1 from public.bowler_replacements r where r.innings_id = i.id and r.original_id = p.id)
                 and not (lim is not null and coalesce(b.lb, 0) >= lim * 6),
             'can_replace_mid_over', i.bowler_id is not null and p.id <> i.bowler_id and p.id is distinct from i.last_over_bowler_id
                 and not exists (select 1 from public.bowler_replacements r where r.innings_id = i.id and r.original_id = p.id)
                 and not (lim is not null and coalesce(b.lb, 0) >= lim * 6),
             'reason', case when p.id = i.bowler_id then 'Bowling now'
                            when exists (select 1 from public.bowler_replacements r where r.innings_id = i.id and r.original_id = p.id) then 'Replaced after an injury; cannot bowl again in this innings'
                            when p.id = i.last_over_bowler_id then 'Bowled the previous over'
                            when lim is not null and coalesce(b.lb, 0) >= lim * 6 then 'Has bowled the maximum ' || lim || ' over(s)'
                            else null end) as x
      from public.match_players mp join public.players p on p.id = mp.player_id
      left join (select bowler_id, count(*) filter (where is_legal)::int as lb from public.balls where innings_id = i.id group by bowler_id) b on b.bowler_id = p.id
     where mp.match_id = p_match_id and mp.team_id = i.bowling_team_id and mp.role = 'playing') q;
  return jsonb_build_object('innings_in_progress', true, 'innings_no', i.innings_no, 'max_overs_per_bowler', lim, 'balls_in_over', in_over % 6,
                            'over_in_progress', i.bowler_id is not null, 'bowlers', res);
end;
$$;

-- ---------- #382 ball order and legal-delivery check ----------
create or replace function public.validate_ball_sequence(p_match_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare issues jsonb := '[]'::jsonb; r record; squad int;
begin
  for r in
    with b as (
      select b.*, i.innings_no,
             coalesce(sum(case when b.is_legal then 1 else 0 end) over (partition by b.innings_id order by b.seq rows between unbounded preceding and 1 preceding), 0)::int as legal_before,
             lag(b.seq) over (partition by b.innings_id order by b.seq) as prev_seq
        from public.balls b join public.innings i on i.id = b.innings_id where b.match_id = p_match_id)
    select innings_no, seq, 'seq_gap' as code, 'Ball numbers jump from ' || prev_seq || ' to ' || seq || '.' as msg from b where prev_seq is not null and seq <> prev_seq + 1
    union all
    select innings_no, seq, 'over_mismatch', 'Ball is recorded as ' || over_no || '.' || ball_in_over || ' but the legal-ball count says ' || (legal_before / 6) || '.' || ((legal_before % 6) + case when is_legal then 1 else 0 end) || '.'
      from b where over_no <> legal_before / 6 or ball_in_over <> (legal_before % 6) + case when is_legal then 1 else 0 end
    union all
    select innings_no, seq, 'illegal_flag', 'A wide or no-ball is marked as a legal delivery.' from b where extra_type in ('wide', 'no_ball') and is_legal
    union all
    select innings_no, seq, 'illegal_flag', 'A normal ball, bye or leg-bye is not marked as a legal delivery.' from b where (extra_type is null or extra_type in ('bye', 'leg_bye')) and not is_legal
    union all
    select innings_no, seq, 'same_batter_both_ends', 'The striker and non-striker are the same player.' from b where striker_id = non_striker_id
    union all
    select innings_no, seq, 'bowler_is_batter', 'The bowler is also one of the batters.' from b where bowler_id in (striker_id, non_striker_id)
    order by 1, 2
  loop
    issues := issues || jsonb_build_object('innings_no', r.innings_no, 'seq', r.seq, 'code', r.code, 'message', r.msg);
  end loop;

  for r in
    select i.innings_no, min(b.seq) as seq, b.over_no from public.balls b join public.innings i on i.id = b.innings_id
     where b.match_id = p_match_id group by i.innings_no, i.id, b.over_no
    having count(distinct b.bowler_id) > 1
       and not exists (select 1 from public.bowler_replacements br where br.innings_id = i.id and br.over_no = b.over_no)
  loop
    issues := issues || jsonb_build_object('innings_no', r.innings_no, 'seq', r.seq, 'code', 'bowler_changed_mid_over', 'message', 'Over ' || (r.over_no + 1) || ' has more than one bowler and no injury replacement was recorded.');
  end loop;

  for r in
    select i.innings_no, min(b2.seq) as seq, b1.over_no + 1 as over_no
      from (select distinct innings_id, over_no, bowler_id from public.balls where match_id = p_match_id) b1
      join (select distinct innings_id, over_no, bowler_id, seq from public.balls where match_id = p_match_id) b2
        on b2.innings_id = b1.innings_id and b2.over_no = b1.over_no + 1 and b2.bowler_id = b1.bowler_id
      join public.innings i on i.id = b1.innings_id
     group by i.innings_no, b1.over_no, b1.innings_id
  loop
    select count(*)::int into squad from public.match_players mp join public.innings i2 on i2.match_id = p_match_id and i2.innings_no = r.innings_no
     where mp.match_id = p_match_id and mp.team_id = i2.bowling_team_id and mp.role = 'playing';
    if squad > 1 then
      issues := issues || jsonb_build_object('innings_no', r.innings_no, 'seq', r.seq, 'code', 'same_bowler_two_overs', 'message', 'The same bowler bowled over ' || (r.over_no - 1 + 1) || ' and over ' || (r.over_no + 1) || '.');
    end if;
  end loop;

  for r in
    select distinct on (i.innings_no, d.dismissed_id) i.innings_no, l.seq, d.dismissed_id
      from public.balls d join public.innings i on i.id = d.innings_id
      join public.balls l on l.innings_id = d.innings_id and l.seq > d.seq and (l.striker_id = d.dismissed_id or l.non_striker_id = d.dismissed_id)
     where d.match_id = p_match_id and d.is_wicket and d.dismissed_id is not null and d.wicket_type is distinct from 'retired_hurt'
     order by i.innings_no, d.dismissed_id, l.seq
  loop
    issues := issues || jsonb_build_object('innings_no', r.innings_no, 'seq', r.seq, 'code', 'batter_after_out',
      'message', coalesce((select display_name from public.players where id = r.dismissed_id), 'A batter') || ' batted after being out.');
  end loop;

  for r in
    select i.innings_no, i.wickets, (select count(*) from public.match_players mp where mp.match_id = p_match_id and mp.team_id = i.batting_team_id and mp.role in ('playing', 'replaced')) as squad_size
      from public.innings i where i.match_id = p_match_id and not i.is_super_over
  loop
    if r.squad_size > 0 and r.wickets > r.squad_size - 1 then
      issues := issues || jsonb_build_object('innings_no', r.innings_no, 'seq', null, 'code', 'too_many_wickets', 'message', r.wickets || ' wickets fell but the side has only ' || r.squad_size || ' players.');
    end if;
  end loop;

  return jsonb_build_object('match_id', p_match_id, 'ok', jsonb_array_length(issues) = 0, 'issues', issues,
                            'balls_checked', (select count(*) from public.balls where match_id = p_match_id), 'checked_at', now());
end;
$$;

do $$
declare f text;
begin
  foreach f in array array['public.request_rule_override(uuid,jsonb,text)', 'public.decide_rule_override(uuid,boolean,text)', 'public.get_bowler_eligibility(uuid)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  execute 'grant execute on function public.list_rule_overrides(uuid) to anon, authenticated';
  execute 'grant execute on function public.validate_ball_sequence(uuid) to anon, authenticated';
end $$;
