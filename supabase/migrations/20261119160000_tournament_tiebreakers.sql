-- Batch 5: #327 configurable tiebreakers. Order of rules applied after points: wins, nrr, head_to_head, fewer_losses, name.
alter table public.tournaments add column if not exists tiebreak_order text[];

create or replace function public.set_tournament_tiebreakers(p_tournament_id uuid, p_order text[])
returns text[] language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); r text; seen text[] := '{}';
begin
  if uid is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  if not (private.is_admin() or private.is_tournament_admin(p_tournament_id)
          or exists (select 1 from public.tournaments t where t.id = p_tournament_id and t.owner_id = uid)) then
    raise exception 'Only the tournament organiser can change the tiebreakers.' using errcode = '42501';
  end if;
  if p_order is not null then
    if array_length(p_order, 1) > 5 then raise exception 'Too many rules.' using errcode = '22023'; end if;
    foreach r in array p_order loop
      if r not in ('wins','nrr','head_to_head','fewer_losses','name') then raise exception 'Unknown rule: %', r using errcode = '22023'; end if;
      if r = any (seen) then raise exception 'A rule can only be used once.' using errcode = '22023'; end if;
      seen := seen || r;
    end loop;
  end if;
  update public.tournaments set tiebreak_order = nullif(p_order, '{}') where id = p_tournament_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, 'TIEBREAKERS_SET', 'tournaments', p_tournament_id::text, jsonb_build_object('tournament_id', p_tournament_id, 'order', p_order));
  return p_order;
end;
$$;
revoke execute on function public.set_tournament_tiebreakers(uuid, text[]) from public, anon;
grant execute on function public.set_tournament_tiebreakers(uuid, text[]) to authenticated;
