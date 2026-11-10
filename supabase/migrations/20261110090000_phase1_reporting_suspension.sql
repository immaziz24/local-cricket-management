-- Phase 1 / #266 User reporting and suspension
-- * Any signed-in user can find a member by name and report them.
-- * Admins / Super-Admin review reports, suspend (for N days or indefinitely) and lift suspensions.
-- * Admins cannot suspend Admins or the Super-Admin; nobody can suspend themselves.
-- * Expired suspensions are lifted automatically when the user next signs in.

-- Find members by name (for the report form). Names only.
create or replace function public.search_members(p_query text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare q text := pg_catalog.btrim(coalesce(p_query, ''));
begin
  if (select auth.uid()) is null then
    raise exception 'Please sign in first.' using errcode = '42501';
  end if;
  if pg_catalog.length(q) < 2 then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', p.id, 'display_name', p.display_name) order by p.display_name)
    from (
      select id, display_name from public.profiles
      where display_name ilike '%' || q || '%' and id <> (select auth.uid())
      order by display_name limit 10
    ) p
  ), '[]'::jsonb);
end;
$$;

-- Report a member.
create or replace function public.report_user(p_reported_user_id uuid, p_reason text, p_description text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := (select auth.uid()); new_id uuid;
begin
  if uid is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  if p_reported_user_id = uid then raise exception 'You cannot report yourself.' using errcode = '22023'; end if;
  if nullif(pg_catalog.btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'Please choose a reason.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_reported_user_id) then
    raise exception 'Member not found.' using errcode = '22023';
  end if;
  if (select count(*) from public.user_reports where reporter_user_id = uid and created_at > pg_catalog.now() - interval '1 hour') >= 10 then
    raise exception 'Too many reports in a short time. Please try again later.' using errcode = '22023';
  end if;

  insert into public.user_reports (reporter_user_id, reported_user_id, reason, description)
  values (uid, p_reported_user_id, pg_catalog.left(pg_catalog.btrim(p_reason), 120), nullif(pg_catalog.left(pg_catalog.btrim(coalesce(p_description, '')), 1000), ''))
  returning id into new_id;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, target_user_id, metadata)
  values (uid, 'USER_REPORTED', 'user_reports', new_id::text, p_reported_user_id, jsonb_build_object('reason', p_reason));
  return jsonb_build_object('id', new_id, 'status', 'submitted');
end;
$$;

-- Admin: list reports.
create or replace function public.list_user_reports(p_status text default null)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Only an Admin or Super-Admin can review reports.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(r order by (r.status in ('submitted','under_review')) desc, r.created_at desc)
    from (
      select ur.id, ur.reported_user_id,
             coalesce(rp.display_name, 'Unnamed member') as reported_user_name,
             coalesce(rr.display_name, 'Unnamed member') as reporter_name,
             ur.reason, ur.description, ur.status, ur.created_at, ur.reviewed_at, ur.resolution_note,
             rp.account_status as reported_account_status
      from public.user_reports ur
      left join public.profiles rp on rp.id = ur.reported_user_id
      left join public.profiles rr on rr.id = ur.reporter_user_id
      where p_status is null or ur.status = p_status
      order by ur.created_at desc
      limit 200
    ) r
  ), '[]'::jsonb);
end;
$$;

-- Admin: close a report.
create or replace function public.resolve_user_report(p_id uuid, p_dismiss boolean, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare new_status text := case when p_dismiss then 'dismissed' else 'resolved' end;
begin
  if not private.is_admin() then
    raise exception 'Only an Admin or Super-Admin can review reports.' using errcode = '42501';
  end if;
  update public.user_reports
     set status = new_status, reviewed_at = pg_catalog.now(), reviewed_by = (select auth.uid()),
         resolution_note = nullif(pg_catalog.btrim(coalesce(p_note, '')), '')
   where id = p_id and status in ('submitted','under_review');
  if not found then raise exception 'Report not found or already closed.' using errcode = '22023'; end if;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'REPORT_' || pg_catalog.upper(new_status), 'user_reports', p_id::text, jsonb_build_object('note', p_note));
  return jsonb_build_object('id', p_id, 'status', new_status);
end;
$$;

