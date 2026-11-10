-- Phase 3 / Category A – ball-by-ball scoring
-- #7 Ball-by-ball scoring, #8 runs, #9 extras, #10 wickets and dismissal types, #11 retired hurt / retired out,
-- #12 automatic strike rotation, #13 end-of-over strike change, #14 bowler selection and changes,
-- #15 over and innings management, #16 target, #17 result, #18 undo / correction, #19 abandoned and tied matches.
--
-- Every delivery is one row in public.balls and keeps the batters/bowler from BEFORE the ball, so "undo" can put
-- everything back exactly. Innings totals and the match score (used by lists and the points table) are updated
-- after every ball. All writes go through functions; only the match scorer (or organiser / admin) may score.

alter table public.matches
  add column if not exists team_a_all_out boolean not null default false,
  add column if not exists team_b_all_out boolean not null default false;

create table if not exists public.innings (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  innings_no int not null check (innings_no between 1 and 4),
  batting_team_id uuid not null references public.teams(id) on delete cascade,
  bowling_team_id uuid not null references public.teams(id) on delete cascade,
  target int check (target is null or target > 0),
  status text not null default 'in_progress' check (status in ('in_progress','completed')),
  end_reason text check (end_reason is null or end_reason in ('all_out','overs','target','declared','closed')),
  runs int not null default 0, wickets int not null default 0, legal_balls int not null default 0, extras int not null default 0,
  striker_id uuid references public.players(id) on delete set null,
  non_striker_id uuid references public.players(id) on delete set null,
  bowler_id uuid references public.players(id) on delete set null,
  last_over_bowler_id uuid references public.players(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (match_id, innings_no)
);
create index if not exists innings_batting_team_idx on public.innings (batting_team_id);
create index if not exists innings_bowling_team_idx on public.innings (bowling_team_id);
create index if not exists innings_striker_idx on public.innings (striker_id);
create index if not exists innings_non_striker_idx on public.innings (non_striker_id);
create index if not exists innings_bowler_idx on public.innings (bowler_id);
create index if not exists innings_last_bowler_idx on public.innings (last_over_bowler_id);

create table if not exists public.balls (
  id bigint generated always as identity primary key,
  match_id uuid not null references public.matches(id) on delete cascade,
  innings_id uuid not null references public.innings(id) on delete cascade,
  seq int not null,
  over_no int not null,
  ball_in_over int not null,
  bowler_id uuid references public.players(id) on delete set null,
  striker_id uuid references public.players(id) on delete set null,
  non_striker_id uuid references public.players(id) on delete set null,
  prev_last_over_bowler_id uuid references public.players(id) on delete set null,
  runs_bat int not null default 0 check (runs_bat between 0 and 7),
  extra_type text check (extra_type is null or extra_type in ('wide','no_ball','bye','leg_bye')),
  extra_runs int not null default 0 check (extra_runs between 0 and 8),
  is_legal boolean not null,
  is_wicket boolean not null default false,
  wicket_type text check (wicket_type is null or wicket_type in ('bowled','caught','lbw','run_out','stumped','hit_wicket',
                                                               'caught_and_bowled','obstructing','timed_out','retired_hurt','retired_out')),
  dismissed_id uuid references public.players(id) on delete set null,
  fielder_id uuid references public.players(id) on delete set null,
  commentary text check (commentary is null or pg_catalog.length(commentary) <= 300),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (innings_id, seq)
);
create index if not exists balls_match_idx on public.balls (match_id);
create index if not exists balls_bowler_idx on public.balls (bowler_id);
create index if not exists balls_striker_idx on public.balls (striker_id);
create index if not exists balls_non_striker_idx on public.balls (non_striker_id);
create index if not exists balls_dismissed_idx on public.balls (dismissed_id);
create index if not exists balls_fielder_idx on public.balls (fielder_id);
create index if not exists balls_prev_bowler_idx on public.balls (prev_last_over_bowler_id);
create index if not exists balls_created_by_idx on public.balls (created_by);

alter table public.innings enable row level security;
alter table public.balls enable row level security;
drop policy if exists innings_read on public.innings;
create policy innings_read on public.innings for select to anon, authenticated using (true);
drop policy if exists balls_read on public.balls;
create policy balls_read on public.balls for select to anon, authenticated using (true);
revoke all on public.innings, public.balls from anon, authenticated;
grant select on public.innings, public.balls to anon, authenticated;
grant all on public.innings, public.balls to service_role;

-- ---------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------
create or replace function private.require_scorer(p_match_id uuid)
returns public.matches language plpgsql stable security definer set search_path = ''
as $$
declare m public.matches%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  select * into m from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found.' using errcode = '22023'; end if;
  if not private.can_score_match(p_match_id) then
    raise exception 'Only the match scorer or the tournament organiser can score this match.' using errcode = '42501';
  end if;
  return m;
end;
$$;
revoke all on function private.require_scorer(uuid) from public, anon, authenticated;

create or replace function private.playing_count(p_match_id uuid, p_team_id uuid)
returns int language sql stable security definer set search_path = ''
as $$ select count(*)::int from public.match_players where match_id = p_match_id and team_id = p_team_id and role = 'playing'; $$;
revoke all on function private.playing_count(uuid, uuid) from public, anon, authenticated;

-- Copy innings totals onto the match row (lists, live score, points table).
create or replace function private.sync_match_score(p_match_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare m public.matches%rowtype;
begin
  select * into m from public.matches where id = p_match_id;
  update public.matches set
    team_a_runs    = (select sum(runs)::int from public.innings where match_id = p_match_id and batting_team_id = m.team_a_id),
    team_a_wickets = (select wickets from public.innings where match_id = p_match_id and batting_team_id = m.team_a_id order by innings_no desc limit 1),
    team_a_balls   = (select sum(legal_balls)::int from public.innings where match_id = p_match_id and batting_team_id = m.team_a_id),
    team_a_all_out = coalesce((select end_reason = 'all_out' from public.innings where match_id = p_match_id and batting_team_id = m.team_a_id order by innings_no desc limit 1), false),
    team_b_runs    = (select sum(runs)::int from public.innings where match_id = p_match_id and batting_team_id = m.team_b_id),
    team_b_wickets = (select wickets from public.innings where match_id = p_match_id and batting_team_id = m.team_b_id order by innings_no desc limit 1),
    team_b_balls   = (select sum(legal_balls)::int from public.innings where match_id = p_match_id and batting_team_id = m.team_b_id),
    team_b_all_out = coalesce((select end_reason = 'all_out' from public.innings where match_id = p_match_id and batting_team_id = m.team_b_id order by innings_no desc limit 1), false)
  where id = p_match_id;
end;
$$;
revoke all on function private.sync_match_score(uuid) from public, anon, authenticated;

-- #17 Work out the result once the last innings is over.
create or replace function private.finish_match(p_match_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare m public.matches%rowtype; ra int; rb int; w uuid; last record; summary text; wleft int; wname text; rtype text;
begin
  perform private.sync_match_score(p_match_id);
  select * into m from public.matches where id = p_match_id;
  ra := coalesce(m.team_a_runs, 0); rb := coalesce(m.team_b_runs, 0);
  select * into last from public.innings where match_id = p_match_id order by innings_no desc limit 1;
  if ra = rb then
    rtype := 'tie'; w := null; summary := 'Match tied';
  else
    rtype := 'win'; w := case when ra > rb then m.team_a_id else m.team_b_id end;
    select name into wname from public.teams where id = w;
    if last.batting_team_id = w then
      wleft := greatest(private.playing_count(p_match_id, w) - 1 - last.wickets, 0);
      summary := wname || ' won by ' || wleft || ' wicket' || case when wleft = 1 then '' else 's' end;
    else
      summary := wname || ' won by ' || abs(ra - rb) || ' run' || case when abs(ra - rb) = 1 then '' else 's' end;
    end if;
  end if;
  update public.matches set status = 'completed', result_type = rtype, winner_team_id = w, result_summary = summary,
         completed_at = pg_catalog.now()
   where id = p_match_id;
  if m.tournament_id is not null then
    update public.tournaments set matches_completed = (select count(*) from public.matches where tournament_id = m.tournament_id and status in ('completed','abandoned'))
     where id = m.tournament_id;
  end if;
  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  select distinct t.owner_id, 'match_result', 'Match result',
         (select name from public.teams where id = m.team_a_id) || ' vs ' || (select name from public.teams where id = m.team_b_id) || ': ' || summary,
         jsonb_build_object('match_id', p_match_id)
    from public.teams t where t.id in (m.team_a_id, m.team_b_id);
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'MATCH_COMPLETED', 'matches', p_match_id::text, jsonb_build_object('result', summary));
end;
$$;
revoke all on function private.finish_match(uuid) from public, anon, authenticated;

-- #15 Close an innings and open the next one (or finish the match).
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

  if coalesce(m.match_type, 'limited_overs') <> 'two_innings' then
    if i.innings_no = 1 then
      insert into public.innings (match_id, innings_no, batting_team_id, bowling_team_id, target)
      values (i.match_id, 2, i.bowling_team_id, i.batting_team_id, i.runs + 1);
    else
      perform private.finish_match(i.match_id);
    end if;
    return;
  end if;

  -- two-innings match: A, B, A, B; the 4th innings chases a target
  if i.innings_no = 4 or (i.innings_no = 3 and p_reason <> 'declared' and
       (select coalesce(sum(runs), 0) from public.innings where match_id = i.match_id and batting_team_id = i.batting_team_id)
       < (select coalesce(sum(runs), 0) from public.innings where match_id = i.match_id and batting_team_id = i.bowling_team_id)) then
    perform private.finish_match(i.match_id);  -- 3rd innings still behind: the other side has won (by an innings)
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
revoke all on function private.close_innings(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- #14 Pick openers / next batter / bowler
-- ---------------------------------------------------------------------------------------------
create or replace function public.set_innings_players(p_match_id uuid, p_striker uuid default null, p_non_striker uuid default null, p_bowler uuid default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare m public.matches%rowtype; i public.innings%rowtype; s uuid; ns uuid; b uuid; balls_this_over int;
begin
  m := private.require_scorer(p_match_id);
  if m.status <> 'live' then raise exception 'The match is not live.' using errcode = '22023'; end if;
  select * into i from public.innings where match_id = p_match_id and status = 'in_progress' order by innings_no desc limit 1;
  if not found then
    if exists (select 1 from public.innings where match_id = p_match_id) then
      raise exception 'No innings is in progress.' using errcode = '22023';
    end if;
    -- first innings starts after the toss
    insert into public.innings (match_id, innings_no, batting_team_id, bowling_team_id)
    values (p_match_id, 1, m.batting_first_team_id,
            case when m.batting_first_team_id = m.team_a_id then m.team_b_id else m.team_a_id end)
    returning * into i;
  end if;
  s := coalesce(p_striker, i.striker_id); ns := coalesce(p_non_striker, i.non_striker_id); b := coalesce(p_bowler, i.bowler_id);

  if s is not null and s = ns then raise exception 'Striker and non-striker must be different players.' using errcode = '22023'; end if;
  if exists (select 1 from unnest(array[s, ns]) x where x is not null and (
        not exists (select 1 from public.match_players where match_id = p_match_id and team_id = i.batting_team_id and player_id = x and role = 'playing')
        or exists (select 1 from public.balls where innings_id = i.id and dismissed_id = x and is_wicket))) then
    raise exception 'Batters must be in the batting side''s Playing XI and not out.' using errcode = '22023';
  end if;
  if b is not null and not exists (select 1 from public.match_players where match_id = p_match_id and team_id = i.bowling_team_id and player_id = b and role = 'playing') then
    raise exception 'The bowler must be in the fielding side''s Playing XI.' using errcode = '22023';
  end if;
  select count(*) into balls_this_over from public.balls where innings_id = i.id and over_no = i.legal_balls / 6;
  if p_bowler is not null and p_bowler = i.last_over_bowler_id and balls_this_over = 0
     and private.playing_count(p_match_id, i.bowling_team_id) > 1 then
    raise exception 'The same bowler cannot bowl two overs in a row.' using errcode = '22023';
  end if;

  update public.innings set striker_id = s, non_striker_id = ns, bowler_id = b where id = i.id;
  return public.get_live_state(p_match_id);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- #7–#13 Record one delivery.
-- p: {runs, extra: null|wide|no_ball|bye|leg_bye, extras (runs run on a wide / no-ball byes / byes),
--     wicket: null|bowled|caught|..., out: 'striker'|'non_striker', fielder_id, commentary}
-- ---------------------------------------------------------------------------------------------
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
  extra_runs int; legal boolean; is_wkt boolean; ran int; dismissed uuid; s uuid; ns uuid; b uuid; last_b uuid; tmp uuid;
  seq_no int; over_idx int; in_over int; overs_limit int; all_out_at int; ended text;
begin
  m := private.require_scorer(p_match_id);
  if m.status <> 'live' then raise exception 'The match is not live.' using errcode = '22023'; end if;
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
  if out_end not in ('striker','non_striker') then raise exception 'Choose which batter is out.' using errcode = '22023'; end if;
  if out_end = 'non_striker' and wk not in ('run_out','obstructing','retired_hurt','retired_out','timed_out') then
    raise exception 'Only a run out (or retirement) can dismiss the non-striker.' using errcode = '22023';
  end if;
  if fielder is not null and not exists (select 1 from public.match_players where match_id = p_match_id and team_id = i.bowling_team_id and player_id = fielder) then
    raise exception 'The fielder must be from the fielding side.' using errcode = '22023';
  end if;

  extra_runs := case ext when 'wide' then 1 + ext_add when 'no_ball' then 1 + ext_add when 'bye' then ext_add when 'leg_bye' then ext_add else 0 end;
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
                            runs_bat, extra_type, extra_runs, is_legal, is_wicket, wicket_type, dismissed_id, fielder_id, commentary, created_by)
  values (p_match_id, i.id, seq_no, over_idx, in_over, b, s, ns, last_b,
          runs_bat, ext, extra_runs, legal, is_wkt, wk, dismissed, fielder,
          nullif(pg_catalog.btrim(coalesce(p->>'commentary', '')), ''), (select auth.uid()));

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
  overs_limit := case when coalesce(m.match_type, 'limited_overs') = 'two_innings' then null else m.overs_per_innings end;
  all_out_at := greatest(private.playing_count(p_match_id, i.batting_team_id) - 1, 1);
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

-- #18 Undo the last ball (also re-opens a just-closed innings or a just-finished match).
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
    update public.innings set status = 'in_progress', end_reason = null, completed_at = null where id = prev.id;
    i := prev;
  end if;

  select * into b from public.balls where innings_id = i.id order by seq desc limit 1;
  if not found then
    perform private.sync_match_score(p_match_id);
    return public.get_live_state(p_match_id);  -- innings re-opened, nothing else to remove
  end if;
  delete from public.balls where id = b.id;
  update public.innings set
    status = 'in_progress', end_reason = null, completed_at = null,
    runs = coalesce((select sum(runs_bat + extra_runs) from public.balls where innings_id = i.id), 0),
    extras = coalesce((select sum(extra_runs) from public.balls where innings_id = i.id), 0),
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

-- End the current innings by hand (declared, rain-shortened, team cannot continue).
create or replace function public.end_innings(p_match_id uuid, p_reason text default 'closed')
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare m public.matches%rowtype; i public.innings%rowtype;
begin
  m := private.require_scorer(p_match_id);
  if m.status <> 'live' then raise exception 'The match is not live.' using errcode = '22023'; end if;
  if p_reason not in ('declared','closed') then raise exception 'Unknown reason.' using errcode = '22023'; end if;
  select * into i from public.innings where match_id = p_match_id and status = 'in_progress' order by innings_no desc limit 1;
  if not found then raise exception 'No innings is in progress.' using errcode = '22023'; end if;
  perform private.close_innings(i.id, p_reason);
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'INNINGS_ENDED', 'matches', p_match_id::text, jsonb_build_object('innings', i.innings_no, 'reason', p_reason));
  return public.get_live_state(p_match_id);
end;
$$;

-- #19 Abandon a match (rain, bad light, ground…). Counts as "no result" in the points table.
create or replace function public.abandon_match(p_match_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare m public.matches%rowtype; reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
begin
  m := private.require_scorer(p_match_id);
  if m.status not in ('scheduled','live') then raise exception 'This match is already finished.' using errcode = '22023'; end if;
  if reason is null then raise exception 'Give a reason (e.g. rain).' using errcode = '22023'; end if;
  perform private.sync_match_score(p_match_id);
  update public.innings set status = 'completed', end_reason = 'closed', completed_at = pg_catalog.now(),
         striker_id = null, non_striker_id = null, bowler_id = null
   where match_id = p_match_id and status = 'in_progress';
  update public.matches set status = 'abandoned', result_type = 'no_result', winner_team_id = null,
         result_summary = 'No result – ' || reason, completed_at = pg_catalog.now()
   where id = p_match_id;
  if m.tournament_id is not null then
    update public.tournaments set matches_completed = (select count(*) from public.matches where tournament_id = m.tournament_id and status in ('completed','abandoned'))
     where id = m.tournament_id;
  end if;
  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  select distinct t.owner_id, 'match_abandoned', 'Match abandoned',
         (select name from public.teams where id = m.team_a_id) || ' vs ' || (select name from public.teams where id = m.team_b_id) || ': no result (' || reason || ').',
         jsonb_build_object('match_id', p_match_id)
    from public.teams t where t.id in (m.team_a_id, m.team_b_id);
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'MATCH_ABANDONED', 'matches', p_match_id::text, jsonb_build_object('reason', reason));
  return public.get_live_state(p_match_id);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Live state: everything the scoring screen and spectators need, in one call.
-- ---------------------------------------------------------------------------------------------
create or replace function public.get_live_state(p_match_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare m public.matches%rowtype; cur public.innings%rowtype; overs_limit int;
begin
  select * into m from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found.' using errcode = '22023'; end if;
  select * into cur from public.innings where match_id = p_match_id order by innings_no desc limit 1;
  overs_limit := case when coalesce(m.match_type, 'limited_overs') = 'two_innings' then null else m.overs_per_innings end;

  return jsonb_build_object(
    'match_id', m.id, 'status', m.status, 'result_summary', m.result_summary, 'overs_limit', overs_limit,
    'can_score', private.can_score_match(p_match_id),
    'innings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'innings_no', i.innings_no, 'status', i.status, 'end_reason', i.end_reason,
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
                   'on_strike', bat.pid = i.striker_id)
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
        'innings_id', cur.id, 'innings_no', cur.innings_no, 'status', cur.status,
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
        'bowling_side', coalesce((select jsonb_agg(jsonb_build_object('player_id', mp.player_id, 'name', p.display_name,
                                   'is_wicket_keeper', mp.is_wicket_keeper) order by p.display_name)
                                  from public.match_players mp join public.players p on p.id = mp.player_id
                                 where mp.match_id = p_match_id and mp.team_id = cur.bowling_team_id and mp.role = 'playing'), '[]'::jsonb)
      ) end
  );
end;
$$;

-- Points table: a side bowled out counts its full overs for NRR, whatever the team size.
create or replace function public.get_points_table(p_tournament_id uuid)
returns table (group_id uuid, group_name text, team_id uuid, team_name text, short_name text, logo_url text,
               played int, won int, lost int, tied int, no_result int, points int,
               runs_for int, balls_faced int, runs_against int, balls_bowled int, nrr numeric,
               rank_no int, qualified boolean)
language sql stable security definer set search_path = ''
as $$
  with t as (select * from public.tournaments where id = p_tournament_id),
  entrants as (
    select tt.team_id, tt.group_id from public.tournament_teams tt where tt.tournament_id = p_tournament_id and tt.status = 'approved'
  ),
  m as (
    select mm.*, coalesce(mm.overs_per_innings, (select overs_per_innings from t)) as ov from public.matches mm
     where mm.tournament_id = p_tournament_id and mm.stage in ('league','group')
       and mm.status in ('completed','abandoned') and mm.result_type is not null
  ),
  sides as (
    select m.id, m.team_a_id as team_id, m.result_type, m.winner_team_id,
           m.team_a_runs as rf, case when (m.team_a_wickets >= 10 or m.team_a_all_out) and m.ov is not null then m.ov * 6 else m.team_a_balls end as bf,
           m.team_b_runs as ra, case when (m.team_b_wickets >= 10 or m.team_b_all_out) and m.ov is not null then m.ov * 6 else m.team_b_balls end as bb
      from m
    union all
    select m.id, m.team_b_id, m.result_type, m.winner_team_id,
           m.team_b_runs, case when (m.team_b_wickets >= 10 or m.team_b_all_out) and m.ov is not null then m.ov * 6 else m.team_b_balls end,
           m.team_a_runs, case when (m.team_a_wickets >= 10 or m.team_a_all_out) and m.ov is not null then m.ov * 6 else m.team_a_balls end
      from m
  ),
  agg as (
    select s.team_id,
           count(*)::int as played,
           count(*) filter (where s.result_type in ('win','walkover') and s.winner_team_id = s.team_id)::int as won,
           count(*) filter (where s.result_type in ('win','walkover') and s.winner_team_id <> s.team_id)::int as lost,
           count(*) filter (where s.result_type = 'tie')::int as tied,
           count(*) filter (where s.result_type = 'no_result')::int as no_result,
           coalesce(sum(s.rf) filter (where s.result_type in ('win','tie') and s.bf > 0 and s.bb > 0), 0)::int as runs_for,
           coalesce(sum(s.bf) filter (where s.result_type in ('win','tie') and s.bf > 0 and s.bb > 0), 0)::int as balls_faced,
           coalesce(sum(s.ra) filter (where s.result_type in ('win','tie') and s.bf > 0 and s.bb > 0), 0)::int as runs_against,
           coalesce(sum(s.bb) filter (where s.result_type in ('win','tie') and s.bf > 0 and s.bb > 0), 0)::int as balls_bowled
      from sides s group by s.team_id
  ),
  rows as (
    select e.group_id, g.name as group_name, g.sort_order, e.team_id, tm.name as team_name, tm.short_name, tm.logo_url,
           coalesce(a.played, 0) as played, coalesce(a.won, 0) as won, coalesce(a.lost, 0) as lost,
           coalesce(a.tied, 0) as tied, coalesce(a.no_result, 0) as no_result,
           (coalesce(a.won, 0) * (select points_win from t) + coalesce(a.tied, 0) * (select points_tie from t)
             + coalesce(a.no_result, 0) * (select points_no_result from t))::int as points,
           coalesce(a.runs_for, 0) as runs_for, coalesce(a.balls_faced, 0) as balls_faced,
           coalesce(a.runs_against, 0) as runs_against, coalesce(a.balls_bowled, 0) as balls_bowled,
           pg_catalog.round(
             case when coalesce(a.balls_faced, 0) > 0 then a.runs_for * 6.0 / a.balls_faced else 0 end
             - case when coalesce(a.balls_bowled, 0) > 0 then a.runs_against * 6.0 / a.balls_bowled else 0 end, 3) as nrr
      from entrants e
      join public.teams tm on tm.id = e.team_id
      left join public.tournament_groups g on g.id = e.group_id
      left join agg a on a.team_id = e.team_id
  ),
  ranked as (
    select r.*, (row_number() over (partition by r.group_id order by r.points desc, r.nrr desc, r.won desc, r.team_name))::int as rank_no
      from rows r
  )
  select r.group_id, r.group_name, r.team_id, r.team_name, r.short_name, r.logo_url,
         r.played, r.won, r.lost, r.tied, r.no_result, r.points,
         r.runs_for, r.balls_faced, r.runs_against, r.balls_bowled, r.nrr, r.rank_no,
         (r.rank_no <= (select qualify_per_group from t) and r.played > 0) as qualified
    from ranked r
   order by r.sort_order nulls first, r.group_name nulls first, r.rank_no;
$$;

revoke all on function public.set_innings_players(uuid, uuid, uuid, uuid) from public, anon;
revoke all on function public.record_ball(uuid, jsonb) from public, anon;
revoke all on function public.undo_last_ball(uuid) from public, anon;
revoke all on function public.end_innings(uuid, text) from public, anon;
revoke all on function public.abandon_match(uuid, text) from public, anon;
revoke all on function public.get_live_state(uuid) from public;
grant execute on function public.set_innings_players(uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.record_ball(uuid, jsonb) to authenticated;
grant execute on function public.undo_last_ball(uuid) to authenticated;
grant execute on function public.end_innings(uuid, text) to authenticated;
grant execute on function public.abandon_match(uuid, text) to authenticated;
grant execute on function public.get_live_state(uuid) to anon, authenticated;
