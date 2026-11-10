-- Phase 2 / Category B – #33 Tournament logo and banner
-- Images go to the public 'media' bucket under tournaments/<tournament id>/…
-- Only the tournament organiser (owner, organiser role) or a website admin can upload.

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
  elsif parts[1] = 'tournaments' then
    return exists (select 1 from public.tournaments where id = target and owner_id = (select auth.uid()))
        or exists (select 1 from public.user_role_assignments where user_id = (select auth.uid()) and role = 'organiser'
                   and scope_type = 'tournament' and scope_id = target and is_active)
        or private.is_admin();
  end if;
  return false;
end;
$$;

-- Save (or remove with an empty url) the tournament logo / banner image, or change the banner colour.
create or replace function public.set_tournament_image(p_tournament_id uuid, p_kind text, p_url text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v text := nullif(pg_catalog.btrim(coalesce(p_url, '')), '');
begin
  perform private.require_tournament_organiser(p_tournament_id);
  if p_kind not in ('logo','banner','color') then raise exception 'Unknown image type.' using errcode = '22023'; end if;
  if p_kind in ('logo','banner') and v is not null
     and pg_catalog.strpos(v, '/storage/v1/object/public/media/tournaments/' || p_tournament_id::text || '/') = 0 then
    raise exception 'Upload the image through the website.' using errcode = '22023';
  end if;
  if p_kind = 'color' and (v is null or v !~ '^#[0-9A-Fa-f]{6}$') then
    raise exception 'Choose a colour like #059669.' using errcode = '22023';
  end if;
  update public.tournaments set
    logo_url = case when p_kind = 'logo' then v else logo_url end,
    banner_url = case when p_kind = 'banner' then v else banner_url end,
    banner_color = case when p_kind = 'color' then v else banner_color end
  where id = p_tournament_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'TOURNAMENT_' || pg_catalog.upper(p_kind) || '_CHANGED', 'tournaments', p_tournament_id::text,
          jsonb_build_object('removed', v is null));
  return jsonb_build_object('id', p_tournament_id, 'kind', p_kind, 'url', v);
end;
$$;

revoke all on function public.set_tournament_image(uuid, text, text) from public, anon;
grant execute on function public.set_tournament_image(uuid, text, text) to authenticated;