-- Admin: suspend a member.
create or replace function public.suspend_user(p_user_id uuid, p_reason text, p_days int default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := (select auth.uid()); new_id uuid; ends timestamptz;
begin
  if not private.is_admin() then
    raise exception 'Only an Admin or Super-Admin can suspend members.' using errcode = '42501';
  end if;
  if p_user_id = uid then raise exception 'You cannot suspend yourself.' using errcode = '22023'; end if;
  if nullif(pg_catalog.btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'Please give a reason.' using errcode = '22023';
  end if;
  if exists (select 1 from public.user_role_assignments
             where user_id = p_user_id and is_active and role in ('admin','super_admin'))
     and not private.has_role('super_admin') then
    raise exception 'Only the Super-Admin can suspend an Admin.' using errcode = '42501';
  end if;
  if exists (select 1 from public.user_role_assignments
             where user_id = p_user_id and is_active and role = 'super_admin') then
    raise exception 'A Super-Admin cannot be suspended.' using errcode = '22023';
  end if;
  if p_days is not null and (p_days < 1 or p_days > 3650) then
    raise exception 'Suspension length must be between 1 and 3650 days.' using errcode = '22023';
  end if;

  ends := case when p_days is null then null else pg_catalog.now() + pg_catalog.make_interval(days => p_days) end;

  update public.user_suspensions set revoked_at = pg_catalog.now(), revoked_by = uid, revocation_note = 'Replaced by a new suspension'
   where user_id = p_user_id and revoked_at is null and (ends_at is null or ends_at > pg_catalog.now());

  insert into public.user_suspensions (user_id, issued_by, reason, ends_at)
  values (p_user_id, uid, pg_catalog.left(pg_catalog.btrim(p_reason), 300), ends)
  returning id into new_id;

  update public.profiles set account_status = 'suspended' where id = p_user_id;

  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  values (p_user_id, 'account_suspended', 'Your account has been suspended',
          'Reason: ' || p_reason || case when ends is null then '. Until further notice.' else '. Until ' || pg_catalog.to_char(ends at time zone 'Asia/Kolkata', 'DD Mon YYYY') || '.' end,
          jsonb_build_object('suspension_id', new_id));

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, target_user_id, metadata)
  values (uid, 'USER_SUSPENDED', 'user_suspensions', new_id::text, p_user_id, jsonb_build_object('reason', p_reason, 'days', p_days));
  return jsonb_build_object('id', new_id, 'ends_at', ends);
end;
$$;

-- Admin: lift a suspension.
create or replace function public.lift_suspension(p_suspension_id uuid, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := (select auth.uid()); target uuid;
begin
  if not private.is_admin() then
    raise exception 'Only an Admin or Super-Admin can lift suspensions.' using errcode = '42501';
  end if;
  update public.user_suspensions
     set revoked_at = pg_catalog.now(), revoked_by = uid, revocation_note = nullif(pg_catalog.btrim(coalesce(p_note, '')), '')
   where id = p_suspension_id and revoked_at is null
  returning user_id into target;
  if target is null then raise exception 'Suspension not found or already lifted.' using errcode = '22023'; end if;

  if not exists (select 1 from public.user_suspensions where user_id = target and revoked_at is null
                 and (ends_at is null or ends_at > pg_catalog.now())) then
    update public.profiles set account_status = 'active' where id = target and account_status = 'suspended';
    insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
    values (target, 'account_reinstated', 'Your account is active again', 'Your suspension has been lifted.', jsonb_build_object('suspension_id', p_suspension_id));
  end if;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, target_user_id, metadata)
  values (uid, 'SUSPENSION_LIFTED', 'user_suspensions', p_suspension_id::text, target, jsonb_build_object('note', p_note));
  return jsonb_build_object('id', p_suspension_id, 'lifted', true);
end;
$$;

-- Admin: active suspensions.
create or replace function public.list_active_suspensions()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Only an Admin or Super-Admin can view suspensions.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(s order by s.starts_at desc)
    from (
      select us.id, us.user_id, coalesce(p.display_name, 'Unnamed member') as user_name,
             us.reason, us.starts_at, us.ends_at, coalesce(ip.display_name, 'Admin') as issued_by_name
      from public.user_suspensions us
      left join public.profiles p on p.id = us.user_id
      left join public.profiles ip on ip.id = us.issued_by
      where us.revoked_at is null and (us.ends_at is null or us.ends_at > pg_catalog.now())
    ) s
  ), '[]'::jsonb);
end;
$$;

-- Any user: lift my own suspension if it has expired; returns my current account status.
create or replace function public.refresh_my_account_status()
returns text
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := (select auth.uid()); st text;
begin
  if uid is null then return null; end if;
  select account_status into st from public.profiles where id = uid;
  if st = 'suspended' and not exists (
       select 1 from public.user_suspensions where user_id = uid and revoked_at is null
       and (ends_at is null or ends_at > pg_catalog.now())) then
    update public.profiles set account_status = 'active' where id = uid;
    st := 'active';
  end if;
  return st;
end;
$$;

revoke all on function public.search_members(text) from public, anon;
revoke all on function public.report_user(uuid, text, text) from public, anon;
revoke all on function public.list_user_reports(text) from public, anon;
revoke all on function public.resolve_user_report(uuid, boolean, text) from public, anon;
revoke all on function public.suspend_user(uuid, text, int) from public, anon;
revoke all on function public.lift_suspension(uuid, text) from public, anon;
revoke all on function public.list_active_suspensions() from public, anon;
revoke all on function public.refresh_my_account_status() from public, anon;
grant execute on function public.search_members(text) to authenticated;
grant execute on function public.report_user(uuid, text, text) to authenticated;
grant execute on function public.list_user_reports(text) to authenticated;
grant execute on function public.resolve_user_report(uuid, boolean, text) to authenticated;
grant execute on function public.suspend_user(uuid, text, int) to authenticated;
grant execute on function public.lift_suspension(uuid, text) to authenticated;
grant execute on function public.list_active_suspensions() to authenticated;
grant execute on function public.refresh_my_account_status() to authenticated;
