-- Phase 3 / Category A – #20 Live commentary, plus scorecard extras asked for by the owner:
-- minutes at the crease (M), current partnership, yet-to-bat list. Lineups are locked once a match starts
-- (use replacements instead).

create table if not exists public.innings_crease (
  innings_id uuid not null references public.innings(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  arrived_at timestamptz not null default now(),
  primary key (innings_id, player_id)
);
create index if not exists innings_crease_player_idx on public.innings_crease (player_id);
alter table public.innings_crease enable row level security;
drop policy if exists innings_crease_read on public.innings_crease;
create policy innings_crease_read on public.innings_crease for select to anon, authenticated using (true);
revoke all on public.innings_crease from anon, authenticated;
grant select on public.innings_crease to anon, authenticated;
grant all on public.innings_crease to service_role;

-- openers of innings already in progress: use their first ball as arrival time
insert into public.innings_crease (innings_id, player_id, arrived_at)
select innings_id, pid, min(created_at) from (
  select innings_id, striker_id as pid, created_at from public.balls union all select innings_id, non_striker_id, created_at from public.balls) x
where pid is not null group by innings_id, pid
on conflict do nothing;

create or replace function public.set_innings_players(p_match_id uuid, p_striker uuid default null, p_non_striker uuid default null, p_bowler uuid default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare m public.matches%rowtype; i public.innings%rowtype; s uuid; ns uuid; b uuid; balls_this_over int;
begin
  m := private.require_scorer(p_match_id);
  if m.status <> 'live' then raise exception 'The match is not live.' using errcode = '22023'; end if;
  select * into i from public.innings where match_id = p_match_id and status = 'in_progress' order by innings_no desc limit 1;
  if not found then
    if exists (select 1 from public.innings where match_id = p_match_id) then
      raise exception 'No innings is in progress.' using errcode = '22023';
    end if;
    -- first innings starts after the toss
    insert into public.innings (match_id, innings_no, batting_team_id, bowling_team_id)
    values (p_match_id, 1, m.batting_first_team_id,
            case when m.batting_first_team_id = m.team_a_id then m.team_b_id else m.team_a_id end)
    returning * into i;
  end if;
  s := coalesce(p_striker, i.striker_id); ns := coalesce(p_non_striker, i.non_striker_id); b := coalesce(p_bowler, i.bowler_id);

  if s is not null and s = ns then raise exception 'Striker and non-striker must be different players.' using errcode = '22023'; end if;
  if exists (select 1 from unnest(array[s, ns]) x where x is not null and (
        not exists (select 1 from public.match_players where match_id = p_match_id and team_id = i.batting_team_id and player_id = x and role = 'playing')
        or exists (select 1 from public.balls where innings_id = i.id and dismissed_id = x and is_wicket))) then
    raise exception 'Batters must be in the batting side''s Playing XI and not out.' using errcode = '22023';
  end if;
  if b is not null and not exists (select 1 from public.match_players where match_id = p_match_id and team_id = i.bowling_team_id and player_id = b and role = 'playing') then
    raise exception 'The bowler must be in the fielding side''s Playing XI.' using errcode = '22023';
  end if;
  select count(*) into balls_this_over from public.balls where innings_id = i.id and over_no = i.legal_balls / 6;
  if p_bowler is not null and p_bowler = i.last_over_bowler_id and balls_this_over = 0
     and private.playing_count(p_match_id, i.bowling_team_id) > 1 then
    raise exception 'The same bowler cannot bowl two overs in a row.' using errcode = '22023';
  end if;

  update public.innings set striker_id = s, non_striker_id = ns, bowler_id = b where id = i.id;
  -- minutes at the crease: remember when each batter walked in
  insert into public.innings_crease (innings_id, player_id)
  select i.id, x from unnest(array[s, ns]) x where x is not null
  on conflict (innings_id, player_id) do nothing;
  return public.get_live_state(p_match_id);
end;
$$;

create or replace function public.get_live_state(p_match_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare m public.matches%rowtype; cur public.innings%rowtype; overs_limit int;
begin
  select * into m from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found.' using errcode = '22023'; end if;
  select * into cur from public.innings where match_id = p_match_id order by innings_no desc limit 1;
  overs_limit := case when coalesce(m.match_type, 'limited_overs') = 'two_innings' then null else m.overs_per_innings end;

  return jsonb_build_object(
    'match_id', m.id, 'status', m.status, 'result_summary', m.result_summary, 'overs_limit', overs_limit,
    'can_score', private.can_score_match(p_match_id),
    'innings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'innings_no', i.innings_no, 'status', i.status, 'end_reason', i.end_reason,
        'batting_team', jsonb_build_object('id', bt.id, 'name', bt.name, 'short_name', bt.short_name),
        'bowling_team', jsonb_build_object('id', ft.id, 'name', ft.name, 'short_name', ft.short_name),
        'runs', i.runs, 'wickets', i.wickets, 'legal_balls', i.legal_balls, 'extras', i.extras, 'target', i.target,
        'extras_detail', (select jsonb_build_object(
             'wides', coalesce(sum(extra_runs) filter (where extra_type = 'wide'), 0),
             'no_balls', coalesce(sum(extra_runs) filter (where extra_type = 'no_ball'), 0),
             'byes', coalesce(sum(extra_runs) filter (where extra_type = 'bye'), 0),
             'leg_byes', coalesce(sum(extra_runs) filter (where extra_type = 'leg_bye'), 0))
           from public.balls where innings_id = i.id),
        'batting', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'player_id', bat.pid, 'name', pl.display_name,
                   'runs', coalesce((select sum(runs_bat) from public.balls where innings_id = i.id and striker_id = bat.pid), 0),
                   'balls', (select count(*) from public.balls where innings_id = i.id and striker_id = bat.pid and extra_type is distinct from 'wide'),
                   'fours', (select count(*) from public.balls where innings_id = i.id and striker_id = bat.pid and runs_bat = 4),
                   'sixes', (select count(*) from public.balls where innings_id = i.id and striker_id = bat.pid and runs_bat = 6),
                   'out', (select jsonb_build_object('type', d.wicket_type,
                                                     'bowler', (select display_name from public.players where id = d.bowler_id),
                                                     'fielder', (select display_name from public.players where id = d.fielder_id))
                             from public.balls d where d.innings_id = i.id and d.dismissed_id = bat.pid order by d.seq desc limit 1),
                   'at_crease', bat.pid in (coalesce(i.striker_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(i.non_striker_id, '00000000-0000-0000-0000-000000000000'::uuid)),
                   'on_strike', bat.pid = i.striker_id,
                   'minutes', greatest(0, ceil(extract(epoch from (
                       coalesce((select d.created_at from public.balls d where d.innings_id = i.id and d.dismissed_id = bat.pid order by d.seq desc limit 1),
                                case when i.status = 'completed' then coalesce(i.completed_at, (select max(created_at) from public.balls where innings_id = i.id)) else pg_catalog.now() end)
                       - coalesce((select c.arrived_at from public.innings_crease c where c.innings_id = i.id and c.player_id = bat.pid),
                                  (select min(created_at) from public.balls where innings_id = i.id and bat.pid in (striker_id, non_striker_id)),
                                  pg_catalog.now()))) / 60.0))::int)
                 order by bat.first_seq)
          from (select pid, min(first_seq) as first_seq from (
                  select striker_id as pid, seq as first_seq from public.balls where innings_id = i.id
                  union all select non_striker_id, seq from public.balls where innings_id = i.id
                  union all select i.striker_id, 100000 where i.striker_id is not null
                  union all select i.non_striker_id, 100001 where i.non_striker_id is not null) x
                where pid is not null group by pid) bat
          join public.players pl on pl.id = bat.pid), '[]'::jsonb),
        'bowling', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'player_id', bw.bowler_id, 'name', pl.display_name, 'legal_balls', bw.legal, 'runs', bw.runs, 'wickets', bw.wkts,
                   'wides', bw.wides, 'no_balls', bw.nbs, 'maidens', bw.maidens, 'current', bw.bowler_id = i.bowler_id)
                 order by bw.first_seq)
          from (select bowler_id, min(seq) as first_seq,
                       count(*) filter (where is_legal) as legal,
                       sum(runs_bat + case when extra_type in ('wide','no_ball') then extra_runs else 0 end) as runs,
                       count(*) filter (where is_wicket and wicket_type in ('bowled','caught','lbw','stumped','hit_wicket','caught_and_bowled')) as wkts,
                       count(*) filter (where extra_type = 'wide') as wides,
                       count(*) filter (where extra_type = 'no_ball') as nbs,
                       (select count(*) from (select over_no from public.balls b2 where b2.innings_id = i.id and b2.bowler_id = b1.bowler_id
                                               group by over_no
                                               having count(*) filter (where is_legal) = 6
                                                  and sum(runs_bat + case when extra_type in ('wide','no_ball') then extra_runs else 0 end) = 0) mo) as maidens
                  from public.balls b1 where innings_id = i.id and bowler_id is not null group by bowler_id) bw
          join public.players pl on pl.id = bw.bowler_id), '[]'::jsonb),
        'fall_of_wickets', coalesce((
          select jsonb_agg(jsonb_build_object('wicket', f.n, 'runs', f.score, 'over', f.over_txt, 'name', f.name) order by f.n)
          from (select row_number() over (order by d.seq) as n,
                       (select sum(runs_bat + extra_runs) from public.balls x where x.innings_id = i.id and x.seq <= d.seq) as score,
                       (d.over_no || '.' || d.ball_in_over) as over_txt,
                       (select display_name from public.players where id = d.dismissed_id) as name
                  from public.balls d where d.innings_id = i.id and d.is_wicket) f), '[]'::jsonb)
      ) order by i.innings_no)
      from public.innings i
      join public.teams bt on bt.id = i.batting_team_id
      join public.teams ft on ft.id = i.bowling_team_id
      where i.match_id = p_match_id), '[]'::jsonb),
    'current', case when cur.id is null then null else jsonb_build_object(
        'innings_id', cur.id, 'innings_no', cur.innings_no, 'status', cur.status,
        'batting_team_id', cur.batting_team_id, 'bowling_team_id', cur.bowling_team_id,
        'striker_id', cur.striker_id, 'non_striker_id', cur.non_striker_id, 'bowler_id', cur.bowler_id,
        'last_over_bowler_id', cur.last_over_bowler_id,
        'runs', cur.runs, 'wickets', cur.wickets, 'legal_balls', cur.legal_balls, 'target', cur.target,
        'runs_needed', case when cur.target is null then null else greatest(cur.target - cur.runs, 0) end,
        'balls_left', case when overs_limit is null then null else greatest(overs_limit * 6 - cur.legal_balls, 0) end,
        'this_over', coalesce((select jsonb_agg(jsonb_build_object('runs', runs_bat, 'extra', extra_type, 'extra_runs', extra_runs,
                                                                   'wicket', wicket_type, 'legal', is_legal) order by seq)
                               from public.balls where innings_id = cur.id and over_no = (case when cur.legal_balls % 6 = 0 and cur.bowler_id is null
                                                                                                then cur.legal_balls / 6 - 1 else cur.legal_balls / 6 end)), '[]'::jsonb),
        'recent', coalesce((select jsonb_agg(r.j order by r.seq desc) from (
                     select b.seq, jsonb_build_object('seq', b.seq, 'over', b.over_no || '.' || b.ball_in_over, 'runs', b.runs_bat,
                              'extra', b.extra_type, 'extra_runs', b.extra_runs, 'wicket', b.wicket_type,
                              'bowler', (select display_name from public.players where id = b.bowler_id),
                              'batter', (select display_name from public.players where id = b.striker_id),
                              'out_name', (select display_name from public.players where id = b.dismissed_id),
                              'commentary', b.commentary) as j
                     from public.balls b where b.innings_id = cur.id order by b.seq desc limit 18) r), '[]'::jsonb),
        'batting_side', coalesce((select jsonb_agg(jsonb_build_object('player_id', mp.player_id, 'name', p.display_name,
                                   'out', exists (select 1 from public.balls where innings_id = cur.id and dismissed_id = mp.player_id and is_wicket),
                                   'retired_hurt', exists (select 1 from public.balls where innings_id = cur.id and dismissed_id = mp.player_id and wicket_type = 'retired_hurt'))
                                   order by mp.batting_order nulls last)
                                  from public.match_players mp join public.players p on p.id = mp.player_id
                                 where mp.match_id = p_match_id and mp.team_id = cur.batting_team_id and mp.role = 'playing'), '[]'::jsonb),
        'partnership', (select jsonb_build_object('runs', coalesce(sum(runs_bat + extra_runs), 0), 'balls', count(*) filter (where is_legal))
                          from public.balls where innings_id = cur.id
                           and seq > coalesce((select max(seq) from public.balls where innings_id = cur.id and dismissed_id is not null), 0)),
        'yet_to_bat', coalesce((select jsonb_agg(p.display_name order by mp.batting_order nulls last)
                                  from public.match_players mp join public.players p on p.id = mp.player_id
                                 where mp.match_id = p_match_id and mp.team_id = cur.batting_team_id and mp.role = 'playing'
                                   and mp.player_id is distinct from cur.striker_id and mp.player_id is distinct from cur.non_striker_id
                                   and not exists (select 1 from public.balls where innings_id = cur.id and mp.player_id in (striker_id, non_striker_id))), '[]'::jsonb),
        'bowling_side', coalesce((select jsonb_agg(jsonb_build_object('player_id', mp.player_id, 'name', p.display_name,
                                   'is_wicket_keeper', mp.is_wicket_keeper) order by p.display_name)
                                  from public.match_players mp join public.players p on p.id = mp.player_id
                                 where mp.match_id = p_match_id and mp.team_id = cur.bowling_team_id and mp.role = 'playing'), '[]'::jsonb)
      ) end
  );
