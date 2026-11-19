-- Batch 14 fix: keep takedown_at when the organiser removes an item (guard trigger used to overwrite it).
create or replace function private.media_status_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'visible' and old.status = 'pending_rights' and not exists (select 1 from public.media_rights r where r.media_id = new.id and r.people <> 'unsure') then
    new.status := 'pending_rights';
  end if;
  if new.status = 'visible' and old.takedown_at is not null and not (private.can_moderate_media(new.scope, new.scope_id) or private.is_admin()) then
    new.status := 'hidden';
  end if;
  if coalesce(current_setting('lcm.takedown_decision', true), '') <> '1' then new.takedown_at := old.takedown_at; end if;
  return new;
end;
$$;

create or replace function public.decide_media_takedown(p_id uuid, p_remove boolean, p_note text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_active_user(); d public.media_takedowns; mi public.media_items; nt text := btrim(coalesce(p_note, ''));
begin
  select * into d from public.media_takedowns where id = p_id for update;
  if not found then raise exception 'Request not found.' using errcode = '22023'; end if;
  select * into mi from public.media_items where id = d.media_id for update;
  if not (private.can_moderate_media(mi.scope, mi.scope_id) or private.is_admin()) then raise exception 'Only the organiser can decide.' using errcode = '42501'; end if;
  if d.status <> 'open' then raise exception 'This request was already decided.' using errcode = '22023'; end if;
  if char_length(nt) < 5 or char_length(nt) > 1000 then raise exception 'Write the reason for your decision (5 to 1000 characters).' using errcode = '22023'; end if;
  update public.media_takedowns set status = case when p_remove then 'removed' else 'kept' end, decided_by = uid, decided_at = now(), decision_note = nt where id = d.id;
  if p_remove then
    perform set_config('lcm.takedown_decision', '1', true);
    update public.media_items set status = 'hidden', takedown_at = now(), updated_at = now() where id = mi.id;
    perform set_config('lcm.takedown_decision', '0', true);
  end if;
  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  select distinct u, 'media_takedown', case when p_remove then 'Photo or video removed' else 'Removal request declined' end, nt, jsonb_build_object('media_id', mi.id)
    from (select d.requester_id as u union select mi.uploader_id) x where u is not null and u <> uid;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, case when p_remove then 'MEDIA_TAKEDOWN_REMOVED' else 'MEDIA_TAKEDOWN_KEPT' end, 'media_items', mi.id::text, jsonb_build_object('note', nt));
  return public.list_media_takedowns(mi.scope, mi.scope_id, 'open');
end;
$$;
revoke execute on function public.decide_media_takedown(uuid,boolean,text) from public, anon;
grant execute on function public.decide_media_takedown(uuid,boolean,text) to authenticated;
