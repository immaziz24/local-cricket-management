alter table public.teams add column archived_at timestamptz;

create or replace function public.delete_owned_team(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.require_active_user();
begin
  perform 1 from public.teams where id = p_id and owner_id = actor for update;
  if not found then raise exception 'Only the owner can remove this team.' using errcode = '42501'; end if;
  update public.teams set archived_at = now() where id = p_id and archived_at is null;
  if found then
    perform private.admin_log('OWNER_TEAM_ARCHIVED', 'teams', p_id::text, '{}'::jsonb);
  end if;
end;
$$;
