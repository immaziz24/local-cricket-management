create function public.delete_owned_team(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.require_active_user();
begin
  perform 1 from public.teams where id = p_id and owner_id = actor for update;
  if not found then raise exception 'Only the owner can delete this team.' using errcode = '42501'; end if;
  if exists (select 1 from public.matches where team_a_id = p_id or team_b_id = p_id) then
    raise exception 'This team has linked matches. Remove its fixtures or matches before deleting it.' using errcode = '22023';
  end if;
  if exists (select 1 from public.tournament_teams where team_id = p_id) then
    raise exception 'This team is registered in a tournament. Remove its registration before deleting it.' using errcode = '22023';
  end if;
  delete from public.teams where id = p_id and owner_id = actor;
  perform private.admin_log('OWNER_TEAM_DELETED', 'teams', p_id::text, '{}'::jsonb);
end;
$$;
revoke all on function public.delete_owned_team(uuid) from public, anon, authenticated;
grant execute on function public.delete_owned_team(uuid) to authenticated;

create function public.delete_owned_tournament(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.require_active_user();
begin
  perform 1 from public.tournaments where id = p_id and owner_id = actor for update;
  if not found then raise exception 'Only the owner can delete this tournament.' using errcode = '42501'; end if;
  if exists (select 1 from public.matches where tournament_id = p_id) then
    raise exception 'This tournament has linked matches. Remove its fixtures or matches before deleting it.' using errcode = '22023';
  end if;
  delete from public.tournaments where id = p_id and owner_id = actor;
  perform private.admin_log('OWNER_TOURNAMENT_DELETED', 'tournaments', p_id::text, '{}'::jsonb);
end;
$$;
revoke all on function public.delete_owned_tournament(uuid) from public, anon, authenticated;
grant execute on function public.delete_owned_tournament(uuid) to authenticated;
