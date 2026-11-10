-- Team owners can edit players in their squad who have not registered yet
-- (registered players edit their own details in My player profile).
create or replace function public.update_team_player(
  p_team_id uuid, p_player_id uuid, p_name text,
  p_player_role text default null, p_batting_style text default null, p_bowling_style text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare pl record;
begin
  perform private.require_team_owner(p_team_id);
  if not exists (select 1 from public.team_members where team_id = p_team_id and player_id = p_player_id) then
    raise exception 'This player is not in your team.' using errcode = '22023';
  end if;
  select * into pl from public.players where id = p_player_id;
  if pl.profile_id is not null then
    raise exception '% is registered and manages their own details. You can still make them captain, vice-captain or icon player.', pl.display_name using errcode = '42501';
  end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_name, ''))) < 2 then
    raise exception 'Please type the player name.' using errcode = '22023';
  end if;
  update public.players
     set display_name = pg_catalog.btrim(p_name),
         player_role = nullif(p_player_role, ''),
         batting_style = nullif(p_batting_style, ''),
         bowling_style = nullif(p_bowling_style, '')
   where id = p_player_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'TEAM_PLAYER_EDITED', 'teams', p_team_id::text, jsonb_build_object('player_id', p_player_id));
  return jsonb_build_object('id', p_player_id);
end;
$$;
revoke all on function public.update_team_player(uuid, uuid, text, text, text, text) from public, anon;
grant execute on function public.update_team_player(uuid, uuid, text, text, text, text) to authenticated;
