-- Phase 2 / Category B – results and standings
-- Manual result entry (until Phase 3 scoring), #53 Points table, #54 Net Run Rate,
-- #55 Qualification management, #56 Knockout brackets (stage/round data), #58 Completion and winner.

alter table public.tournaments
  add column if not exists overs_per_innings int check (overs_per_innings is null or overs_per_innings between 1 and 100),
  add column if not exists points_win int not null default 2 check (points_win between 0 and 10),
  add column if not exists points_tie int not null default 1 check (points_tie between 0 and 10),
  add column if not exists points_no_result int not null default 1 check (points_no_result between 0 and 10),
  add column if not exists qualify_per_group int not null default 2 check (qualify_per_group between 1 and 16),
  add column if not exists winner_team_id uuid references public.teams(id) on delete set null,
  add column if not exists runner_up_team_id uuid references public.teams(id) on delete set null,
  add column if not exists completed_at timestamptz;
create index if not exists tournaments_winner_idx on public.tournaments (winner_team_id);
create index if not exists tournaments_runner_up_idx on public.tournaments (runner_up_team_id);

-- Fill overs from the format text (T10 -> 10, T20 -> 20, ODI -> 50) where possible.
update public.tournaments
   set overs_per_innings = case when format ~* 'odi' then 50
                                when substring(format from '([0-9]{1,3})') is not null
                                     then least(100, greatest(1, substring(format from '([0-9]{1,3})')::int))
                           end
 where overs_per_innings is null;

alter table public.matches add column if not exists batting_first_team_id uuid references public.teams(id) on delete set null;
create index if not exists matches_batting_first_idx on public.matches (batting_first_team_id);

