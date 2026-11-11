-- Phase 4 / Category Q – Team punctuality, attendance and match delay management (#299–#310).
-- Owner-confirmed rules (blueprint section 5): three alternative methods with configurable rates, only one active
-- per match, the late team and benefiting opponent are identified and an authorised organiser / umpire must approve
-- before anything affects the match. These are local rules published in the playing conditions – not ICC sanctions.

-- ---------- Settings live in the playing conditions ----------
create or replace function private.default_rules()
returns jsonb language sql immutable set search_path = ''
as $$
  select jsonb_build_object(
    'wide_runs', 1, 'no_ball_runs', 1, 'free_hit', true, 'lbw', true, 'byes', true, 'leg_byes', true,
    'max_overs_per_bowler', null, 'retire_at', null,
    'powerplay_overs', 0, 'fielders_outside_powerplay', 2, 'fielders_outside', 5,
    'boundary_size_m', null, 'follow_on_lead', null,
    -- Category Q (late arrival)
    'late_method', null, 'late_grace_min', 0, 'late_step_min', 10, 'late_overs_per_step', 1, 'late_runs_per_step', 5,
    'late_field_step_min', 5, 'late_field_max_outside', 2, 'late_approver', 'organiser', 'late_repeat_threshold', 3,
    'notes', jsonb_build_object('batting', '', 'bowling', '', 'boundary', '', 'fielding', '', 'ground', '', 'substitutes', '', 'general', '')
  );
$$;

create or replace function private.clean_rules(p jsonb)
returns jsonb language plpgsql immutable set search_path = ''
as $$
declare d jsonb := private.default_rules(); r jsonb := '{}'::jsonb; k text; v jsonb; n jsonb := '{}'::jsonb; nk text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then return '{}'::jsonb; end if;
  for k, v in select * from jsonb_each(p) loop
    if not (d ? k) then continue; end if;
    if k = 'notes' then
      if jsonb_typeof(v) = 'object' then
        for nk in select jsonb_object_keys(d->'notes') loop
          if v ? nk and jsonb_typeof(v->nk) = 'string' then
            if pg_catalog.length(v->>nk) > 1000 then raise exception 'Each rules note can be at most 1000 characters.' using errcode = '22023'; end if;
            n := n || jsonb_build_object(nk, pg_catalog.btrim(v->>nk));
          end if;
        end loop;
        r := r || jsonb_build_object('notes', n);
      end if;
    elsif k in ('free_hit','lbw','byes','leg_byes') then
      if jsonb_typeof(v) <> 'boolean' then raise exception 'Rule % must be yes or no.', k using errcode = '22023'; end if;
      r := r || jsonb_build_object(k, v);
    elsif k = 'late_method' then
      if jsonb_typeof(v) = 'null' or v->>0 = '' then r := r || jsonb_build_object(k, null);
      elsif v->>0 in ('none','overs_deduction','fielding_restriction','penalty_runs') then r := r || jsonb_build_object(k, v->>0);
      else raise exception 'Unknown late-arrival method.' using errcode = '22023'; end if;
    elsif k = 'late_approver' then
      if v->>0 not in ('organiser','umpire') then raise exception 'Choose who approves late-arrival penalties.' using errcode = '22023'; end if;
      r := r || jsonb_build_object(k, v->>0);
    else
      if jsonb_typeof(v) = 'null' or (jsonb_typeof(v) = 'string' and v->>0 = '') then
        if k in ('max_overs_per_bowler','retire_at','boundary_size_m','follow_on_lead') then r := r || jsonb_build_object(k, null); end if;
        continue;
      end if;
      begin
        v := to_jsonb((v #>> '{}')::int);
      exception when others then raise exception 'Rule % must be a whole number.', k using errcode = '22023';
      end;
      if (k in ('wide_runs','no_ball_runs') and (v::int < 0 or v::int > 2))
         or (k = 'max_overs_per_bowler' and (v::int < 1 or v::int > 50))
         or (k = 'retire_at' and (v::int < 5 or v::int > 200))
         or (k = 'powerplay_overs' and (v::int < 0 or v::int > 50))
         or (k in ('fielders_outside_powerplay','fielders_outside') and (v::int < 0 or v::int > 10))
         or (k = 'boundary_size_m' and (v::int < 10 or v::int > 120))
         or (k = 'follow_on_lead' and (v::int < 1 or v::int > 500))
         or (k = 'late_grace_min' and (v::int < 0 or v::int > 60))
         or (k in ('late_step_min','late_field_step_min') and (v::int < 1 or v::int > 60))
         or (k = 'late_overs_per_step' and (v::int < 1 or v::int > 10))
         or (k = 'late_runs_per_step' and (v::int < 1 or v::int > 50))
         or (k = 'late_field_max_outside' and (v::int < 0 or v::int > 9))
         or (k = 'late_repeat_threshold' and (v::int < 2 or v::int > 10)) then
        raise exception 'Rule % is out of range.', k using errcode = '22023';
      end if;
      r := r || jsonb_build_object(k, v);
    end if;
  end loop;
  return r;
end;
$$;

-- Late-arrival settings for a match (#306: exactly one method). Falls back to the tournament's penalty policy.
create or replace function private.late_config(p_match_id uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select r || jsonb_build_object('late_method', coalesce(nullif(r->>'late_method', ''),
              (select t.penalty_policy from public.tournaments t where t.id = m.tournament_id), 'none'))
    from public.matches m,
         lateral (select private.default_rules() || (coalesce(case when m.status <> 'scheduled' then m.rules end, private.effective_rules(m.id)) - 'notes') as r) x
   where m.id = p_match_id;
$$;

-- ---------- Tables ----------
alter table public.matches add column if not exists late_effects jsonb not null default '{}'::jsonb;

create table if not exists public.match_arrivals (
  match_id uuid not null references public.matches(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  arrived_at timestamptz not null,
  minutes_late int not null default 0,
  players_present int,
  note text check (note is null or pg_catalog.length(note) <= 300),
  checked_in_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (match_id, team_id)
);
create index if not exists match_arrivals_team_idx on public.match_arrivals (team_id);
create index if not exists match_arrivals_checked_in_by_idx on public.match_arrivals (checked_in_by);

create table if not exists public.match_attendance (
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  status text not null check (status in ('present','late','absent')),
  arrived_at timestamptz,
  marked_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (match_id, player_id)
);
create index if not exists match_attendance_team_idx on public.match_attendance (team_id);
create index if not exists match_attendance_player_idx on public.match_attendance (player_id);
create index if not exists match_attendance_marked_by_idx on public.match_attendance (marked_by);

create table if not exists public.late_penalties (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  late_team_id uuid not null references public.teams(id) on delete cascade,
  beneficiary_team_id uuid not null references public.teams(id) on delete cascade,
  minutes_late int not null check (minutes_late between 0 and 600),
  method text not null check (method in ('overs_deduction','fielding_restriction','penalty_runs')),
  rate jsonb not null,
  value int not null check (value >= 0),
  status text not null default 'proposed' check (status in ('proposed','approved','rejected','appealed','waived')),
  applied boolean not null default false,
  auto_created boolean not null default false,
  proposed_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  appeal_reason text check (appeal_reason is null or pg_catalog.length(appeal_reason) <= 1000),
  appealed_by uuid references auth.users(id) on delete set null,
  decision_note text check (decision_note is null or pg_catalog.length(decision_note) <= 1000),
  fine_amount numeric(10,2) check (fine_amount is null or fine_amount >= 0),
  fine_paid boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists late_penalties_match_idx on public.late_penalties (match_id);
create index if not exists late_penalties_late_team_idx on public.late_penalties (late_team_id, created_at desc);
create index if not exists late_penalties_beneficiary_idx on public.late_penalties (beneficiary_team_id);
create index if not exists late_penalties_proposed_by_idx on public.late_penalties (proposed_by);
create index if not exists late_penalties_approved_by_idx on public.late_penalties (approved_by);
create index if not exists late_penalties_appealed_by_idx on public.late_penalties (appealed_by);

create table if not exists public.team_player_fines (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  match_id uuid references public.matches(id) on delete set null,
  amount numeric(10,2) not null check (amount > 0 and amount <= 100000),
  reason text not null check (pg_catalog.length(reason) between 2 and 200),
  paid boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists team_player_fines_team_idx on public.team_player_fines (team_id);
create index if not exists team_player_fines_player_idx on public.team_player_fines (player_id);
create index if not exists team_player_fines_match_idx on public.team_player_fines (match_id);
create index if not exists team_player_fines_created_by_idx on public.team_player_fines (created_by);

alter table public.match_arrivals enable row level security;
alter table public.match_attendance enable row level security;
alter table public.late_penalties enable row level security;
alter table public.team_player_fines enable row level security;
revoke all on public.match_arrivals, public.match_attendance, public.late_penalties, public.team_player_fines from anon, authenticated;

-- ---------- Permission helpers ----------
-- Who may check a team in / mark attendance: that team's owner, the match owner, or an accepted match official.
create or replace function private.can_check_in(p_match_id uuid, p_team_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.can_manage_match(p_match_id) or private.is_match_official(p_match_id)
      or exists (select 1 from public.teams t where t.id = p_team_id and t.owner_id = (select auth.uid())
                 and not exists (select 1 from public.profiles where id = (select auth.uid()) and account_status in ('suspended','disabled')));
$$;

-- #307 Who may approve: the match / tournament owner, or (when the rules allow) an accepted umpire / referee.
create or replace function private.can_approve_late(p_match_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.can_manage_match(p_match_id)
      or ((private.late_config(p_match_id)->>'late_approver') = 'umpire'
          and exists (select 1 from public.match_officials mo where mo.match_id = p_match_id and mo.user_id = (select auth.uid())
                      and mo.status = 'accepted' and mo.role in ('umpire','third_umpire','match_referee')));
$$;

-- #302 Delay calculator: penalty size for a number of minutes late under the match's rules.
create or replace function private.late_penalty_value(cfg jsonb, p_minutes int, p_overs int)
returns int language sql immutable set search_path = ''
as $$
  select case
    when p_minutes <= coalesce((cfg->>'late_grace_min')::int, 0) then 0
    when cfg->>'late_method' = 'overs_deduction' then
      least((p_minutes / greatest((cfg->>'late_step_min')::int, 1)) * coalesce((cfg->>'late_overs_per_step')::int, 1), greatest(coalesce(p_overs, 20) - 1, 0))
    when cfg->>'late_method' = 'penalty_runs' then
      (p_minutes / greatest((cfg->>'late_step_min')::int, 1)) * coalesce((cfg->>'late_runs_per_step')::int, 5)
    when cfg->>'late_method' = 'fielding_restriction' then
      least(p_minutes / greatest((cfg->>'late_field_step_min')::int, 1), coalesce(p_overs, 20))
    else 0 end;
$$;

-- ---------- Effects on the match (applied only after approval) ----------
-- Penalty runs to a team: added to its innings, or kept until it bats (uses pending_penalty).
create or replace function private.give_penalty_runs(p_match_id uuid, p_team_id uuid, p_runs int)
returns void language plpgsql security definer set search_path = ''
as $$
declare i public.innings%rowtype; cur public.innings%rowtype;
begin
  if p_runs = 0 then return; end if;
  select * into i from public.innings where match_id = p_match_id and batting_team_id = p_team_id and not is_super_over order by innings_no desc limit 1 for update;
  if found then
    update public.innings set penalty_runs = greatest(penalty_runs + p_runs, 0), runs = greatest(runs + p_runs, 0), extras = greatest(extras + p_runs, 0) where id = i.id;
    select * into cur from public.innings where match_id = p_match_id and status = 'in_progress' and batting_team_id <> p_team_id and not is_super_over order by innings_no desc limit 1;
    if found and cur.target is not null and i.status = 'completed' then
      update public.innings set target = greatest(target + p_runs, 1) where id = cur.id;
    end if;
    perform private.sync_match_score(p_match_id);
  else
    update public.matches set pending_penalty = pending_penalty || jsonb_build_object(p_team_id::text, greatest(coalesce((pending_penalty->>p_team_id::text)::int, 0) + p_runs, 0))
     where id = p_match_id;
  end if;
end;
$$;

-- Apply (p_sign = 1) or undo (p_sign = -1) an approved penalty.
create or replace function private.apply_late_penalty(p_id uuid, p_sign int)
returns void language plpgsql security definer set search_path = ''
as $$
declare lp public.late_penalties%rowtype; m public.matches%rowtype; i public.innings%rowtype; cut int; eff jsonb;
begin
  select * into lp from public.late_penalties where id = p_id for update;
  select * into m from public.matches where id = lp.match_id for update;
  if lp.method = 'penalty_runs' then
    perform private.give_penalty_runs(lp.match_id, lp.beneficiary_team_id, p_sign * lp.value);
  elsif lp.method = 'overs_deduction' then
    if coalesce(m.match_type, 'limited_overs') = 'two_innings' then raise exception 'Overs deduction is only for limited-overs matches.' using errcode = '22023'; end if;
    cut := greatest(coalesce((m.late_effects #>> array['overs_cut', lp.late_team_id::text])::int, 0) + p_sign * lp.value, 0);
    select * into i from public.innings where match_id = lp.match_id and batting_team_id = lp.late_team_id and not is_super_over order by innings_no desc limit 1 for update;
    if found then
      if i.status = 'completed' and p_sign > 0 then raise exception 'The late team has already batted – choose a different penalty or waive it.' using errcode = '22023'; end if;
      if i.status <> 'completed' then
        if p_sign > 0 and i.legal_balls >= greatest(m.overs_per_innings - cut, 1) * 6 then raise exception 'The late team has already faced more overs than the cut would allow.' using errcode = '22023'; end if;
        update public.innings set overs_limit = case when cut = 0 then null else greatest(m.overs_per_innings - cut, 1) end where id = i.id;
      end if;
    end if;
    eff := jsonb_set(m.late_effects, '{overs_cut}', coalesce(m.late_effects->'overs_cut', '{}'::jsonb) || jsonb_build_object(lp.late_team_id::text, cut));
    update public.matches set late_effects = eff where id = m.id;
  else
    eff := jsonb_set(m.late_effects, '{field_restriction}', coalesce(m.late_effects->'field_restriction', '{}'::jsonb) ||
             jsonb_build_object(lp.late_team_id::text, case when p_sign > 0 then jsonb_build_object('overs', lp.value, 'max_outside', (lp.rate->>'late_field_max_outside')::int) else null end));
    update public.matches set late_effects = jsonb_strip_nulls(eff) where id = m.id;
  end if;
  update public.late_penalties set applied = (p_sign > 0) where id = p_id;
end;
$$;

-- When the late team's innings starts, its overs are cut.
create or replace function private.apply_overs_cut()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare m public.matches%rowtype; cut int;
begin
  if new.is_super_over then return new; end if;
  select * into m from public.matches where id = new.match_id;
  cut := coalesce((m.late_effects #>> array['overs_cut', new.batting_team_id::text])::int, 0);
  if cut > 0 and coalesce(m.match_type, 'limited_overs') <> 'two_innings' and m.overs_per_innings is not null then
    new.overs_limit := greatest(m.overs_per_innings - cut, 1);
  end if;
  return new;
end;
$$;
drop trigger if exists innings_overs_cut on public.innings;
create trigger innings_overs_cut before insert on public.innings for each row execute function private.apply_overs_cut();

-- ---------- #299 Check-in (and automatic proposal, #302 #310) ----------
create or replace function public.check_in_team(p_match_id uuid, p_team_id uuid, p_arrived_at timestamptz default null, p_players int default null, p_note text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare m public.matches%rowtype; uid uuid := (select auth.uid()); v_at timestamptz := coalesce(p_arrived_at, now()); late int; cfg jsonb; val int; other uuid; pid uuid;
begin
  if uid is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  select * into m from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found.' using errcode = '22023'; end if;
  if p_team_id not in (m.team_a_id, m.team_b_id) then raise exception 'Choose one of the two teams.' using errcode = '22023'; end if;
  if not private.can_check_in(p_match_id, p_team_id) then raise exception 'Only the team owner, the match owner or a match official can check this team in.' using errcode = '42501'; end if;
  if m.status in ('completed','abandoned') then raise exception 'This match is over.' using errcode = '22023'; end if;
  if v_at > now() + interval '5 minutes' then raise exception 'The arrival time cannot be in the future.' using errcode = '22023'; end if;
  if p_players is not null and (p_players < 0 or p_players > 30) then raise exception 'Enter how many players arrived.' using errcode = '22023'; end if;
  late := case when m.scheduled_at is null then 0 else greatest(floor(extract(epoch from (v_at - m.scheduled_at)) / 60)::int, 0) end;
  insert into public.match_arrivals (match_id, team_id, arrived_at, minutes_late, players_present, note, checked_in_by)
  values (p_match_id, p_team_id, v_at, late, p_players, nullif(pg_catalog.btrim(coalesce(p_note, '')), ''), uid)
  on conflict (match_id, team_id) do update set arrived_at = excluded.arrived_at, minutes_late = excluded.minutes_late,
     players_present = excluded.players_present, note = excluded.note, checked_in_by = excluded.checked_in_by;
  other := case when p_team_id = m.team_a_id then m.team_b_id else m.team_a_id end;
  -- tell the other team
  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  select t.owner_id, 'team_arrival', 'Team arrived',
         (select name from public.teams where id = p_team_id) || ' checked in' || case when late > 0 then ' (' || late || ' min late)' else ' on time' end || '.',
         jsonb_build_object('match_id', p_match_id)
    from public.teams t where t.id = other and t.owner_id is not null and t.owner_id <> uid;
  -- automatic proposal when late and a method is set
  cfg := private.late_config(p_match_id);
  val := private.late_penalty_value(cfg, late, m.overs_per_innings);
  if cfg->>'late_method' <> 'none' and val > 0
     and not exists (select 1 from public.late_penalties where match_id = p_match_id and late_team_id = p_team_id and status in ('proposed','approved','appealed')) then
    insert into public.late_penalties (match_id, late_team_id, beneficiary_team_id, minutes_late, method, rate, value, auto_created, proposed_by)
    values (p_match_id, p_team_id, other, late, cfg->>'late_method', cfg, val, true, uid) returning id into pid;
    insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
    select distinct u, 'late_penalty', 'Late-arrival penalty to approve',
           (select name from public.teams where id = p_team_id) || ' arrived ' || late || ' min late. Proposed: ' ||
           case cfg->>'late_method' when 'overs_deduction' then val || ' over(s) cut' when 'penalty_runs' then val || ' runs to the opponent'
                else val || ' over(s) of fielding restriction' end || '.',
           jsonb_build_object('match_id', p_match_id, 'penalty_id', pid)
      from (select m.created_by as u union select owner_id from public.tournaments where id = m.tournament_id
            union select owner_id from public.teams where id in (m.team_a_id, m.team_b_id)) x
     where u is not null and u <> uid;
  end if;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, 'TEAM_CHECKED_IN', 'matches', p_match_id::text, jsonb_build_object('team_id', p_team_id, 'minutes_late', late));
  return public.get_match_readiness(p_match_id);
end;
$$;

-- #300 Player attendance.
create or replace function public.set_attendance(p_match_id uuid, p_player_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare m public.matches%rowtype; t uuid;
begin
  select * into m from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found.' using errcode = '22023'; end if;
  select team_id into t from public.match_players where match_id = p_match_id and player_id = p_player_id limit 1;
  if t is null then select tm.team_id into t from public.team_members tm where tm.player_id = p_player_id and tm.team_id in (m.team_a_id, m.team_b_id) limit 1; end if;
  if t is null then raise exception 'That player is not in either squad.' using errcode = '22023'; end if;
  if not private.can_check_in(p_match_id, t) then raise exception 'Only the team owner, the match owner or a match official can mark attendance.' using errcode = '42501'; end if;
  if p_status is null then
    delete from public.match_attendance where match_id = p_match_id and player_id = p_player_id;
  elsif p_status not in ('present','late','absent') then raise exception 'Unknown status.' using errcode = '22023';
  else
    insert into public.match_attendance (match_id, player_id, team_id, status, arrived_at, marked_by, updated_at)
    values (p_match_id, p_player_id, t, p_status, case when p_status <> 'absent' then now() end, (select auth.uid()), now())
    on conflict (match_id, player_id) do update set status = excluded.status,
      arrived_at = case when excluded.status = 'absent' then null else coalesce(public.match_attendance.arrived_at, excluded.arrived_at) end,
      marked_by = excluded.marked_by, updated_at = now();
  end if;
  return public.get_match_readiness(p_match_id);
end;
$$;

-- #301 Match readiness, with arrivals, attendance and the late-arrival penalty (#302–#309).
create or replace function public.get_match_readiness(p_match_id uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  with m as (select * from public.matches where id = p_match_id),
  cfg as (select private.late_config(p_match_id) as c),
  per as (select coalesce(m.players_per_side, (select players_per_side from public.tournaments where id = m.tournament_id), 11) as n from m),
  teams as (select t.* from public.teams t, m where t.id in (m.team_a_id, m.team_b_id))
  select jsonb_build_object(
    'match_status', (select status from m), 'scheduled_at', (select scheduled_at from m),
    'rules', (select jsonb_build_object('method', c->>'late_method', 'grace', c->'late_grace_min', 'step', c->'late_step_min', 'overs_per_step', c->'late_overs_per_step',
                                        'runs_per_step', c->'late_runs_per_step', 'field_step', c->'late_field_step_min', 'field_max_outside', c->'late_field_max_outside',
                                        'approver', c->>'late_approver') from cfg),
    'can_manage', private.can_manage_match(p_match_id),
    'can_approve', private.can_approve_late(p_match_id),
    'late_effects', (select late_effects from m),
    'teams', coalesce((select jsonb_agg(jsonb_build_object(
        'team_id', t.id, 'name', t.name, 'can_check_in', private.can_check_in(p_match_id, t.id),
        'is_owner', t.owner_id = (select auth.uid()),
        'arrival', (select jsonb_build_object('arrived_at', a.arrived_at, 'minutes_late', a.minutes_late, 'players_present', a.players_present, 'note', a.note,
                                              'by', (select display_name from public.profiles where id = a.checked_in_by))
                      from public.match_arrivals a where a.match_id = p_match_id and a.team_id = t.id),
        'lineup', (select count(*) from public.match_players mp where mp.match_id = p_match_id and mp.team_id = t.id and mp.role = 'playing'),
        'players', coalesce((select jsonb_agg(jsonb_build_object('player_id', p.id, 'name', p.display_name,
                       'status', (select status from public.match_attendance ma where ma.match_id = p_match_id and ma.player_id = p.id),
                       'in_xi', exists (select 1 from public.match_players mp where mp.match_id = p_match_id and mp.player_id = p.id and mp.role = 'playing'))
                       order by p.display_name)
                    from public.players p where p.id in (select tm.player_id from public.team_members tm where tm.team_id = t.id
                                                         union select mp.player_id from public.match_players mp where mp.match_id = p_match_id and mp.team_id = t.id)), '[]'::jsonb),
        'present', (select count(*) from public.match_attendance ma where ma.match_id = p_match_id and ma.team_id = t.id and ma.status in ('present','late')),
        'offences', (select count(*) from public.late_penalties lp where lp.late_team_id = t.id and lp.status in ('approved','appealed') and lp.created_at > now() - interval '365 days')
      ) order by t.name) from teams t), '[]'::jsonb),
    'checklist', jsonb_build_array(
      jsonb_build_object('item', 'Both teams checked in', 'ok', (select count(*) from public.match_arrivals where match_id = p_match_id) = 2),
      jsonb_build_object('item', 'Enough players present', 'ok', (select bool_and(c >= (select n from per)) from (
          select greatest((select count(*) from public.match_attendance ma where ma.match_id = p_match_id and ma.team_id = t.id and ma.status in ('present','late')),
                          coalesce((select players_present from public.match_arrivals a where a.match_id = p_match_id and a.team_id = t.id), 0)) as c from teams t) x)),
      jsonb_build_object('item', 'Playing XIs picked', 'ok', (select bool_and(c >= 2) from (select (select count(*) from public.match_players mp where mp.match_id = p_match_id and mp.team_id = t.id and mp.role = 'playing') as c from teams t) y)),
      jsonb_build_object('item', 'Scorer confirmed', 'ok', exists (select 1 from m where m.scorer_id is not null)
                                                           or exists (select 1 from public.match_officials where match_id = p_match_id and role = 'scorer' and status = 'accepted')),
      jsonb_build_object('item', 'Umpire confirmed', 'ok', exists (select 1 from public.match_officials where match_id = p_match_id and role = 'umpire' and status = 'accepted'), 'optional', true),
      jsonb_build_object('item', 'Ground set', 'ok', exists (select 1 from m where m.ground_id is not null or m.venue is not null), 'optional', true),
      jsonb_build_object('item', 'No penalty waiting for approval', 'ok', not exists (select 1 from public.late_penalties where match_id = p_match_id and status in ('proposed','appealed')))
    ),
    'penalties', coalesce((select jsonb_agg(jsonb_build_object(
        'id', lp.id, 'late_team_id', lp.late_team_id, 'late_team', (select name from public.teams where id = lp.late_team_id),
        'beneficiary', (select name from public.teams where id = lp.beneficiary_team_id), 'minutes_late', lp.minutes_late, 'method', lp.method,
        'value', lp.value, 'status', lp.status, 'applied', lp.applied, 'auto_created', lp.auto_created, 'appeal_reason', lp.appeal_reason, 'decision_note', lp.decision_note,
        'approved_by', (select display_name from public.profiles where id = lp.approved_by), 'approved_at', lp.approved_at,
        'fine_amount', lp.fine_amount, 'fine_paid', lp.fine_paid, 'created_at', lp.created_at,
        'can_appeal', lp.status in ('proposed','approved') and exists (select 1 from public.teams t where t.id = lp.late_team_id and t.owner_id = (select auth.uid())),
        'repeat_offender', (select count(*) from public.late_penalties x where x.late_team_id = lp.late_team_id and x.status in ('approved','appealed') and x.created_at > now() - interval '365 days')
                            >= coalesce((lp.rate->>'late_repeat_threshold')::int, 3)) order by lp.created_at desc)
      from public.late_penalties lp where lp.match_id = p_match_id), '[]'::jsonb)
  );
$$;

-- ---------- #303–#307 Propose / approve / reject / waive ----------
create or replace function public.propose_late_penalty(p_match_id uuid, p_late_team_id uuid, p_minutes int default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare m public.matches%rowtype; cfg jsonb; mins int; val int; other uuid; uid uuid := (select auth.uid());
begin
  select * into m from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found.' using errcode = '22023'; end if;
  if not (private.can_manage_match(p_match_id) or private.is_match_official(p_match_id)) then raise exception 'Only the match owner or a match official can propose a penalty.' using errcode = '42501'; end if;
  if p_late_team_id not in (m.team_a_id, m.team_b_id) then raise exception 'Choose the late team.' using errcode = '22023'; end if;
  if m.status in ('completed','abandoned') then raise exception 'This match is over.' using errcode = '22023'; end if;
  cfg := private.late_config(p_match_id);
  if cfg->>'late_method' = 'none' then raise exception 'This match has no late-arrival penalty. Set one in the playing conditions first.' using errcode = '22023'; end if;
  mins := coalesce(p_minutes, (select minutes_late from public.match_arrivals where match_id = p_match_id and team_id = p_late_team_id));
  if mins is null then raise exception 'Check the team in first, or enter the minutes late.' using errcode = '22023'; end if;
  if mins < 0 or mins > 600 then raise exception 'Minutes late must be between 0 and 600.' using errcode = '22023'; end if;
  val := private.late_penalty_value(cfg, mins, m.overs_per_innings);
  if val <= 0 then raise exception 'At % minutes late, the rules give no penalty.', mins using errcode = '22023'; end if;
  if exists (select 1 from public.late_penalties where match_id = p_match_id and late_team_id = p_late_team_id and status in ('proposed','approved','appealed')) then
    raise exception 'This team already has an active late-arrival penalty in this match.' using errcode = '22023';
  end if;
  other := case when p_late_team_id = m.team_a_id then m.team_b_id else m.team_a_id end;
  insert into public.late_penalties (match_id, late_team_id, beneficiary_team_id, minutes_late, method, rate, value, proposed_by)
  values (p_match_id, p_late_team_id, other, mins, cfg->>'late_method', cfg, val, uid);
  return public.get_match_readiness(p_match_id);
end;
$$;

create or replace function public.decide_late_penalty(p_penalty_id uuid, p_action text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare lp public.late_penalties%rowtype; m public.matches%rowtype; uid uuid := (select auth.uid()); note text := nullif(pg_catalog.btrim(coalesce(p_note, '')), '');
        cnt int; what text; late_name text; ben_name text;
begin
  select * into lp from public.late_penalties where id = p_penalty_id for update;
  if not found then raise exception 'Penalty not found.' using errcode = '22023'; end if;
  select * into m from public.matches where id = lp.match_id;
  if p_action not in ('approve','reject','waive','uphold') then raise exception 'Unknown action.' using errcode = '22023'; end if;
  if not private.can_approve_late(lp.match_id) then raise exception 'Only the organiser (or an umpire, if the rules allow) can decide late-arrival penalties.' using errcode = '42501'; end if;
  if note is not null and pg_catalog.length(note) > 1000 then raise exception 'The note can be at most 1000 characters.' using errcode = '22023'; end if;
  late_name := (select name from public.teams where id = lp.late_team_id); ben_name := (select name from public.teams where id = lp.beneficiary_team_id);
  what := case lp.method when 'overs_deduction' then lp.value || ' over(s) cut from ' || late_name || '''s innings'
                         when 'penalty_runs' then lp.value || ' penalty runs to ' || ben_name
                         else late_name || ' may have only ' || (lp.rate->>'late_field_max_outside') || ' fielders outside the circle for the first ' || lp.value || ' over(s) they bowl' end;

  if p_action = 'approve' then
    if lp.status <> 'proposed' then raise exception 'Only proposed penalties can be approved.' using errcode = '22023'; end if;
    if m.status in ('completed','abandoned') then raise exception 'This match is over.' using errcode = '22023'; end if;
    perform private.apply_late_penalty(lp.id, 1);
    update public.late_penalties set status = 'approved', approved_by = uid, approved_at = now(), decision_note = coalesce(note, decision_note) where id = lp.id;
    insert into public.match_reports (match_id, kind, team_id, title, details, action, penalty_runs, created_by)
    values (lp.match_id, 'decision', lp.late_team_id, 'Late-arrival penalty: ' || late_name,
            late_name || ' arrived ' || lp.minutes_late || ' min late. ' || what || '. (Local tournament rule.)',
            case when lp.method = 'penalty_runs' then 'penalty_runs' else 'warning' end, case when lp.method = 'penalty_runs' then lp.value end, uid);
    -- #308 repeat offenders
    select count(*) into cnt from public.late_penalties where late_team_id = lp.late_team_id and status in ('approved','appealed') and created_at > now() - interval '365 days';
    insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
    select distinct u, 'late_penalty', 'Late-arrival penalty approved',
           what || '.' || case when cnt >= coalesce((lp.rate->>'late_repeat_threshold')::int, 3) then ' ' || late_name || ' now has ' || cnt || ' late penalties this year (repeat offender).' else '' end,
           jsonb_build_object('match_id', lp.match_id, 'penalty_id', lp.id)
      from (select owner_id as u from public.teams where id in (lp.late_team_id, lp.beneficiary_team_id)
            union select owner_id from public.tournaments where id = m.tournament_id union select m.created_by) x
     where u is not null and u <> uid;
  elsif p_action = 'reject' then
    if lp.status <> 'proposed' then raise exception 'Only proposed penalties can be rejected.' using errcode = '22023'; end if;
    update public.late_penalties set status = 'rejected', approved_by = uid, approved_at = now(), decision_note = note where id = lp.id;
  elsif p_action = 'waive' then
    -- #309 exemption, or an appeal accepted
    if lp.status not in ('proposed','approved','appealed') then raise exception 'This penalty is already closed.' using errcode = '22023'; end if;
    if note is null then raise exception 'Give the reason for the exemption.' using errcode = '22023'; end if;
    if lp.applied then perform private.apply_late_penalty(lp.id, -1); end if;
    update public.late_penalties set status = 'waived', decision_note = note, approved_by = uid, approved_at = now() where id = lp.id;
    if lp.applied then
      insert into public.match_reports (match_id, kind, team_id, title, details, created_by)
      values (lp.match_id, 'decision', lp.late_team_id, 'Late-arrival penalty removed', 'Penalty on ' || late_name || ' was waived: ' || note, uid);
    end if;
  else -- uphold an appeal
    if lp.status <> 'appealed' then raise exception 'Only appealed penalties can be upheld.' using errcode = '22023'; end if;
    update public.late_penalties set status = case when lp.applied then 'approved' else 'proposed' end, decision_note = coalesce(note, 'Appeal rejected') where id = lp.id;
  end if;
  if p_action in ('reject','waive','uphold') then
    insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
    select distinct u, 'late_penalty', 'Late-arrival penalty ' || case p_action when 'reject' then 'rejected' when 'waive' then 'waived' else '– appeal turned down' end,
           late_name || coalesce(': ' || note, ''), jsonb_build_object('match_id', lp.match_id, 'penalty_id', lp.id)
      from (select owner_id as u from public.teams where id in (lp.late_team_id, lp.beneficiary_team_id)) x where u is not null and u <> uid;
  end if;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, 'LATE_PENALTY_' || upper(p_action), 'late_penalties', lp.id::text, jsonb_build_object('match_id', lp.match_id));
  return public.get_match_readiness(lp.match_id);
end;
$$;

-- #309 Appeal (late team's owner).
create or replace function public.appeal_late_penalty(p_penalty_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare lp public.late_penalties%rowtype; m public.matches%rowtype; uid uuid := (select auth.uid()); reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
begin
  select * into lp from public.late_penalties where id = p_penalty_id for update;
  if not found then raise exception 'Penalty not found.' using errcode = '22023'; end if;
  if not exists (select 1 from public.teams where id = lp.late_team_id and owner_id = uid) then raise exception 'Only the late team''s owner can appeal.' using errcode = '42501'; end if;
  if lp.status not in ('proposed','approved') then raise exception 'This penalty cannot be appealed now.' using errcode = '22023'; end if;
  if reason is null or pg_catalog.length(reason) > 1000 then raise exception 'Give the reason for the appeal (up to 1000 characters).' using errcode = '22023'; end if;
  update public.late_penalties set status = 'appealed', appeal_reason = reason, appealed_by = uid where id = lp.id;
  select * into m from public.matches where id = lp.match_id;
  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  select distinct u, 'late_penalty', 'Penalty appeal', (select name from public.teams where id = lp.late_team_id) || ' appealed: ' || reason,
         jsonb_build_object('match_id', lp.match_id, 'penalty_id', lp.id)
    from (select m.created_by as u union select owner_id from public.tournaments where id = m.tournament_id) x where u is not null and u <> uid;
  return public.get_match_readiness(lp.match_id);
end;
$$;

-- #308 #309 Fine for the late team (recorded by the organiser).
create or replace function public.set_late_fine(p_penalty_id uuid, p_amount numeric, p_paid boolean)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare lp public.late_penalties%rowtype;
begin
  select * into lp from public.late_penalties where id = p_penalty_id for update;
  if not found then raise exception 'Penalty not found.' using errcode = '22023'; end if;
  if not private.can_manage_match(lp.match_id) then raise exception 'Only the match owner or organiser can record fines.' using errcode = '42501'; end if;
  if p_amount is not null and (p_amount < 0 or p_amount > 100000) then raise exception 'Enter a sensible amount.' using errcode = '22023'; end if;
  update public.late_penalties set fine_amount = p_amount, fine_paid = coalesce(p_paid, false) where id = lp.id;
  if p_amount is not null and not lp.fine_paid and coalesce(p_paid, false) = false and lp.fine_amount is distinct from p_amount then
    insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
    select owner_id, 'late_fine', 'Late-arrival fine', (select name from public.teams where id = lp.late_team_id) || ' was fined ₹' || p_amount || ' for arriving late.', jsonb_build_object('match_id', lp.match_id)
      from public.teams where id = lp.late_team_id and owner_id is not null;
  end if;
  return public.get_match_readiness(lp.match_id);
end;
$$;

-- #308 Team owner fines a player (e.g. for arriving late).
create or replace function public.add_player_fine(p_team_id uuid, p_player_id uuid, p_amount numeric, p_reason text, p_match_id uuid default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare reason text := pg_catalog.btrim(coalesce(p_reason, ''));
begin
  perform private.require_team_owner(p_team_id);
  if not exists (select 1 from public.team_members where team_id = p_team_id and player_id = p_player_id) then raise exception 'That player is not in your squad.' using errcode = '22023'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 100000 then raise exception 'Enter the fine amount.' using errcode = '22023'; end if;
  if pg_catalog.length(reason) < 2 or pg_catalog.length(reason) > 200 then raise exception 'Give a short reason.' using errcode = '22023'; end if;
  if p_match_id is not null and not exists (select 1 from public.matches where id = p_match_id and p_team_id in (team_a_id, team_b_id)) then raise exception 'Choose one of your team''s matches.' using errcode = '22023'; end if;
  insert into public.team_player_fines (team_id, player_id, match_id, amount, reason, created_by) values (p_team_id, p_player_id, p_match_id, p_amount, reason, (select auth.uid()));
  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  select p.profile_id, 'player_fine', 'Team fine', (select name from public.teams where id = p_team_id) || ' fined you ₹' || p_amount || ': ' || reason, jsonb_build_object('team_id', p_team_id)
    from public.players p where p.id = p_player_id and p.profile_id is not null and p.profile_id <> (select auth.uid());
  return public.get_team_punctuality(p_team_id);
end;
$$;

create or replace function public.set_player_fine_paid(p_fine_id uuid, p_paid boolean)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare f public.team_player_fines%rowtype;
begin
  select * into f from public.team_player_fines where id = p_fine_id for update;
  if not found then raise exception 'Fine not found.' using errcode = '22023'; end if;
  perform private.require_team_owner(f.team_id);
  update public.team_player_fines set paid = coalesce(p_paid, false) where id = f.id;
  return public.get_team_punctuality(f.team_id);
end;
$$;

-- #308 #310 A team's punctuality record. Fines are shown only to the team owner (and each player their own).
create or replace function public.get_team_punctuality(p_team_id uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  with own as (select exists (select 1 from public.teams where id = p_team_id and owner_id = (select auth.uid())) as v),
  arr as (select a.*, m.team_a_id, m.team_b_id, m.scheduled_at, m.tournament_id from public.match_arrivals a join public.matches m on m.id = a.match_id where a.team_id = p_team_id)
  select jsonb_build_object(
    'is_owner', (select v from own),
    'checked_in', (select count(*) from arr),
    'on_time', (select count(*) from arr where minutes_late <= 5),
    'average_late', (select round(avg(minutes_late) filter (where minutes_late > 5), 0) from arr),
    'penalties', (select count(*) from public.late_penalties where late_team_id = p_team_id and status in ('approved','appealed')),
    'penalties_last_year', (select count(*) from public.late_penalties where late_team_id = p_team_id and status in ('approved','appealed') and created_at > now() - interval '365 days'),
    'history', coalesce((select jsonb_agg(jsonb_build_object('match_id', match_id, 'scheduled_at', scheduled_at, 'arrived_at', arrived_at, 'minutes_late', minutes_late,
                 'opponent', (select name from public.teams where id = case when team_a_id = p_team_id then team_b_id else team_a_id end),
                 'penalty', (select jsonb_build_object('method', lp.method, 'value', lp.value, 'status', lp.status, 'fine', lp.fine_amount, 'fine_paid', lp.fine_paid)
                               from public.late_penalties lp where lp.match_id = arr.match_id and lp.late_team_id = p_team_id order by lp.created_at desc limit 1))
                 order by scheduled_at desc nulls last) from (select * from arr order by scheduled_at desc nulls last limit 30) arr), '[]'::jsonb),
    'fines', case when (select v from own) then coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'player', p.display_name, 'player_id', f.player_id, 'amount', f.amount,
                 'reason', f.reason, 'paid', f.paid, 'created_at', f.created_at) order by f.created_at desc)
               from public.team_player_fines f join public.players p on p.id = f.player_id where f.team_id = p_team_id), '[]'::jsonb) end
  );
$$;

-- Scorer sees an active fielding restriction for the late team (#304).
create or replace function public.get_scoring_rules(p_match_id uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  with m as (select * from public.matches where id = p_match_id),
  r as (select coalesce(case when m.rules is not null and m.status <> 'scheduled'
                             then private.default_rules() || (m.rules - 'notes') else private.effective_rules(m.id) end, private.default_rules()) as rules from m),
  i as (select * from public.innings where match_id = p_match_id and status = 'in_progress' order by innings_no desc limit 1),
  lastb as (select b.* from public.balls b join i on i.id = b.innings_id order by b.seq desc limit 1)
  select jsonb_build_object(
    'rules', (select rules from r),
    'free_hit_next', coalesce((select (rules->>'free_hit')::boolean from r), true)
                     and coalesce((select extra_type = 'no_ball' or (free_hit and extra_type in ('wide','no_ball')) from lastb), false),
    'powerplay', (select (i.legal_balls / 6) < coalesce((rules->>'powerplay_overs')::int, 0) from i, r),
    'bowler_overs', coalesce((select jsonb_object_agg(bowler_id, legal) from (
                       select b.bowler_id, count(*) filter (where b.is_legal)::int as legal from public.balls b join i on i.id = b.innings_id
                        where b.bowler_id is not null group by b.bowler_id) x), '{}'::jsonb),
    'late_restriction', (select case when (m.late_effects #>> array['field_restriction', i.bowling_team_id::text, 'overs']) is not null
                                          and (i.legal_balls / 6) < (m.late_effects #>> array['field_restriction', i.bowling_team_id::text, 'overs'])::int and not i.is_super_over
                                     then jsonb_build_object('overs', (m.late_effects #>> array['field_restriction', i.bowling_team_id::text, 'overs'])::int,
                                                             'max_outside', (m.late_effects #>> array['field_restriction', i.bowling_team_id::text, 'max_outside'])::int,
                                                             'team', (select name from public.teams where id = i.bowling_team_id)) end
                         from m, i)
  );
$$;

revoke all on function private.late_config(uuid) from public, anon, authenticated;
revoke all on function private.can_check_in(uuid, uuid) from public, anon, authenticated;
revoke all on function private.can_approve_late(uuid) from public, anon, authenticated;
revoke all on function private.late_penalty_value(jsonb, int, int) from public, anon, authenticated;
revoke all on function private.give_penalty_runs(uuid, uuid, int) from public, anon, authenticated;
revoke all on function private.apply_late_penalty(uuid, int) from public, anon, authenticated;
revoke all on function private.apply_overs_cut() from public, anon, authenticated;
revoke all on function public.check_in_team(uuid, uuid, timestamptz, int, text) from public, anon;
revoke all on function public.set_attendance(uuid, uuid, text) from public, anon;
revoke all on function public.get_match_readiness(uuid) from public;
revoke all on function public.propose_late_penalty(uuid, uuid, int) from public, anon;
revoke all on function public.decide_late_penalty(uuid, text, text) from public, anon;
revoke all on function public.appeal_late_penalty(uuid, text) from public, anon;
revoke all on function public.set_late_fine(uuid, numeric, boolean) from public, anon;
revoke all on function public.add_player_fine(uuid, uuid, numeric, text, uuid) from public, anon;
revoke all on function public.set_player_fine_paid(uuid, boolean) from public, anon;
revoke all on function public.get_team_punctuality(uuid) from public;
grant execute on function public.check_in_team(uuid, uuid, timestamptz, int, text) to authenticated;
grant execute on function public.set_attendance(uuid, uuid, text) to authenticated;
grant execute on function public.get_match_readiness(uuid) to anon, authenticated;
grant execute on function public.propose_late_penalty(uuid, uuid, int) to authenticated;
grant execute on function public.decide_late_penalty(uuid, text, text) to authenticated;
grant execute on function public.appeal_late_penalty(uuid, text) to authenticated;
grant execute on function public.set_late_fine(uuid, numeric, boolean) to authenticated;
grant execute on function public.add_player_fine(uuid, uuid, numeric, text, uuid) to authenticated;
grant execute on function public.set_player_fine_paid(uuid, boolean) to authenticated;
grant execute on function public.get_team_punctuality(uuid) to anon, authenticated;
