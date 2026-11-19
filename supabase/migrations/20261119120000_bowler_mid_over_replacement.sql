-- Batch 2: injured / unable bowler replaced mid-over (#321-#323) with an audit trail (#315-#319 style).
-- The balls already bowled stay with the first bowler (balls.bowler_id is per delivery); the replacement bowls the rest.
-- The replaced bowler cannot bowl again in the innings; the replacement cannot bowl the next over
-- (the over-end already records him as the last-over bowler).

create table public.bowler_replacements (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  innings_id uuid not null references public.innings(id) on delete cascade,
  over_no integer not null check (over_no >= 0),
  original_id uuid not null,
  replacement_id uuid not null,
  legal_balls_before integer not null check (legal_balls_before between 0 and 5),
  reason text not null check (pg_catalog.length(reason) between 3 and 160),
  created_by uuid,
  created_at timestamptz not null default pg_catalog.now()
);
create index bowler_replacements_innings_idx on public.bowler_replacements (innings_id);
create index bowler_replacements_match_idx on public.bowler_replacements (match_id);

alter table public.bowler_replacements enable row level security;
create policy "bowler replacements are public match data" on public.bowler_replacements for select to anon, authenticated using (true);
revoke all on public.bowler_replacements from public, anon, authenticated;
grant select on public.bowler_replacements to anon, authenticated;

create or replace function public.replace_bowler_mid_over(p_match_id uuid, p_replacement uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  m public.matches%rowtype; i public.innings%rowtype;
  why text := pg_catalog.btrim(coalesce(p_reason, ''));
  n int; lim int; used int;
begin
  m := private.require_scorer(p_match_id);
  if m.status <> 'live' then raise exception 'The match is not live.' using errcode = '22023'; end if;
  select * into i from public.innings where match_id = p_match_id and status = 'in_progress' order by innings_no desc limit 1;
  if not found then raise exception 'No innings is in progress.' using errcode = '22023'; end if;
  if i.bowler_id is null then raise exception 'No over is in progress. Pick the next bowler instead.' using errcode = '22023'; end if;
  if pg_catalog.length(why) < 3 then raise exception 'Give a reason (injury, illness or suspension).' using errcode = '22023'; end if;
  if pg_catalog.length(why) > 160 then raise exception 'Keep the reason under 160 characters.' using errcode = '22023'; end if;
  if p_replacement is null or p_replacement = i.bowler_id then raise exception 'Pick a different player to finish the over.' using errcode = '22023'; end if;
  if not exists (select 1 from public.match_players where match_id = p_match_id and team_id = i.bowling_team_id and player_id = p_replacement and role = 'playing') then
    raise exception 'The replacement must be in the fielding side''s Playing XI.' using errcode = '22023';
  end if;
  if p_replacement = i.last_over_bowler_id then
    raise exception 'The bowler of the previous over cannot finish this over.' using errcode = '22023';
  end if;
  if exists (select 1 from public.bowler_replacements where innings_id = i.id and original_id = p_replacement) then
    raise exception 'This player was replaced earlier and cannot bowl again in this innings.' using errcode = '22023';
  end if;
  lim := (coalesce(m.rules, private.effective_rules(m.id)) ->> 'max_overs_per_bowler')::int;
  if lim is not null then
    select count(*) into used from public.balls where innings_id = i.id and bowler_id = p_replacement and is_legal;
    if used >= lim * 6 then raise exception 'The replacement has already bowled the maximum of % overs.', lim using errcode = '22023'; end if;
  end if;

  n := i.legal_balls % 6;
  insert into public.bowler_replacements (match_id, innings_id, over_no, original_id, replacement_id, legal_balls_before, reason, created_by)
  values (p_match_id, i.id, i.legal_balls / 6, i.bowler_id, p_replacement, n, why, (select auth.uid()));
  update public.innings set bowler_id = p_replacement where id = i.id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'BOWLER_REPLACED_MID_OVER', 'matches', p_match_id::text,
          jsonb_build_object('original_id', i.bowler_id, 'replacement_id', p_replacement, 'over', i.legal_balls / 6,
                             'legal_balls_before', n, 'reason', why));
  return public.get_live_state(p_match_id);
end;
$$;

-- A bowler who was replaced mid-over cannot be picked again in the same innings.
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
  if p_bowler is not null and exists (select 1 from public.bowler_replacements where innings_id = i.id and original_id = p_bowler) then
    raise exception 'This bowler was replaced after an injury and cannot bowl again in this innings.' using errcode = '22023';
  end if;
  select count(*) into balls_this_over from public.balls where innings_id = i.id and over_no = i.legal_balls / 6;
  if p_bowler is not null and p_bowler = i.last_over_bowler_id and balls_this_over = 0
     and private.playing_count(p_match_id, i.bowling_team_id) > 1 then
    raise exception 'The same bowler cannot bowl two overs in a row.' using errcode = '22023';
  end if;

  update public.innings set striker_id = s, non_striker_id = ns, bowler_id = b where id = i.id;
  insert into public.innings_crease (innings_id, player_id)
  select i.id, x from unnest(array[s, ns]) x where x is not null
  on conflict (innings_id, player_id) do nothing;
  return public.get_live_state(p_match_id);
end;
$$;

revoke all on function public.replace_bowler_mid_over(uuid, uuid, text) from public, anon;
grant execute on function public.replace_bowler_mid_over(uuid, uuid, text) to authenticated;
revoke all on function public.set_innings_players(uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.set_innings_players(uuid, uuid, uuid, uuid) to authenticated;
