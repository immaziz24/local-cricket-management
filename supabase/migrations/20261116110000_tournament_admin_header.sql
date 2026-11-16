create or replace function public.get_tournament_registrations(p_tournament_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare viewer uuid := (select auth.uid());
begin
  return jsonb_build_object(
    'is_organiser', viewer is not null and (private.is_tournament_admin(p_tournament_id) or
        exists (select 1 from public.tournaments where id = p_tournament_id and owner_id = viewer)
        or exists (select 1 from public.user_role_assignments where user_id = viewer and role = 'organiser'
                   and scope_type = 'tournament' and scope_id = p_tournament_id and is_active)),
    'admin_access', (
      select case
        when t.owner_id = viewer then jsonb_build_object('admins', coalesce((
          select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name) order by p.display_name, p.id)
          from private.tournament_admins a join public.profiles p on p.id = a.user_id
          where a.tournament_id = t.id
        ), '[]'::jsonb))
        when private.is_tournament_admin(t.id) then jsonb_build_object('granted_by', coalesce((
          select p.display_name
          from public.audit_logs l join public.profiles p on p.id = l.actor_user_id
          where l.action = 'TOURNAMENT_ADMIN_GRANT' and l.entity_type = 'tournaments'
            and l.entity_id = t.id::text and l.metadata->>'user_id' = viewer::text
          order by l.created_at desc
          limit 1
        ), owner.display_name, 'Tournament owner'))
      end
      from public.tournaments t left join public.profiles owner on owner.id = t.owner_id
      where t.id = p_tournament_id
    ),
    'teams', coalesce((
      select jsonb_agg(jsonb_build_object(
               'team_id', t.id, 'name', t.name, 'short_name', t.short_name, 'city', t.city, 'logo_url', t.logo_url,
               'status', tt.status, 'note', tt.note, 'created_at', tt.created_at, 'i_own', t.owner_id = viewer,
               'captain', (select pl.display_name from public.team_members tm join public.players pl on pl.id = tm.player_id
                           where tm.team_id = t.id and tm.is_captain limit 1),
               'squad_size', (select count(*) from public.team_members tm where tm.team_id = t.id))
             order by (tt.status = 'pending') desc, tt.created_at)
      from public.tournament_teams tt join public.teams t on t.id = tt.team_id
      where tt.tournament_id = p_tournament_id), '[]'::jsonb)
  );
end;
$$;

