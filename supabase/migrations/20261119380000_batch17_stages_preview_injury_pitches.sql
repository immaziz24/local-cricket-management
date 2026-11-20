-- Batch 17: #325 stage dependency builder, #330 stage freeze / reopen, #324 correction impact preview,
--           #357 mid-over injury substitution rule, #364 multi-pitch venue scheduling.

-- ---------------------------------------------------------------- stages (#325 #330)
create table if not exists public.tournament_stages (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 60),
  sort_order int not null default 0,
  status text not null default 'open' check (status in ('open', 'frozen')),
  frozen_at timestamptz, frozen_by uuid, freeze_reason text,
  created_at timestamptz not null default now(),
  unique (tournament_id, name)
);
create table if not exists public.tournament_stage_deps (
  stage_id uuid not null references public.tournament_stages(id) on delete cascade,
  requires_stage_id uuid not null references public.tournament_stages(id) on delete cascade,
  primary key (stage_id, requires_stage_id),
  check (stage_id <> requires_stage_id)
);
alter table public.tournament_stages enable row level security;
alter table public.tournament_stage_deps enable row level security;
revoke all on public.tournament_stages, public.tournament_stage_deps from anon, authenticated;
create index if not exists tournament_stages_t_idx on public.tournament_stages (tournament_id, sort_order);

alter table public.matches add column if not exists stage_id uuid references public.tournament_stages(id) on delete set null;
alter table public.matches add column if not exists pitch_no int check (pitch_no is null or pitch_no between 1 and 20);
create index if not exists matches_stage_idx on public.matches (stage_id) where stage_id is not null;

-- a stage is "done" when it is frozen, or it has matches and none is still scheduled / live
create or replace function private.stage_done(p_stage uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select s.status = 'frozen' or (
    exists (select 1 from public.matches m where m.stage_id = s.id)
    and not exists (select 1 from public.matches m where m.stage_id = s.id and m.status in ('scheduled', 'live')))
  from public.tournament_stages s where s.id = p_stage;
$$;

-- names of the earlier stages that are not done yet
create or replace function private.stage_blockers(p_stage uuid) returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(r.name order by r.sort_order), '{}') from public.tournament_stage_deps d
    join public.tournament_stages r on r.id = d.requires_stage_id
   where d.stage_id = p_stage and not coalesce(private.stage_done(r.id), false);
$$;

-- raises when the match sits in a frozen stage, or its stage is still waiting on an earlier stage
create or replace function private.assert_stage_open(p_match uuid, p_check_deps boolean default true) returns void
language plpgsql stable security definer set search_path = '' as $$
declare s public.tournament_stages%rowtype; b text[];
begin
  select s2.* into s from public.matches m join public.tournament_stages s2 on s2.id = m.stage_id where m.id = p_match;
  if not found then return; end if;
  if s.status = 'frozen' then
    raise exception 'The stage "%" is frozen. The organiser must reopen it before this can change.', s.name using errcode = '22023';
  end if;
  if p_check_deps then
    b := private.stage_blockers(s.id);
    if array_length(b, 1) > 0 then
      raise exception 'The stage "%" is waiting for: %.', s.name, array_to_string(b, ', ') using errcode = '22023';
    end if;
  end if;
end $$;

create or replace function private.require_scorer(p_match_id uuid)
returns public.matches language plpgsql stable security definer set search_path = '' as $$
declare m public.matches%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  select * into m from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found.' using errcode = '22023'; end if;
  if not private.can_score_match(p_match_id) then
    raise exception 'Only the match scorer or the tournament organiser can score this match.' using errcode = '42501';
  end if;
  perform private.assert_stage_open(p_match_id, true);
  return m;
end $$;

