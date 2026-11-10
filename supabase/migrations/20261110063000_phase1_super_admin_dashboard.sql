-- Phase 1 / #257 Super-admin dashboard
-- * private.has_role(): checks the signed-in user's active global role
-- * public.platform_settings: one row holding maintenance mode and the platform-wide broadcast
-- * RPC functions the super-admin screen calls (each one re-checks the role and writes an audit log)

-- ------------------------------------------------------------------
-- Role check helper (used only inside SECURITY DEFINER functions)
-- ------------------------------------------------------------------
create or replace function private.has_role(p_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_role_assignments ura
    where ura.user_id = (select auth.uid())
      and ura.role = p_role
      and ura.scope_type = 'global'
      and ura.is_active
      and (ura.expires_at is null or ura.expires_at > pg_catalog.now())
  );
$$;
revoke all on function private.has_role(text) from public, anon, authenticated;

-- ------------------------------------------------------------------
-- Platform settings (single row)
-- ------------------------------------------------------------------
create table if not exists public.platform_settings (
  id boolean primary key default true check (id),
  maintenance_mode boolean not null default false,
  broadcast_message text check (broadcast_message is null or pg_catalog.length(broadcast_message) <= 500),
  broadcast_level text not null default 'info' check (broadcast_level in ('info','warning','critical')),
  broadcast_updated_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
create index if not exists platform_settings_updated_by_idx on public.platform_settings (updated_by);
insert into public.platform_settings (id) values (true) on conflict (id) do nothing;

drop trigger if exists platform_settings_set_updated_at on public.platform_settings;
create trigger platform_settings_set_updated_at before update on public.platform_settings
for each row execute function private.set_updated_at();

alter table public.platform_settings enable row level security;

-- Everyone (including visitors who are not signed in) may read the banner and maintenance flag.
drop policy if exists platform_settings_public_read on public.platform_settings;
create policy platform_settings_public_read on public.platform_settings
for select to anon, authenticated using (true);

revoke all on public.platform_settings from anon, authenticated;
grant select on public.platform_settings to anon, authenticated;
grant all on public.platform_settings to service_role;

-- ------------------------------------------------------------------
-- RPC: dashboard metrics (super-admin only)
-- ------------------------------------------------------------------
create or replace function public.get_super_admin_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not private.has_role('super_admin') then
    raise exception 'Only a Super-Admin can view this dashboard.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'total_users', (select count(*) from public.profiles),
    'new_users_7d', (select count(*) from public.profiles where created_at > pg_catalog.now() - interval '7 days'),
    'suspended_users', (select count(*) from public.profiles where account_status = 'suspended'),
    'pending_verifications', (select count(*) from public.user_verifications where status = 'pending'),
    'open_reports', (select count(*) from public.user_reports where status in ('submitted','under_review')),
    'role_breakdown', jsonb_build_object(
      'super_admins', (select count(distinct user_id) from public.user_role_assignments where role = 'super_admin' and is_active),
      'admins',       (select count(distinct user_id) from public.user_role_assignments where role = 'admin' and is_active),
      'organisers',   (select count(distinct user_id) from public.user_role_assignments where role = 'organiser' and is_active),
      'team_owners',  (select count(distinct user_id) from public.user_role_assignments where role = 'team_owner' and is_active),
      'captains',     (select count(distinct user_id) from public.user_role_assignments where role = 'captain' and is_active),
      'scorers',      (select count(distinct user_id) from public.user_role_assignments where role = 'scorer' and is_active),
      'umpires',      (select count(distinct user_id) from public.user_role_assignments where role = 'umpire' and is_active),
      'players',      (select count(distinct user_id) from public.user_role_assignments where role = 'player' and is_active)
    ),
    'maintenance_mode', ps.maintenance_mode,
    'broadcast_banner', case when ps.broadcast_message is null then null else jsonb_build_object(
      'message', ps.broadcast_message,
      'level', ps.broadcast_level,
      'timestamp', ps.broadcast_updated_at
    ) end
  )
  into result
  from public.platform_settings ps
  where ps.id;

  return result;
end;
$$;

-- ------------------------------------------------------------------
-- RPC: maintenance mode on/off (super-admin only, audited)
-- ------------------------------------------------------------------
create or replace function public.set_maintenance_mode(p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_role('super_admin') then
    raise exception 'Only a Super-Admin can change maintenance mode.' using errcode = '42501';
  end if;

  update public.platform_settings
     set maintenance_mode = coalesce(p_enabled, false),
         updated_by = (select auth.uid())
   where id;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'MAINTENANCE_MODE_CHANGED', 'platform_settings', 'global',
          jsonb_build_object('enabled', coalesce(p_enabled, false)));

  return jsonb_build_object('maintenance_mode', coalesce(p_enabled, false));
end;
$$;

-- ------------------------------------------------------------------
-- RPC: set or clear the platform-wide broadcast (super-admin only, audited)
-- ------------------------------------------------------------------
create or replace function public.set_platform_broadcast(p_message text, p_level text default 'info')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_message text := nullif(pg_catalog.btrim(coalesce(p_message, '')), '');
  clean_level text := coalesce(nullif(p_level, ''), 'info');
begin
  if not private.has_role('super_admin') then
    raise exception 'Only a Super-Admin can publish announcements.' using errcode = '42501';
  end if;
  if clean_level not in ('info','warning','critical') then
    raise exception 'Unknown announcement level: %', clean_level using errcode = '22023';
  end if;

  update public.platform_settings
     set broadcast_message = clean_message,
         broadcast_level = clean_level,
         broadcast_updated_at = case when clean_message is null then null else pg_catalog.now() end,
         updated_by = (select auth.uid())
   where id;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()),
          case when clean_message is null then 'BROADCAST_CLEARED' else 'BROADCAST_PUBLISHED' end,
          'platform_settings', 'global',
          jsonb_build_object('level', clean_level, 'message', clean_message));

  return case when clean_message is null then jsonb_build_object('broadcast', null)
    else jsonb_build_object('broadcast', jsonb_build_object(
      'message', clean_message, 'level', clean_level, 'timestamp', pg_catalog.now()))
  end;
end;
$$;

-- Only signed-in users may call these; each function checks the Super-Admin role itself.
revoke all on function public.get_super_admin_metrics() from public, anon;
revoke all on function public.set_maintenance_mode(boolean) from public, anon;
revoke all on function public.set_platform_broadcast(text, text) from public, anon;
grant execute on function public.get_super_admin_metrics() to authenticated;
grant execute on function public.set_maintenance_mode(boolean) to authenticated;
grant execute on function public.set_platform_broadcast(text, text) to authenticated;
