-- Batch 16 #395: achievement cards for a player, worked out from the real stats. Public, like the player's stats page.
create or replace function public.get_player_achievements(p_player_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare s jsonb; nm text; b jsonb; f jsonb; out jsonb := '[]'::jsonb; aw int;
  mt int; runs int; fifties int; huns int; sixes int; wk int; w3 int; w5 int; ct int; pom int; tr int;
begin
  select display_name into nm from public.players where id = p_player_id;
  if nm is null then return null; end if;
  s := public.get_player_stats(p_player_id);
  b := s->'batting'; f := s->'bowling';
  mt := coalesce((b->>'matches')::int, 0); runs := coalesce((b->>'runs')::int, 0); fifties := coalesce((b->>'fifties')::int, 0);
  huns := coalesce((b->>'hundreds')::int, 0); sixes := coalesce((b->>'sixes')::int, 0);
  wk := coalesce((f->>'wickets')::int, 0); w3 := coalesce((f->>'three_wickets')::int, 0); w5 := coalesce((f->>'five_wickets')::int, 0);
  ct := coalesce((s->'fielding'->>'catches')::int, 0); pom := coalesce((s->>'player_of_match')::int, 0); tr := coalesce((s->>'trophies')::int, 0);
  select count(*) into aw from public.tournament_awards a where a.player_id = p_player_id;
  if mt >= 1 then out := out || jsonb_build_object('key','first_match','title','First match played','value',mt,'detail',mt || ' match' || case when mt = 1 then '' else 'es' end || ' played'); end if;
  if mt >= 10 then out := out || jsonb_build_object('key','matches_10','title','10 matches','value',mt,'detail',mt || ' matches played'); end if;
  if mt >= 25 then out := out || jsonb_build_object('key','matches_25','title','25 matches','value',mt,'detail',mt || ' matches played'); end if;
  if runs >= 100 then out := out || jsonb_build_object('key','runs_100','title','100 career runs','value',runs,'detail',runs || ' runs'); end if;
  if runs >= 500 then out := out || jsonb_build_object('key','runs_500','title','500 career runs','value',runs,'detail',runs || ' runs'); end if;
  if fifties >= 1 then out := out || jsonb_build_object('key','fifty','title','Half-century','value',fifties,'detail',fifties || ' fifty score' || case when fifties = 1 then '' else 's' end); end if;
  if huns >= 1 then out := out || jsonb_build_object('key','century','title','Century','value',huns,'detail',huns || ' hundred' || case when huns = 1 then '' else 's' end); end if;
  if sixes >= 10 then out := out || jsonb_build_object('key','sixes_10','title','10 sixes','value',sixes,'detail',sixes || ' sixes'); end if;
  if wk >= 5 then out := out || jsonb_build_object('key','wickets_5','title','5 career wickets','value',wk,'detail',wk || ' wickets'); end if;
  if wk >= 25 then out := out || jsonb_build_object('key','wickets_25','title','25 career wickets','value',wk,'detail',wk || ' wickets'); end if;
  if w3 >= 1 then out := out || jsonb_build_object('key','three_wickets','title','3-wicket haul','value',w3,'detail',w3 || ' time' || case when w3 = 1 then '' else 's' end); end if;
  if w5 >= 1 then out := out || jsonb_build_object('key','five_wickets','title','5-wicket haul','value',w5,'detail',w5 || ' time' || case when w5 = 1 then '' else 's' end); end if;
  if ct >= 5 then out := out || jsonb_build_object('key','catches_5','title','5 catches','value',ct,'detail',ct || ' catches'); end if;
  if pom >= 1 then out := out || jsonb_build_object('key','player_of_match','title','Player of the Match','value',pom,'detail',pom || ' time' || case when pom = 1 then '' else 's' end); end if;
  if tr >= 1 then out := out || jsonb_build_object('key','trophy','title','Trophy winner','value',tr,'detail',tr || ' trophy' || case when tr = 1 then '' else 's' end); end if;
  if aw >= 1 then out := out || jsonb_build_object('key','tournament_award','title','Tournament award','value',aw,'detail',aw || ' award' || case when aw = 1 then '' else 's' end); end if;
  return jsonb_build_object('player_id', p_player_id, 'name', nm, 'badges', out);
end $$;
revoke all on function public.get_player_achievements(uuid) from public;
grant execute on function public.get_player_achievements(uuid) to anon, authenticated;