create or replace function public.list_tournament_stages(p_tournament_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  if (select auth.uid()) is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'name', s.name, 'sort_order', s.sort_order, 'status', s.status, 'freeze_reason', s.freeze_reason, 'frozen_at', s.frozen_at,
      'match_count', (select count(*) from public.matches m where m.stage_id = s.id),
      'open_count', (select count(*) from public.matches m where m.stage_id = s.id and m.status in ('scheduled', 'live')),
      'live_count', (select count(*) from public.matches m where m.stage_id = s.id and m.status = 'live'),
      'done', coalesce(private.stage_done(s.id), false),
      'blocked_by', to_jsonb(private.stage_blockers(s.id)),
      'depends_on', (select coalesce(jsonb_agg(d.requires_stage_id), '[]'::jsonb) from public.tournament_stage_deps d where d.stage_id = s.id)
    ) order by s.sort_order, s.created_at), '[]'::jsonb) into r
    from public.tournament_stages s where s.tournament_id = p_tournament_id;
  return jsonb_build_object('can_manage', private.is_tournament_organiser(p_tournament_id), 'stages', r);
end $$;

create or replace function public.save_tournament_stage(p_tournament_id uuid, p_stage_id uuid, p_name text, p_sort_order int, p_depends_on uuid[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare sid uuid := p_stage_id; nm text := pg_catalog.btrim(coalesce(p_name, '')); dep uuid; cyc boolean;
begin
  perform private.require_active_user();
  perform private.require_tournament_organiser(p_tournament_id);
  if pg_catalog.length(nm) < 2 or pg_catalog.length(nm) > 60 then raise exception 'Give the stage a name of 2 to 60 characters.' using errcode = '22023'; end if;
  if sid is null then
    if (select count(*) from public.tournament_stages where tournament_id = p_tournament_id) >= 12 then raise exception 'A tournament can have at most 12 stages.' using errcode = '22023'; end if;
    begin
      insert into public.tournament_stages (tournament_id, name, sort_order)
      values (p_tournament_id, nm, coalesce(p_sort_order, (select coalesce(max(sort_order), 0) + 1 from public.tournament_stages where tournament_id = p_tournament_id))) returning id into sid;
    exception when unique_violation then raise exception 'This tournament already has a stage called "%".', nm using errcode = '22023'; end;
  else
    if not exists (select 1 from public.tournament_stages where id = sid and tournament_id = p_tournament_id) then raise exception 'Stage not found.' using errcode = '22023'; end if;
    if exists (select 1 from public.tournament_stages where id = sid and status = 'frozen') then raise exception 'This stage is frozen. Reopen it first.' using errcode = '22023'; end if;
    begin
      update public.tournament_stages set name = nm, sort_order = coalesce(p_sort_order, sort_order) where id = sid;
    exception when unique_violation then raise exception 'This tournament already has a stage called "%".', nm using errcode = '22023'; end;
  end if;
  if p_depends_on is not null then
    delete from public.tournament_stage_deps where stage_id = sid;
    foreach dep in array p_depends_on loop
      if dep = sid then raise exception 'A stage cannot wait for itself.' using errcode = '22023'; end if;
      if not exists (select 1 from public.tournament_stages where id = dep and tournament_id = p_tournament_id) then raise exception 'A chosen earlier stage was not found.' using errcode = '22023'; end if;
      -- would the chosen stage already (directly or indirectly) wait for this one?
      with recursive chain(id) as (
        select requires_stage_id from public.tournament_stage_deps where stage_id = dep
        union select d.requires_stage_id from public.tournament_stage_deps d join chain c on d.stage_id = c.id)
      select exists (select 1 from chain where id = sid) into cyc;
      if cyc then raise exception 'That would make the stages wait for each other in a circle.' using errcode = '22023'; end if;
      insert into public.tournament_stage_deps (stage_id, requires_stage_id) values (sid, dep) on conflict do nothing;
    end loop;
  end if;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'TOURNAMENT_STAGE_SAVED', 'tournaments', p_tournament_id::text, jsonb_build_object('stage_id', sid, 'name', nm, 'depends_on', p_depends_on));
  return public.list_tournament_stages(p_tournament_id);
end $$;

create or replace function public.delete_tournament_stage(p_stage_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.tournament_stages%rowtype;
begin
  select * into s from public.tournament_stages where id = p_stage_id;
  if not found then raise exception 'Stage not found.' using errcode = '22023'; end if;
  perform private.require_tournament_organiser(s.tournament_id);
  if s.status = 'frozen' then raise exception 'This stage is frozen. Reopen it first.' using errcode = '22023'; end if;
  delete from public.tournament_stages where id = p_stage_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'TOURNAMENT_STAGE_DELETED', 'tournaments', s.tournament_id::text, jsonb_build_object('name', s.name));
  return public.list_tournament_stages(s.tournament_id);
end $$;

create or replace function public.assign_match_stage(p_match_id uuid, p_stage_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare m public.matches%rowtype; s public.tournament_stages%rowtype;
begin
  select * into m from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found.' using errcode = '22023'; end if;
  if m.tournament_id is null then raise exception 'Only tournament matches belong to a stage.' using errcode = '22023'; end if;
  perform private.require_tournament_organiser(m.tournament_id);
  perform private.assert_stage_open(p_match_id, false);
  if p_stage_id is not null then
    select * into s from public.tournament_stages where id = p_stage_id and tournament_id = m.tournament_id;
    if not found then raise exception 'Stage not found in this tournament.' using errcode = '22023'; end if;
    if s.status = 'frozen' then raise exception 'The stage "%" is frozen.', s.name using errcode = '22023'; end if;
  end if;
  update public.matches set stage_id = p_stage_id where id = p_match_id;
  return public.list_tournament_stages(m.tournament_id);
end $$;

create or replace function public.freeze_tournament_stage(p_stage_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.tournament_stages%rowtype; why text := pg_catalog.btrim(coalesce(p_reason, ''));
begin
  select * into s from public.tournament_stages where id = p_stage_id for update;
  if not found then raise exception 'Stage not found.' using errcode = '22023'; end if;
  perform private.require_tournament_organiser(s.tournament_id);
  if s.status = 'frozen' then raise exception 'This stage is already frozen.' using errcode = '22023'; end if;
  if exists (select 1 from public.matches where stage_id = s.id and status = 'live') then raise exception 'A match in this stage is live. Finish it first.' using errcode = '22023'; end if;
  if pg_catalog.length(why) > 200 then raise exception 'Keep the note under 200 characters.' using errcode = '22023'; end if;
  update public.tournament_stages set status = 'frozen', frozen_at = now(), frozen_by = (select auth.uid()), freeze_reason = nullif(why, '') where id = s.id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'TOURNAMENT_STAGE_FROZEN', 'tournaments', s.tournament_id::text, jsonb_build_object('stage_id', s.id, 'name', s.name, 'reason', why));
  return public.list_tournament_stages(s.tournament_id);
end $$;

create or replace function public.reopen_tournament_stage(p_stage_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.tournament_stages%rowtype; why text := pg_catalog.btrim(coalesce(p_reason, '')); later text[];
begin
  select * into s from public.tournament_stages where id = p_stage_id for update;
  if not found then raise exception 'Stage not found.' using errcode = '22023'; end if;
  perform private.require_tournament_organiser(s.tournament_id);
  if s.status <> 'frozen' then raise exception 'This stage is not frozen.' using errcode = '22023'; end if;
  if pg_catalog.length(why) < 5 then raise exception 'Give a reason for reopening (at least 5 characters).' using errcode = '22023'; end if;
  if pg_catalog.length(why) > 200 then raise exception 'Keep the reason under 200 characters.' using errcode = '22023'; end if;
  select array_agg(x.name) into later from public.tournament_stage_deps d join public.tournament_stages x on x.id = d.stage_id where d.requires_stage_id = s.id and x.status = 'frozen';
  if later is not null then raise exception 'Reopen the later frozen stage(s) first: %.', array_to_string(later, ', ') using errcode = '22023'; end if;
  update public.tournament_stages set status = 'open', frozen_at = null, frozen_by = null, freeze_reason = null where id = s.id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'TOURNAMENT_STAGE_REOPENED', 'tournaments', s.tournament_id::text, jsonb_build_object('stage_id', s.id, 'name', s.name, 'reason', why));
  return public.list_tournament_stages(s.tournament_id);
end $$;

-- frozen stages also lock ground, pitch and time changes
create or replace function public.set_match_ground(p_match_id uuid, p_ground_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g public.grounds%rowtype;
begin
  if not private.can_manage_match(p_match_id) then raise exception 'Only the match creator or tournament organiser can set the ground.' using errcode = '42501'; end if;
  perform private.assert_stage_open(p_match_id, false);
  if p_ground_id is not null then
    select * into g from public.grounds where id = p_ground_id and is_active;
    if not found then raise exception 'Ground not found.' using errcode = '22023'; end if;
  end if;
  update public.matches set ground_id = p_ground_id, pitch_no = case when p_ground_id is distinct from ground_id then null else pitch_no end,
         venue = case when p_ground_id is null then venue else g.name end, city = case when p_ground_id is null then city else coalesce(g.city, city) end
   where id = p_match_id;
  return jsonb_build_object('ground_id', p_ground_id, 'name', g.name);
end $$;

create or replace function public.reschedule_match(p_match_id uuid, p_scheduled_at timestamptz, p_venue text default null, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare m record; tname text;
begin
  select * into m from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found.' using errcode = '22023'; end if;
  perform private.require_tournament_organiser(m.tournament_id);
  perform private.assert_stage_open(p_match_id, false);
  if m.status not in ('scheduled') then raise exception 'Only matches that have not started can be rescheduled.' using errcode = '22023'; end if;
  update public.matches set scheduled_at = p_scheduled_at, venue = coalesce(nullif(pg_catalog.btrim(coalesce(p_venue, '')), ''), venue),
         notes = coalesce(nullif(pg_catalog.btrim(coalesce(p_reason, '')), ''), notes)
   where id = p_match_id;
  select name into tname from public.tournaments where id = m.tournament_id;
  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  select distinct t.owner_id, 'match_rescheduled', 'Match rescheduled',
         (select name from public.teams where id = m.team_a_id) || ' vs ' || (select name from public.teams where id = m.team_b_id)
         || ' (' || tname || ') is now on ' || pg_catalog.to_char(p_scheduled_at at time zone 'Asia/Kolkata', 'DD Mon YYYY, HH12:MI AM')
         || coalesce('. Reason: ' || nullif(pg_catalog.btrim(coalesce(p_reason, '')), ''), ''),
         jsonb_build_object('match_id', p_match_id)
    from public.teams t where t.id in (m.team_a_id, m.team_b_id);
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'MATCH_RESCHEDULED', 'tournaments', m.tournament_id::text,
          jsonb_build_object('match_id', p_match_id, 'from', m.scheduled_at, 'to', p_scheduled_at, 'reason', p_reason));
  return jsonb_build_object('id', p_match_id);
end $$;

-- ---------------------------------------------------------------- #324 correction impact preview
create or replace function public.preview_ball_correction(p_match_id uuid, p_ball_id bigint, p_changes jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare b public.balls%rowtype; k text; v text; cur jsonb; lines jsonb := '[]'::jsonb; fr boolean; bowler_runs int; bowler_wkt boolean;
        bat_runs int; old_id uuid; new_id uuid; nm_old text; nm_new text; role_label text; effect text;
begin
  perform private.require_scorer(p_match_id, 'edit_ball');
  select * into b from public.balls where id = p_ball_id and match_id = p_match_id;
  if not found then raise exception 'That ball was not found in this match.' using errcode = '22023'; end if;
  cur := jsonb_build_object('striker_id', b.striker_id, 'non_striker_id', b.non_striker_id, 'bowler_id', b.bowler_id, 'fielder_id', b.fielder_id, 'dismissed_id', b.dismissed_id);
  fr := coalesce(b.extra_type, '') <> 'wide';
  bat_runs := coalesce(b.runs_bat, 0);
  bowler_runs := coalesce(b.runs_bat, 0) + case when b.extra_type in ('wide', 'no_ball') then coalesce(b.extra_runs, 0) else 0 end;
  bowler_wkt := b.is_wicket and coalesce(b.wicket_type, '') in ('bowled', 'caught', 'caught_and_bowled', 'stumped', 'hit_wicket');
  for k in select jsonb_object_keys(coalesce(p_changes, '{}'::jsonb)) loop
    if k not in ('striker_id','non_striker_id','bowler_id','fielder_id','dismissed_id') then raise exception 'Unknown field: %', k using errcode = '22023'; end if;
    v := nullif(p_changes ->> k, '');
    if (cur ->> k) is not distinct from v then continue; end if;
    old_id := nullif(cur ->> k, '')::uuid; new_id := v::uuid;
    select display_name into nm_old from public.players where id = old_id;
    select display_name into nm_new from public.players where id = new_id;
    role_label := case k when 'striker_id' then 'Batter facing' when 'non_striker_id' then 'Non-striker' when 'bowler_id' then 'Bowler' when 'fielder_id' then 'Fielder' else 'Who was out' end;
    effect := case k
      when 'striker_id' then format('%s runs%s move from %s to %s', bat_runs, case when fr then ' and 1 ball faced' else '' end, coalesce(nm_old, 'nobody'), coalesce(nm_new, 'nobody'))
      when 'bowler_id' then format('%s runs conceded%s move from %s to %s', bowler_runs, case when bowler_wkt then ' and the wicket' else '' end, coalesce(nm_old, 'nobody'), coalesce(nm_new, 'nobody'))
      when 'dismissed_id' then format('The dismissal moves from %s to %s', coalesce(nm_old, 'nobody'), coalesce(nm_new, 'nobody'))
      when 'fielder_id' then format('The catch / run-out credit moves from %s to %s', coalesce(nm_old, 'nobody'), coalesce(nm_new, 'nobody'))
      else format('The non-striker at the crease changes from %s to %s (no runs move)', coalesce(nm_old, 'nobody'), coalesce(nm_new, 'nobody')) end;
    lines := lines || jsonb_build_array(jsonb_build_object('field', k, 'label', role_label, 'from', nm_old, 'to', nm_new, 'effect', effect));
  end loop;
  return jsonb_build_object('lines', lines, 'team_total_changes', false,
    'note', 'The team total, overs and wickets stay the same. Only the player figures move.');
end $$;

-- ---------------------------------------------------------------- #357 injury replacement rule
create or replace function private.default_rules() returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'wide_runs', 1, 'no_ball_runs', 1, 'free_hit', true, 'lbw', true, 'byes', true, 'leg_byes', true,
    'max_overs_per_bowler', null, 'retire_at', null,
    'powerplay_overs', 0, 'fielders_outside_powerplay', 2, 'fielders_outside', 5,
    'boundary_size_m', null, 'follow_on_lead', null,
    'late_method', null, 'late_grace_min', 0, 'late_step_min', 10, 'late_overs_per_step', 1, 'late_runs_per_step', 5,
    'late_field_step_min', 5, 'late_field_max_outside', 2, 'late_approver', 'organiser', 'late_repeat_threshold', 3,
    'mid_over_injury_replacement', true, 'mid_over_injury_max', null,
    'notes', jsonb_build_object('batting', '', 'bowling', '', 'boundary', '', 'fielding', '', 'ground', '', 'substitutes', '', 'general', '')
  );
$$;

create or replace function private.clean_rules(p jsonb) returns jsonb language plpgsql immutable set search_path = '' as $$
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
    elsif k in ('free_hit','lbw','byes','leg_byes','mid_over_injury_replacement') then
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
        if k in ('max_overs_per_bowler','retire_at','boundary_size_m','follow_on_lead','mid_over_injury_max') then r := r || jsonb_build_object(k, null); end if;
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
         or (k = 'late_repeat_threshold' and (v::int < 2 or v::int > 10))
         or (k = 'mid_over_injury_max' and (v::int < 1 or v::int > 10)) then
        raise exception 'Rule % is out of range.', k using errcode = '22023';
      end if;
      r := r || jsonb_build_object(k, v);
    end if;
  end loop;
  return r;
end $$;

create or replace function public.replace_bowler_mid_over(p_match_id uuid, p_replacement uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  m public.matches%rowtype; i public.innings%rowtype; rl jsonb;
  why text := pg_catalog.btrim(coalesce(p_reason, ''));
  n int; lim int; used int; cap int;
begin
  m := private.require_scorer(p_match_id, 'replace_bowler');
  if m.status <> 'live' then raise exception 'The match is not live.' using errcode = '22023'; end if;
  select * into i from public.innings where match_id = p_match_id and status = 'in_progress' order by innings_no desc limit 1;
  if not found then raise exception 'No innings is in progress.' using errcode = '22023'; end if;
  if i.bowler_id is null then raise exception 'No over is in progress. Pick the next bowler instead.' using errcode = '22023'; end if;
  rl := private.effective_rules(m.id);
  if coalesce((rl ->> 'mid_over_injury_replacement')::boolean, true) is false then
    raise exception 'The playing conditions for this match do not allow a bowler to be replaced in the middle of an over.' using errcode = '22023';
  end if;
  cap := (rl ->> 'mid_over_injury_max')::int;
  if cap is not null and (select count(*) from public.bowler_replacements where innings_id = i.id) >= cap then
    raise exception 'The playing conditions allow only % mid-over replacement(s) per innings, and that is used up.', cap using errcode = '22023';
  end if;
  if pg_catalog.length(why) < 3 then raise exception 'Give a reason (injury, illness or suspension).' using errcode = '22023'; end if;
  if pg_catalog.length(why) > 160 then raise exception 'Keep the reason under 160 characters.' using errcode = '22023'; end if;
  if p_replacement is null or p_replacement = i.bowler_id then raise exception 'Pick a different player to finish the over.' using errcode = '22023'; end if;
  if not exists (select 1 from public.match_players where match_id = p_match_id and team_id = i.bowling_team_id and player_id = p_replacement and role = 'playing') then
    raise exception 'The replacement must be in the fielding side''s Playing XI.' using errcode = '22023';
  end if;
  if p_replacement = i.last_over_bowler_id then
    raise exception 'The bowler of the previous over cannot finish this over.' using errcode = '22023';
  end if;
  if exists (select 1 from public.bowler_replacements where innings_id = i.id and original_id = p_replacement) then
    raise exception 'This player was replaced earlier and cannot bowl again in this innings.' using errcode = '22023';
  end if;
  lim := (rl ->> 'max_overs_per_bowler')::int;
  if lim is not null then
    select count(*) into used from public.balls where innings_id = i.id and bowler_id = p_replacement and is_legal;
    if used >= lim * 6 then raise exception 'The replacement has already bowled the maximum of % overs.', lim using errcode = '22023'; end if;
  end if;
  n := i.legal_balls % 6;
  insert into public.bowler_replacements (match_id, innings_id, over_no, original_id, replacement_id, legal_balls_before, reason, created_by)
  values (p_match_id, i.id, i.legal_balls / 6, i.bowler_id, p_replacement, n, why, (select auth.uid()));
  update public.innings set bowler_id = p_replacement where id = i.id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'BOWLER_REPLACED_MID_OVER', 'matches', p_match_id::text,
          jsonb_build_object('original_id', i.bowler_id, 'replacement_id', p_replacement, 'over', i.legal_balls / 6, 'legal_balls_before', n, 'reason', why));
  return public.get_live_state(p_match_id);
end $$;

-- ---------------------------------------------------------------- #364 multi-pitch scheduling
-- A ground with several pitches can host several matches at once: a match clash is only a hard
-- conflict when every pitch is taken. Matches that name a pitch clash only with the same pitch.
create or replace function public.check_ground_conflicts(p_ground_id uuid, p_starts timestamptz, p_ends timestamptz, p_exclude_booking uuid default null, p_exclude_match uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare g public.grounds%rowtype; hard jsonb; soft jsonb; outside boolean := false; ls time; le time; pc int; mcount int;
begin
  if (select auth.uid()) is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  select * into g from public.grounds where id = p_ground_id;
  if not found then raise exception 'Ground not found.' using errcode = '22023'; end if;
  if p_starts is null or p_ends is null or p_ends <= p_starts then raise exception 'Choose a start and an end time.' using errcode = '22023'; end if;
  pc := greatest(coalesce(g.pitch_count, 1), 1);
  select count(*) into mcount from public.matches m
   where m.ground_id = p_ground_id and m.id is distinct from p_exclude_match and m.status in ('scheduled', 'live') and m.scheduled_at is not null
     and m.scheduled_at < p_ends and m.scheduled_at + interval '4 hours' > p_starts
     and not exists (select 1 from public.ground_bookings bb where bb.match_id = m.id and bb.status = 'confirmed' and bb.id is not distinct from p_exclude_booking);
  select coalesce(jsonb_agg(x order by x ->> 'starts_at'), '[]'::jsonb) into hard from (
    select jsonb_build_object('type', case when b.kind = 'blocked' then 'blocked' else 'booking' end, 'label', case when b.kind = 'blocked' then 'Not available (blocked by the owner)' else 'Already booked' end,
             'starts_at', b.starts_at, 'ends_at', b.ends_at) x
      from public.ground_bookings b where b.ground_id = p_ground_id and b.status = 'confirmed' and b.id is distinct from p_exclude_booking and b.starts_at < p_ends and b.ends_at > p_starts
    union all
    select jsonb_build_object('type', 'match', 'label', case when pc > 1 then 'All ' || pc || ' pitches are in use' else 'Another match is scheduled' end,
             'starts_at', m.scheduled_at, 'ends_at', m.scheduled_at + interval '4 hours', 'match_id', m.id)
      from public.matches m where mcount >= pc and m.ground_id = p_ground_id and m.id is distinct from p_exclude_match and m.status in ('scheduled', 'live') and m.scheduled_at is not null
       and m.scheduled_at < p_ends and m.scheduled_at + interval '4 hours' > p_starts
       and not exists (select 1 from public.ground_bookings bb where bb.match_id = m.id and bb.status = 'confirmed' and bb.id is not distinct from p_exclude_booking)) q;
  select coalesce(jsonb_agg(jsonb_build_object('type', 'request', 'label', 'Another request is waiting for this time', 'starts_at', b.starts_at, 'ends_at', b.ends_at) order by b.starts_at), '[]'::jsonb) into soft
    from public.ground_bookings b where b.ground_id = p_ground_id and b.status = 'requested' and b.id is distinct from p_exclude_booking and b.starts_at < p_ends and b.ends_at > p_starts;
  begin ls := g.open_time::time; le := g.close_time::time; exception when others then ls := null; le := null; end;
  if ls is not null and le is not null and le > ls then
    outside := (p_starts at time zone 'Asia/Kolkata')::time < ls or (p_ends at time zone 'Asia/Kolkata')::time > le or (p_starts at time zone 'Asia/Kolkata')::date <> (p_ends at time zone 'Asia/Kolkata')::date;
  end if;
  return jsonb_build_object('ok', jsonb_array_length(hard) = 0 and not outside, 'hard', hard, 'soft', soft, 'outside_hours', outside,
                            'open_time', g.open_time, 'close_time', g.close_time, 'booking_open', g.booking_open, 'pitch_count', pc, 'matches_in_window', mcount);
end $$;

-- which pitches are free for a match's time, and which one it is on
create or replace function public.get_match_pitch_options(p_match_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare m public.matches%rowtype; g public.grounds%rowtype; pc int; res jsonb := '[]'::jsonb; p int; taken int;
begin
  if (select auth.uid()) is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  select * into m from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found.' using errcode = '22023'; end if;
  if m.ground_id is null then return jsonb_build_object('ground_id', null, 'pitch_count', 0, 'pitch_no', m.pitch_no, 'pitches', '[]'::jsonb, 'can_manage', private.can_manage_match(p_match_id)); end if;
  select * into g from public.grounds where id = m.ground_id;
  pc := greatest(coalesce(g.pitch_count, 1), 1);
  for p in 1..pc loop
    select count(*) into taken from public.matches o
     where o.ground_id = m.ground_id and o.id <> m.id and o.pitch_no = p and o.status in ('scheduled', 'live') and o.scheduled_at is not null and m.scheduled_at is not null
       and o.scheduled_at < m.scheduled_at + interval '4 hours' and o.scheduled_at + interval '4 hours' > m.scheduled_at;
    res := res || jsonb_build_array(jsonb_build_object('pitch_no', p, 'free', taken = 0, 'selected', m.pitch_no = p));
  end loop;
  return jsonb_build_object('ground_id', m.ground_id, 'ground_name', g.name, 'pitch_count', pc, 'pitch_no', m.pitch_no, 'pitches', res, 'can_manage', private.can_manage_match(p_match_id));
end $$;

create or replace function public.set_match_pitch(p_match_id uuid, p_pitch_no int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare m public.matches%rowtype; g public.grounds%rowtype; pc int; clash boolean;
begin
  if not private.can_manage_match(p_match_id) then raise exception 'Only the match creator or tournament organiser can set the pitch.' using errcode = '42501'; end if;
  perform private.assert_stage_open(p_match_id, false);
  select * into m from public.matches where id = p_match_id;
  if m.ground_id is null then raise exception 'Choose a ground for the match first.' using errcode = '22023'; end if;
  if m.status <> 'scheduled' then raise exception 'The pitch can only change before the match starts.' using errcode = '22023'; end if;
  if p_pitch_no is not null then
    select * into g from public.grounds where id = m.ground_id;
    pc := greatest(coalesce(g.pitch_count, 1), 1);
    if p_pitch_no < 1 or p_pitch_no > pc then raise exception 'This ground has % pitch(es).', pc using errcode = '22023'; end if;
    select exists (select 1 from public.matches o where o.ground_id = m.ground_id and o.id <> m.id and o.pitch_no = p_pitch_no and o.status in ('scheduled', 'live')
       and o.scheduled_at is not null and m.scheduled_at is not null
       and o.scheduled_at < m.scheduled_at + interval '4 hours' and o.scheduled_at + interval '4 hours' > m.scheduled_at) into clash;
    if clash then raise exception 'Pitch % already has a match at that time.', p_pitch_no using errcode = '22023'; end if;
  end if;
  update public.matches set pitch_no = p_pitch_no where id = p_match_id;
  return public.get_match_pitch_options(p_match_id);
end $$;

-- lock down: signed-in users only
do $$ declare f text; begin
  foreach f in array array[
    'public.list_tournament_stages(uuid)', 'public.save_tournament_stage(uuid,uuid,text,int,uuid[])', 'public.delete_tournament_stage(uuid)',
    'public.assign_match_stage(uuid,uuid)', 'public.freeze_tournament_stage(uuid,text)', 'public.reopen_tournament_stage(uuid,text)',
    'public.preview_ball_correction(uuid,bigint,jsonb)', 'public.get_match_pitch_options(uuid)', 'public.set_match_pitch(uuid,int)']
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
revoke all on function private.stage_done(uuid), private.stage_blockers(uuid), private.assert_stage_open(uuid, boolean) from public, anon, authenticated;
