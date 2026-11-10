-- Fix: the player profile failed with 'record "ps" is not assigned yet' for players
-- added by name only (no account), because their privacy settings were never loaded.
create or replace function public.get_player_profile(p_player_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare pl record; vis text := 'members'; show_phone boolean := false; show_email boolean := false;
        email text; viewer uuid := (select auth.uid()); is_me boolean;
begin
  select * into pl from public.players where id = p_player_id;
  if not found then raise exception 'Player not found.' using errcode = '22023'; end if;
  is_me := viewer is not null and pl.profile_id = viewer;

  if pl.profile_id is not null then
    select coalesce(s.profile_visibility, 'members'), coalesce(s.show_phone, false), coalesce(s.show_email, false)
      into vis, show_phone, show_email
      from public.user_privacy_settings s where s.user_id = pl.profile_id;
    vis := coalesce(vis, 'members'); show_phone := coalesce(show_phone, false); show_email := coalesce(show_email, false);
    select u.email into email from auth.users u where u.id = pl.profile_id;
  end if;

  if not is_me and pl.profile_id is not null and vis = 'private' then
    return jsonb_build_object('id', pl.id, 'player_code', pl.player_code, 'display_name', pl.display_name, 'private', true);
  end if;
  if not is_me and pl.profile_id is not null and vis = 'members' and viewer is null then
    return jsonb_build_object('id', pl.id, 'player_code', pl.player_code, 'display_name', pl.display_name, 'members_only', true);
  end if;

  return jsonb_build_object(
    'id', pl.id,
    'player_code', pl.player_code,
    'display_name', pl.display_name,
    'photo_url', pl.photo_url,
    'player_role', pl.player_role,
    'batting_style', pl.batting_style,
    'bowling_style', pl.bowling_style,
    'age', case when pl.date_of_birth is null then null else pg_catalog.date_part('year', pg_catalog.age(pl.date_of_birth))::int end,
    'date_of_birth', case when is_me then pl.date_of_birth else null end,
    'is_registered', pl.profile_id is not null,
    'is_me', is_me,
    'can_edit_photo', private.can_edit_media('players/' || pl.id::text || '/x'),
    'mobile_number', case when is_me or show_phone then pl.mobile_number else null end,
    'email', case when is_me or show_email then email else null end,
    'badges', coalesce((select jsonb_agg(v.verification_type) from public.user_verifications v
                        where v.user_id = pl.profile_id and v.status = 'approved'
                          and v.verification_type in ('identity','umpire','scorer')), '[]'::jsonb),
    'teams', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'short_name', t.short_name, 'logo_url', t.logo_url,
                                                          'is_captain', tm.is_captain, 'is_vice_captain', tm.is_vice_captain, 'is_icon', tm.is_icon)
                                        order by tm.joined_at)
                       from public.team_members tm join public.teams t on t.id = tm.team_id
                       where tm.player_id = pl.id), '[]'::jsonb)
  );
end;
$$;
