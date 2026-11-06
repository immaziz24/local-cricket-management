-- Local Cricket Management: Phase 1 / Category N foundation
-- Source: Master Feature Blueprint v2.0, features #254-270.
-- Supabase-managed auth/storage/realtime schemas are not modified.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to postgres, service_role;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  display_name text,
  avatar_url text,
  locale text not null default 'en',
  timezone text not null default 'Asia/Kolkata',
  account_status text not null default 'active'
    check (account_status in ('active','pending_verification','suspended','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists profiles_username_lower_uidx
  on public.profiles (lower(username)) where username is not null;

create table if not exists public.user_role_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in (
    'super_admin','admin','organiser','team_owner','captain','scorer','umpire','player'
  )),
  scope_type text not null check (scope_type in ('global','tournament','team','match')),
  scope_id uuid,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  is_active boolean not null default true,
  notes text,
  check ((scope_type = 'global' and scope_id is null) or (scope_type <> 'global' and scope_id is not null)),
  check (
    (role in ('super_admin','admin') and scope_type = 'global')
    or (role = 'organiser' and scope_type in ('global','tournament'))
    or (role in ('team_owner','captain','player') and scope_type = 'team')
    or (role in ('scorer','umpire') and scope_type = 'match')
  ),
  check (expires_at is null or expires_at > granted_at)
);
create unique index if not exists user_role_assignments_unique_scope_uidx
  on public.user_role_assignments (
    user_id, role, scope_type, coalesce(scope_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );
create index if not exists user_role_assignments_user_active_idx
  on public.user_role_assignments (user_id, is_active, role);

create table if not exists public.user_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  verification_type text not null check (verification_type in ('email','phone','identity','profile')),
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz,
  review_note text,
  private_metadata jsonb not null default '{}'::jsonb
);
create index if not exists user_verifications_user_status_idx
  on public.user_verifications (user_id, status, submitted_at desc);

create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references auth.users(id) on delete restrict,
  reported_user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  description text,
  status text not null default 'submitted'
    check (status in ('submitted','under_review','resolved','dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  resolution_note text,
  check (reporter_user_id <> reported_user_id)
);
create index if not exists user_reports_reported_status_idx
  on public.user_reports (reported_user_id, status, created_at desc);
create index if not exists user_reports_reporter_idx
  on public.user_reports (reporter_user_id, created_at desc);

create table if not exists public.user_suspensions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  issued_by uuid not null references auth.users(id) on delete restrict,
  reason text not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  revocation_note text,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create index if not exists user_suspensions_user_active_idx
  on public.user_suspensions (user_id, starts_at desc, ends_at);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  target_user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_actor_created_idx on public.audit_logs (actor_user_id, created_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

create table if not exists public.user_privacy_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile_visibility text not null default 'private'
    check (profile_visibility in ('public','members','private')),
  show_phone boolean not null default false,
  show_email boolean not null default false,
  allow_messages boolean not null default true,
  analytics_opt_in boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default true,
  push_enabled boolean not null default true,
  sms_enabled boolean not null default false,
  category_preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null,
  title text not null,
  body text,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_recipient_unread_idx
  on public.notifications (recipient_user_id, created_at desc) where read_at is null;

create table if not exists public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  channel text not null check (channel in ('in_app','email','push','sms')),
  title_template text,
  body_template text not null,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function private.set_updated_at();

drop trigger if exists privacy_settings_set_updated_at on public.user_privacy_settings;
create trigger privacy_settings_set_updated_at before update on public.user_privacy_settings
for each row execute function private.set_updated_at();

drop trigger if exists notification_preferences_set_updated_at on public.notification_preferences;
create trigger notification_preferences_set_updated_at before update on public.notification_preferences
for each row execute function private.set_updated_at();

drop trigger if exists notification_templates_set_updated_at on public.notification_templates;
create trigger notification_templates_set_updated_at before update on public.notification_templates
for each row execute function private.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name'), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_auth_user();

alter table public.profiles enable row level security;
alter table public.user_role_assignments enable row level security;
alter table public.user_verifications enable row level security;
alter table public.user_reports enable row level security;
alter table public.user_suspensions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.user_privacy_settings enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_templates enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
for select to authenticated using ((select auth.uid()) = id);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
for update to authenticated using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists role_assignments_select_own on public.user_role_assignments;
create policy role_assignments_select_own on public.user_role_assignments
for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists verifications_select_own on public.user_verifications;
create policy verifications_select_own on public.user_verifications
for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists reports_select_own on public.user_reports;
create policy reports_select_own on public.user_reports
for select to authenticated using ((select auth.uid()) = reporter_user_id);
drop policy if exists reports_insert_own on public.user_reports;
create policy reports_insert_own on public.user_reports
for insert to authenticated with check (
  (select auth.uid()) = reporter_user_id
  and reporter_user_id <> reported_user_id
);

drop policy if exists suspensions_select_own on public.user_suspensions;
create policy suspensions_select_own on public.user_suspensions
for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists privacy_settings_select_own on public.user_privacy_settings;
create policy privacy_settings_select_own on public.user_privacy_settings
for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists privacy_settings_insert_own on public.user_privacy_settings;
create policy privacy_settings_insert_own on public.user_privacy_settings
for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists privacy_settings_update_own on public.user_privacy_settings;
create policy privacy_settings_update_own on public.user_privacy_settings
for update to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists notification_preferences_select_own on public.notification_preferences;
create policy notification_preferences_select_own on public.notification_preferences
for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists notification_preferences_insert_own on public.notification_preferences;
create policy notification_preferences_insert_own on public.notification_preferences
for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists notification_preferences_update_own on public.notification_preferences;
create policy notification_preferences_update_own on public.notification_preferences
for update to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
for select to authenticated using ((select auth.uid()) = recipient_user_id);
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
for update to authenticated using ((select auth.uid()) = recipient_user_id)
with check ((select auth.uid()) = recipient_user_id);

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (username, display_name, avatar_url, locale, timezone) on public.profiles to authenticated;
grant select on public.user_role_assignments to authenticated;
grant select on public.user_verifications to authenticated;
grant select, insert on public.user_reports to authenticated;
grant select on public.user_suspensions to authenticated;
grant select, insert, update on public.user_privacy_settings to authenticated;
grant select, insert, update on public.notification_preferences to authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

grant all privileges on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on function private.set_updated_at() to service_role;
