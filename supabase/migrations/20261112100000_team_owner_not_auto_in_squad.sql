-- #71 Squad management: creating a team no longer puts the creator in the squad.
-- The owner can still add themselves with "Add me to the squad" (add_player_to_team).
do $$
declare d text; n text;
begin
  d := pg_get_functiondef('public.create_team(text, text, text)'::regprocedure);
  n := replace(d, E'  me := public.get_my_player();\n  insert into public.team_members (team_id, player_id, added_by)\n  values (new_id, (me->>''id'')::uuid, uid)\n  on conflict do nothing;\n\n', '');
  if n = d then raise exception 'create_team: squad insert not found'; end if;
  execute n;
end $$;
