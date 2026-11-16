-- Keep the existing RPC signature for mobile-only clients.
create or replace function public.manage_tournament_admins(
  p_tournament_id uuid, p_action text, p_mobile text default null, p_user_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  target public.profiles;
  identifier text := pg_catalog.btrim(p_mobile);
begin
  if not exists (
    select 1 from public.tournaments t join public.profiles p on p.id = t.owner_id
    where t.id = p_tournament_id and t.owner_id = actor
      and p.account_status not in ('suspended', 'disabled')
  ) then
    raise exception 'Only the tournament creator can manage admins.' using errcode = '42501';
  end if;

  if p_action in ('lookup', 'grant') then
    begin
      select p.* into strict target
      from public.profiles p
      where p.id <> actor and p.account_status not in ('suspended', 'disabled')
        and case when pg_catalog.strpos(identifier, '@') > 0 then exists (
          select 1 from auth.users u
          where u.id = p.id and u.email_confirmed_at is not null
            and pg_catalog.lower(u.email) = pg_catalog.lower(identifier)
        ) else p.mobile_number = private.clean_mobile(identifier) end;
    exception when no_data_found or too_many_rows then
      raise exception 'No unique eligible account found. Check the mobile number or verified email.' using errcode = '22023';
    end;
    if p_action = 'lookup' then
      return jsonb_build_object('id', target.id, 'name', target.display_name);
    end if;
    if target.id is distinct from p_user_id then
      raise exception 'Look up the account again before assigning access.' using errcode = '22023';
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

