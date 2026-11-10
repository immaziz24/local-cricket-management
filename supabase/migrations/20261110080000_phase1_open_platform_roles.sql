-- Phase 1 / #259–#264: open-platform rule (confirmed by the owner 2026-11-10)
-- * Every registered user is a Player automatically.
-- * Everyone can create tournaments, teams and matches. Organiser, Team Owner, Captain,
--   Scorer and Umpire are earned per tournament / team / match from what a user creates
--   or is chosen for (built in Phases 2–4), never handed out platform-wide.
-- * Only Admin and Super-Admin are appointed by hand.

-- 1. New users get the Player role at sign-up.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  raw_mobile text := pg_catalog.regexp_replace(
    coalesce(new.raw_user_meta_data ->> 'mobile_number', ''), '[^0-9]', '', 'g');
  clean_mobile text;
begin
  clean_mobile := case
    when pg_catalog.length(raw_mobile) >= 10 then pg_catalog.right(raw_mobile, 10)
    else null
  end;

  insert into public.profiles (id, display_name, mobile_number)
  values (
    new.id,
    nullif(coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name'), ''),
    clean_mobile
  )
  on conflict (id) do nothing;

  insert into public.user_role_assignments (user_id, role, scope_type, notes)
  values (new.id, 'player', 'global', 'Automatic: every registered user is a player')
  on conflict do nothing;

  return new;
end;
$$;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

-- 2. Existing users become players too.
insert into public.user_role_assignments (user_id, role, scope_type, notes)
select p.id, 'player', 'global', 'Automatic: every registered user is a player'
from public.profiles p
where not exists (
  select 1 from public.user_role_assignments ura
  where ura.user_id = p.id and ura.role = 'player' and ura.scope_type = 'global'
);

-- 3. Hand-appointed roles are limited to Admin and Super-Admin (Super-Admin only).
create or replace function public.assign_role(p_user_id uuid, p_role text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if p_role not in ('super_admin','admin') then
    raise exception 'The % role is earned automatically (every user is a player; organisers, team owners, captains, scorers and umpires come from creating or being chosen for a tournament, team or match).', p_role
      using errcode = '22023';
  end if;
  if not private.has_role('super_admin') then
    raise exception 'Only a Super-Admin can appoint Admins.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Member not found.' using errcode = '22023';
  end if;

  update public.user_role_assignments
     set is_active = true, granted_by = (select auth.uid()), granted_at = pg_catalog.now(), expires_at = null
   where user_id = p_user_id and role = p_role and scope_type = 'global';
  if not found then
    insert into public.user_role_assignments (user_id, role, scope_type, granted_by)
    values (p_user_id, p_role, 'global', (select auth.uid()));
  end if;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, target_user_id, metadata)
  values ((select auth.uid()), 'ROLE_ASSIGNED', 'user_role_assignments', p_role, p_user_id, jsonb_build_object('role', p_role, 'scope', 'global'));
  return jsonb_build_object('user_id', p_user_id, 'role', p_role, 'active', true);
end;
$$;

create or replace function public.revoke_role(p_user_id uuid, p_role text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if p_role not in ('super_admin','admin') then
    raise exception 'The % role cannot be removed by hand. To stop someone, suspend their account (#266).', p_role
      using errcode = '22023';
  end if;
  if not private.has_role('super_admin') then
    raise exception 'Only a Super-Admin can remove Admins.' using errcode = '42501';
  end if;

  if p_role = 'super_admin' and (
    select count(distinct user_id) from public.user_role_assignments
    where role = 'super_admin' and is_active and user_id <> p_user_id
  ) = 0 then
    raise exception 'You cannot remove the last Super-Admin. Make someone else Super-Admin first.' using errcode = '22023';
  end if;

  update public.user_role_assignments
     set is_active = false
   where user_id = p_user_id and role = p_role and scope_type = 'global' and is_active;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, target_user_id, metadata)
  values ((select auth.uid()), 'ROLE_REVOKED', 'user_role_assignments', p_role, p_user_id, jsonb_build_object('role', p_role, 'scope', 'global'));
  return jsonb_build_object('user_id', p_user_id, 'role', p_role, 'active', false);
end;
$$;
