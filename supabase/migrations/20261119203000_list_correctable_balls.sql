-- Batch 8: helper for the correction screen (#315 #316): recent balls with names, plus the match's players.
create or replace function public.list_correctable_balls(p_match_id uuid, p_limit integer default 60)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  if not private.is_match_official(p_match_id) then raise exception 'Only the match scorers and organisers can correct balls.' using errcode = '42501'; end if;
  return jsonb_build_object(
    'balls', coalesce((select jsonb_agg(x order by x.created_at desc) from (
      select b.id, b.seq, b.over_no, b.ball_in_over, b.created_at, i.innings_no, b.is_wicket, b.runs_bat, b.extra_type,
             b.striker_id, b.non_striker_id, b.bowler_id, b.fielder_id, b.dismissed_id,
             (select display_name from public.players where id = b.striker_id) as striker,
             (select display_name from public.players where id = b.non_striker_id) as non_striker,
             (select display_name from public.players where id = b.bowler_id) as bowler,
             (select display_name from public.players where id = b.fielder_id) as fielder,
             (select display_name from public.players where id = b.dismissed_id) as dismissed
        from public.balls b join public.innings i on i.id = b.innings_id
       where b.match_id = p_match_id order by b.created_at desc limit greatest(1, least(coalesce(p_limit, 60), 200))) x), '[]'::jsonb),
    'players', coalesce((select jsonb_agg(jsonb_build_object('id', mp.player_id, 'name', p.display_name, 'team_id', mp.team_id) order by p.display_name)
        from public.match_players mp join public.players p on p.id = mp.player_id where mp.match_id = p_match_id), '[]'::jsonb));
end;
$$;
revoke execute on function public.list_correctable_balls(uuid, integer) from public, anon;
grant execute on function public.list_correctable_balls(uuid, integer) to authenticated;
