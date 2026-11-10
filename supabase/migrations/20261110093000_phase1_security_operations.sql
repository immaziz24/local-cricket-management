-- Phase 1 / #267–#270 Security & operations
-- #267 Activity and audit logs   : list_audit_logs() for Admin/Super-Admin
-- #268 Database backup           : export_platform_snapshot() for Super-Admin (JSON download).
--                                  Full point-in-time backups need a paid Supabase plan.
-- #269 Security and privacy      : export_my_data() for every user (personal data download).
--                                  Privacy settings use public.user_privacy_settings (own row, RLS).
-- #270 Notifications management  : send_announcement() for Admin/Super-Admin; users read their
--                                  inbox from public.notifications (own rows, RLS).

create or replace function public.list_audit_logs(p_search text default null, p_limit int default 200)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare q text := nullif(pg_catalog.btrim(coalesce(p_search, '')), '');
begin
  if not private.is_admin() then
    raise exception 'Only an Admin or Super-Admin can view the audit log.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(l order by l.created_at desc)
    from (
      select a.id, a.action, a.entity_type, a.entity_id, a.metadata, a.created_at,
             coalesce(ap.display_name, case when a.actor_user_id is null then 'System' else 'Unnamed member' end) as actor_name,
             tp.display_name as target_name
      from public.audit_logs a
      left join public.profiles ap on ap.id = a.actor_user_id
      left join public.profiles tp on tp.id = a.target_user_id
      where q is null
         or a.action ilike '%' || q || '%'
         or a.entity_type ilike '%' || q || '%'
         or ap.display_name ilike '%' || q || '%'
         or tp.display_name ilike '%' || q || '%'
      order by a.created_at desc
      limit greatest(1, least(coalesce(p_limit, 200), 1000))
    ) l
  ), '[]'::jsonb);
end;
$$;

create or replace function public.export_platform_snapshot()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare snap jsonb;
begin
  if not private.has_role('super_admin') then
    raise exception 'Only the Super-Admin can export a platform snapshot.' using errcode = '42501';
  end if;
  snap := jsonb_build_object(
    'exported_at', pg_catalog.now(),
    'format', 'local-cricket-snapshot-v1',
    'profiles', coalesce((select jsonb_agg(p) from public.profiles p), '[]'::jsonb),
    'user_role_assignments', coalesce((select jsonb_agg(r) from public.user_role_assignments r), '[]'::jsonb),
    'role_permissions', coalesce((select jsonb_agg(rp) from public.role_permissions rp), '[]'::jsonb),
    'user_verifications', coalesce((select jsonb_agg(v - 'private_metadata') from (select to_jsonb(uv) as v from public.user_verifications uv) x), '[]'::jsonb),
    'user_reports', coalesce((select jsonb_agg(ur) from public.user_reports ur), '[]'::jsonb),
    'user_suspensions', coalesce((select jsonb_agg(us) from public.user_suspensions us), '[]'::jsonb),
    'platform_settings', (select to_jsonb(ps) from public.platform_settings ps where ps.id),
    'audit_logs_last_1000', coalesce((select jsonb_agg(a) from (select * from public.audit_logs order by created_at desc limit 1000) a), '[]'::jsonb)
  );
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'PLATFORM_SNAPSHOT_EXPORTED', 'platform', 'global',
          jsonb_build_object('profiles', jsonb_array_length(snap->'profiles')));
  return snap;
end;
$$;

create or replace function public.export_my_data()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := (select auth.uid()); data jsonb;
begin
  if uid is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  data := jsonb_build_object(
    'exported_at', pg_catalog.now(),
    'account', (select jsonb_build_object('email', u.email, 'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at) from auth.users u where u.id = uid),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = uid),
    'roles', coalesce((select jsonb_agg(jsonb_build_object('role', r.role, 'scope', r.scope_type, 'active', r.is_active, 'granted_at', r.granted_at)) from public.user_role_assignments r where r.user_id = uid), '[]'::jsonb),
    'verifications', coalesce((select jsonb_agg(jsonb_build_object('type', v.verification_type, 'status', v.status, 'submitted_at', v.submitted_at, 'reviewed_at', v.reviewed_at)) from public.user_verifications v where v.user_id = uid), '[]'::jsonb),
    'reports_i_made', coalesce((select jsonb_agg(jsonb_build_object('reason', r.reason, 'status', r.status, 'created_at', r.created_at)) from public.user_reports r where r.reporter_user_id = uid), '[]'::jsonb),
    'suspensions', coalesce((select jsonb_agg(jsonb_build_object('reason', s.reason, 'starts_at', s.starts_at, 'ends_at', s.ends_at, 'lifted_at', s.revoked_at)) from public.user_suspensions s where s.user_id = uid), '[]'::jsonb),
    'privacy_settings', (select to_jsonb(ps) from public.user_privacy_settings ps where ps.user_id = uid),
    'notification_preferences', (select to_jsonb(np) from public.notification_preferences np where np.user_id = uid),
    'notifications', coalesce((select jsonb_agg(jsonb_build_object('title', n.title, 'body', n.body, 'created_at', n.created_at, 'read_at', n.read_at)) from public.notifications n where n.recipient_user_id = uid), '[]'::jsonb)
  );
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, target_user_id)
  values (uid, 'PERSONAL_DATA_EXPORTED', 'profiles', uid::text, uid);
  return data;
end;
$$;

create or replace function public.send_announcement(p_title text, p_body text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := (select auth.uid()); sent int;
  t text := nullif(pg_catalog.btrim(coalesce(p_title, '')), '');
  b text := nullif(pg_catalog.btrim(coalesce(p_body, '')), '');
begin
  if not private.is_admin() then
    raise exception 'Only an Admin or Super-Admin can send announcements.' using errcode = '42501';
  end if;
  if t is null then raise exception 'Please write a title.' using errcode = '22023'; end if;
  if pg_catalog.length(t) > 120 or pg_catalog.length(coalesce(b, '')) > 2000 then
    raise exception 'Title must be under 120 characters and message under 2000.' using errcode = '22023';
  end if;

  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  select p.id, 'announcement', t, b, jsonb_build_object('sent_by', uid)
  from public.profiles p
  left join public.notification_preferences np on np.user_id = p.id
  where p.account_status = 'active' and coalesce(np.in_app_enabled, true);
  get diagnostics sent = row_count;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, 'ANNOUNCEMENT_SENT', 'notifications', 'all', jsonb_build_object('title', t, 'recipients', sent));
  return jsonb_build_object('recipients', sent);
end;
$$;

revoke all on function public.list_audit_logs(text, int) from public, anon;
revoke all on function public.export_platform_snapshot() from public, anon;
revoke all on function public.export_my_data() from public, anon;
revoke all on function public.send_announcement(text, text) from public, anon;
grant execute on function public.list_audit_logs(text, int) to authenticated;
grant execute on function public.export_platform_snapshot() to authenticated;
grant execute on function public.export_my_data() to authenticated;
grant execute on function public.send_announcement(text, text) to authenticated;
