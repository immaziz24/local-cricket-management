-- Phase 1 / #258 Admin dashboard
-- Admin operations overview for users with the global 'admin' or 'super_admin' role.
-- Tournament approvals, team sanctions and match disputes are added when those
-- tables exist (Phase 2 / Phase 4).

create or replace function public.get_admin_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not (private.has_role('admin') or private.has_role('super_admin')) then
    raise exception 'Only an Admin or Super-Admin can view this dashboard.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'total_users',           (select count(*) from public.profiles),
    'new_users_7d',          (select count(*) from public.profiles where created_at > pg_catalog.now() - interval '7 days'),
    'suspended_users',       (select count(*) from public.profiles where account_status = 'suspended'),
    'pending_verifications', (select count(*) from public.user_verifications where status = 'pending'),
    'open_reports',          (select count(*) from public.user_reports where status in ('submitted','under_review')),

    'recent_users', coalesce((
      select jsonb_agg(u order by u.created_at desc)
      from (
        select p.id,
               coalesce(p.display_name, 'Unnamed member') as display_name,
               p.created_at,
               p.account_status,
               coalesce((
                 select jsonb_agg(distinct ura.role)
                 from public.user_role_assignments ura
                 where ura.user_id = p.id and ura.is_active
               ), '[]'::jsonb) as roles
        from public.profiles p
        order by p.created_at desc
        limit 10
      ) u
    ), '[]'::jsonb),

    'pending_verification_items', coalesce((
      select jsonb_agg(v order by v.submitted_at)
      from (
        select uv.id,
               coalesce(p.display_name, 'Unnamed member') as user_name,
               uv.verification_type,
               uv.submitted_at
        from public.user_verifications uv
        left join public.profiles p on p.id = uv.user_id
        where uv.status = 'pending'
        order by uv.submitted_at
        limit 10
      ) v
    ), '[]'::jsonb),

    'open_report_items', coalesce((
      select jsonb_agg(r order by r.created_at desc)
      from (
        select ur.id,
               coalesce(rp.display_name, 'Unnamed member') as reported_user_name,
               coalesce(rr.display_name, 'Unnamed member') as reporter_name,
               ur.reason,
               ur.status,
               ur.created_at
        from public.user_reports ur
        left join public.profiles rp on rp.id = ur.reported_user_id
        left join public.profiles rr on rr.id = ur.reporter_user_id
        where ur.status in ('submitted','under_review')
        order by ur.created_at desc
        limit 10
      ) r
    ), '[]'::jsonb)
  )
  into result;

  return result;
end;
$$;

revoke all on function public.get_admin_dashboard() from public, anon;
grant execute on function public.get_admin_dashboard() to authenticated;
