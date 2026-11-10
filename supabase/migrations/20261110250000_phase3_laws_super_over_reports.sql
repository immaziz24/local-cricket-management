-- Phase 3 / Category E batch 2 – laws in practice.
-- #121 Super Over (tied limited-overs match), #123 penalty runs, #120 follow-on (two-innings matches),
-- #126 match decision log, #127 incident reports, #128 disciplinary reports (+ #124 time-wasting warnings).
-- The reference library (#103 #104 #113 #115–#117 #122 #125) is a website page with plain-language summaries.
-- Super Over innings are kept apart: they never count toward team totals, NRR or player statistics.

alter table public.innings
  add column if not exists is_super_over boolean not null default false,
  add column if not exists overs_limit int check (overs_limit is null or overs_limit between 1 and 50),
  add column if not exists wickets_limit int check (wickets_limit is null or wickets_limit between 1 and 10),
  add column if not exists penalty_runs int not null default 0;
alter table public.matches add column if not exists pending_penalty jsonb not null default '{}'::jsonb;

create table if not exists public.match_reports (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  kind text not null check (kind in ('decision','incident','disciplinary')),
  innings_no int,
  over_text text check (over_text is null or pg_catalog.length(over_text) <= 10),
  team_id uuid references public.teams(id) on delete set null,
  player_id uuid references public.players(id) on delete set null,
  title text not null check (pg_catalog.length(title) between 2 and 120),
  details text check (details is null or pg_catalog.length(details) <= 2000),
  action text not null default 'none' check (action in ('none','warning','penalty_runs','suspension','referred')),
  penalty_runs int,
  suspension_matches int check (suspension_matches is null or suspension_matches between 1 and 50),
  status text not null default 'open' check (status in ('open','closed')),
  closing_note text check (closing_note is null or pg_catalog.length(closing_note) <= 500),
  created_by uuid references auth.users(id) on delete set null,
  closed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create index if not exists match_reports_match_idx on public.match_reports (match_id, created_at desc);
create index if not exists match_reports_team_idx on public.match_reports (team_id);
create index if not exists match_reports_player_idx on public.match_reports (player_id);
create index if not exists match_reports_created_by_idx on public.match_reports (created_by);
create index if not exists match_reports_closed_by_idx on public.match_reports (closed_by);
alter table public.match_reports enable row level security;
-- no direct table access: read through list_match_reports(), write through the functions below
revoke all on public.match_reports from anon, authenticated;

-- Team totals never include Super Over runs.
create or replace function private.sync_match_score(p_match_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare m public.matches%rowtype;
begin
  select * into m from public.matches where id = p_match_id;
  update public.matches set
    team_a_runs    = (select sum(runs)::int from public.innings where match_id = p_match_id and batting_team_id = m.team_a_id and not is_super_over),
    team_a_wickets = (select wickets from public.innings where match_id = p_match_id and batting_team_id = m.team_a_id and not is_super_over order by innings_no desc limit 1),
    team_a_balls   = (select sum(legal_balls)::int from public.innings where match_id = p_match_id and batting_team_id = m.team_a_id and not is_super_over),
    team_a_all_out = coalesce((select end_reason = 'all_out' from public.innings where match_id = p_match_id and batting_team_id = m.team_a_id and not is_super_over order by innings_no desc limit 1), false),
    team_b_runs    = (select sum(runs)::int from public.innings where match_id = p_match_id and batting_team_id = m.team_b_id and not is_super_over),
    team_b_wickets = (select wickets from public.innings where match_id = p_match_id and batting_team_id = m.team_b_id and not is_super_over order by innings_no desc limit 1),
    team_b_balls   = (select sum(legal_balls)::int from public.innings where match_id = p_match_id and batting_team_id = m.team_b_id and not is_super_over),
    team_b_all_out = coalesce((select end_reason = 'all_out' from public.innings where match_id = p_match_id and batting_team_id = m.team_b_id and not is_super_over order by innings_no desc limit 1), false)
  where id = p_match_id;
end;
$$;

-- #121 Result of a Super Over pair.
create or replace function private.finish_super_over(p_match_id uuid, p_innings_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare m public.matches%rowtype; i public.innings%rowtype; w uuid; summary text;
begin
  select * into m from public.matches where id = p_match_id;
  select * into i from public.innings where id = p_innings_id;
  if i.runs >= i.target then w := i.batting_team_id;
  elsif i.runs = i.target - 1 then w := null;
  else w := i.bowling_team_id; end if;
  summary := case when w is null then 'Match tied (Super Over tied too)'
                  else (select name from public.teams where id = w) || ' won the Super Over (match tied)' end;
  update public.matches set status = 'completed', result_type = case when w is null then 'tie' else 'win' end,
         winner_team_id = w, result_summary = summary, completed_at = pg_catalog.now()
   where id = p_match_id;
  if m.tournament_id is not null then
    update public.tournaments set matches_completed = (select count(*) from public.matches where tournament_id = m.tournament_id and status in ('completed','abandoned'))
     where id = m.tournament_id;
  end if;
  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  select distinct t.owner_id, 'match_result', 'Match result',
         (select name from public.teams where id = m.team_a_id) || ' vs ' || (select name from public.teams where id = m.team_b_id) || ': ' || summary,
         jsonb_build_object('match_id', p_match_id)
    from public.teams t where t.id in (m.team_a_id, m.team_b_id) and t.owner_id is not null;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'MATCH_COMPLETED', 'matches', p_match_id::text, jsonb_build_object('result', summary, 'super_over', true));
end;
$$;

create or replace function private.close_innings(p_innings_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = ''
as $$
declare i public.innings%rowtype; m public.matches%rowtype; first_total int; second_total int; nxt int; bat uuid; bowl uuid; tgt int;
begin
  select * into i from public.innings where id = p_innings_id;
  select * into m from public.matches where id = i.match_id;
  update public.innings set status = 'completed', end_reason = p_reason, completed_at = pg_catalog.now(),
         striker_id = null, non_striker_id = null, bowler_id = null
   where id = p_innings_id;
  perform private.sync_match_score(i.match_id);

  -- #121 Super Over: first innings of the pair sets a target, the second decides the match
  if i.is_super_over then
    if i.target is null then
      insert into public.innings (match_id, innings_no, batting_team_id, bowling_team_id, target, is_super_over, overs_limit, wickets_limit)
      values (i.match_id, i.innings_no + 1, i.bowling_team_id, i.batting_team_id, i.runs + 1, true, i.overs_limit, i.wickets_limit);
    else
      perform private.finish_super_over(i.match_id, p_innings_id);
    end if;
    return;
  end if;

  if coalesce(m.match_type, 'limited_overs') <> 'two_innings' then
    if i.innings_no = 1 then
      insert into public.innings (match_id, innings_no, batting_team_id, bowling_team_id, target)
      values (i.match_id, 2, i.bowling_team_id, i.batting_team_id, i.runs + 1);
    else
      perform private.finish_match(i.match_id);
    end if;
    return;
  end if;

  if i.innings_no = 4 or (i.innings_no = 3 and p_reason <> 'declared' and
       (select coalesce(sum(runs), 0) from public.innings where match_id = i.match_id and batting_team_id = i.batting_team_id)
       < (select coalesce(sum(runs), 0) from public.innings where match_id = i.match_id and batting_team_id = i.bowling_team_id)) then
    perform private.finish_match(i.match_id);
    return;
  end if;
  nxt := i.innings_no + 1; bat := i.bowling_team_id; bowl := i.batting_team_id; tgt := null;
  if nxt = 4 then
    first_total := (select coalesce(sum(runs), 0) from public.innings where match_id = i.match_id and batting_team_id = bowl);
    second_total := (select coalesce(sum(runs), 0) from public.innings where match_id = i.match_id and batting_team_id = bat);
    tgt := greatest(first_total - second_total + 1, 1);
  end if;
  insert into public.innings (match_id, innings_no, batting_team_id, bowling_team_id, target) values (i.match_id, nxt, bat, bowl, tgt);
end;
$$;

-- #121 Start a Super Over after a tie (scorer). The team that batted second bats first.
create or replace function public.start_super_over(p_match_id uuid, p_wickets int default 2)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare m public.matches%rowtype; last public.innings%rowtype; n int;
begin
  m := private.require_scorer(p_match_id);
  if m.status <> 'completed' or m.result_type is distinct from 'tie' then raise exception 'A Super Over can only be played when the match is tied.' using errcode = '22023'; end if;
  if coalesce(m.match_type, 'limited_overs') = 'two_innings' then raise exception 'Super Overs are only for limited-overs matches.' using errcode = '22023'; end if;
  if not exists (select 1 from public.balls where match_id = p_match_id) then raise exception 'Only for matches scored ball by ball.' using errcode = '22023'; end if;
  if m.tournament_id is not null and exists (select 1 from public.tournaments where id = m.tournament_id and status = 'completed') then
    raise exception 'The tournament is finished.' using errcode = '22023';
  end if;
  if p_wickets is null or p_wickets < 1 or p_wickets > 5 then raise exception 'Wickets for a Super Over must be between 1 and 5.' using errcode = '22023'; end if;
  select * into last from public.innings where match_id = p_match_id order by innings_no desc limit 1;
  insert into public.innings (match_id, innings_no, batting_team_id, bowling_team_id, is_super_over, overs_limit, wickets_limit)
  values (p_match_id, last.innings_no + 1, last.batting_team_id, last.bowling_team_id, true, 1, p_wickets);
  update public.matches set status = 'live', result_type = null, winner_team_id = null, result_summary = null, completed_at = null where id = p_match_id;
  if m.tournament_id is not null then
    update public.tournaments set matches_completed = (select count(*) from public.matches where tournament_id = m.tournament_id and status in ('completed','abandoned'))
     where id = m.tournament_id;
  end if;
  select count(*) into n from public.innings where match_id = p_match_id and is_super_over;
  insert into public.match_reports (match_id, kind, innings_no, title, details, created_by)
  values (p_match_id, 'decision', last.innings_no + 1, 'Super Over started',
          'Match tied. Super Over ' || ((n + 1) / 2) || ': 1 over, ' || p_wickets || ' wickets. ' || (select name from public.teams where id = last.batting_team_id) || ' bat first.',
          (select auth.uid()));
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'SUPER_OVER_STARTED', 'matches', p_match_id::text, jsonb_build_object('wickets', p_wickets));
  return public.get_live_state(p_match_id);
end;
$$;

-- #123 Penalty runs to the batting side (added now) or the fielding side (added to their innings).
create or replace function public.award_penalty_runs(p_match_id uuid, p_to text, p_runs int, p_reason text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare m public.matches%rowtype; i public.innings%rowtype; prev public.innings%rowtype; team uuid; reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
begin
  m := private.require_scorer(p_match_id);
  if m.status <> 'live' then raise exception 'The match is not live.' using errcode = '22023'; end if;
  if p_to not in ('batting','fielding') then raise exception 'Choose which side gets the penalty runs.' using errcode = '22023'; end if;
  if p_runs is null or p_runs = 0 or p_runs < -10 or p_runs > 10 then raise exception 'Penalty runs must be between 1 and 10 (or a negative number to correct a mistake).' using errcode = '22023'; end if;
  if reason is null or pg_catalog.length(reason) > 300 then raise exception 'Give a short reason (up to 300 characters).' using errcode = '22023'; end if;
  select * into i from public.innings where match_id = p_match_id and status = 'in_progress' order by innings_no desc limit 1 for update;
  if not found then raise exception 'No innings is in progress.' using errcode = '22023'; end if;

  if p_to = 'batting' then
    team := i.batting_team_id;
    if i.penalty_runs + p_runs < 0 then raise exception 'That would take the penalty runs below zero.' using errcode = '22023'; end if;
    update public.innings set penalty_runs = penalty_runs + p_runs, runs = runs + p_runs, extras = extras + p_runs where id = i.id returning * into i;
  else
    team := i.bowling_team_id;
    select * into prev from public.innings where match_id = p_match_id and batting_team_id = team and status = 'completed' and is_super_over = i.is_super_over
     order by innings_no desc limit 1 for update;
    if found then
      if prev.penalty_runs + p_runs < 0 then raise exception 'That would take the penalty runs below zero.' using errcode = '22023'; end if;
      update public.innings set penalty_runs = penalty_runs + p_runs, runs = runs + p_runs, extras = extras + p_runs where id = prev.id;
      if i.target is not null then update public.innings set target = greatest(target + p_runs, 1) where id = i.id returning * into i; end if;
    else
      if coalesce((m.pending_penalty->>team::text)::int, 0) + p_runs < 0 then raise exception 'That would take the penalty runs below zero.' using errcode = '22023'; end if;
      update public.matches set pending_penalty = pending_penalty || jsonb_build_object(team::text, coalesce((pending_penalty->>team::text)::int, 0) + p_runs)
       where id = p_match_id;
    end if;
  end if;

  insert into public.match_reports (match_id, kind, innings_no, over_text, team_id, title, details, action, penalty_runs, created_by)
  values (p_match_id, 'decision', i.innings_no, (i.legal_balls / 6) || '.' || (i.legal_balls % 6), team,
          case when p_runs > 0 then p_runs || ' penalty run' || case when p_runs = 1 then '' else 's' end || ' to ' || (select name from public.teams where id = team)
               else 'Penalty runs corrected (' || p_runs || ') for ' || (select name from public.teams where id = team) end,
          reason, 'penalty_runs', p_runs, (select auth.uid()));

  if i.target is not null and i.runs >= i.target then
    perform private.close_innings(i.id, 'target');
  else
    perform private.sync_match_score(p_match_id);
  end if;
  return public.get_live_state(p_match_id);
end;
$$;

-- Penalty runs given to a side that has not batted yet are added when its innings starts.
create or replace function private.apply_pending_penalty()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare n int;
begin
  if new.is_super_over then return new; end if;
  select (pending_penalty->>new.batting_team_id::text)::int into n from public.matches where id = new.match_id;
  if coalesce(n, 0) <> 0 then
    new.penalty_runs := coalesce(new.penalty_runs, 0) + n; new.runs := coalesce(new.runs, 0) + n; new.extras := coalesce(new.extras, 0) + n;
    update public.matches set pending_penalty = pending_penalty - new.batting_team_id::text where id = new.match_id;
  end if;
  return new;
end;
$$;
drop trigger if exists innings_pending_penalty on public.innings;
create trigger innings_pending_penalty before insert on public.innings for each row execute function private.apply_pending_penalty();

-- #120 Follow-on (two-innings matches): the side batting second is asked to bat again.
create or replace function public.enforce_follow_on(p_match_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare m public.matches%rowtype; i public.innings%rowtype; first public.innings%rowtype; second public.innings%rowtype; need int; lead int;
begin
  m := private.require_scorer(p_match_id);
  if coalesce(m.match_type, 'limited_overs') <> 'two_innings' then raise exception 'The follow-on is only for two-innings matches.' using errcode = '22023'; end if;
  select * into i from public.innings where match_id = p_match_id and status = 'in_progress' order by innings_no desc limit 1 for update;
  if not found or i.innings_no <> 3 then raise exception 'The follow-on can only be enforced at the start of the third innings.' using errcode = '22023'; end if;
  if exists (select 1 from public.balls where innings_id = i.id) then raise exception 'The third innings has already started.' using errcode = '22023'; end if;
  select * into first from public.innings where match_id = p_match_id and innings_no = 1;
  select * into second from public.innings where match_id = p_match_id and innings_no = 2;
  if i.batting_team_id <> first.batting_team_id then raise exception 'The follow-on has already been enforced.' using errcode = '22023'; end if;
  need := coalesce((coalesce(m.rules, private.effective_rules(m.id))->>'follow_on_lead')::int, 75);
  lead := first.runs - second.runs;
  if lead < need then raise exception 'A lead of at least % runs is needed (lead is %).', need, lead using errcode = '22023'; end if;
  delete from public.innings_crease where innings_id = i.id;
  update public.innings set batting_team_id = second.batting_team_id, bowling_team_id = first.batting_team_id,
         striker_id = null, non_striker_id = null, bowler_id = null, last_over_bowler_id = null
   where id = i.id;
  insert into public.match_reports (match_id, kind, innings_no, team_id, title, details, created_by)
  values (p_match_id, 'decision', 3, first.batting_team_id, 'Follow-on enforced',
          (select name from public.teams where id = first.batting_team_id) || ' led by ' || lead || ' runs and asked ' ||
          (select name from public.teams where id = second.batting_team_id) || ' to bat again.', (select auth.uid()));
  return public.get_live_state(p_match_id);
end;
$$;

-- #126 #127 #128 Decision log, incident reports and disciplinary reports.
create or replace function public.add_match_report(p_match_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare m public.matches%rowtype; k text := p->>'kind'; t uuid := nullif(p->>'team_id', '')::uuid; pl uuid := nullif(p->>'player_id', '')::uuid;
        act text := coalesce(nullif(p->>'action', ''), 'none'); sus int := nullif(p->>'suspension_matches', '')::int; rid uuid; cur public.innings%rowtype;
        title text := pg_catalog.btrim(coalesce(p->>'title', '')); details text := nullif(pg_catalog.btrim(coalesce(p->>'details', '')), '');
begin
  m := private.require_scorer(p_match_id);
  if k not in ('decision','incident','disciplinary') then raise exception 'Choose decision, incident or disciplinary.' using errcode = '22023'; end if;
  if pg_catalog.length(title) < 2 or pg_catalog.length(title) > 120 then raise exception 'Give a short title (2–120 characters).' using errcode = '22023'; end if;
  if details is not null and pg_catalog.length(details) > 2000 then raise exception 'Details can be at most 2000 characters.' using errcode = '22023'; end if;
  if act not in ('none','warning','suspension','referred') then raise exception 'Unknown action. (Penalty runs are given from the scoring screen.)' using errcode = '22023'; end if;
  if act = 'suspension' and (sus is null or sus < 1 or sus > 50) then raise exception 'Enter how many matches the suspension lasts (1–50).' using errcode = '22023'; end if;
  if t is not null and t not in (m.team_a_id, m.team_b_id) then raise exception 'Choose one of the two teams in this match.' using errcode = '22023'; end if;
  if pl is not null then
    if not exists (select 1 from public.match_players where match_id = p_match_id and player_id = pl) then raise exception 'Choose a player from this match.' using errcode = '22023'; end if;
    t := coalesce(t, (select team_id from public.match_players where match_id = p_match_id and player_id = pl limit 1));
  end if;
  if k = 'disciplinary' and pl is null and t is null then raise exception 'A disciplinary report must name a player or a team.' using errcode = '22023'; end if;
  select * into cur from public.innings where match_id = p_match_id order by innings_no desc limit 1;
  insert into public.match_reports (match_id, kind, innings_no, over_text, team_id, player_id, title, details, action, suspension_matches, status, created_by)
  values (p_match_id, k, cur.innings_no, case when cur.id is null then null else (cur.legal_balls / 6) || '.' || (cur.legal_balls % 6) end,
          t, pl, title, details, act, case when act = 'suspension' then sus end, case when k = 'decision' then 'closed' else 'open' end, (select auth.uid()))
  returning id into rid;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'MATCH_REPORT_ADDED', 'match_reports', rid::text, jsonb_build_object('match_id', p_match_id, 'kind', k, 'action', act));
  if k = 'disciplinary' or act in ('warning','suspension') then
    insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
    select distinct u, 'match_report', case when k = 'disciplinary' then 'Disciplinary report' else 'Match report' end,
           title || coalesce(' – ' || (select display_name from public.players where id = pl), '') || ' (' ||
           (select name from public.teams where id = m.team_a_id) || ' vs ' || (select name from public.teams where id = m.team_b_id) || ')',
           jsonb_build_object('match_id', p_match_id, 'report_id', rid)
      from (select tm.owner_id as u from public.teams tm where tm.id = t
            union select tr.owner_id from public.tournaments tr where tr.id = m.tournament_id
            union select pp.profile_id from public.players pp where pp.id = pl) x
     where u is not null and u <> (select auth.uid());
  end if;
  return jsonb_build_object('id', rid);
end;
$$;

create or replace function public.close_match_report(p_report_id uuid, p_note text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare r public.match_reports%rowtype; note text := nullif(pg_catalog.btrim(coalesce(p_note, '')), '');
begin
  select * into r from public.match_reports where id = p_report_id for update;
  if not found then raise exception 'Report not found.' using errcode = '22023'; end if;
  perform private.require_scorer(r.match_id);
  if note is not null and pg_catalog.length(note) > 500 then raise exception 'The note can be at most 500 characters.' using errcode = '22023'; end if;
  update public.match_reports set status = case when status = 'open' then 'closed' else 'open' end,
         closed_by = case when status = 'open' then (select auth.uid()) end, closed_at = case when status = 'open' then pg_catalog.now() end,
         closing_note = coalesce(note, closing_note)
   where id = p_report_id returning * into r;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), case when r.status = 'closed' then 'MATCH_REPORT_CLOSED' else 'MATCH_REPORT_REOPENED' end, 'match_reports', r.id::text, jsonb_build_object('match_id', r.match_id));
  return jsonb_build_object('status', r.status);
end;
$$;

-- Decisions are public; incidents and disciplinary reports are visible to the match officials,
-- the organiser, admins and the owners of the two teams.
create or replace function public.list_match_reports(p_match_id uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  with m as (select * from public.matches where id = p_match_id),
  can_see as (select private.can_score_match(p_match_id) or private.is_admin()
                     or exists (select 1 from public.teams t, m where t.id in (m.team_a_id, m.team_b_id) and t.owner_id = (select auth.uid())) as ok)
  select jsonb_build_object(
    'can_add', private.can_score_match(p_match_id),
    'can_see_private', (select ok from can_see),
    'reports', coalesce((select jsonb_agg(jsonb_build_object(
        'id', r.id, 'kind', r.kind, 'innings_no', r.innings_no, 'over', r.over_text, 'title', r.title, 'details', r.details,
        'action', r.action, 'penalty_runs', r.penalty_runs, 'suspension_matches', r.suspension_matches, 'status', r.status,
        'closing_note', r.closing_note, 'created_at', r.created_at, 'closed_at', r.closed_at,
        'team', (select name from public.teams where id = r.team_id), 'player', (select display_name from public.players where id = r.player_id),
        'player_id', r.player_id, 'by', (select display_name from public.profiles where id = r.created_by)) order by r.created_at desc)
      from public.match_reports r where r.match_id = p_match_id and (r.kind = 'decision' or (select ok from can_see))), '[]'::jsonb)
  );
$$;

revoke all on function private.finish_super_over(uuid, uuid) from public, anon, authenticated;
revoke all on function private.apply_pending_penalty() from public, anon, authenticated;
revoke all on function public.start_super_over(uuid, int) from public, anon;
revoke all on function public.award_penalty_runs(uuid, text, int, text) from public, anon;
revoke all on function public.enforce_follow_on(uuid) from public, anon;
revoke all on function public.add_match_report(uuid, jsonb) from public, anon;
revoke all on function public.close_match_report(uuid, text) from public, anon;
revoke all on function public.list_match_reports(uuid) from public;
grant execute on function public.start_super_over(uuid, int) to authenticated;
grant execute on function public.award_penalty_runs(uuid, text, int, text) to authenticated;
grant execute on function public.enforce_follow_on(uuid) to authenticated;
grant execute on function public.add_match_report(uuid, jsonb) to authenticated;
grant execute on function public.close_match_report(uuid, text) to authenticated;
grant execute on function public.list_match_reports(uuid) to anon, authenticated;

-- Undo keeps penalty runs; undoing an unstarted Super Over returns to the tie
create or replace function public.undo_last_ball(p_match_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare m public.matches%rowtype; i public.innings%rowtype; prev public.innings%rowtype; b public.balls%rowtype;
begin
  m := private.require_scorer(p_match_id);
  if m.status = 'abandoned' then raise exception 'This match was abandoned.' using errcode = '22023'; end if;
  if m.status = 'completed' then
    if not exists (select 1 from public.innings where match_id = p_match_id) then
      raise exception 'This result was entered by hand. Change it from the tournament fixtures.' using errcode = '22023';
    end if;
    if m.tournament_id is not null and exists (select 1 from public.tournaments where id = m.tournament_id and status = 'completed') then
      raise exception 'The tournament is finished.' using errcode = '22023';
    end if;
    update public.matches set status = 'live', result_type = null, winner_team_id = null, result_summary = null, completed_at = null where id = p_match_id;
    update public.innings set status = 'in_progress', end_reason = null, completed_at = null
     where id = (select id from public.innings where match_id = p_match_id order by innings_no desc limit 1);
    if m.tournament_id is not null then
      update public.tournaments set matches_completed = (select count(*) from public.matches where tournament_id = m.tournament_id and status in ('completed','abandoned'))
       where id = m.tournament_id;
    end if;
    m.status := 'live';
  end if;
  if m.status <> 'live' then raise exception 'The match is not live.' using errcode = '22023'; end if;

  select * into i from public.innings where match_id = p_match_id order by innings_no desc limit 1;
  if not found then raise exception 'Nothing to undo.' using errcode = '22023'; end if;
  if i.status = 'in_progress' and not exists (select 1 from public.balls where innings_id = i.id) and i.innings_no > 1 then
    delete from public.innings where id = i.id;
    select * into prev from public.innings where match_id = p_match_id order by innings_no desc limit 1;
    -- #121 undoing a Super Over that has not started goes back to the tied result
    if i.is_super_over and not prev.is_super_over then
      perform private.finish_match(p_match_id);
      return public.get_live_state(p_match_id);
    end if;
    update public.innings set status = 'in_progress', end_reason = null, completed_at = null where id = prev.id;
    i := prev;
  end if;

  select * into b from public.balls where innings_id = i.id order by seq desc limit 1;
  if not found then
    perform private.sync_match_score(p_match_id);
    return public.get_live_state(p_match_id);
  end if;
  delete from public.balls where id = b.id;
  update public.innings set
    status = 'in_progress', end_reason = null, completed_at = null,
    runs = coalesce((select sum(runs_bat + extra_runs) from public.balls where innings_id = i.id), 0) + penalty_runs,
    extras = coalesce((select sum(extra_runs) from public.balls where innings_id = i.id), 0) + penalty_runs,
    wickets = (select count(*) from public.balls where innings_id = i.id and is_wicket),
    legal_balls = (select count(*) from public.balls where innings_id = i.id and is_legal),
    striker_id = b.striker_id, non_striker_id = b.non_striker_id, bowler_id = b.bowler_id,
    last_over_bowler_id = b.prev_last_over_bowler_id
  where id = i.id;
  perform private.sync_match_score(p_match_id);
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'BALL_UNDONE', 'matches', p_match_id::text,
          jsonb_build_object('innings', i.innings_no, 'seq', b.seq, 'runs', b.runs_bat + b.extra_runs, 'wicket', b.wicket_type));
  return public.get_live_state(p_match_id);
end;
$$;

-- Playing conditions: follow-on lead (#120); statistics, scoring and live state know about Super Overs
create or replace function private.default_rules()
returns jsonb language sql immutable set search_path = ''
as $$
  select jsonb_build_object(
    'wide_runs', 1, 'no_ball_runs', 1, 'free_hit', true, 'lbw', true, 'byes', true, 'leg_byes', true,
    'max_overs_per_bowler', null, 'retire_at', null,
    'powerplay_overs', 0, 'fielders_outside_powerplay', 2, 'fielders_outside', 5,
    'boundary_size_m', null, 'follow_on_lead', null,
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
         or (k = 'follow_on_lead' and (v::int < 1 or v::int > 500)) then
        raise exception 'Rule % is out of range.', k using errcode = '22023';
      end if;
      r := r || jsonb_build_object(k, v);
    end if;
  end loop;
  return r;
end;
$$;


create or replace function public.player_match_stats(p_player_id uuid default null, p_tournament_id uuid default null, p_match_id uuid default null)
returns table (match_id uuid, tournament_id uuid, team_id uuid, player_id uuid, match_date timestamptz, match_status text,
               batted boolean, runs int, balls int, fours int, sixes int, is_out boolean,
               bowl_balls int, runs_conceded int, wickets int, maidens int, dots int, wides int, no_balls int,
               catches int, run_outs int, stumpings int, points int)
language sql stable security definer set search_path = ''
as $$
  with ms as (
    select m.id, m.tournament_id, coalesce(m.started_at, m.scheduled_at, m.created_at) as at, m.status
      from public.matches m
     where m.status in ('live','completed','abandoned')
       and (p_tournament_id is null or m.tournament_id = p_tournament_id)
       and (p_match_id is null or m.id = p_match_id)
  ),
  bl as (select b.* from public.balls b join ms on ms.id = b.match_id join public.innings ii on ii.id = b.innings_id where not ii.is_super_over),
  players as (
    select mp.match_id, mp.player_id, mp.team_id from public.match_players mp join ms on ms.id = mp.match_id
     where mp.role in ('playing','replaced') and (p_player_id is null or mp.player_id = p_player_id)
  ),
  batted as (
    select distinct match_id, pid from (
      select match_id, striker_id as pid from bl union all select match_id, non_striker_id from bl
      union all select i.match_id, c.player_id from public.innings_crease c join public.innings i on i.id = c.innings_id join ms on ms.id = i.match_id) x
    where pid is not null
  ),
  bat as (
    select match_id, striker_id as pid, sum(runs_bat)::int as runs,
           count(*) filter (where extra_type is distinct from 'wide')::int as balls,
           count(*) filter (where runs_bat = 4)::int as fours, count(*) filter (where runs_bat = 6)::int as sixes
      from bl where striker_id is not null group by 1, 2
  ),
  outs as (select distinct match_id, dismissed_id as pid from bl where is_wicket and dismissed_id is not null and wicket_type is distinct from 'retired_hurt'),
  bowl as (
    select match_id, bowler_id as pid,
           count(*) filter (where is_legal)::int as bowl_balls,
           sum(runs_bat + case when extra_type in ('wide','no_ball') then extra_runs else 0 end)::int as runs_conceded,
           count(*) filter (where is_wicket and wicket_type in ('bowled','caught','lbw','stumped','hit_wicket','caught_and_bowled'))::int as wickets,
           count(*) filter (where is_legal and runs_bat = 0 and (extra_type is null or extra_type in ('bye','leg_bye')))::int as dots,
           count(*) filter (where extra_type = 'wide')::int as wides,
           count(*) filter (where extra_type = 'no_ball')::int as no_balls
      from bl where bowler_id is not null group by 1, 2
  ),
  maid as (
    select match_id, pid, count(*)::int as maidens from (
      select match_id, innings_id, over_no, bowler_id as pid from bl where bowler_id is not null
       group by 1, 2, 3, 4
      having count(*) filter (where is_legal) = 6
         and sum(runs_bat + case when extra_type in ('wide','no_ball') then extra_runs else 0 end) = 0) o
    group by 1, 2
  ),
  fld as (
    select match_id, pid,
           count(*) filter (where kind = 'catch')::int as catches,
           count(*) filter (where kind = 'run_out')::int as run_outs,
           count(*) filter (where kind = 'stumping')::int as stumpings
      from (select match_id, case when wicket_type = 'caught_and_bowled' then bowler_id else fielder_id end as pid,
                   case when wicket_type in ('caught','caught_and_bowled') then 'catch' when wicket_type = 'run_out' then 'run_out'
                        when wicket_type = 'stumped' then 'stumping' end as kind
              from bl where is_wicket and wicket_type in ('caught','caught_and_bowled','run_out','stumped')) f
     where pid is not null group by 1, 2
  )
  select p.match_id, ms.tournament_id, p.team_id, p.player_id, ms.at, ms.status,
         (bt.pid is not null) as batted,
         coalesce(b.runs, 0), coalesce(b.balls, 0), coalesce(b.fours, 0), coalesce(b.sixes, 0), (o.pid is not null),
         coalesce(w.bowl_balls, 0), coalesce(w.runs_conceded, 0), coalesce(w.wickets, 0), coalesce(md.maidens, 0), coalesce(w.dots, 0),
         coalesce(w.wides, 0), coalesce(w.no_balls, 0),
         coalesce(f.catches, 0), coalesce(f.run_outs, 0), coalesce(f.stumpings, 0),
         (coalesce(b.runs, 0) + coalesce(b.fours, 0) + 2 * coalesce(b.sixes, 0)
           + case when coalesce(b.runs, 0) >= 100 then 24 when coalesce(b.runs, 0) >= 50 then 8 else 0 end
           + 25 * coalesce(w.wickets, 0) + 8 * coalesce(md.maidens, 0) + coalesce(w.dots, 0)
           + 8 * coalesce(f.catches, 0) + 12 * coalesce(f.stumpings, 0) + 10 * coalesce(f.run_outs, 0))::int
    from players p
    join ms on ms.id = p.match_id
    left join batted bt on bt.match_id = p.match_id and bt.pid = p.player_id
    left join bat b on b.match_id = p.match_id and b.pid = p.player_id
    left join outs o on o.match_id = p.match_id and o.pid = p.player_id
    left join bowl w on w.match_id = p.match_id and w.pid = p.player_id
    left join maid md on md.match_id = p.match_id and md.pid = p.player_id
    left join fld f on f.match_id = p.match_id and f.pid = p.player_id;
$$;


create or replace function public.record_ball(p_match_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  m public.matches%rowtype; i public.innings%rowtype;
  runs_bat int := coalesce(nullif(p->>'runs', '')::int, 0);
  ext text := nullif(p->>'extra', '');
  ext_add int := coalesce(nullif(p->>'extras', '')::int, 0);
  wk text := nullif(p->>'wicket', '');
  out_end text := coalesce(nullif(p->>'out', ''), 'striker');
  fielder uuid := nullif(p->>'fielder_id', '')::uuid;
  cid uuid := nullif(p->>'client_id', '')::uuid;
  extra_runs int; legal boolean; is_wkt boolean; ran int; dismissed uuid; s uuid; ns uuid; b uuid; last_b uuid; tmp uuid;
  seq_no int; over_idx int; in_over int; overs_limit int; all_out_at int; ended text;
  rules jsonb; fh boolean := false; lastb public.balls%rowtype;
begin
  m := private.require_scorer(p_match_id);
  -- #27 offline sync: a ball that already reached the server (same client id) is not recorded twice
  if cid is not null and exists (select 1 from public.balls where client_id = cid) then
    return public.get_live_state(p_match_id);
  end if;
  if m.status <> 'live' then raise exception 'The match is not live.' using errcode = '22023'; end if;
  rules := private.default_rules() || (coalesce(m.rules, private.effective_rules(m.id)) - 'notes');
  select * into i from public.innings where match_id = p_match_id and status = 'in_progress' order by innings_no desc limit 1 for update;
  if not found then raise exception 'Pick the opening batters and bowler first.' using errcode = '22023'; end if;
  if i.striker_id is null or i.non_striker_id is null then raise exception 'Pick the batters first.' using errcode = '22023'; end if;
  if i.bowler_id is null then raise exception 'Pick the bowler first.' using errcode = '22023'; end if;
  if runs_bat < 0 or runs_bat > 7 or ext_add < 0 or ext_add > 7 then raise exception 'Runs must be between 0 and 7.' using errcode = '22023'; end if;
  if ext is not null and ext not in ('wide','no_ball','bye','leg_bye') then raise exception 'Unknown extra.' using errcode = '22023'; end if;
  if ext in ('wide','bye','leg_bye') and runs_bat > 0 then raise exception 'No runs off the bat on a wide, bye or leg-bye.' using errcode = '22023'; end if;
  if ext in ('bye','leg_bye') and ext_add < 1 then raise exception 'Enter how many byes / leg-byes were run.' using errcode = '22023'; end if;
  if wk is not null and wk not in ('bowled','caught','lbw','run_out','stumped','hit_wicket','caught_and_bowled','obstructing','timed_out','retired_hurt','retired_out') then
    raise exception 'Unknown dismissal.' using errcode = '22023';
  end if;
  if ext = 'no_ball' and wk in ('bowled','caught','lbw','stumped','hit_wicket','caught_and_bowled') then
    raise exception 'A batter cannot be out that way on a no-ball.' using errcode = '22023';
  end if;
  if ext = 'wide' and wk in ('bowled','caught','lbw','caught_and_bowled') then
    raise exception 'A batter cannot be out that way on a wide.' using errcode = '22023';
  end if;
  -- #112 #114 rules switched off for this match
  if wk = 'lbw' and not coalesce((rules->>'lbw')::boolean, true) then raise exception 'LBW is not used in this match.' using errcode = '22023'; end if;
  if ext = 'leg_bye' and not coalesce((rules->>'leg_byes')::boolean, true) then raise exception 'Leg-byes are not allowed in this match.' using errcode = '22023'; end if;
  if ext = 'bye' and not coalesce((rules->>'byes')::boolean, true) then raise exception 'Byes are not allowed in this match.' using errcode = '22023'; end if;
  -- #111 free hit: the ball after a no-ball (and again after a wide/no-ball on a free hit)
  select * into lastb from public.balls where innings_id = i.id order by seq desc limit 1;
  fh := coalesce(coalesce((rules->>'free_hit')::boolean, true) and found and (lastb.extra_type = 'no_ball' or (lastb.free_hit and lastb.extra_type in ('wide','no_ball'))), false);
  if fh and wk in ('bowled','caught','lbw','stumped','hit_wicket','caught_and_bowled') then
    raise exception 'Free hit: the batter can only be run out on this ball.' using errcode = '22023';
  end if;
  if out_end not in ('striker','non_striker') then raise exception 'Choose which batter is out.' using errcode = '22023'; end if;
  if out_end = 'non_striker' and wk not in ('run_out','obstructing','retired_hurt','retired_out','timed_out') then
    raise exception 'Only a run out (or retirement) can dismiss the non-striker.' using errcode = '22023';
  end if;
  if fielder is not null and not exists (select 1 from public.match_players where match_id = p_match_id and team_id = i.bowling_team_id and player_id = fielder) then
    raise exception 'The fielder must be from the fielding side.' using errcode = '22023';
  end if;

  extra_runs := case ext when 'wide' then coalesce((rules->>'wide_runs')::int, 1) + ext_add when 'no_ball' then coalesce((rules->>'no_ball_runs')::int, 1) + ext_add when 'bye' then ext_add when 'leg_bye' then ext_add else 0 end;
  legal := ext is null or ext in ('bye','leg_bye');
  is_wkt := wk is not null and wk <> 'retired_hurt';
  ran := case ext when 'wide' then ext_add when 'no_ball' then runs_bat + ext_add when 'bye' then ext_add when 'leg_bye' then ext_add else runs_bat end;
  if runs_bat in (4, 6) and ext is null then ran := 0; end if;  -- boundary: batters stay
  if runs_bat in (4, 6) and ext = 'no_ball' then ran := ext_add; end if;

  s := i.striker_id; ns := i.non_striker_id; b := i.bowler_id; last_b := i.last_over_bowler_id;
  dismissed := case when wk is null then null when out_end = 'non_striker' then ns else s end;
  select coalesce(max(seq), 0) + 1 into seq_no from public.balls where innings_id = i.id;
  over_idx := i.legal_balls / 6;
  in_over := (i.legal_balls % 6) + case when legal then 1 else 0 end;

  insert into public.balls (match_id, innings_id, seq, over_no, ball_in_over, bowler_id, striker_id, non_striker_id, prev_last_over_bowler_id,
                            runs_bat, extra_type, extra_runs, is_legal, is_wicket, wicket_type, dismissed_id, fielder_id, commentary, created_by, client_id, free_hit)
  values (p_match_id, i.id, seq_no, over_idx, in_over, b, s, ns, last_b,
          runs_bat, ext, extra_runs, legal, is_wkt, wk, dismissed, fielder,
          nullif(pg_catalog.btrim(coalesce(p->>'commentary', '')), ''), (select auth.uid()), cid, fh);

  -- #12 strike rotation on odd runs
  if ran % 2 = 1 then tmp := s; s := ns; ns := tmp; end if;
  -- #10 #11 dismissed batter leaves the crease (slot stays empty until the next batter is picked)
  if dismissed is not null then
    if s = dismissed then s := null; elsif ns = dismissed then ns := null; end if;
  end if;
  -- #13 end of over: batters change ends, a new bowler is needed
  if legal and (i.legal_balls + 1) % 6 = 0 then
    tmp := s; s := ns; ns := tmp; last_b := b; b := null;
  end if;

  update public.innings set
    runs = runs + runs_bat + extra_runs, extras = extras + extra_runs,
    wickets = wickets + case when is_wkt then 1 else 0 end,
    legal_balls = legal_balls + case when legal then 1 else 0 end,
    striker_id = s, non_striker_id = ns, bowler_id = b, last_over_bowler_id = last_b
  where id = i.id
  returning * into i;

  -- #15 #16 has the innings ended?
  overs_limit := coalesce(i.overs_limit, case when coalesce(m.match_type, 'limited_overs') = 'two_innings' then null else m.overs_per_innings end);
  all_out_at := coalesce(i.wickets_limit, greatest(private.playing_count(p_match_id, i.batting_team_id) - 1, 1));
  ended := case
    when i.target is not null and i.runs >= i.target then 'target'
    when i.wickets >= all_out_at then 'all_out'
    when overs_limit is not null and i.legal_balls >= overs_limit * 6 then 'overs'
    else null end;
  if ended is not null then
    perform private.close_innings(i.id, ended);
  else
    perform private.sync_match_score(p_match_id);
  end if;
  return public.get_live_state(p_match_id);
end;
$$;


create or replace function public.get_live_state(p_match_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare m public.matches%rowtype; cur public.innings%rowtype; overs_limit int;
begin
  select * into m from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found.' using errcode = '22023'; end if;
  select * into cur from public.innings where match_id = p_match_id order by innings_no desc limit 1;
  overs_limit := coalesce(cur.overs_limit, case when coalesce(m.match_type, 'limited_overs') = 'two_innings' then null else m.overs_per_innings end);

  return jsonb_build_object(
    'match_id', m.id, 'status', m.status, 'result_summary', m.result_summary, 'result_type', m.result_type, 'match_type', coalesce(m.match_type, 'limited_overs'), 'overs_limit', overs_limit,
    'can_score', private.can_score_match(p_match_id),
    'innings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'innings_no', i.innings_no, 'status', i.status, 'end_reason', i.end_reason, 'is_super_over', i.is_super_over, 'penalty_runs', i.penalty_runs,
        'batting_team', jsonb_build_object('id', bt.id, 'name', bt.name, 'short_name', bt.short_name),
        'bowling_team', jsonb_build_object('id', ft.id, 'name', ft.name, 'short_name', ft.short_name),
        'runs', i.runs, 'wickets', i.wickets, 'legal_balls', i.legal_balls, 'extras', i.extras, 'target', i.target,
        'extras_detail', (select jsonb_build_object(
             'wides', coalesce(sum(extra_runs) filter (where extra_type = 'wide'), 0),
             'no_balls', coalesce(sum(extra_runs) filter (where extra_type = 'no_ball'), 0),
             'byes', coalesce(sum(extra_runs) filter (where extra_type = 'bye'), 0),
             'leg_byes', coalesce(sum(extra_runs) filter (where extra_type = 'leg_bye'), 0))
           from public.balls where innings_id = i.id),
        'batting', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'player_id', bat.pid, 'name', pl.display_name,
                   'runs', coalesce((select sum(runs_bat) from public.balls where innings_id = i.id and striker_id = bat.pid), 0),
                   'balls', (select count(*) from public.balls where innings_id = i.id and striker_id = bat.pid and extra_type is distinct from 'wide'),
                   'fours', (select count(*) from public.balls where innings_id = i.id and striker_id = bat.pid and runs_bat = 4),
                   'sixes', (select count(*) from public.balls where innings_id = i.id and striker_id = bat.pid and runs_bat = 6),
                   'out', (select jsonb_build_object('type', d.wicket_type,
                                                     'bowler', (select display_name from public.players where id = d.bowler_id),
                                                     'fielder', (select display_name from public.players where id = d.fielder_id))
                             from public.balls d where d.innings_id = i.id and d.dismissed_id = bat.pid order by d.seq desc limit 1),
                   'at_crease', bat.pid in (coalesce(i.striker_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(i.non_striker_id, '00000000-0000-0000-0000-000000000000'::uuid)),
                   'on_strike', bat.pid = i.striker_id,
                   'minutes', greatest(0, ceil(extract(epoch from (
                       coalesce((select d.created_at from public.balls d where d.innings_id = i.id and d.dismissed_id = bat.pid order by d.seq desc limit 1),
                                case when i.status = 'completed' then coalesce(i.completed_at, (select max(created_at) from public.balls where innings_id = i.id)) else pg_catalog.now() end)
                       - coalesce((select c.arrived_at from public.innings_crease c where c.innings_id = i.id and c.player_id = bat.pid),
                                  (select min(created_at) from public.balls where innings_id = i.id and bat.pid in (striker_id, non_striker_id)),
                                  pg_catalog.now()))) / 60.0))::int)
                 order by bat.first_seq)
          from (select pid, min(first_seq) as first_seq from (
                  select striker_id as pid, seq as first_seq from public.balls where innings_id = i.id
                  union all select non_striker_id, seq from public.balls where innings_id = i.id
                  union all select i.striker_id, 100000 where i.striker_id is not null
                  union all select i.non_striker_id, 100001 where i.non_striker_id is not null) x
                where pid is not null group by pid) bat
          join public.players pl on pl.id = bat.pid), '[]'::jsonb),
        'bowling', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'player_id', bw.bowler_id, 'name', pl.display_name, 'legal_balls', bw.legal, 'runs', bw.runs, 'wickets', bw.wkts,
                   'wides', bw.wides, 'no_balls', bw.nbs, 'maidens', bw.maidens, 'current', bw.bowler_id = i.bowler_id)
                 order by bw.first_seq)
          from (select bowler_id, min(seq) as first_seq,
                       count(*) filter (where is_legal) as legal,
                       sum(runs_bat + case when extra_type in ('wide','no_ball') then extra_runs else 0 end) as runs,
                       count(*) filter (where is_wicket and wicket_type in ('bowled','caught','lbw','stumped','hit_wicket','caught_and_bowled')) as wkts,
                       count(*) filter (where extra_type = 'wide') as wides,
                       count(*) filter (where extra_type = 'no_ball') as nbs,
                       (select count(*) from (select over_no from public.balls b2 where b2.innings_id = i.id and b2.bowler_id = b1.bowler_id
                                               group by over_no
                                               having count(*) filter (where is_legal) = 6
                                                  and sum(runs_bat + case when extra_type in ('wide','no_ball') then extra_runs else 0 end) = 0) mo) as maidens
                  from public.balls b1 where innings_id = i.id and bowler_id is not null group by bowler_id) bw
          join public.players pl on pl.id = bw.bowler_id), '[]'::jsonb),
        'fall_of_wickets', coalesce((
          select jsonb_agg(jsonb_build_object('wicket', f.n, 'runs', f.score, 'over', f.over_txt, 'name', f.name) order by f.n)
          from (select row_number() over (order by d.seq) as n,
                       (select sum(runs_bat + extra_runs) from public.balls x where x.innings_id = i.id and x.seq <= d.seq) as score,
                       (d.over_no || '.' || d.ball_in_over) as over_txt,
                       (select display_name from public.players where id = d.dismissed_id) as name
                  from public.balls d where d.innings_id = i.id and d.is_wicket) f), '[]'::jsonb)
      ) order by i.innings_no)
      from public.innings i
      join public.teams bt on bt.id = i.batting_team_id
      join public.teams ft on ft.id = i.bowling_team_id
      where i.match_id = p_match_id), '[]'::jsonb),
    'current', case when cur.id is null then null else jsonb_build_object(
        'innings_id', cur.id, 'innings_no', cur.innings_no, 'status', cur.status, 'is_super_over', cur.is_super_over,
        'batting_team_id', cur.batting_team_id, 'bowling_team_id', cur.bowling_team_id,
        'striker_id', cur.striker_id, 'non_striker_id', cur.non_striker_id, 'bowler_id', cur.bowler_id,
        'last_over_bowler_id', cur.last_over_bowler_id,
        'runs', cur.runs, 'wickets', cur.wickets, 'legal_balls', cur.legal_balls, 'target', cur.target,
        'runs_needed', case when cur.target is null then null else greatest(cur.target - cur.runs, 0) end,
        'balls_left', case when overs_limit is null then null else greatest(overs_limit * 6 - cur.legal_balls, 0) end,
        'this_over', coalesce((select jsonb_agg(jsonb_build_object('runs', runs_bat, 'extra', extra_type, 'extra_runs', extra_runs,
                                                                   'wicket', wicket_type, 'legal', is_legal) order by seq)
                               from public.balls where innings_id = cur.id and over_no = (case when cur.legal_balls % 6 = 0 and cur.bowler_id is null
                                                                                                then cur.legal_balls / 6 - 1 else cur.legal_balls / 6 end)), '[]'::jsonb),
        'recent', coalesce((select jsonb_agg(r.j order by r.seq desc) from (
                     select b.seq, jsonb_build_object('seq', b.seq, 'over', b.over_no || '.' || b.ball_in_over, 'runs', b.runs_bat,
                              'extra', b.extra_type, 'extra_runs', b.extra_runs, 'wicket', b.wicket_type,
                              'bowler', (select display_name from public.players where id = b.bowler_id),
                              'batter', (select display_name from public.players where id = b.striker_id),
                              'out_name', (select display_name from public.players where id = b.dismissed_id),
                              'commentary', b.commentary) as j
                     from public.balls b where b.innings_id = cur.id order by b.seq desc limit 18) r), '[]'::jsonb),
        'batting_side', coalesce((select jsonb_agg(jsonb_build_object('player_id', mp.player_id, 'name', p.display_name,
                                   'out', exists (select 1 from public.balls where innings_id = cur.id and dismissed_id = mp.player_id and is_wicket),
                                   'retired_hurt', exists (select 1 from public.balls where innings_id = cur.id and dismissed_id = mp.player_id and wicket_type = 'retired_hurt'))
                                   order by mp.batting_order nulls last)
                                  from public.match_players mp join public.players p on p.id = mp.player_id
                                 where mp.match_id = p_match_id and mp.team_id = cur.batting_team_id and mp.role = 'playing'), '[]'::jsonb),
        'partnership', (select jsonb_build_object('runs', coalesce(sum(runs_bat + extra_runs), 0), 'balls', count(*) filter (where is_legal))
                          from public.balls where innings_id = cur.id
                           and seq > coalesce((select max(seq) from public.balls where innings_id = cur.id and dismissed_id is not null), 0)),
        'yet_to_bat', coalesce((select jsonb_agg(p.display_name order by mp.batting_order nulls last)
                                  from public.match_players mp join public.players p on p.id = mp.player_id
                                 where mp.match_id = p_match_id and mp.team_id = cur.batting_team_id and mp.role = 'playing'
                                   and mp.player_id is distinct from cur.striker_id and mp.player_id is distinct from cur.non_striker_id
                                   and not exists (select 1 from public.balls where innings_id = cur.id and mp.player_id in (striker_id, non_striker_id))), '[]'::jsonb),
        'bowling_side', coalesce((select jsonb_agg(jsonb_build_object('player_id', mp.player_id, 'name', p.display_name,
                                   'is_wicket_keeper', mp.is_wicket_keeper) order by p.display_name)
                                  from public.match_players mp join public.players p on p.id = mp.player_id
                                 where mp.match_id = p_match_id and mp.team_id = cur.bowling_team_id and mp.role = 'playing'), '[]'::jsonb)
      ) end
  );
end;
$$;
