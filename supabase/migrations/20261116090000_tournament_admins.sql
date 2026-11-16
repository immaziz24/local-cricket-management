create table private.tournament_admins (
  tournament_id uuid references public.tournaments(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  primary key (tournament_id, user_id)
);
alter table private.tournament_admins enable row level security;

create function private.is_tournament_admin(p_tournament_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from private.tournament_admins
    where tournament_id = p_tournament_id and user_id = (select auth.uid())
  ) and not exists (
    select 1 from public.profiles where id = (select auth.uid())
    and account_status in ('suspended', 'disabled')
  );
$$;
revoke all on function private.is_tournament_admin(uuid) from public, anon, authenticated;

-- The owner can look up an exact mobile number, confirm an account, or revoke access.
create function public.manage_tournament_admins(
  p_tournament_id uuid, p_action text, p_mobile text default null, p_user_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  target public.profiles;
begin
  if not exists (
    select 1 from public.tournaments t join public.profiles p on p.id = t.owner_id
    where t.id = p_tournament_id and t.owner_id = actor
      and p.account_status not in ('suspended', 'disabled')
  ) then
    raise exception 'Only the tournament creator can manage admins.' using errcode = '42501';
  end if;

  if p_action in ('lookup', 'grant') then
    select * into target from public.profiles
    where mobile_number = private.clean_mobile(p_mobile)
      and id <> actor and account_status not in ('suspended', 'disabled');
    if not found then
      raise exception 'No eligible registered account found for this number.' using errcode = '22023';
    end if;
    if p_action = 'lookup' then
      return jsonb_build_object('id', target.id, 'name', target.display_name);
    end if;
    if target.id is distinct from p_user_id then
      raise exception 'Look up the mobile number again before assigning access.' using errcode = '22023';
    end if;
    insert into private.tournament_admins (tournament_id, user_id)
    values (p_tournament_id, target.id) on conflict do nothing;
  elsif p_action = 'revoke' then
    delete from private.tournament_admins where tournament_id = p_tournament_id and user_id = p_user_id;
  elsif p_action is distinct from 'list' then
    raise exception 'Invalid admin action.' using errcode = '22023';
  end if;
  if p_action in ('grant', 'revoke') and found then
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
    values (actor, 'TOURNAMENT_ADMIN_' || pg_catalog.upper(p_action), 'tournaments',
      p_tournament_id::text, jsonb_build_object('user_id', p_user_id));
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name) order by p.display_name)
    from private.tournament_admins a join public.profiles p on p.id = a.user_id
    where a.tournament_id = p_tournament_id
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.manage_tournament_admins(uuid,text,text,uuid) from public, anon;
grant execute on function public.manage_tournament_admins(uuid,text,text,uuid) to authenticated;

create or replace function private.require_tournament_organiser(p_tournament_id uuid)
returns void language plpgsql stable security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  if not exists (select 1 from public.tournaments where id = p_tournament_id) then
    raise exception 'Tournament not found.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.tournaments where id = p_tournament_id and owner_id = (select auth.uid()))
     and not exists (select 1 from public.user_role_assignments where user_id = (select auth.uid()) and role = 'organiser'
                     and scope_type = 'tournament' and scope_id = p_tournament_id and is_active)
     and not private.is_tournament_admin(p_tournament_id) and not private.is_admin() then
    raise exception 'Only the tournament organiser can do this.' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where id = (select auth.uid()) and account_status in ('suspended','disabled')) then
    raise exception 'Your account is suspended.' using errcode = '42501';
  end if;
end;
$$;

create or replace function private.is_tournament_organiser(p_tournament_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and (
    exists (select 1 from public.tournaments where id = p_tournament_id and owner_id = (select auth.uid()))
    or exists (select 1 from public.user_role_assignments where user_id = (select auth.uid()) and role = 'organiser'
               and scope_type = 'tournament' and scope_id = p_tournament_id and is_active)
    or private.is_tournament_admin(p_tournament_id) or private.is_admin())
  and not exists (select 1 from public.profiles where id = (select auth.uid()) and account_status in ('suspended', 'disabled'));
$$;

create or replace function private.can_manage_match(p_match_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.matches m where m.id = p_match_id and (
      private.is_tournament_admin(m.tournament_id) or m.created_by = (select auth.uid()) or private.is_admin()
      or (m.tournament_id is not null and (
            exists (select 1 from public.tournaments t where t.id = m.tournament_id and t.owner_id = (select auth.uid()))
         or exists (select 1 from public.user_role_assignments r where r.user_id = (select auth.uid()) and r.role = 'organiser'
                    and r.scope_type = 'tournament' and r.scope_id = m.tournament_id and r.is_active)))))
  and not exists (select 1 from public.profiles where id = (select auth.uid()) and account_status in ('suspended','disabled'));
$$;

create or replace function private.can_score_match(p_match_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.matches m
     where m.id = p_match_id
       and (private.is_tournament_admin(m.tournament_id) or m.created_by = (select auth.uid()) or m.scorer_id = (select auth.uid()) or private.is_admin()
            or exists (select 1 from public.match_officials mo where mo.match_id = m.id and mo.user_id = (select auth.uid())
                       and mo.role = 'scorer' and mo.status = 'accepted')
            or (m.tournament_id is not null and (
                  exists (select 1 from public.tournaments t where t.id = m.tournament_id and t.owner_id = (select auth.uid()))
               or exists (select 1 from public.user_role_assignments r where r.user_id = (select auth.uid()) and r.role = 'organiser'
                          and r.scope_type = 'tournament' and r.scope_id = m.tournament_id and r.is_active))))
  ) and not exists (select 1 from public.profiles where id = (select auth.uid()) and account_status in ('suspended','disabled'));
$$;

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
    return private.is_tournament_admin(target) or exists (select 1 from public.tournaments where id = target and owner_id = (select auth.uid()))
        or exists (select 1 from public.user_role_assignments where user_id = (select auth.uid()) and role = 'organiser'
                   and scope_type = 'tournament' and scope_id = target and is_active)
        or private.is_admin();
  elsif parts[1] = 'grounds' then
    return exists (select 1 from public.grounds where id = target and owner_id = (select auth.uid())) or private.is_admin();
  elsif parts[1] = 'listings' then
    return exists (select 1 from public.directory_listings where id = target and owner_id = (select auth.uid())) or private.is_admin();
  elsif parts[1] = 'items' then
    return exists (select 1 from public.market_items where id = target and seller_id = (select auth.uid())) or private.is_admin();
  elsif parts[1] in ('gallery', 'clips') then
    return exists (select 1 from public.media_items mi where mi.id = target
                   and (mi.uploader_id = (select auth.uid()) or private.can_moderate_media(mi.scope, mi.scope_id)));
  elsif parts[1] = 'sponsors' then
    return private.is_sponsor_owner(target);
  elsif parts[1] = 'sponsorships' then
    return exists (select 1 from public.tournament_sponsors ts where ts.id = target
                   and (private.is_tournament_organiser(ts.tournament_id) or private.is_sponsor_owner(ts.sponsor_id)));
  elsif parts[1] = 'ads' then
    return exists (select 1 from public.ad_placements a where a.id = target and private.can_manage_ad(a));
  elsif parts[1] = 'merch' then
    return exists (select 1 from public.merch_items m where m.id = target and private.is_tournament_organiser(m.tournament_id));
  end if;
  return false;
end;
$$;
