-- Phase 3 / Category D – Cricket statistics and analytics (#79–#102), and Phase 2 #57 leaderboards,
-- #77 player career statistics, #78 awards and achievements.
-- Everything is worked out from the scored balls, so it is always in step with the scorecards.
--
-- MVP points (used for Player of the Match #96 and Most Valuable Player #97):
--   batting  : 1 per run, +1 per four, +2 per six, +8 for a fifty, +24 for a hundred
--   bowling  : 25 per wicket, 8 per maiden, 1 per dot ball
--   fielding : 8 per catch, 12 per stumping, 10 per run-out

alter table public.matches
  add column if not exists player_of_match_id uuid references public.players(id) on delete set null,
  add column if not exists player_of_match_by_hand boolean not null default false;
create index if not exists matches_pom_idx on public.matches (player_of_match_id);

-- One row per player per match: batting, bowling and fielding figures + MVP points.
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
  bl as (select b.* from public.balls b join ms on ms.id = b.match_id),
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

-- #96 Player of the Match: picked automatically (most MVP points) when a scored match finishes.
create or replace function private.auto_player_of_match()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'completed' and (old.status is distinct from 'completed') and not new.player_of_match_by_hand
     and exists (select 1 from public.balls where match_id = new.id) then
    update public.matches set player_of_match_id = (
      select s.player_id from public.player_match_stats(null, null, new.id) s
       order by s.points desc, coalesce(s.team_id = new.winner_team_id, false) desc, s.runs desc, s.wickets desc limit 1)
     where id = new.id;
  elsif new.status <> 'completed' and old.status = 'completed' and not new.player_of_match_by_hand then
    update public.matches set player_of_match_id = null where id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function private.auto_player_of_match() from public, anon, authenticated;
drop trigger if exists matches_auto_pom on public.matches;
create trigger matches_auto_pom after update of status on public.matches for each row execute function private.auto_player_of_match();

-- Scorer / organiser can choose a different Player of the Match (or clear the choice to go back to automatic).
create or replace function public.set_player_of_match(p_match_id uuid, p_player_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare m public.matches%rowtype; pick uuid := p_player_id;
begin
  m := private.require_scorer(p_match_id);
  if m.status <> 'completed' then raise exception 'Player of the Match is chosen after the match.' using errcode = '22023'; end if;
  if pick is not null and not exists (select 1 from public.match_players where match_id = p_match_id and player_id = pick and role in ('playing','replaced')) then
    raise exception 'Choose a player who played in this match.' using errcode = '22023';
  end if;
  if pick is null then
    select s.player_id into pick from public.player_match_stats(null, null, p_match_id) s
     order by s.points desc, coalesce(s.team_id = m.winner_team_id, false) desc, s.runs desc, s.wickets desc limit 1;
  end if;
  update public.matches set player_of_match_id = pick, player_of_match_by_hand = (p_player_id is not null) where id = p_match_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'PLAYER_OF_MATCH_SET', 'matches', p_match_id::text, jsonb_build_object('player_id', pick, 'by_hand', p_player_id is not null));
  return jsonb_build_object('player_of_match_id', pick);
end;
$$;

-- #77 #78 #79–#95 #100 Career statistics, awards and match-by-match figures for one player.
create or replace function public.get_player_stats(p_player_id uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  with s as (select * from public.player_match_stats(p_player_id, null, null)),
  agg as (
    select count(*)::int as matches,
           count(*) filter (where batted)::int as innings,
           count(*) filter (where batted and not is_out)::int as not_outs,
           coalesce(sum(runs), 0)::int as runs, coalesce(sum(balls), 0)::int as balls,
           coalesce(sum(fours), 0)::int as fours, coalesce(sum(sixes), 0)::int as sixes,
           count(*) filter (where runs >= 50 and runs < 100)::int as fifties,
           count(*) filter (where runs >= 100)::int as hundreds,
           count(*) filter (where batted and is_out and runs = 0)::int as ducks,
           count(*) filter (where bowl_balls > 0)::int as bowl_innings,
           coalesce(sum(bowl_balls), 0)::int as bowl_balls, coalesce(sum(runs_conceded), 0)::int as runs_conceded,
           coalesce(sum(wickets), 0)::int as wickets, coalesce(sum(maidens), 0)::int as maidens, coalesce(sum(dots), 0)::int as dots,
           coalesce(sum(wides), 0)::int as wides, coalesce(sum(no_balls), 0)::int as no_balls,
           count(*) filter (where wickets >= 3 and wickets < 5)::int as three_wickets,
           count(*) filter (where wickets >= 5)::int as five_wickets,
           coalesce(sum(catches), 0)::int as catches, coalesce(sum(run_outs), 0)::int as run_outs, coalesce(sum(stumpings), 0)::int as stumpings,
           coalesce(sum(points), 0)::int as points
      from s
  )
  select jsonb_build_object(
    'player_id', p_player_id,
    'batting', jsonb_build_object(
       'matches', a.matches, 'innings', a.innings, 'not_outs', a.not_outs, 'runs', a.runs, 'balls', a.balls,
       'average', case when a.innings - a.not_outs > 0 then round(a.runs::numeric / (a.innings - a.not_outs), 2) end,
       'strike_rate', case when a.balls > 0 then round(a.runs * 100.0 / a.balls, 2) end,
       'fours', a.fours, 'sixes', a.sixes, 'fifties', a.fifties, 'hundreds', a.hundreds, 'ducks', a.ducks,
       'highest', (select jsonb_build_object('runs', runs, 'balls', balls, 'not_out', not is_out) from s where batted order by runs desc, is_out asc, balls asc limit 1)),
    'bowling', jsonb_build_object(
       'innings', a.bowl_innings, 'balls', a.bowl_balls, 'runs', a.runs_conceded, 'wickets', a.wickets, 'maidens', a.maidens, 'dots', a.dots,
       'wides', a.wides, 'no_balls', a.no_balls, 'three_wickets', a.three_wickets, 'five_wickets', a.five_wickets,
       'average', case when a.wickets > 0 then round(a.runs_conceded::numeric / a.wickets, 2) end,
       'economy', case when a.bowl_balls > 0 then round(a.runs_conceded * 6.0 / a.bowl_balls, 2) end,
       'strike_rate', case when a.wickets > 0 then round(a.bowl_balls::numeric / a.wickets, 2) end,
       'best', (select jsonb_build_object('wickets', wickets, 'runs', runs_conceded) from s where bowl_balls > 0 order by wickets desc, runs_conceded asc limit 1)),
    'fielding', jsonb_build_object('catches', a.catches, 'run_outs', a.run_outs, 'stumpings', a.stumpings),
    'mvp_points', a.points,
    'player_of_match', (select count(*) from public.matches where player_of_match_id = p_player_id and status = 'completed'),
    'trophies', (select count(*) from public.tournaments t where t.status = 'completed' and t.winner_team_id in
                   (select distinct team_id from s where s.tournament_id = t.id)),
    'matches', coalesce((
      select jsonb_agg(jsonb_build_object(
               'match_id', s.match_id, 'date', s.match_date, 'status', s.match_status,
               'team', (select name from public.teams where id = s.team_id),
               'opponent', (select name from public.teams where id = case when m.team_a_id = s.team_id then m.team_b_id else m.team_a_id end),
               'tournament', (select name from public.tournaments where id = s.tournament_id),
               'batted', s.batted, 'runs', s.runs, 'balls', s.balls, 'fours', s.fours, 'sixes', s.sixes, 'out', s.is_out,
               'bowl_balls', s.bowl_balls, 'runs_conceded', s.runs_conceded, 'wickets', s.wickets,
               'catches', s.catches, 'run_outs', s.run_outs, 'stumpings', s.stumpings, 'points', s.points,
               'result', m.result_summary, 'won', m.winner_team_id = s.team_id,
               'player_of_match', m.player_of_match_id = p_player_id) order by s.match_date desc)
        from s join public.matches m on m.id = s.match_id), '[]'::jsonb)
  )
  from agg a;
$$;

-- #57 #97 #102 Leaderboards for one tournament, or for the whole website when p_tournament_id is null.
create or replace function public.get_leaderboards(p_tournament_id uuid default null, p_limit int default 10)
returns jsonb language sql stable security definer set search_path = ''
as $$
  with s as (select * from public.player_match_stats(null, p_tournament_id, null)),
  per as (
    select player_id,
           count(*)::int as matches, count(*) filter (where batted)::int as innings, count(*) filter (where batted and not is_out)::int as not_outs,
           sum(runs)::int as runs, sum(balls)::int as balls, sum(fours)::int as fours, sum(sixes)::int as sixes,
           max(runs)::int as highest, count(*) filter (where runs >= 50)::int as fifties_plus,
           sum(bowl_balls)::int as bowl_balls, sum(runs_conceded)::int as runs_conceded, sum(wickets)::int as wickets,
           sum(maidens)::int as maidens, sum(dots)::int as dots,
           sum(catches)::int as catches, sum(run_outs)::int as run_outs, sum(stumpings)::int as stumpings, sum(points)::int as points
      from s group by player_id
  ),
  named as (
    select per.*, p.display_name as name, p.photo_url,
           (select t.name from public.match_players mp join public.teams t on t.id = mp.team_id
             where mp.player_id = per.player_id order by mp.created_at desc limit 1) as team
      from per join public.players p on p.id = per.player_id
  ),
  lim as (select least(greatest(coalesce(p_limit, 10), 1), 50) as n)
  select jsonb_build_object(
    'most_runs', coalesce((select jsonb_agg(x) from (select jsonb_build_object('player_id', player_id, 'name', name, 'team', team, 'photo_url', photo_url,
                  'value', runs, 'matches', matches, 'innings', innings, 'balls', balls,
                  'average', case when innings - not_outs > 0 then round(runs::numeric / (innings - not_outs), 2) end,
                  'strike_rate', case when balls > 0 then round(runs * 100.0 / balls, 2) end) as x
                  from named where runs > 0 order by runs desc, balls asc limit (select n from lim)) t), '[]'::jsonb),
    'most_wickets', coalesce((select jsonb_agg(x) from (select jsonb_build_object('player_id', player_id, 'name', name, 'team', team, 'photo_url', photo_url,
                  'value', wickets, 'matches', matches, 'overs', (bowl_balls / 6) || '.' || (bowl_balls % 6), 'runs', runs_conceded,
                  'economy', case when bowl_balls > 0 then round(runs_conceded * 6.0 / bowl_balls, 2) end) as x
                  from named where wickets > 0 order by wickets desc, runs_conceded asc limit (select n from lim)) t), '[]'::jsonb),
    'highest_scores', coalesce((select jsonb_agg(x) from (select jsonb_build_object('player_id', s.player_id, 'name', p.display_name, 'value', s.runs, 'balls', s.balls,
                  'not_out', not s.is_out, 'match_id', s.match_id) as x
                  from s join public.players p on p.id = s.player_id where s.batted and s.runs > 0 order by s.runs desc, s.balls asc limit (select n from lim)) t), '[]'::jsonb),
    'best_bowling', coalesce((select jsonb_agg(x) from (select jsonb_build_object('player_id', s.player_id, 'name', p.display_name, 'value', s.wickets || '/' || s.runs_conceded,
                  'wickets', s.wickets, 'runs', s.runs_conceded, 'match_id', s.match_id) as x
                  from s join public.players p on p.id = s.player_id where s.wickets > 0 order by s.wickets desc, s.runs_conceded asc limit (select n from lim)) t), '[]'::jsonb),
    'most_sixes', coalesce((select jsonb_agg(x) from (select jsonb_build_object('player_id', player_id, 'name', name, 'team', team, 'value', sixes, 'fours', fours) as x
                  from named where sixes > 0 order by sixes desc, fours desc limit (select n from lim)) t), '[]'::jsonb),
    'best_strike_rate', coalesce((select jsonb_agg(x) from (select jsonb_build_object('player_id', player_id, 'name', name, 'team', team,
                  'value', round(runs * 100.0 / balls, 2), 'runs', runs, 'balls', balls) as x
                  from named where balls >= 10 order by runs * 1.0 / balls desc limit (select n from lim)) t), '[]'::jsonb),
    'best_economy', coalesce((select jsonb_agg(x) from (select jsonb_build_object('player_id', player_id, 'name', name, 'team', team,
                  'value', round(runs_conceded * 6.0 / bowl_balls, 2), 'overs', (bowl_balls / 6) || '.' || (bowl_balls % 6), 'wickets', wickets) as x
                  from named where bowl_balls >= 12 order by runs_conceded * 1.0 / bowl_balls asc limit (select n from lim)) t), '[]'::jsonb),
    'most_catches', coalesce((select jsonb_agg(x) from (select jsonb_build_object('player_id', player_id, 'name', name, 'team', team,
                  'value', catches + stumpings + run_outs, 'catches', catches, 'stumpings', stumpings, 'run_outs', run_outs) as x
                  from named where catches + stumpings + run_outs > 0 order by catches + stumpings + run_outs desc limit (select n from lim)) t), '[]'::jsonb),
    'mvp', coalesce((select jsonb_agg(x) from (select jsonb_build_object('player_id', player_id, 'name', name, 'team', team, 'photo_url', photo_url,
                  'value', points, 'runs', runs, 'wickets', wickets, 'matches', matches) as x
                  from named where points > 0 order by points desc limit (select n from lim)) t), '[]'::jsonb),
    'totals', (select jsonb_build_object('matches', count(distinct match_id), 'runs', coalesce(sum(runs), 0), 'wickets', coalesce(sum(wickets), 0),
                                         'sixes', coalesce(sum(sixes), 0), 'fours', coalesce(sum(fours), 0)) from s)
  );
$$;

-- #99 Team statistics, optionally head-to-head against another team.
create or replace function public.get_team_stats(p_team_id uuid, p_vs_team_id uuid default null)
returns jsonb language sql stable security definer set search_path = ''
as $$
  with m as (
    select mm.*, case when mm.team_a_id = p_team_id then mm.team_b_id else mm.team_a_id end as opp,
           case when mm.team_a_id = p_team_id then mm.team_a_runs else mm.team_b_runs end as runs_for,
           case when mm.team_a_id = p_team_id then mm.team_b_runs else mm.team_a_runs end as runs_against
      from public.matches mm
     where p_team_id in (mm.team_a_id, mm.team_b_id) and mm.status in ('completed','abandoned')
       and (p_vs_team_id is null or p_vs_team_id in (mm.team_a_id, mm.team_b_id))
  )
  select jsonb_build_object(
    'team', (select jsonb_build_object('id', id, 'name', name, 'logo_url', logo_url) from public.teams where id = p_team_id),
    'played', count(*), 'won', count(*) filter (where winner_team_id = p_team_id),
    'lost', count(*) filter (where winner_team_id is not null and winner_team_id <> p_team_id),
    'tied', count(*) filter (where result_type = 'tie'), 'no_result', count(*) filter (where result_type = 'no_result'),
    'win_percent', case when count(*) filter (where result_type in ('win','walkover','tie')) > 0
                        then round(count(*) filter (where winner_team_id = p_team_id) * 100.0 / count(*) filter (where result_type in ('win','walkover','tie')), 1) end,
    'average_score', round(avg(runs_for) filter (where runs_for is not null), 1),
    'highest_total', max(runs_for), 'lowest_total', min(runs_for) filter (where runs_for is not null),
    'average_conceded', round(avg(runs_against) filter (where runs_against is not null), 1),
    'tournaments_won', (select count(*) from public.tournaments where winner_team_id = p_team_id and status = 'completed'),
    'recent', coalesce((select jsonb_agg(jsonb_build_object('match_id', id, 'date', coalesce(completed_at, scheduled_at),
                         'opponent', (select name from public.teams where id = opp), 'result', result_summary,
                         'won', winner_team_id = p_team_id, 'runs_for', runs_for, 'runs_against', runs_against)
                         order by coalesce(completed_at, scheduled_at) desc)
                        from (select * from m order by coalesce(completed_at, scheduled_at) desc limit 10) r), '[]'::jsonb)
  ) from m;
$$;

-- #101 Match analysis: runs and wickets per over (Manhattan / worm) and partnerships for each innings.
create or replace function public.get_match_analysis(p_match_id uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'player_of_match', (select jsonb_build_object('player_id', p.id, 'name', p.display_name, 'photo_url', p.photo_url, 'by_hand', m.player_of_match_by_hand,
                                                   'points', (select s.points from public.player_match_stats(null, null, p_match_id) s where s.player_id = p.id))
                          from public.matches m join public.players p on p.id = m.player_of_match_id where m.id = p_match_id),
    'players', coalesce((select jsonb_agg(x order by (x->>'points')::int desc) from (
                     select jsonb_build_object('player_id', s.player_id, 'name', p.display_name, 'points', s.points, 'runs', s.runs, 'balls', s.balls,
                                               'wickets', s.wickets, 'runs_conceded', s.runs_conceded) as x
                       from public.player_match_stats(null, null, p_match_id) s join public.players p on p.id = s.player_id
                      order by s.points desc) t), '[]'::jsonb),
    'innings', coalesce((
      select jsonb_agg(jsonb_build_object(
               'innings_no', i.innings_no, 'team', t.name, 'runs', i.runs, 'wickets', i.wickets, 'legal_balls', i.legal_balls,
               'overs', coalesce((select jsonb_agg(jsonb_build_object('over', o.over_no + 1, 'runs', o.runs, 'wickets', o.wkts, 'total', o.total) order by o.over_no)
                                    from (select over_no, sum(runs_bat + extra_runs)::int as runs, count(*) filter (where is_wicket)::int as wkts,
                                                 sum(sum(runs_bat + extra_runs)) over (order by over_no)::int as total
                                            from public.balls where innings_id = i.id group by over_no) o), '[]'::jsonb),
               'partnerships', coalesce((select jsonb_agg(jsonb_build_object('wicket', pt.n, 'runs', pt.runs, 'balls', pt.balls,
                                                                              'batters', pt.batters) order by pt.n)
                                    from (select grp + 1 as n, sum(runs_bat + extra_runs)::int as runs, count(*) filter (where is_legal)::int as balls,
                                                 (select string_agg(distinct pl.display_name, ' & ') from public.players pl
                                                   where pl.id in (select unnest(array_agg(striker_id) || array_agg(non_striker_id)))) as batters
                                            from (select b.*, coalesce((select count(*) from public.balls w where w.innings_id = b.innings_id and w.seq < b.seq
                                                                         and w.dismissed_id is not null), 0) as grp
                                                    from public.balls b where b.innings_id = i.id) g
                                           group by grp) pt), '[]'::jsonb),
               'boundaries', (select jsonb_build_object('fours', count(*) filter (where runs_bat = 4), 'sixes', count(*) filter (where runs_bat = 6),
                                                        'boundary_runs', coalesce(sum(runs_bat) filter (where runs_bat in (4, 6)), 0),
                                                        'dots', count(*) filter (where is_legal and runs_bat = 0 and (extra_type is null or extra_type in ('bye','leg_bye'))))
                                from public.balls where innings_id = i.id)
             ) order by i.innings_no)
        from public.innings i join public.teams t on t.id = i.batting_team_id where i.match_id = p_match_id), '[]'::jsonb)
  );
$$;

-- Simple player search for the comparison page.
create or replace function public.search_players(p_query text)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name, 'photo_url', p.photo_url, 'player_code', p.player_code) order by p.display_name), '[]'::jsonb)
    from (select * from public.players
           where pg_catalog.length(pg_catalog.btrim(coalesce(p_query, ''))) >= 2
             and (display_name ilike '%' || replace(replace(pg_catalog.btrim(p_query), '%', ''), '_', '') || '%'
                  or player_code ilike pg_catalog.btrim(p_query))
           order by display_name limit 15) p;
$$;

revoke all on function public.player_match_stats(uuid, uuid, uuid) from public;
revoke all on function public.get_player_stats(uuid) from public;
revoke all on function public.get_leaderboards(uuid, int) from public;
revoke all on function public.get_team_stats(uuid, uuid) from public;
revoke all on function public.get_match_analysis(uuid) from public;
revoke all on function public.search_players(text) from public;
revoke all on function public.set_player_of_match(uuid, uuid) from public, anon;
grant execute on function public.player_match_stats(uuid, uuid, uuid) to anon, authenticated;
grant execute on function public.get_player_stats(uuid) to anon, authenticated;
grant execute on function public.get_leaderboards(uuid, int) to anon, authenticated;
grant execute on function public.get_team_stats(uuid, uuid) to anon, authenticated;
grant execute on function public.get_match_analysis(uuid) to anon, authenticated;
grant execute on function public.search_players(text) to anon, authenticated;
grant execute on function public.set_player_of_match(uuid, uuid) to authenticated;