end;
$$;

-- #20 Ball-by-ball commentary for the whole match (public), with the running score after every ball.
create or replace function public.get_commentary(p_match_id uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'innings_no', i.innings_no, 'batting_team', bt.name, 'bowling_team', ft.name,
           'runs', i.runs, 'wickets', i.wickets, 'legal_balls', i.legal_balls,
           'balls', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'seq', x.seq, 'over_no', x.over_no, 'ball_in_over', x.ball_in_over, 'legal', x.is_legal,
                      'runs', x.runs_bat, 'extra', x.extra_type, 'extra_runs', x.extra_runs,
                      'wicket', x.wicket_type, 'is_wicket', x.is_wicket,
                      'bowler', x.bowler, 'batter', x.batter, 'non_striker', x.non_striker,
                      'out_name', x.out_name, 'fielder', x.fielder, 'commentary', x.commentary,
                      'score', x.score, 'wkts', x.wkts, 'at', x.created_at) order by x.seq)
               from (select b.*, bw.display_name as bowler, st.display_name as batter, ns.display_name as non_striker,
                            dp.display_name as out_name, fp.display_name as fielder,
                            sum(b.runs_bat + b.extra_runs) over w as score,
                            count(*) filter (where b.is_wicket) over w as wkts
                       from public.balls b
                       left join public.players bw on bw.id = b.bowler_id
                       left join public.players st on st.id = b.striker_id
                       left join public.players ns on ns.id = b.non_striker_id
                       left join public.players dp on dp.id = b.dismissed_id
                       left join public.players fp on fp.id = b.fielder_id
                      where b.innings_id = i.id
                     window w as (order by b.seq rows between unbounded preceding and current row)) x), '[]'::jsonb)
         ) order by i.innings_no), '[]'::jsonb)
    from public.innings i
    join public.teams bt on bt.id = i.batting_team_id
    join public.teams ft on ft.id = i.bowling_team_id
   where i.match_id = p_match_id;
