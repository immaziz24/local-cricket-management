-- Phase 1 / #259–#264 Role permissions (organiser, team owner, captain, scorer, umpire, player)
-- * Roles can be held platform-wide ('global'), as well as per tournament / team / match later.
-- * public.role_permissions: what each role is allowed to do (Super-Admin can switch items on/off).
-- * RPCs to list, assign and remove roles. Every change is written to audit_logs.
-- * private.has_permission(): used by future features to check what the signed-in user may do.

-- 1. Allow every non-admin role to be held platform-wide.
alter table public.user_role_assignments drop constraint if exists user_role_assignments_check1;
alter table public.user_role_assignments add constraint user_role_assignments_role_scope_check check (
  (role in ('super_admin','admin') and scope_type = 'global')
  or (role = 'organiser' and scope_type in ('global','tournament'))
  or (role in ('team_owner','captain','player') and scope_type in ('global','team'))
  or (role in ('scorer','umpire') and scope_type in ('global','match'))
);

-- 2. Permission catalogue per role.
create table if not exists public.role_permissions (
  role text not null check (role in ('organiser','team_owner','captain','scorer','umpire','player')),
  permission_key text not null check (permission_key ~ '^[a-z_]+$'),
  label text not null,
  description text,
  enabled boolean not null default true,
  default_enabled boolean not null default true,
  sort_order int not null default 0,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (role, permission_key)
);
create index if not exists role_permissions_updated_by_idx on public.role_permissions (updated_by);

drop trigger if exists role_permissions_set_updated_at on public.role_permissions;
create trigger role_permissions_set_updated_at before update on public.role_permissions
for each row execute function private.set_updated_at();

insert into public.role_permissions (role, permission_key, label, description, enabled, default_enabled, sort_order) values
  ('organiser', 'create_tournament', 'Create & Publish Tournaments', 'Setup tournament brackets, venues, and registration fees', true, true, 1),
  ('organiser', 'reschedule_match', 'Reschedule Fixtures & Change Grounds', 'Modify match dates, timings, and grounds', true, true, 2),
  ('organiser', 'penalty_policy_select', 'Select Late Arrival Penalty Policy', 'Assign overs deduction, fielding penalty, or penalty runs (Cat Q)', true, true, 3),
  ('organiser', 'collect_fees', 'Collect Team Registration Fees', 'Record and track tournament entry payments', true, true, 4),
  ('organiser', 'appoint_officials', 'Appoint Match Umpires & Scorers', 'Assign official scorers and certified umpires to fixtures', true, true, 5),
  ('team_owner', 'manage_roster', 'Register & Manage Squad Rosters', 'Add or release registered players from team squad', true, true, 1),
  ('team_owner', 'submit_entry', 'Submit Tournament Entry Applications', 'Enter team into sanctioned local tournaments', true, true, 2),
  ('team_owner', 'sponsor_branding', 'Upload Jersey & Sponsor Assets', 'Manage team crest, jersey numbers, and sponsor banners', true, true, 3),
  ('team_owner', 'team_finances', 'View Team Financial Statements', 'Track tournament fee receipts and prize distributions', false, false, 4),
  ('captain', 'submit_playing_xi', 'Submit Official Playing XI & 12th Man', 'Lock in line-up before the official toss call', true, true, 1),
  ('captain', 'toss_call', 'Record Coin Toss Nomination', 'Confirm heads/tails call and bat/bowl decision with umpire', true, true, 2),
  ('captain', 'batting_order', 'Adjust Batting & Bowling Orders', 'Submit live tactical order adjustments to scorer', true, true, 3),
  ('captain', 'score_dispute', 'Log Official Scorecard Dispute', 'File a formal scoring review with match referee within 30 min', true, true, 4),
  ('scorer', 'ball_by_ball', 'Record Real-Time Ball-by-Ball Data', 'Log runs, extras (wd, nb, b, lb), wickets, and pitch zones', true, true, 1),
  ('scorer', 'wagon_wheel', 'Plot Wagon Wheels & Shot Directions', 'Input fielding position coordinates and trajectory vectors', true, true, 2),
  ('scorer', 'dls_calculator', 'Calculate Rain Interruptions (DLS / VJD)', 'Recalculate revised targets in rain-curtailed matches', true, true, 3),
  ('scorer', 'finalize_scorecard', 'Lock & Sign Off Official Scorecard', 'Generate verified match summary signed by umpires', true, true, 4),
  ('umpire', 'match_signoff', 'Sanction & Sign Off Match Results', 'Confirm final match outcome, bonus points, and player of match', true, true, 1),
  ('umpire', 'pitch_report', 'Submit Pre-Match Ground & Pitch Report', 'Log boundary lengths, pitch hardness, and weather condition', true, true, 2),
  ('umpire', 'conduct_infraction', 'Report Code of Conduct Violations', 'Issue formal cautions or level 1-4 disciplinary reports', true, true, 3),
  ('umpire', 'award_penalties', 'Award Penalty Runs for Misconduct', 'Enforce 5 penalty runs for unfair play or ball tampering', true, true, 4),
  ('player', 'view_profile', 'View Personal Career Statistics', 'Access career batting averages, bowling economy, and strike rates', true, true, 1),
  ('player', 'match_rsvp', 'RSVP Availability for Upcoming Fixtures', 'Notify team captain of availability for weekend matches', true, true, 2),
  ('player', 'transfer_request', 'Submit Team Transfer Request', 'Initiate formal release and transfer to another registered club', true, true, 3),
  ('player', 'export_stats', 'Download Verified Player Profile PDF', 'Export certified playing credentials for league registration', true, true, 4)
