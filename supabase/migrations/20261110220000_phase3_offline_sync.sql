-- Phase 3 / Category A – #26 Offline scoring support, #27 Automatic synchronisation after internet returns.
-- The website keeps balls scored without internet on the device and sends them in order when the connection
-- returns. Each ball carries a client id made on the device, so a ball that is sent twice (for example the
-- connection dropped after the server saved it) is only recorded once.

alter table public.balls add column if not exists client_id uuid;
create unique index if not exists balls_client_id_uidx on public.balls (client_id) where client_id is not null;

create or replace function public.record_ball(p_match_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  m public.matches%rowtype; i public.innings%rowtype;
  runs_bat int := coalesce(nullif(p->>'runs', '')::int, 0);
  ext text := nullif(p->>'extra', '');
  ext_add int := coalesce(nullif(p->>'extras', '')::int, 0);
  wk text := nullif(p->>'wicket', '');
  out_end text := coalesce(nullif(p->>'out', ''), 'striker');
  fielder uuid := nullif(p->>'fielder_id', '')::uuid;
  cid uuid := nullif(p->>'client_id', '')::uuid;
  extra_runs int; legal boolean; is_wkt boolean; ran int; dismissed uuid; s uuid; ns uuid; b uuid; last_b uuid; tmp uuid;
  seq_no int; over_idx int; in_over int; overs_limit int; all_out_at int; ended text;
begin
  m := private.require_scorer(p_match_id);
  -- #27 offline sync: a ball that already reached the server (same client id) is not recorded twice
  if cid is not null and exists (select 1 from public.balls where client_id = cid) then
    return public.get_live_state(p_match_id);
  end if;
  if m.status <> 'live' then raise exception 'The match is not live.' using errcode = '22023'; end if;
  select * into i from public.innings where match_id = p_match_id and status = 'in_progress' order by innings_no desc limit 1 for update;
  if not found then raise exception 'Pick the opening batters and bowler first.' using errcode = '22023'; end if;
  if i.striker_id is null or i.non_striker_id is null then raise exception 'Pick the batters first.' using errcode = '22023'; end if;
  if i.bowler_id is null then raise exception 'Pick the bowler first.' using errcode = '22023'; end if;
  if runs_bat < 0 or runs_bat > 7 or ext_add < 0 or ext_add > 7 then raise exception 'Runs must be between 0 and 7.' using errcode = '22023'; end if;
  if ext is not null and ext not in ('wide','no_ball','bye','leg_bye') then raise exception 'Unknown extra.' using errcode = '22023'; end if;
  if ext in ('wide','bye','leg_bye') and runs_bat > 0 then raise exception 'No runs off the bat on a wide, bye or leg-bye.' using errcode = '22023'; end if;
  if ext in ('bye','leg_bye') and ext_add < 1 then raise exception 'Enter how many byes / leg-byes were run.' using errcode = '22023'; end if;
  if wk is not null and wk not in ('bowled','caught','lbw','run_out','stumped','hit_wicket','caught_and_bowled','obstructing','timed_out','retired_hurt','retired_out') then
    raise exception 'Unknown dismissal.' using errcode = '22023';
  end if;
  if ext = 'no_ball' and wk in ('bowled','caught','lbw','stumped','hit_wicket','caught_and_bowled') then
    raise exception 'A batter cannot be out that way on a no-ball.' using errcode = '22023';
  end if;
  if ext = 'wide' and wk in ('bowled','caught','lbw','caught_and_bowled') then
    raise exception 'A batter cannot be out that way on a wide.' using errcode = '22023';
  end if;
  if out_end not in ('striker','non_striker') then raise exception 'Choose which batter is out.' using errcode = '22023'; end if;
  if out_end = 'non_striker' and wk not in ('run_out','obstructing','retired_hurt','retired_out','timed_out') then
    raise exception 'Only a run out (or retirement) can dismiss the non-striker.' using errcode = '22023';
  end if;
  if fielder is not null and not exists (select 1 from public.match_players where match_id = p_match_id and team_id = i.bowling_team_id and player_id = fielder) then
    raise exception 'The fielder must be from the fielding side.' using errcode = '22023';
  end if;

  extra_runs := case ext when 'wide' then 1 + ext_add when 'no_ball' then 1 + ext_add when 'bye' then ext_add when 'leg_bye' then ext_add else 0 end;
  legal := ext is null or ext in ('bye','leg_bye');
  is_wkt := wk is not null and wk <> 'retired_hurt';
  ran := case ext when 'wide' then ext_add when 'no_ball' then runs_bat + ext_add when 'bye' then ext_add when 'leg_bye' then ext_add else runs_bat end;
  if runs_bat in (4, 6) and ext is null then ran := 0; end if;  -- boundary: batters stay
  if runs_bat in (4, 6) and ext = 'no_ball' then ran := ext_add; end if;

  s := i.striker_id; ns := i.non_striker_id; b := i.bowler_id; last_b := i.last_over_bowler_id;
  dismissed := case when wk is null then null when out_end = 'non_striker' then ns else s end;
  select coalesce(max(seq), 0) + 1 into seq_no from public.balls where innings_id = i.id;
  over_idx := i.legal_balls / 6;
  in_over := (i.legal_balls % 6) + case when legal then 1 else 0 end;

  insert into public.balls (match_id, innings_id, seq, over_no, ball_in_over, bowler_id, striker_id, non_striker_id, prev_last_over_bowler_id,
                            runs_bat, extra_type, extra_runs, is_legal, is_wicket, wicket_type, dismissed_id, fielder_id, commentary, created_by, client_id)
  values (p_match_id, i.id, seq_no, over_idx, in_over, b, s, ns, last_b,
          runs_bat, ext, extra_runs, legal, is_wkt, wk, dismissed, fielder,
          nullif(pg_catalog.btrim(coalesce(p->>'commentary', '')), ''), (select auth.uid()), cid);

  -- #12 strike rotation on odd runs
  if ran % 2 = 1 then tmp := s; s := ns; ns := tmp; end if;
  -- #10 #11 dismissed batter leaves the crease (slot stays empty until the next batter is picked)
  if dismissed is not null then
    if s = dismissed then s := null; elsif ns = dismissed then ns := null; end if;
  end if;
  -- #13 end of over: batters change ends, a new bowler is needed
  if legal and (i.legal_balls + 1) % 6 = 0 then
    tmp := s; s := ns; ns := tmp; last_b := b; b := null;
  end if;

  update public.innings set
    runs = runs + runs_bat + extra_runs, extras = extras + extra_runs,
    wickets = wickets + case when is_wkt then 1 else 0 end,
    legal_balls = legal_balls + case when legal then 1 else 0 end,
    striker_id = s, non_striker_id = ns, bowler_id = b, last_over_bowler_id = last_b
  where id = i.id
  returning * into i;

  -- #15 #16 has the innings ended?
  overs_limit := case when coalesce(m.match_type, 'limited_overs') = 'two_innings' then null else m.overs_per_innings end;
  all_out_at := greatest(private.playing_count(p_match_id, i.batting_team_id) - 1, 1);
  ended := case
    when i.target is not null and i.runs >= i.target then 'target'
    when i.wickets >= all_out_at then 'all_out'
    when overs_limit is not null and i.legal_balls >= overs_limit * 6 then 'overs'
    else null end;
  if ended is not null then
    perform private.close_innings(i.id, ended);
  else
    perform private.sync_match_score(p_match_id);
  end if;
  return public.get_live_state(p_match_id);
end;
$$;