$$;


-- Lineups cannot be re-picked after the toss; replacements (#74) handle changes during a match.
create or replace function public.set_match_lineup(p_match_id uuid, p_team_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  m public.matches%rowtype; per_side int := 11; max_subs int := 4; playing uuid[]; subs uuid[]; cap uuid; wk uuid; other uuid; i int;
begin
  m := private.require_lineup_editor(p_match_id, p_team_id);
  if m.status <> 'scheduled' then raise exception 'The lineup is fixed once the match has started. Use Replace a player instead.' using errcode = '22023'; end if;
  if exists (select 1 from public.match_players where match_id = p_match_id and team_id = p_team_id and role = 'replaced') then
    raise exception 'A replacement has already been made. Use replacements instead of picking the lineup again.' using errcode = '22023';
  end if;
  if m.tournament_id is not null then
    select players_per_side, max_substitutes into per_side, max_subs from public.tournaments where id = m.tournament_id;
  end if;
  per_side := coalesce(m.players_per_side, per_side, 11);
  select coalesce(array_agg(x::uuid), '{}') into playing from jsonb_array_elements_text(coalesce(p->'playing', '[]'::jsonb)) x;
  select coalesce(array_agg(x::uuid), '{}') into subs from jsonb_array_elements_text(coalesce(p->'substitutes', '[]'::jsonb)) x;
  cap := nullif(p->>'captain', '')::uuid; wk := nullif(p->>'wicket_keeper', '')::uuid;

  if pg_catalog.cardinality(playing) < 2 then raise exception 'Pick at least 2 playing players.' using errcode = '22023'; end if;
  if pg_catalog.cardinality(playing) > per_side then raise exception 'Pick at most % playing players.', per_side using errcode = '22023'; end if;
  if pg_catalog.cardinality(subs) > max_subs then raise exception 'At most % substitutes are allowed.', max_subs using errcode = '22023'; end if;
  if (select count(distinct x) from unnest(playing || subs) x) <> pg_catalog.cardinality(playing || subs) then
    raise exception 'A player can only be picked once.' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(playing || subs) x where not exists (select 1 from public.team_members where team_id = p_team_id and player_id = x)) then
    raise exception 'Only players from the team squad can be picked.' using errcode = '22023';
  end if;
  other := case when m.team_a_id = p_team_id then m.team_b_id else m.team_a_id end;
  if exists (select 1 from public.match_players where match_id = p_match_id and team_id = other and player_id = any (playing || subs)) then
    raise exception 'One of these players is already picked by the other team for this match.' using errcode = '22023';
  end if;
  if cap is not null and not cap = any (playing) then raise exception 'The captain must be in the playing side.' using errcode = '22023'; end if;
  if wk is not null and not wk = any (playing) then raise exception 'The wicket-keeper must be in the playing side.' using errcode = '22023'; end if;

  delete from public.match_players where match_id = p_match_id and team_id = p_team_id;
  for i in 1 .. pg_catalog.cardinality(playing) loop
    insert into public.match_players (match_id, team_id, player_id, role, batting_order, is_captain, is_wicket_keeper, selected_by)
    values (p_match_id, p_team_id, playing[i], 'playing', i, playing[i] = coalesce(cap, '00000000-0000-0000-0000-000000000000'::uuid),
            playing[i] = coalesce(wk, '00000000-0000-0000-0000-000000000000'::uuid), (select auth.uid()));
  end loop;
  insert into public.match_players (match_id, team_id, player_id, role, selected_by)
  select p_match_id, p_team_id, x, 'substitute', (select auth.uid()) from unnest(subs) x;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'MATCH_LINEUP_SET', 'teams', p_team_id::text,
          jsonb_build_object('match_id', p_match_id, 'playing', pg_catalog.cardinality(playing), 'substitutes', pg_catalog.cardinality(subs)));
  return jsonb_build_object('playing', pg_catalog.cardinality(playing), 'substitutes', pg_catalog.cardinality(subs));
end;
$$;

revoke all on function public.get_commentary(uuid) from public;
grant execute on function public.get_commentary(uuid) to anon, authenticated;