on conflict (role, permission_key) do nothing;

alter table public.role_permissions enable row level security;
drop policy if exists role_permissions_read on public.role_permissions;
create policy role_permissions_read on public.role_permissions
for select to authenticated using (true);
revoke all on public.role_permissions from anon, authenticated;
grant select on public.role_permissions to authenticated;
grant all on public.role_permissions to service_role;

-- 3. Helpers
create or replace function private.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$ select private.has_role('admin') or private.has_role('super_admin'); $$;
revoke all on function private.is_admin() from public, anon, authenticated;

-- True if the signed-in user holds an active role whose permission is enabled.
-- Super-Admins have every permission.
create or replace function private.has_permission(p_key text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.has_role('super_admin') or exists (
    select 1
    from public.user_role_assignments ura
    join public.role_permissions rp on rp.role = ura.role
    where ura.user_id = (select auth.uid())
      and ura.is_active
      and (ura.expires_at is null or ura.expires_at > pg_catalog.now())
      and rp.permission_key = p_key
      and rp.enabled
  );
$$;
revoke all on function private.has_permission(text) from public, anon, authenticated;

-- 4. Switch one permission on/off (Super-Admin only)
create or replace function public.set_role_permission(p_role text, p_key text, p_enabled boolean)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.has_role('super_admin') then
    raise exception 'Only a Super-Admin can change role permissions.' using errcode = '42501';
  end if;
  update public.role_permissions
     set enabled = coalesce(p_enabled, false), updated_by = (select auth.uid())
   where role = p_role and permission_key = p_key;
  if not found then
    raise exception 'Unknown permission % for role %', p_key, p_role using errcode = '22023';
  end if;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'ROLE_PERMISSION_CHANGED', 'role_permissions', p_role || ':' || p_key,
          jsonb_build_object('role', p_role, 'permission', p_key, 'enabled', coalesce(p_enabled, false)));
  return jsonb_build_object('role', p_role, 'key', p_key, 'enabled', coalesce(p_enabled, false));
end;
$$;

-- 5. Reset a role's permissions to defaults (Super-Admin only)
create or replace function public.reset_role_permissions(p_role text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.has_role('super_admin') then
    raise exception 'Only a Super-Admin can change role permissions.' using errcode = '42501';
  end if;
  update public.role_permissions
     set enabled = default_enabled, updated_by = (select auth.uid())
   where role = p_role;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'ROLE_PERMISSIONS_RESET', 'role_permissions', p_role, jsonb_build_object('role', p_role));
  return jsonb_build_object('role', p_role, 'reset', true);
end;
$$;

-- 6. Members list for the role screens (Admin or Super-Admin)
create or replace function public.list_members_with_roles()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Only an Admin or Super-Admin can manage roles.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(m order by m.display_name)
    from (
      select p.id,
             coalesce(p.display_name, 'Unnamed member') as display_name,
             p.account_status,
             p.created_at,
             coalesce((
               select jsonb_agg(distinct ura.role)
               from public.user_role_assignments ura
               where ura.user_id = p.id and ura.is_active and ura.scope_type = 'global'
             ), '[]'::jsonb) as roles
      from public.profiles p
    ) m
  ), '[]'::jsonb);
end;
$$;

-- 7. Give a member a platform-wide role
create or replace function public.assign_role(p_user_id uuid, p_role text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if p_role in ('super_admin','admin') then
    if not private.has_role('super_admin') then
      raise exception 'Only a Super-Admin can give the % role.', p_role using errcode = '42501';
    end if;
  elsif not private.is_admin() then
    raise exception 'Only an Admin or Super-Admin can give roles.' using errcode = '42501';
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

-- 8. Remove a member's platform-wide role
create or replace function public.revoke_role(p_user_id uuid, p_role text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if p_role in ('super_admin','admin') then
    if not private.has_role('super_admin') then
      raise exception 'Only a Super-Admin can remove the % role.', p_role using errcode = '42501';
    end if;
  elsif not private.is_admin() then
    raise exception 'Only an Admin or Super-Admin can remove roles.' using errcode = '42501';
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

revoke all on function public.set_role_permission(text, text, boolean) from public, anon;
revoke all on function public.reset_role_permissions(text) from public, anon;
revoke all on function public.list_members_with_roles() from public, anon;
revoke all on function public.assign_role(uuid, text) from public, anon;
revoke all on function public.revoke_role(uuid, text) from public, anon;
grant execute on function public.set_role_permission(text, text, boolean) to authenticated;
grant execute on function public.reset_role_permissions(text) to authenticated;
grant execute on function public.list_members_with_roles() to authenticated;
grant execute on function public.assign_role(uuid, text) to authenticated;
grant execute on function public.revoke_role(uuid, text) to authenticated;
