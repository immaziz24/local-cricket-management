-- #18 Score correction: the match scorer can correct any ball of the current innings while the match is live
-- (runs off the bat, bye / leg bye, wide / no-ball runs, direction and commentary). Totals, over numbers,
-- scorecard and figures are rebuilt from the balls. Wickets, and turning a legal ball into a wide / no-ball
-- (or back) in an earlier ball, still go through Undo so the over and the batters stay correct.

create or replace function public.edit_ball(p_match_id uuid, p_seq int, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare m public.matches%rowtype; i public.innings%rowtype; b public.balls%rowtype; rules jsonb;
        v_ext text; v_add int; v_runs int; v_legal boolean; v_extra_runs int; last_seq int;
begin
  m := private.require_scorer(p_match_id);
  if m.status <> 'live' then raise exception 'Balls can be corrected while the match is live. After the match, ask an admin.' using errcode = '22023'; end if;
  select * into i from public.innings where match_id = p_match_id order by innings_no desc limit 1;
  select * into b from public.balls where innings_id = i.id and seq = p_seq for update;
  if not found then raise exception 'That ball was not found in this innings.' using errcode = '22023'; end if;
  rules := coalesce(m.rules, '{}'::jsonb);
  v_ext := case when p ? 'extra' then nullif(p->>'extra', '') else b.extra_type end;
  if v_ext is not null and v_ext not in ('wide', 'no_ball', 'bye', 'leg_bye') then raise exception 'Unknown extra.' using errcode = '22023'; end if;
  v_add := greatest(0, least(7, coalesce(nullif(p->>'extras', '')::int, 0)));
  v_runs := greatest(0, least(7, coalesce(nullif(p->>'runs', '')::int, 0)));
  if v_ext in ('wide', 'bye', 'leg_bye') then v_runs := 0; end if;
  if v_ext in ('bye', 'leg_bye') and v_add < 1 then raise exception 'Byes and leg byes need at least 1 run.' using errcode = '22023'; end if;
  v_legal := v_ext is null or v_ext in ('bye', 'leg_bye');
  v_extra_runs := case v_ext when 'wide' then coalesce((rules->>'wide_runs')::int, 1) + v_add
                             when 'no_ball' then coalesce((rules->>'no_ball_runs')::int, 1) + v_add
                             when 'bye' then v_add when 'leg_bye' then v_add else 0 end;
  select max(seq) into last_seq from public.balls where innings_id = i.id;
  if v_legal <> b.is_legal and b.seq <> last_seq then
    raise exception 'To turn a legal ball into a wide or no-ball (or back), use Undo – it changes the over.' using errcode = '22023'; end if;
  if b.wicket_type is not null and v_ext is distinct from b.extra_type and v_legal <> b.is_legal then
    raise exception 'To change a wicket ball, use Undo.' using errcode = '22023'; end if;

  update public.balls set runs_bat = v_runs, extra_type = v_ext, extra_runs = v_extra_runs, is_legal = v_legal,
    shot_angle = case when p ? 'shot_angle' then case when (p->>'shot_angle') ~ '^\d{1,3}$' and (p->>'shot_angle')::int between 0 and 359 then (p->>'shot_angle')::smallint end else shot_angle end,
    shot_dist = case when p ? 'shot_dist' then case when (p->>'shot_dist') ~ '^\d{1,3}$' and (p->>'shot_dist')::int between 1 and 100 then (p->>'shot_dist')::smallint end else shot_dist end,
    commentary = case when p ? 'commentary' then nullif(pg_catalog.left(pg_catalog.btrim(p->>'commentary'), 600), '') else commentary end
  where id = b.id;
  perform private.admin_recompute_innings(i.id);
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'BALL_EDITED', 'matches', p_match_id::text,
          jsonb_build_object('innings', i.innings_no, 'seq', b.seq, 'over', b.over_no || '.' || b.ball_in_over,
                             'before', jsonb_build_object('runs', b.runs_bat, 'extra', b.extra_type, 'extra_runs', b.extra_runs),
                             'after', jsonb_build_object('runs', v_runs, 'extra', v_ext, 'extra_runs', v_extra_runs)));
  return public.get_live_state(p_match_id);
end $$;
revoke all on function public.edit_ball(uuid, int, jsonb) from public, anon;
grant execute on function public.edit_ball(uuid, int, jsonb) to authenticated;

-- Recent balls carry the wagon-wheel direction so a correction can keep it.
do $$
declare d text; n text;
begin
  d := pg_get_functiondef('public.get_live_state(uuid)'::regprocedure);
  n := replace(d, E'''out_name'', (select display_name from public.players where id = b.dismissed_id),\n                              ''commentary'', b.commentary) as j',
                  E'''out_name'', (select display_name from public.players where id = b.dismissed_id),\n                              ''commentary'', b.commentary, ''shot_angle'', b.shot_angle, ''shot_dist'', b.shot_dist) as j');
  if n = d then raise exception 'get_live_state: recent balls not found'; end if;
  execute n;
end $$;
