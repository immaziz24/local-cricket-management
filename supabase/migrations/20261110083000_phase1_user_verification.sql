-- Phase 1 / #265 User verification
-- Optional "verified" badges. Any signed-in user can request one; Admins / Super-Admin review.
-- Badge types: identity (real person), umpire (certified umpire), scorer (certified scorer).

alter table public.user_verifications drop constraint if exists user_verifications_verification_type_check;
alter table public.user_verifications add constraint user_verifications_verification_type_check
  check (verification_type in ('email','phone','identity','profile','umpire','scorer'));

-- Only one open request per user and badge type.
create unique index if not exists user_verifications_one_pending_uidx
  on public.user_verifications (user_id, verification_type) where status = 'pending';

-- ------------------------------------------------------------------
-- Request a badge (any signed-in, non-suspended user)
-- ------------------------------------------------------------------
create or replace function public.request_verification(p_type text, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  new_id uuid;
  clean_note text := nullif(pg_catalog.btrim(coalesce(p_note, '')), '');
begin
  if uid is null then
    raise exception 'Please sign in first.' using errcode = '42501';
  end if;
  if p_type not in ('identity','umpire','scorer') then
    raise exception 'Unknown badge type: %', p_type using errcode = '22023';
  end if;
  if clean_note is not null and pg_catalog.length(clean_note) > 500 then
    raise exception 'Please keep the note under 500 characters.' using errcode = '22023';
  end if;
  if exists (select 1 from public.profiles where id = uid and account_status in ('suspended','disabled')) then
    raise exception 'Suspended accounts cannot request verification.' using errcode = '42501';
  end if;
  if exists (select 1 from public.user_verifications where user_id = uid and verification_type = p_type and status = 'pending') then
    raise exception 'You already have a request waiting for review for this badge.' using errcode = '22023';
  end if;
  if exists (select 1 from public.user_verifications where user_id = uid and verification_type = p_type and status = 'approved') then
    raise exception 'You already have this badge.' using errcode = '22023';
  end if;

  insert into public.user_verifications (user_id, verification_type, status, private_metadata)
  values (uid, p_type, 'pending', jsonb_build_object('note', clean_note))
  returning id into new_id;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, target_user_id, metadata)
  values (uid, 'VERIFICATION_REQUESTED', 'user_verifications', new_id::text, uid, jsonb_build_object('type', p_type));

  return jsonb_build_object('id', new_id, 'verification_type', p_type, 'status', 'pending');
end;
$$;

-- ------------------------------------------------------------------
-- Review queue (Admin or Super-Admin)
-- ------------------------------------------------------------------
create or replace function public.list_verification_requests(p_status text default null)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Only an Admin or Super-Admin can review verification requests.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(r order by (r.status = 'pending') desc, r.submitted_at desc)
    from (
      select uv.id,
             uv.user_id,
             coalesce(p.display_name, 'Unnamed member') as user_name,
             uv.verification_type,
             uv.status,
             uv.private_metadata ->> 'note' as note,
             uv.submitted_at,
             uv.reviewed_at,
             uv.review_note,
             coalesce(rp.display_name, null) as reviewer_name
      from public.user_verifications uv
      left join public.profiles p on p.id = uv.user_id
      left join public.profiles rp on rp.id = uv.reviewed_by
      where uv.verification_type in ('identity','umpire','scorer')
        and (p_status is null or uv.status = p_status)
      order by uv.submitted_at desc
      limit 200
    ) r
  ), '[]'::jsonb);
end;
$$;

-- ------------------------------------------------------------------
-- Approve / reject (Admin or Super-Admin). Notifies the user and writes the audit log.
-- ------------------------------------------------------------------
create or replace function public.review_verification(p_id uuid, p_approve boolean, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  rec record;
  new_status text := case when p_approve then 'approved' else 'rejected' end;
  clean_note text := nullif(pg_catalog.btrim(coalesce(p_note, '')), '');
  badge text;
begin
  if not private.is_admin() then
    raise exception 'Only an Admin or Super-Admin can review verification requests.' using errcode = '42501';
  end if;

  select * into rec from public.user_verifications where id = p_id for update;
  if not found then
    raise exception 'Request not found.' using errcode = '22023';
  end if;
  if rec.status <> 'pending' then
    raise exception 'This request has already been reviewed.' using errcode = '22023';
  end if;
  if not p_approve and clean_note is null then
    raise exception 'Please give a reason when rejecting a request.' using errcode = '22023';
  end if;

  update public.user_verifications
     set status = new_status,
         reviewed_at = pg_catalog.now(),
         reviewed_by = (select auth.uid()),
         review_note = clean_note
   where id = p_id;

  badge := case rec.verification_type
             when 'identity' then 'Verified person'
             when 'umpire' then 'Verified umpire'
             when 'scorer' then 'Verified scorer'
             else rec.verification_type end;

  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  values (
    rec.user_id,
    'verification_' || new_status,
    case when p_approve then 'You are now a ' || badge || '!' else 'Verification request not approved' end,
    case when p_approve then 'Your ' || badge || ' badge is now shown on your profile.'
         else 'Your request for the ' || badge || ' badge was not approved. Reason: ' || clean_note end,
    jsonb_build_object('verification_id', p_id, 'type', rec.verification_type, 'status', new_status)
  );

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, target_user_id, metadata)
  values ((select auth.uid()),
          case when p_approve then 'VERIFICATION_APPROVED' else 'VERIFICATION_REJECTED' end,
          'user_verifications', p_id::text, rec.user_id,
          jsonb_build_object('type', rec.verification_type, 'note', clean_note));

  return jsonb_build_object('id', p_id, 'status', new_status);
end;
$$;

revoke all on function public.request_verification(text, text) from public, anon;
revoke all on function public.list_verification_requests(text) from public, anon;
revoke all on function public.review_verification(uuid, boolean, text) from public, anon;
grant execute on function public.request_verification(text, text) to authenticated;
grant execute on function public.list_verification_requests(text) to authenticated;
grant execute on function public.review_verification(uuid, boolean, text) to authenticated;
