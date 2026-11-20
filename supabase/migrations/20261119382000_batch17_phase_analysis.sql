-- Batch 17: #351 powerplay and #352 death-overs analysis, worked out on the server for any match.
create or replace function public.get_phase_analysis(p_match_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare rl jsonb; pp_rule int; res jsonb := '[]'::jsonb; i record; lim int; pp int; dd int; mid_from int; death_from int; one jsonb; mo int;
begin
  select overs_per_innings into mo from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found.' using errcode = '22023'; end if;
  rl := private.effective_rules(p_match_id);
  pp_rule := nullif((rl ->> 'powerplay_overs')::int, 0);
  for i in select * from public.innings where match_id = p_match_id and not coalesce(is_super_over, false) order by innings_no loop
    lim := greatest(coalesce(i.overs_limit, mo, 20), 1);
    pp := least(coalesce(pp_rule, greatest(1, round(lim * 0.3)::int)), lim);
    dd := greatest(1, round(lim * 0.2)::int);
    mid_from := pp; death_from := greatest(mid_from, lim - dd);
    select jsonb_build_object('innings_no', i.innings_no, 'team_id', i.batting_team_id, 'team', (select name from public.teams where id = i.batting_team_id), 'overs_limit', lim,
      'phases', jsonb_build_array(
        (select jsonb_build_object('key', 'powerplay', 'label', 'Powerplay', 'from_over', 1, 'to_over', pp, 'runs', coalesce(sum(b.runs_bat + b.extra_runs), 0), 'wickets', count(*) filter (where b.is_wicket and b.wicket_type <> 'retired_hurt'),
            'legal_balls', count(*) filter (where b.is_legal), 'dots', count(*) filter (where b.is_legal and b.runs_bat + b.extra_runs = 0 and not b.is_wicket),
            'boundaries', count(*) filter (where b.runs_bat in (4, 6)))
           from public.balls b where b.innings_id = i.id and b.over_no >= 0 and b.over_no < pp),
        (select jsonb_build_object('key', 'middle', 'label', 'Middle overs', 'from_over', mid_from + 1, 'to_over', death_from, 'runs', coalesce(sum(b.runs_bat + b.extra_runs), 0), 'wickets', count(*) filter (where b.is_wicket and b.wicket_type <> 'retired_hurt'),
            'legal_balls', count(*) filter (where b.is_legal), 'dots', count(*) filter (where b.is_legal and b.runs_bat + b.extra_runs = 0 and not b.is_wicket),
            'boundaries', count(*) filter (where b.runs_bat in (4, 6)))
           from public.balls b where b.innings_id = i.id and b.over_no >= mid_from and b.over_no < death_from),
        (select jsonb_build_object('key', 'death', 'label', 'Death overs', 'from_over', death_from + 1, 'to_over', lim, 'runs', coalesce(sum(b.runs_bat + b.extra_runs), 0), 'wickets', count(*) filter (where b.is_wicket and b.wicket_type <> 'retired_hurt'),
            'legal_balls', count(*) filter (where b.is_legal), 'dots', count(*) filter (where b.is_legal and b.runs_bat + b.extra_runs = 0 and not b.is_wicket),
            'boundaries', count(*) filter (where b.runs_bat in (4, 6)))
           from public.balls b where b.innings_id = i.id and b.over_no >= death_from and b.over_no < lim))) into one;
    res := res || jsonb_build_array(one);
  end loop;
  return jsonb_build_object('innings', res);
end $$;
revoke all on function public.get_phase_analysis(uuid) from public;
grant execute on function public.get_phase_analysis(uuid) to anon, authenticated;
