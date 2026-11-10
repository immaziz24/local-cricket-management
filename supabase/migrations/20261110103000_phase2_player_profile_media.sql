-- Phase 2 / Category C (continued)
-- #61 Player profile photograph, #62 Player ID, #66 Age and date of birth,
-- #67 Contact information and privacy settings, #69 Team logo, #76 Team history, #60 Player profile.

-- #62 Player ID (LC-000001 …)
create sequence if not exists public.player_code_seq;
alter table public.players add column if not exists player_code text unique;
update public.players set player_code = 'LC-' || pg_catalog.lpad(pg_catalog.nextval('public.player_code_seq')::text, 6, '0')
 where player_code is null;
alter table public.players alter column player_code set default ('LC-' || pg_catalog.lpad(pg_catalog.nextval('public.player_code_seq')::text, 6, '0'));
alter table public.players alter column player_code set not null;

-- #66 Date of birth (only the age is shown to others)
alter table public.players add column if not exists date_of_birth date
  check (date_of_birth is null or (date_of_birth > date '1920-01-01' and date_of_birth <= current_date));

grant select (player_code) on public.players to anon, authenticated;

-- ------------------------------------------------------------------
-- Storage bucket for player photos and team logos (#61, #69): public read, 2 MB images.
-- Paths: players/<player_id>/<file>, teams/<team_id>/<file>
-- ------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

create or replace function private.can_edit_media(p_name text)
returns boolean language plpgsql stable security definer set search_path = ''
as $$
declare parts text[] := storage.foldername(p_name); target uuid;
begin
  if (select auth.uid()) is null or pg_catalog.array_length(parts, 1) < 2 then return false; end if;
  begin target := parts[2]::uuid; exception when others then return false; end;
  if parts[1] = 'teams' then
    return exists (select 1 from public.teams where id = target and owner_id = (select auth.uid()));
  elsif parts[1] = 'players' then
    return exists (select 1 from public.players where id = target
                   and (profile_id = (select auth.uid()) or (profile_id is null and created_by = (select auth.uid()))));
  end if;
  return false;
end;
$$;
grant execute on function private.can_edit_media(text) to authenticated;
grant usage on schema private to authenticated;
-- (schema usage is needed for the storage policy to call the helper; every other private function
--  keeps EXECUTE revoked from authenticated, so they stay unreachable)

drop policy if exists media_insert on storage.objects;
create policy media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and private.can_edit_media(name));
drop policy if exists media_update on storage.objects;
create policy media_update on storage.objects for update to authenticated
  using (bucket_id = 'media' and private.can_edit_media(name))
  with check (bucket_id = 'media' and private.can_edit_media(name));
drop policy if exists media_delete on storage.objects;
create policy media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and private.can_edit_media(name));

-- Save the uploaded image URL on the player / team.
create or replace function public.set_player_photo(p_player_id uuid, p_url text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  if not private.can_edit_media('players/' || p_player_id::text || '/x') then
    raise exception 'You can only change your own photo, or photos of players you added who have not registered.' using errcode = '42501';
  end if;
  update public.players set photo_url = nullif(p_url, '') where id = p_player_id;
  return jsonb_build_object('id', p_player_id, 'photo_url', p_url);
end;
$$;

create or replace function public.set_team_logo(p_team_id uuid, p_url text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_team_owner(p_team_id);
  update public.teams set logo_url = nullif(p_url, '') where id = p_team_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'TEAM_LOGO_CHANGED', 'teams', p_team_id::text, '{}'::jsonb);
  return jsonb_build_object('id', p_team_id, 'logo_url', p_url);
end;
$$;

-- #66 My date of birth
create or replace function public.update_my_birth_date(p_date date)
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  perform public.get_my_player();
  update public.players set date_of_birth = p_date where profile_id = (select auth.uid());
  return jsonb_build_object('date_of_birth', p_date);
end;
$$;

-- #60 / #67 Public player profile, with contact details only if the player allows it.
create or replace function public.get_player_profile(p_player_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare pl record; ps record; email text; viewer uuid := (select auth.uid()); is_me boolean;
begin
  select * into pl from public.players where id = p_player_id;
  if not found then raise exception 'Player not found.' using errcode = '22023'; end if;
  is_me := viewer is not null and pl.profile_id = viewer;

  if pl.profile_id is not null then
    select * into ps from public.user_privacy_settings where user_id = pl.profile_id;
    select u.email into email from auth.users u where u.id = pl.profile_id;
  end if;

  if not is_me and pl.profile_id is not null and coalesce(ps.profile_visibility, 'members') = 'private' then
    return jsonb_build_object('id', pl.id, 'player_code', pl.player_code, 'display_name', pl.display_name, 'private', true);
  end if;
  if not is_me and pl.profile_id is not null and coalesce(ps.profile_visibility, 'members') = 'members' and viewer is null then
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
    'mobile_number', case when is_me or coalesce(ps.show_phone, false) then pl.mobile_number else null end,
    'email', case when is_me or coalesce(ps.show_email, false) then email else null end,
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

-- #76 Team history (public timeline built from the audit log).
create or replace function public.get_team_history(p_team_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  return coalesce((
    select jsonb_agg(h order by h.created_at desc)
    from (
      select a.created_at, a.action,
             coalesce(ap.display_name, 'Someone') as by_name,
             (select pl.display_name from public.players pl where pl.id = (a.metadata ->> 'player_id')::uuid) as player_name,
             (select pl.display_name from public.players pl where pl.id = (a.metadata ->> 'captain')::uuid) as captain_name,
             (select pl.display_name from public.players pl where pl.id = (a.metadata ->> 'vice_captain')::uuid) as vice_captain_name,
             (select pl.display_name from public.players pl where pl.id = (a.metadata ->> 'icon')::uuid) as icon_name
      from public.audit_logs a
      left join public.profiles ap on ap.id = a.actor_user_id
      where a.entity_type = 'teams' and a.entity_id = p_team_id::text
      order by a.created_at desc
      limit 100
    ) h
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.set_player_photo(uuid, text) from public, anon;
revoke all on function public.set_team_logo(uuid, text) from public, anon;
revoke all on function public.update_my_birth_date(date) from public, anon;
revoke all on function public.get_player_profile(uuid) from public;
revoke all on function public.get_team_history(uuid) from public;
grant execute on function public.set_player_photo(uuid, text) to authenticated;
grant execute on function public.set_team_logo(uuid, text) to authenticated;
grant execute on function public.update_my_birth_date(date) to authenticated;
grant execute on function public.get_player_profile(uuid) to anon, authenticated;
grant execute on function public.get_team_history(uuid) to anon, authenticated;

-- get_my_player now also returns player_code and date_of_birth.
create or replace function public.get_my_player()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := (select auth.uid()); rec record;
begin
  if uid is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  select * into rec from public.players where profile_id = uid;
  if not found then
    insert into public.players (profile_id, display_name, created_by)
    values (uid, coalesce((select display_name from public.profiles where id = uid), 'Player'), uid)
    returning * into rec;
  end if;
  return jsonb_build_object('id', rec.id, 'player_code', rec.player_code, 'display_name', rec.display_name,
    'mobile_number', rec.mobile_number, 'player_role', rec.player_role, 'batting_style', rec.batting_style,
    'bowling_style', rec.bowling_style, 'photo_url', rec.photo_url, 'date_of_birth', rec.date_of_birth);
end;
$$;
