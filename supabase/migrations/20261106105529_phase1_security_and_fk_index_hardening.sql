
-- Phase 1 hardening: explicit deny policies and indexes for FK joins.
-- (Already applied to Supabase project cwdkvjweuyvednvoyaum on 2026-11-06; file archived into the repo on 2026-11-10.)
create index if not exists audit_logs_target_user_idx
  on public.audit_logs (target_user_id);
create index if not exists notification_templates_created_by_idx
  on public.notification_templates (created_by);
create index if not exists user_reports_reviewed_by_idx
  on public.user_reports (reviewed_by);
create index if not exists user_role_assignments_granted_by_idx
  on public.user_role_assignments (granted_by);
create index if not exists user_suspensions_issued_by_idx
  on public.user_suspensions (issued_by);
create index if not exists user_suspensions_revoked_by_idx
  on public.user_suspensions (revoked_by);
create index if not exists user_verifications_reviewed_by_idx
  on public.user_verifications (reviewed_by);

-- Explicitly deny direct client access to audit records and notification templates.
drop policy if exists audit_logs_deny_client_access on public.audit_logs;
create policy audit_logs_deny_client_access on public.audit_logs
for all to anon, authenticated using (false) with check (false);
drop policy if exists notification_templates_deny_client_access on public.notification_templates;
create policy notification_templates_deny_client_access on public.notification_templates
for all to anon, authenticated using (false) with check (false);

-- Restrict verification reads to non-sensitive status fields only.
revoke select on public.user_verifications from authenticated;
grant select (
  id, user_id, verification_type, status, submitted_at, reviewed_at, expires_at
) on public.user_verifications to authenticated;
