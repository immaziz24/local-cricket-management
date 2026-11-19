-- Batch 9: #356 statistics provenance (do the player figures add up to the scoreboard? what are they built from?)
--          #355 boundary tracker across a competition.

create or replace function public.stats_reconciliation(p_match_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare res jsonb; p_bat int; p_conc int; t_bat int; t_conc int; ok_all boolean;
begin
  select coalesce(sum(s.runs), 0), coalesce(sum(s.runs_conceded), 0) into p_bat, p_conc from public.player_match_stats(null, null, p_match_id) s;
  select coalesce(sum(b.runs_bat), 0), coalesce(sum(b.runs_bat + case when b.extra_type in ('wide', 'no_ball') then b.extra_runs else 0 end), 0)
    into t_bat, t_conc
    from public.balls b join public.innings i on i.id = b.innings_id where b.match_id = p_match_id and not i.is_super_over;

  select jsonb_build_object(
    'match_id', p_match_id,
    'innings', coalesce(jsonb_agg(jsonb_build_object(
        'innings_no', x.innings_no, 'team', x.team, 'super_over', x.is_super_over,
        'scoreboard_runs', x.runs, 'batters_runs', x.bat, 'extras', x.ex, 'penalty', x.pen,
        'bowlers_conceded', x.conceded, 'byes_leg_byes', x.byes,
        'scoreboard_wickets', x.wickets, 'wickets_from_balls', x.w, 'scoreboard_balls', x.legal_balls, 'legal_balls_from_balls', x.lb,
        'runs_ok', x.runs = x.bat + x.ex + x.pen, 'bowling_ok', x.runs = x.conceded + x.byes + x.pen,
        'wickets_ok', x.wickets = x.w, 'balls_ok', x.legal_balls = x.lb) order by x.innings_no), '[]'::jsonb),
    'ball_count', (select count(*) from public.balls where match_id = p_match_id),
    'first_ball_at', (select min(created_at) from public.balls where match_id = p_match_id),
    'last_ball_at', (select max(created_at) from public.balls where match_id = p_match_id),
    'scorers', coalesce((select jsonb_agg(distinct coalesce(pr.display_name, 'Scorer')) from public.balls b left join public.profiles pr on pr.id = b.created_by where b.match_id = p_match_id), '[]'::jsonb),
    'corrections_applied', (select count(*) from public.ball_revisions where match_id = p_match_id and status = 'applied'),
    'last_correction_at', (select max(decided_at) from public.ball_revisions where match_id = p_match_id and status = 'applied'),
    'player_batting_runs', p_bat, 'ball_batting_runs', t_bat, 'player_conceded', p_conc, 'ball_conceded', t_conc,
    'players_ok', p_bat = t_bat and p_conc = t_conc,
    'computed_at', now())
  into res
  from (
    select i.innings_no, t.name as team, i.is_super_over, i.runs, i.wickets, i.legal_balls, coalesce(i.penalty_runs, 0) as pen,
           coalesce(sum(b.runs_bat), 0)::int as bat, coalesce(sum(b.extra_runs), 0)::int as ex,
           coalesce(sum(b.runs_bat + case when b.extra_type in ('wide', 'no_ball') then b.extra_runs else 0 end), 0)::int as conceded,
           coalesce(sum(b.extra_runs) filter (where b.extra_type in ('bye', 'leg_bye')), 0)::int as byes,
           count(*) filter (where b.is_wicket and b.wicket_type is distinct from 'retired_hurt')::int as w,
           count(*) filter (where b.is_legal)::int as lb
      from public.innings i join public.teams t on t.id = i.batting_team_id left join public.balls b on b.innings_id = i.id
     where i.match_id = p_match_id group by i.id, t.name) x;

  ok_all := coalesce((select bool_and((e ->> 'runs_ok')::boolean and (e ->> 'bowling_ok')::boolean and (e ->> 'wickets_ok')::boolean and (e ->> 'balls_ok')::boolean)
                        from jsonb_array_elements(res -> 'innings') e), true) and (res ->> 'players_ok')::boolean;
  return res || jsonb_build_object('all_ok', ok_all);
end;
$$;

create or replace function public.get_boundary_tracker(p_tournament_id uuid default null, p_limit integer default 10)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare n int := least(greatest(coalesce(p_limit, 10), 1), 50);
begin
  return jsonb_build_object(
    'teams', coalesce((select jsonb_agg(x order by (x ->> 'boundary_runs')::int desc) from (
        select jsonb_build_object('team_id', t.id, 'team', t.name, 'matches', count(distinct b.match_id),
                 'fours', count(*) filter (where b.runs_bat = 4), 'sixes', count(*) filter (where b.runs_bat = 6),
                 'boundary_runs', coalesce(sum(b.runs_bat) filter (where b.runs_bat in (4, 6)), 0),
                 'bat_runs', coalesce(sum(b.runs_bat), 0), 'balls', count(*) filter (where b.extra_type is distinct from 'wide'),
                 'balls_per_boundary', case when count(*) filter (where b.runs_bat in (4, 6)) > 0
                     then round(count(*) filter (where b.extra_type is distinct from 'wide')::numeric / count(*) filter (where b.runs_bat in (4, 6)), 1) end,
                 'boundary_share', case when sum(b.runs_bat) > 0 then round(coalesce(sum(b.runs_bat) filter (where b.runs_bat in (4, 6)), 0) * 100.0 / sum(b.runs_bat), 1) end) as x
          from public.balls b join public.innings i on i.id = b.innings_id join public.matches m on m.id = b.match_id join public.teams t on t.id = i.batting_team_id
         where not i.is_super_over and m.status in ('live', 'completed', 'abandoned') and (p_tournament_id is null or m.tournament_id = p_tournament_id)
         group by t.id, t.name) q), '[]'::jsonb),
    'players', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('player_id', s.player_id, 'name', p.display_name, 'fours', sum(s.fours)::int, 'sixes', sum(s.sixes)::int,
                 'boundary_runs', (sum(s.fours) * 4 + sum(s.sixes) * 6)::int, 'runs', sum(s.runs)::int, 'balls', sum(s.balls)::int,
                 'boundary_share', case when sum(s.runs) > 0 then round((sum(s.fours) * 4 + sum(s.sixes) * 6) * 100.0 / sum(s.runs), 1) end) as x
          from public.player_match_stats(null, p_tournament_id, null) s join public.players p on p.id = s.player_id
         group by s.player_id, p.display_name having sum(s.fours) + sum(s.sixes) > 0
         order by (sum(s.fours) * 4 + sum(s.sixes) * 6) desc, p.display_name limit n) q), '[]'::jsonb),
    'phases', coalesce((select jsonb_agg(jsonb_build_object('label', ph.label, 'fours', ph.f4, 'sixes', ph.s6) order by ph.ord) from (
        select case when b.over_no < 6 then 1 when b.over_no < 15 then 2 else 3 end as ord,
               case when b.over_no < 6 then 'Overs 1-6' when b.over_no < 15 then 'Overs 7-15' else 'Overs 16+' end as label,
               count(*) filter (where b.runs_bat = 4) as f4, count(*) filter (where b.runs_bat = 6) as s6
          from public.balls b join public.innings i on i.id = b.innings_id join public.matches m on m.id = b.match_id
         where not i.is_super_over and m.status in ('live', 'completed', 'abandoned') and (p_tournament_id is null or m.tournament_id = p_tournament_id)
         group by 1, 2) ph), '[]'::jsonb),
    'top_matches', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('match_id', m.id, 'teams', (select name from public.teams where id = m.team_a_id) || ' v ' || (select name from public.teams where id = m.team_b_id),
                 'fours', count(*) filter (where b.runs_bat = 4), 'sixes', count(*) filter (where b.runs_bat = 6)) as x
          from public.balls b join public.innings i on i.id = b.innings_id join public.matches m on m.id = b.match_id
         where not i.is_super_over and m.status in ('live', 'completed', 'abandoned') and (p_tournament_id is null or m.tournament_id = p_tournament_id)
         group by m.id having count(*) filter (where b.runs_bat in (4, 6)) > 0
         order by count(*) filter (where b.runs_bat in (4, 6)) desc, m.id limit 3) q), '[]'::jsonb),
    'totals', (select jsonb_build_object('fours', count(*) filter (where b.runs_bat = 4), 'sixes', count(*) filter (where b.runs_bat = 6),
                 'matches', count(distinct b.match_id))
          from public.balls b join public.innings i on i.id = b.innings_id join public.matches m on m.id = b.match_id
         where not i.is_super_over and m.status in ('live', 'completed', 'abandoned') and (p_tournament_id is null or m.tournament_id = p_tournament_id)));
end;
$$;

grant execute on function public.stats_reconciliation(uuid) to anon, authenticated;
grant execute on function public.get_boundary_tracker(uuid, integer) to anon, authenticated;