-- Points, overs and qualification rules (#53, #55)
create or replace function public.set_tournament_rules(p_tournament_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_tournament_organiser(p_tournament_id);
  update public.tournaments set
    overs_per_innings = case when p ? 'overs_per_innings' then nullif(p->>'overs_per_innings', '')::int else overs_per_innings end,
    points_win        = coalesce(nullif(p->>'points_win', '')::int, points_win),
    points_tie        = coalesce(nullif(p->>'points_tie', '')::int, points_tie),
    points_no_result  = coalesce(nullif(p->>'points_no_result', '')::int, points_no_result),
    qualify_per_group = coalesce(nullif(p->>'qualify_per_group', '')::int, qualify_per_group)
  where id = p_tournament_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'TOURNAMENT_RULES_UPDATED', 'tournaments', p_tournament_id::text, p);
  return jsonb_build_object('id', p_tournament_id);
end;
$$;

-- Manual result entry. p: {result_type, winner_team_id, batting_first_team_id,
--   team_a_runs, team_a_wickets, team_a_balls, team_b_runs, team_b_wickets, team_b_balls, notes}
create or replace function public.record_match_result(p_match_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  m record; t record; rtype text; w uuid; bf uuid; summary text;
  ar int; aw int; ab int; br int; bw int; bb int;
  w_name text; first_runs int; second_runs int; second_wkts int; ko boolean;
begin
  select * into m from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found.' using errcode = '22023'; end if;
  perform private.require_tournament_organiser(m.tournament_id);
  select * into t from public.tournaments where id = m.tournament_id;
  if t.status in ('completed','cancelled') then raise exception 'This tournament is finished.' using errcode = '22023'; end if;
  if m.team_a_id is null or m.team_b_id is null then raise exception 'Both teams must be set before entering a result.' using errcode = '22023'; end if;

  rtype := coalesce(nullif(p->>'result_type', ''), 'win');
  if rtype not in ('win','tie','no_result','walkover') then raise exception 'Unknown result type.' using errcode = '22023'; end if;
  w  := nullif(p->>'winner_team_id', '')::uuid;
  bf := nullif(p->>'batting_first_team_id', '')::uuid;
  ko := m.stage in ('knockout','quarter_final','semi_final','final','third_place');
  ar := nullif(p->>'team_a_runs', '')::int; aw := nullif(p->>'team_a_wickets', '')::int; ab := nullif(p->>'team_a_balls', '')::int;
  br := nullif(p->>'team_b_runs', '')::int; bw := nullif(p->>'team_b_wickets', '')::int; bb := nullif(p->>'team_b_balls', '')::int;

  if w is not null and w not in (m.team_a_id, m.team_b_id) then raise exception 'The winner must be one of the two teams.' using errcode = '22023'; end if;
  if bf is not null and bf not in (m.team_a_id, m.team_b_id) then raise exception 'Batting-first team must be one of the two teams.' using errcode = '22023'; end if;
  if rtype in ('win','walkover') and w is null then raise exception 'Choose the winning team.' using errcode = '22023'; end if;
  if ko and w is null then raise exception 'A knockout match needs a winner (super over, bowl-out or toss decides a tie).' using errcode = '22023'; end if;
  if not ko and rtype in ('tie','no_result') then w := null; end if;
  if least(coalesce(ar,0), coalesce(br,0), coalesce(ab,0), coalesce(bb,0)) < 0
     or greatest(coalesce(aw,0), coalesce(bw,0)) > 10 or least(coalesce(aw,0), coalesce(bw,0)) < 0 then
    raise exception 'Check the runs, wickets and overs.' using errcode = '22023';
  end if;
  if t.overs_per_innings is not null and greatest(coalesce(ab,0), coalesce(bb,0)) > t.overs_per_innings * 6 then
    raise exception 'Overs cannot be more than % per innings.', t.overs_per_innings using errcode = '22023';
  end if;
  if rtype = 'win' and (ar is null or br is null or ab is null or bb is null) then
    raise exception 'Enter runs and overs for both teams.' using errcode = '22023';
  end if;
  if rtype = 'win' and ((w = m.team_a_id and ar <= br) or (w = m.team_b_id and br <= ar)) then
    raise exception 'The winning team must have scored more runs.' using errcode = '22023';
  end if;
  if rtype = 'tie' and ar is not null and br is not null and ar <> br then
    raise exception 'A tie needs equal scores.' using errcode = '22023';
  end if;

  select name into w_name from public.teams where id = w;
  summary := case rtype
    when 'walkover' then w_name || ' won by walkover'
    when 'no_result' then 'No result'
    when 'tie' then 'Match tied' || coalesce(' (' || w_name || ' won the tie-breaker)', '')
    else null end;
  if rtype = 'win' then
    if bf is null then
      summary := w_name || ' won';
    else
      first_runs  := case when bf = m.team_a_id then ar else br end;
      second_runs := case when bf = m.team_a_id then br else ar end;
      second_wkts := case when bf = m.team_a_id then bw else aw end;
      summary := case when w = bf then w_name || ' won by ' || (first_runs - second_runs) || ' run' || case when first_runs - second_runs = 1 then '' else 's' end
                      else w_name || ' won by ' || (10 - coalesce(second_wkts, 0)) || ' wicket' || case when 10 - coalesce(second_wkts, 0) = 1 then '' else 's' end end;
    end if;
  end if;

  update public.matches set status = case when rtype = 'no_result' then 'abandoned' else 'completed' end,
         result_type = rtype, winner_team_id = w, batting_first_team_id = bf,
         team_a_runs = ar, team_a_wickets = aw, team_a_balls = ab,
         team_b_runs = br, team_b_wickets = bw, team_b_balls = bb,
         result_summary = summary,
         notes = coalesce(nullif(pg_catalog.btrim(coalesce(p->>'notes', '')), ''), notes)
   where id = p_match_id;

  update public.tournaments set
    matches_completed = (select count(*) from public.matches where tournament_id = t.id and status in ('completed','abandoned')),
    status = case when status in ('registration','upcoming') then 'ongoing' else status end
   where id = t.id;

  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  select distinct tm.owner_id, 'match_result', 'Match result',
         (select name from public.teams where id = m.team_a_id) || ' vs ' || (select name from public.teams where id = m.team_b_id)
         || ' (' || t.name || '): ' || summary, jsonb_build_object('match_id', p_match_id, 'tournament_id', t.id)
    from public.teams tm where tm.id in (m.team_a_id, m.team_b_id);
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'MATCH_RESULT_RECORDED', 'tournaments', t.id::text,
          jsonb_build_object('match_id', p_match_id, 'previous', m.result_summary, 'result', summary));
  return jsonb_build_object('id', p_match_id, 'result_summary', summary);
end;
$$;

-- Undo a result entered by mistake (match goes back to scheduled).
create or replace function public.clear_match_result(p_match_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare m record;
begin
  select * into m from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found.' using errcode = '22023'; end if;
  perform private.require_tournament_organiser(m.tournament_id);
  if exists (select 1 from public.tournaments where id = m.tournament_id and status = 'completed') then
    raise exception 'This tournament is finished.' using errcode = '22023';
  end if;
  update public.matches set status = 'scheduled', result_type = null, winner_team_id = null, batting_first_team_id = null,
         team_a_runs = null, team_a_wickets = null, team_a_balls = null,
         team_b_runs = null, team_b_wickets = null, team_b_balls = null, result_summary = null
   where id = p_match_id;
  update public.tournaments set matches_completed = (select count(*) from public.matches where tournament_id = m.tournament_id and status in ('completed','abandoned'))
   where id = m.tournament_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'MATCH_RESULT_CLEARED', 'tournaments', m.tournament_id::text,
          jsonb_build_object('match_id', p_match_id, 'previous', m.result_summary));
  return jsonb_build_object('id', p_match_id);
end;
$$;

-- #53 Points table, #54 NRR, #55 qualification.
-- League/group matches only. NRR = runs scored / overs faced - runs conceded / overs bowled.
-- A team bowled out (10 wickets) counts the full quota of overs. Walkovers and no-results are left out of NRR.
create or replace function public.get_points_table(p_tournament_id uuid)
returns table (group_id uuid, group_name text, team_id uuid, team_name text, short_name text, logo_url text,
               played int, won int, lost int, tied int, no_result int, points int,
               runs_for int, balls_faced int, runs_against int, balls_bowled int, nrr numeric,
               rank_no int, qualified boolean)
language sql stable security definer set search_path = ''
as $$
  with t as (select * from public.tournaments where id = p_tournament_id),
  entrants as (
    select tt.team_id, tt.group_id from public.tournament_teams tt where tt.tournament_id = p_tournament_id and tt.status = 'approved'
  ),
  m as (
    select mm.* from public.matches mm
     where mm.tournament_id = p_tournament_id and mm.stage in ('league','group')
       and mm.status in ('completed','abandoned') and mm.result_type is not null
  ),
  sides as (
    select m.id, m.team_a_id as team_id, m.result_type, m.winner_team_id,
           m.team_a_runs as rf, case when m.team_a_wickets >= 10 and (select overs_per_innings from t) is not null then (select overs_per_innings from t) * 6 else m.team_a_balls end as bf,
           m.team_b_runs as ra, case when m.team_b_wickets >= 10 and (select overs_per_innings from t) is not null then (select overs_per_innings from t) * 6 else m.team_b_balls end as bb
      from m
    union all
    select m.id, m.team_b_id, m.result_type, m.winner_team_id,
           m.team_b_runs, case when m.team_b_wickets >= 10 and (select overs_per_innings from t) is not null then (select overs_per_innings from t) * 6 else m.team_b_balls end,
           m.team_a_runs, case when m.team_a_wickets >= 10 and (select overs_per_innings from t) is not null then (select overs_per_innings from t) * 6 else m.team_a_balls end
      from m
  ),
  agg as (
    select s.team_id,
           count(*)::int as played,
           count(*) filter (where s.result_type in ('win','walkover') and s.winner_team_id = s.team_id)::int as won,
           count(*) filter (where s.result_type in ('win','walkover') and s.winner_team_id <> s.team_id)::int as lost,
           count(*) filter (where s.result_type = 'tie')::int as tied,
           count(*) filter (where s.result_type = 'no_result')::int as no_result,
           coalesce(sum(s.rf) filter (where s.result_type in ('win','tie') and s.bf > 0 and s.bb > 0), 0)::int as runs_for,
           coalesce(sum(s.bf) filter (where s.result_type in ('win','tie') and s.bf > 0 and s.bb > 0), 0)::int as balls_faced,
           coalesce(sum(s.ra) filter (where s.result_type in ('win','tie') and s.bf > 0 and s.bb > 0), 0)::int as runs_against,
           coalesce(sum(s.bb) filter (where s.result_type in ('win','tie') and s.bf > 0 and s.bb > 0), 0)::int as balls_bowled
      from sides s group by s.team_id
  ),
  rows as (
    select e.group_id, g.name as group_name, g.sort_order, e.team_id, tm.name as team_name, tm.short_name, tm.logo_url,
           coalesce(a.played, 0) as played, coalesce(a.won, 0) as won, coalesce(a.lost, 0) as lost,
           coalesce(a.tied, 0) as tied, coalesce(a.no_result, 0) as no_result,
           (coalesce(a.won, 0) * (select points_win from t) + coalesce(a.tied, 0) * (select points_tie from t)
             + coalesce(a.no_result, 0) * (select points_no_result from t))::int as points,
           coalesce(a.runs_for, 0) as runs_for, coalesce(a.balls_faced, 0) as balls_faced,
           coalesce(a.runs_against, 0) as runs_against, coalesce(a.balls_bowled, 0) as balls_bowled,
           pg_catalog.round(
             case when coalesce(a.balls_faced, 0) > 0 then a.runs_for * 6.0 / a.balls_faced else 0 end
             - case when coalesce(a.balls_bowled, 0) > 0 then a.runs_against * 6.0 / a.balls_bowled else 0 end, 3) as nrr
      from entrants e
      join public.teams tm on tm.id = e.team_id
      left join public.tournament_groups g on g.id = e.group_id
      left join agg a on a.team_id = e.team_id
  ),
  ranked as (
    select r.*, (row_number() over (partition by r.group_id order by r.points desc, r.nrr desc, r.won desc, r.team_name))::int as rank_no
      from rows r
  )
  select r.group_id, r.group_name, r.team_id, r.team_name, r.short_name, r.logo_url,
         r.played, r.won, r.lost, r.tied, r.no_result, r.points,
         r.runs_for, r.balls_faced, r.runs_against, r.balls_bowled, r.nrr, r.rank_no,
         (r.rank_no <= (select qualify_per_group from t) and r.played > 0) as qualified
    from ranked r
   order by r.sort_order nulls first, r.group_name nulls first, r.rank_no;
$$;

-- #58 Finish the tournament and declare the winner (defaults to the final's result).
create or replace function public.complete_tournament(p_tournament_id uuid, p_winner uuid default null, p_runner_up uuid default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare t record; f record; w uuid := p_winner; r uuid := p_runner_up; wname text;
begin
  perform private.require_tournament_organiser(p_tournament_id);
  select * into t from public.tournaments where id = p_tournament_id;
  if t.status = 'completed' then raise exception 'This tournament is already finished.' using errcode = '22023'; end if;
  if w is null then
    select * into f from public.matches where tournament_id = p_tournament_id and stage = 'final' and winner_team_id is not null
     order by match_no desc limit 1;
    if found then
      w := f.winner_team_id;
      r := coalesce(r, case when f.team_a_id = f.winner_team_id then f.team_b_id else f.team_a_id end);
    end if;
  end if;
  if w is null then raise exception 'Choose the winning team.' using errcode = '22023'; end if;
  if w = r then raise exception 'Winner and runner-up must be different teams.' using errcode = '22023'; end if;
  if not exists (select 1 from public.tournament_teams where tournament_id = p_tournament_id and team_id = w and status = 'approved')
     or (r is not null and not exists (select 1 from public.tournament_teams where tournament_id = p_tournament_id and team_id = r and status = 'approved')) then
    raise exception 'Winner and runner-up must be teams of this tournament.' using errcode = '22023';
  end if;
  if exists (select 1 from public.matches where tournament_id = p_tournament_id and status in ('scheduled','live')) then
    raise exception 'Some matches are not finished yet. Enter their results or delete them first.' using errcode = '22023';
  end if;

  update public.tournaments set status = 'completed', winner_team_id = w, runner_up_team_id = r, completed_at = now(),
         registration_open = false
   where id = p_tournament_id;
  select name into wname from public.teams where id = w;
  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  select distinct tm.owner_id, 'tournament_completed', t.name || ' finished',
         wname || ' won ' || t.name || '.', jsonb_build_object('tournament_id', p_tournament_id)
    from public.tournament_teams tt join public.teams tm on tm.id = tt.team_id
   where tt.tournament_id = p_tournament_id and tt.status = 'approved';
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'TOURNAMENT_COMPLETED', 'tournaments', p_tournament_id::text,
          jsonb_build_object('winner', w, 'runner_up', r));
  return jsonb_build_object('id', p_tournament_id, 'winner_team_id', w, 'runner_up_team_id', r);
end;
$$;

revoke all on function public.set_tournament_rules(uuid, jsonb) from public, anon;
revoke all on function public.record_match_result(uuid, jsonb) from public, anon;
revoke all on function public.clear_match_result(uuid) from public, anon;
revoke all on function public.complete_tournament(uuid, uuid, uuid) from public, anon;
revoke all on function public.get_points_table(uuid) from public;
grant execute on function public.set_tournament_rules(uuid, jsonb) to authenticated;
grant execute on function public.record_match_result(uuid, jsonb) to authenticated;
grant execute on function public.clear_match_result(uuid) to authenticated;
grant execute on function public.complete_tournament(uuid, uuid, uuid) to authenticated;
grant execute on function public.get_points_table(uuid) to anon, authenticated;

-- New tournaments take their overs from the format (T10 -> 10, T20 -> 20, ODI -> 50) unless set.
create or replace function private.fill_tournament_overs()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.overs_per_innings is null and new.format is not null then
    new.overs_per_innings := case when new.format ~* 'odi' then 50
                                  when substring(new.format from '([0-9]{1,3})') is not null
                                       then least(100, greatest(1, substring(new.format from '([0-9]{1,3})')::int)) end;
  end if;
  return new;
end;
$$;
drop trigger if exists tournaments_fill_overs on public.tournaments;
create trigger tournaments_fill_overs before insert or update of format, overs_per_innings on public.tournaments
for each row execute function private.fill_tournament_overs();
