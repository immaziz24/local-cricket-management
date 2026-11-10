-- Phase 3 / Category A – #24 Save incomplete matches, #25 Resume a saved match,
-- #29 Live score updates for spectators (Realtime), #30 Scoring history and audit trail.
-- (#28 sharing is a link to the match page, handled in the website.)
-- Every ball is already saved as it is scored, so a match can be closed and resumed at any time.
-- "Pause" records why play stopped (rain, break, bad light) so spectators can see it.

alter table public.matches
  add column if not exists paused_reason text check (paused_reason is null or pg_catalog.length(paused_reason) <= 120),
  add column if not exists paused_at timestamptz;

create or replace function public.pause_match(p_match_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare m public.matches%rowtype; reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
begin
  m := private.require_scorer(p_match_id);
  if m.status <> 'live' then raise exception 'Only a live match can be paused.' using errcode = '22023'; end if;
  update public.matches set paused_reason = coalesce(reason, 'Play stopped'), paused_at = pg_catalog.now() where id = p_match_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'MATCH_PAUSED', 'matches', p_match_id::text, jsonb_build_object('reason', coalesce(reason, 'Play stopped')));
  return jsonb_build_object('paused', true);
end;
$$;

create or replace function public.resume_match(p_match_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare m public.matches%rowtype;
begin
  m := private.require_scorer(p_match_id);
  if m.paused_at is null then return jsonb_build_object('paused', false); end if;
  update public.matches set paused_reason = null, paused_at = null where id = p_match_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'MATCH_RESUMED', 'matches', p_match_id::text,
          jsonb_build_object('paused_minutes', ceil(extract(epoch from (pg_catalog.now() - m.paused_at)) / 60.0)::int));
  return jsonb_build_object('paused', false);
end;
$$;

-- Scoring a ball while paused simply resumes play.
create or replace function private.auto_resume_on_ball()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  update public.matches set paused_reason = null, paused_at = null where id = new.match_id and paused_at is not null;
  return new;
end;
$$;
revoke all on function private.auto_resume_on_ball() from public, anon, authenticated;
drop trigger if exists balls_auto_resume on public.balls;
create trigger balls_auto_resume after insert on public.balls for each row execute function private.auto_resume_on_ball();

-- #30 Scoring history: who did what, and when (public, for transparency).
create or replace function public.get_match_history(p_match_id uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'events', coalesce((
      select jsonb_agg(jsonb_build_object('at', a.created_at, 'action', a.action, 'by', coalesce(p.display_name, 'Someone'),
                                          'details', a.metadata - 'match_id') order by a.created_at desc)
        from public.audit_logs a left join public.profiles p on p.id = a.actor_user_id
       where (a.entity_type = 'matches' and a.entity_id = p_match_id::text)
          or (a.action in ('MATCH_LINEUP_SET','MATCH_PLAYER_REPLACED','MATCH_RESULT_RECORDED','MATCH_RESULT_CLEARED','MATCH_RESCHEDULED')
              and a.metadata ->> 'match_id' = p_match_id::text)), '[]'::jsonb),
    'scorers', coalesce((
      select jsonb_agg(jsonb_build_object('name', coalesce(p.display_name, 'Someone'), 'balls', x.n, 'first', x.first_at, 'last', x.last_at))
        from (select created_by, count(*) as n, min(created_at) as first_at, max(created_at) as last_at
                from public.balls where match_id = p_match_id group by created_by) x
        left join public.profiles p on p.id = x.created_by), '[]'::jsonb)
  );
$$;

revoke all on function public.pause_match(uuid, text) from public, anon;
revoke all on function public.resume_match(uuid) from public, anon;
revoke all on function public.get_match_history(uuid) from public;
grant execute on function public.pause_match(uuid, text) to authenticated;
grant execute on function public.resume_match(uuid) to authenticated;
grant execute on function public.get_match_history(uuid) to anon, authenticated;

-- #29 Realtime: spectators' pages update the moment a ball is scored.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'balls') then
      alter publication supabase_realtime add table public.balls;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'matches') then
      alter publication supabase_realtime add table public.matches;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'innings') then
      alter publication supabase_realtime add table public.innings;
    end if;
  end if;
end $$;
