-- Batch 17: list_tournament_stages also returns which matches sit in each stage.
create or replace function public.list_tournament_stages(p_tournament_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  if (select auth.uid()) is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'name', s.name, 'sort_order', s.sort_order, 'status', s.status, 'freeze_reason', s.freeze_reason, 'frozen_at', s.frozen_at,
      'match_count', (select count(*) from public.matches m where m.stage_id = s.id),
      'open_count', (select count(*) from public.matches m where m.stage_id = s.id and m.status in ('scheduled', 'live')),
      'live_count', (select count(*) from public.matches m where m.stage_id = s.id and m.status = 'live'),
      'match_ids', (select coalesce(jsonb_agg(m.id order by m.scheduled_at), '[]'::jsonb) from public.matches m where m.stage_id = s.id),
      'done', coalesce(private.stage_done(s.id), false),
      'blocked_by', to_jsonb(private.stage_blockers(s.id)),
      'depends_on', (select coalesce(jsonb_agg(d.requires_stage_id), '[]'::jsonb) from public.tournament_stage_deps d where d.stage_id = s.id)
    ) order by s.sort_order, s.created_at), '[]'::jsonb) into r
    from public.tournament_stages s where s.tournament_id = p_tournament_id;
  return jsonb_build_object('can_manage', private.is_tournament_organiser(p_tournament_id), 'stages', r);
end $$;
revoke all on function public.list_tournament_stages(uuid) from public, anon;
grant execute on function public.list_tournament_stages(uuid) to authenticated;
