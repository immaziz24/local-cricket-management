-- Wagon wheel: where each scoring shot went (#8 record runs, shown on the scorecard and in analysis).
-- shot_angle: position on the field picture, degrees clockwise from the top (0 = straight past the bowler,
-- 90 = right of the picture, 180 = behind the keeper, 270 = left). The batter is at the centre.
-- shot_dist: 1–100, share of the distance from the pitch to the boundary (100 = boundary).
alter table public.balls add column if not exists shot_angle smallint check (shot_angle between 0 and 359);
alter table public.balls add column if not exists shot_dist smallint check (shot_dist between 1 and 100);

do $$
declare d text; n text;
begin
  d := pg_get_functiondef('public.record_ball(uuid, jsonb)'::regprocedure);
  n := replace(d, 'commentary, created_by, client_id, free_hit)', 'commentary, created_by, client_id, free_hit, shot_angle, shot_dist)');
  n := replace(n, E'(select auth.uid()), cid, fh);',
    E'(select auth.uid()), cid, fh,\n          case when (p->>''shot_angle'') ~ ''^\\d{1,3}$'' and (p->>''shot_angle'')::int between 0 and 359 then (p->>''shot_angle'')::smallint end,\n          case when (p->>''shot_dist'') ~ ''^\\d{1,3}$'' and (p->>''shot_dist'')::int between 1 and 100 then (p->>''shot_dist'')::smallint end);');
  if n = d or pg_catalog.length(n) - pg_catalog.length(d) < 200 then raise exception 'record_ball patch failed'; end if;
  execute n;
end $$;

-- Wagon wheel for one innings, optionally one batter. Anyone can view (scores are public).
create or replace function public.get_wagon_wheel(p_match_id uuid, p_innings_no int default null, p_batter_id uuid default null)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('angle', b.shot_angle, 'dist', b.shot_dist, 'runs', b.runs_bat,
           'batter_id', b.striker_id, 'over', b.over_no, 'ball', b.ball_in_over) order by b.seq), '[]'::jsonb)
    from public.balls b join public.innings i on i.id = b.innings_id
   where b.match_id = p_match_id and b.shot_angle is not null
     and (p_innings_no is null or i.innings_no = p_innings_no)
     and (p_batter_id is null or b.striker_id = p_batter_id);
$$;
revoke all on function public.get_wagon_wheel(uuid, int, uuid) from public;
grant execute on function public.get_wagon_wheel(uuid, int, uuid) to anon, authenticated;
