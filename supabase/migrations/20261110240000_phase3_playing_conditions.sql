-- Phase 3 / Category E batch 1 – Playing conditions (rules) for tournaments and matches.
-- #105 match-specific rule configuration, #106 batting/innings rules, #107 bowling restrictions,
-- #108 max overs per bowler, #109 wides, #110 no-balls, #111 free hit, #112 LBW on/off,
-- #114 byes and leg-byes, #118 boundary rules, #119 powerplay, #129 ball type, #130 pitch and ground,
-- #131 fielding restrictions, #132 local tournament playing conditions, #133 substitutions,
-- #134 rule publishing and version history.
--
-- Rules are a small JSON object. A tournament sets the defaults for its matches; a match can change them
-- until it starts. When a match goes live its rules are frozen (copied onto the match) and the scorer's
-- ball-by-ball entry follows them.

alter table public.tournaments add column if not exists rules jsonb not null default '{}'::jsonb;
alter table public.matches add column if not exists rules jsonb;
alter table public.balls add column if not exists free_hit boolean not null default false;

create table if not exists public.rule_versions (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments(id) on delete cascade,
  match_id uuid references public.matches(id) on delete cascade,
  version int not null,
  rules jsonb not null,
  note text check (note is null or pg_catalog.length(note) <= 300),
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((tournament_id is not null) <> (match_id is not null))
);
create index if not exists rule_versions_tournament_idx on public.rule_versions (tournament_id, version desc);
create index if not exists rule_versions_match_idx on public.rule_versions (match_id, version desc);
create index if not exists rule_versions_changed_by_idx on public.rule_versions (changed_by);
alter table public.rule_versions enable row level security;
drop policy if exists rule_versions_read on public.rule_versions;
create policy rule_versions_read on public.rule_versions for select to anon, authenticated using (true);
grant select on public.rule_versions to anon, authenticated;

-- Default local-cricket rules.
create or replace function private.default_rules()
returns jsonb language sql immutable set search_path = ''
as $$
  select jsonb_build_object(
    'wide_runs', 1, 'no_ball_runs', 1, 'free_hit', true, 'lbw', true, 'byes', true, 'leg_byes', true,
    'max_overs_per_bowler', null, 'retire_at', null,
    'powerplay_overs', 0, 'fielders_outside_powerplay', 2, 'fielders_outside', 5,
    'boundary_size_m', null,
    'notes', jsonb_build_object('batting', '', 'bowling', '', 'boundary', '', 'fielding', '', 'ground', '', 'substitutes', '', 'general', '')
  );
$$;

-- Checks and tidies a rules object (unknown keys dropped, numbers range-checked).
create or replace function private.clean_rules(p jsonb)
returns jsonb language plpgsql immutable set search_path = ''
as $$
declare d jsonb := private.default_rules(); r jsonb := '{}'::jsonb; k text; v jsonb; n jsonb := '{}'::jsonb; nk text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then return '{}'::jsonb; end if;
  for k, v in select * from jsonb_each(p) loop
    if not (d ? k) then continue; end if;
    if k = 'notes' then
      if jsonb_typeof(v) = 'object' then
        for nk in select jsonb_object_keys(d->'notes') loop
          if v ? nk and jsonb_typeof(v->nk) = 'string' then
            if pg_catalog.length(v->>nk) > 1000 then raise exception 'Each rules note can be at most 1000 characters.' using errcode = '22023'; end if;
            n := n || jsonb_build_object(nk, pg_catalog.btrim(v->>nk));
          end if;
        end loop;
        r := r || jsonb_build_object('notes', n);
      end if;
    elsif k in ('free_hit','lbw','byes','leg_byes') then
      if jsonb_typeof(v) <> 'boolean' then raise exception 'Rule % must be yes or no.', k using errcode = '22023'; end if;
      r := r || jsonb_build_object(k, v);
    else
      if jsonb_typeof(v) = 'null' or (jsonb_typeof(v) = 'string' and v->>0 = '') then
        if k in ('max_overs_per_bowler','retire_at','boundary_size_m') then r := r || jsonb_build_object(k, null); end if;
        continue;
      end if;
      begin
        v := to_jsonb((v #>> '{}')::int);
      exception when others then raise exception 'Rule % must be a whole number.', k using errcode = '22023';
      end;
      if (k in ('wide_runs','no_ball_runs') and (v::int < 0 or v::int > 2))
         or (k = 'max_overs_per_bowler' and (v::int < 1 or v::int > 50))
         or (k = 'retire_at' and (v::int < 5 or v::int > 200))
         or (k = 'powerplay_overs' and (v::int < 0 or v::int > 50))
         or (k in ('fielders_outside_powerplay','fielders_outside') and (v::int < 0 or v::int > 10))
         or (k = 'boundary_size_m' and (v::int < 10 or v::int > 120)) then
        raise exception 'Rule % is out of range.', k using errcode = '22023';
      end if;
      r := r || jsonb_build_object(k, v);
    end if;
  end loop;
  return r;
end;
$$;

-- Rules in force for a match: defaults, then tournament rules, then the match's own rules.
create or replace function private.effective_rules(p_match_id uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select private.default_rules()
         || coalesce((select t.rules - 'notes' from public.tournaments t where t.id = m.tournament_id), '{}'::jsonb)
         || coalesce(m.rules - 'notes', '{}'::jsonb)
         || jsonb_build_object('notes', (private.default_rules()->'notes')
              || coalesce((select t.rules->'notes' from public.tournaments t where t.id = m.tournament_id), '{}'::jsonb)
              || coalesce(m.rules->'notes', '{}'::jsonb))
    from public.matches m where m.id = p_match_id;
$$;

-- Freeze the rules when a match starts, so later tournament edits don't change a match in progress.
create or replace function private.freeze_match_rules()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'live' and old.status = 'scheduled' then
    new.rules := private.effective_rules(new.id);
  end if;
  return new;
end;
$$;
drop trigger if exists matches_freeze_rules on public.matches;
create trigger matches_freeze_rules before update of status on public.matches for each row execute function private.freeze_match_rules();

-- Read the playing conditions of a tournament or a match, with version history.
create or replace function public.get_playing_conditions(p_tournament_id uuid default null, p_match_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare m public.matches%rowtype; t public.tournaments%rowtype; eff jsonb; own jsonb; can_edit boolean := false; locked boolean := false; inherited jsonb;
begin
  if (p_tournament_id is null) = (p_match_id is null) then raise exception 'Choose a tournament or a match.' using errcode = '22023'; end if;
  if p_match_id is not null then
    select * into m from public.matches where id = p_match_id;
    if not found then raise exception 'Match not found.' using errcode = '22023'; end if;
    locked := m.status <> 'scheduled';
    eff := case when locked and m.rules is not null then private.default_rules() || (m.rules - 'notes')
                     || jsonb_build_object('notes', (private.default_rules()->'notes') || coalesce(m.rules->'notes', '{}'::jsonb))
                else private.effective_rules(p_match_id) end;
    own := case when locked then '{}'::jsonb else coalesce(m.rules, '{}'::jsonb) end;
    inherited := case when m.tournament_id is null then private.default_rules()
                      else private.default_rules() || (select (t2.rules - 'notes') || jsonb_build_object('notes', (private.default_rules()->'notes') || coalesce(t2.rules->'notes', '{}'::jsonb))
                                                         from public.tournaments t2 where t2.id = m.tournament_id) end;
    can_edit := not locked and (case when m.tournament_id is not null then
                   exists (select 1 from public.tournaments x where x.id = m.tournament_id and x.owner_id = (select auth.uid()))
                   or exists (select 1 from public.user_role_assignments r where r.user_id = (select auth.uid()) and r.role = 'organiser'
                              and r.scope_type = 'tournament' and r.scope_id = m.tournament_id and r.is_active)
                   or private.is_admin()
                 else private.can_score_match(p_match_id) end);
    return jsonb_build_object(
      'rules', eff, 'own', own, 'inherited', inherited, 'locked', locked, 'can_edit', coalesce(can_edit, false),
      'match', jsonb_build_object('id', m.id, 'overs_per_innings', m.overs_per_innings, 'players_per_side', m.players_per_side,
                                  'ball_type', m.ball_type, 'pitch_type', m.pitch_type, 'match_type', m.match_type, 'tournament_id', m.tournament_id,
                                  'max_substitutes', (select max_substitutes from public.tournaments where id = m.tournament_id)),
      'versions', coalesce((select jsonb_agg(jsonb_build_object('version', v.version, 'rules', v.rules, 'note', v.note, 'created_at', v.created_at,
                                                                 'changed_by', (select display_name from public.profiles where id = v.changed_by)) order by v.version desc)
                              from public.rule_versions v where v.match_id = p_match_id), '[]'::jsonb));
  end if;

  select * into t from public.tournaments where id = p_tournament_id;
  if not found then raise exception 'Tournament not found.' using errcode = '22023'; end if;
  can_edit := (select auth.uid()) is not null and (t.owner_id = (select auth.uid())
               or exists (select 1 from public.user_role_assignments r where r.user_id = (select auth.uid()) and r.role = 'organiser'
                          and r.scope_type = 'tournament' and r.scope_id = t.id and r.is_active)
               or private.is_admin());
  return jsonb_build_object(
    'rules', private.default_rules() || (t.rules - 'notes') || jsonb_build_object('notes', (private.default_rules()->'notes') || coalesce(t.rules->'notes', '{}'::jsonb)),
    'own', t.rules, 'inherited', private.default_rules(), 'locked', t.status = 'completed', 'can_edit', can_edit and t.status <> 'completed',
    'tournament', jsonb_build_object('id', t.id, 'overs_per_innings', t.overs_per_innings, 'players_per_side', t.players_per_side,
                                     'max_substitutes', t.max_substitutes, 'ball_type', t.ball_type, 'pitch_type', t.pitch_type, 'match_type', t.match_type),
    'versions', coalesce((select jsonb_agg(jsonb_build_object('version', v.version, 'rules', v.rules, 'note', v.note, 'created_at', v.created_at,
                                                               'changed_by', (select display_name from public.profiles where id = v.changed_by)) order by v.version desc)
                            from public.rule_versions v where v.tournament_id = p_tournament_id), '[]'::jsonb));
end;
$$;

-- #134 Save (publish) playing conditions. Each save is a new version; tournament teams are notified.
create or replace function public.save_playing_conditions(p_tournament_id uuid default null, p_match_id uuid default null,
                                                          p_rules jsonb default '{}'::jsonb, p_note text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare m public.matches%rowtype; t public.tournaments%rowtype; clean jsonb := private.clean_rules(p_rules); ver int; uid uuid := (select auth.uid());
        v_note text := nullif(pg_catalog.btrim(coalesce(p_note, '')), '');
begin
  if uid is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  if (p_tournament_id is null) = (p_match_id is null) then raise exception 'Choose a tournament or a match.' using errcode = '22023'; end if;
  if v_note is not null and pg_catalog.length(v_note) > 300 then raise exception 'The change note can be at most 300 characters.' using errcode = '22023'; end if;

  if p_match_id is not null then
    select * into m from public.matches where id = p_match_id for update;
    if not found then raise exception 'Match not found.' using errcode = '22023'; end if;
    if m.tournament_id is not null then perform private.require_tournament_organiser(m.tournament_id);
    elsif not private.can_score_match(p_match_id) then raise exception 'Only the match creator or scorer can change the rules.' using errcode = '42501';
    end if;
    if m.status <> 'scheduled' then raise exception 'Rules are fixed once the match has started.' using errcode = '22023'; end if;
    update public.matches set rules = clean where id = p_match_id;
    select coalesce(max(version), 0) + 1 into ver from public.rule_versions where match_id = p_match_id;
    insert into public.rule_versions (match_id, version, rules, note, changed_by) values (p_match_id, ver, clean, v_note, uid);
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
    values (uid, 'MATCH_RULES_SAVED', 'matches', p_match_id::text, jsonb_build_object('version', ver));
  else
    perform private.require_tournament_organiser(p_tournament_id);
    select * into t from public.tournaments where id = p_tournament_id for update;
    if t.status = 'completed' then raise exception 'The tournament is finished; its rules can no longer change.' using errcode = '22023'; end if;
    update public.tournaments set rules = clean where id = p_tournament_id;
    select coalesce(max(version), 0) + 1 into ver from public.rule_versions where tournament_id = p_tournament_id;
    insert into public.rule_versions (tournament_id, version, rules, note, changed_by) values (p_tournament_id, ver, clean, v_note, uid);
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
    values (uid, 'TOURNAMENT_RULES_SAVED', 'tournaments', p_tournament_id::text, jsonb_build_object('version', ver));
    insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
    select distinct tm.owner_id, 'tournament_rules', 'Playing conditions updated',
           t.name || ': the playing conditions were updated (version ' || ver || ')' || coalesce(' – ' || v_note, '') || '.',
           jsonb_build_object('tournament_id', t.id, 'version', ver)
      from public.tournament_teams tt join public.teams tm on tm.id = tt.team_id
     where tt.tournament_id = t.id and tt.status = 'approved' and tm.owner_id is not null and tm.owner_id <> uid;
  end if;
  return jsonb_build_object('version', ver);
end;
$$;

-- Live rule state for the scorer: rules in force, free hit, powerplay, overs bowled by each bowler.
create or replace function public.get_scoring_rules(p_match_id uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  with m as (select * from public.matches where id = p_match_id),
  r as (select coalesce(case when m.rules is not null and m.status <> 'scheduled'
                             then private.default_rules() || (m.rules - 'notes') else private.effective_rules(m.id) end, private.default_rules()) as rules from m),
  i as (select * from public.innings where match_id = p_match_id and status = 'in_progress' order by innings_no desc limit 1),
  lastb as (select b.* from public.balls b join i on i.id = b.innings_id order by b.seq desc limit 1)
  select jsonb_build_object(
    'rules', (select rules from r),
    'free_hit_next', coalesce((select (rules->>'free_hit')::boolean from r), true)
                     and coalesce((select extra_type = 'no_ball' or (free_hit and extra_type in ('wide','no_ball')) from lastb), false),
    'powerplay', (select (i.legal_balls / 6) < coalesce((rules->>'powerplay_overs')::int, 0) from i, r),
    'bowler_overs', coalesce((select jsonb_object_agg(bowler_id, legal) from (
                       select b.bowler_id, count(*) filter (where b.is_legal)::int as legal from public.balls b join i on i.id = b.innings_id
                        where b.bowler_id is not null group by b.bowler_id) x), '{}'::jsonb)
  );
$$;

-- #108 Max overs per bowler: check when a bowler is picked.
create or replace function private.check_bowler_quota()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare lim int; used int; cur int;
begin
  if new.bowler_id is null or new.bowler_id is not distinct from old.bowler_id then return new; end if;
  select (coalesce(m.rules, private.effective_rules(m.id))->>'max_overs_per_bowler')::int into lim from public.matches m where m.id = new.match_id;
  if lim is null then return new; end if;
  select count(*) filter (where is_legal) into used from public.balls where innings_id = new.id and bowler_id = new.bowler_id;
  select count(*) into cur from public.balls where innings_id = new.id and over_no = new.legal_balls / 6;
  if cur = 0 and used >= lim * 6 then
    raise exception 'This bowler has already bowled the maximum % over(s).', lim using errcode = '22023';
  end if;
  return new;
end;
$$;
drop trigger if exists innings_bowler_quota on public.innings;
create trigger innings_bowler_quota before update of bowler_id on public.innings for each row execute function private.check_bowler_quota();

revoke all on function private.default_rules() from public, anon, authenticated;
revoke all on function private.clean_rules(jsonb) from public, anon, authenticated;
revoke all on function private.effective_rules(uuid) from public, anon, authenticated;
revoke all on function private.freeze_match_rules() from public, anon, authenticated;
revoke all on function private.check_bowler_quota() from public, anon, authenticated;
revoke all on function public.get_playing_conditions(uuid, uuid) from public;
revoke all on function public.get_scoring_rules(uuid) from public;
revoke all on function public.save_playing_conditions(uuid, uuid, jsonb, text) from public, anon;
grant execute on function public.get_playing_conditions(uuid, uuid) to anon, authenticated;
grant execute on function public.get_scoring_rules(uuid) to anon, authenticated;
grant execute on function public.save_playing_conditions(uuid, uuid, jsonb, text) to authenticated;

-- record_ball now follows the playing conditions (#109 #110 #111 #112 #114)
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
  rules jsonb; fh boolean := false; lastb public.balls%rowtype;
begin
  m := private.require_scorer(p_match_id);
  -- #27 offline sync: a ball that already reached the server (same client id) is not recorded twice
  if cid is not null and exists (select 1 from public.balls where client_id = cid) then
    return public.get_live_state(p_match_id);
  end if;
  if m.status <> 'live' then raise exception 'The match is not live.' using errcode = '22023'; end if;
  rules := private.default_rules() || (coalesce(m.rules, private.effective_rules(m.id)) - 'notes');
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
  -- #112 #114 rules switched off for this match
  if wk = 'lbw' and not coalesce((rules->>'lbw')::boolean, true) then raise exception 'LBW is not used in this match.' using errcode = '22023'; end if;
  if ext = 'leg_bye' and not coalesce((rules->>'leg_byes')::boolean, true) then raise exception 'Leg-byes are not allowed in this match.' using errcode = '22023'; end if;
  if ext = 'bye' and not coalesce((rules->>'byes')::boolean, true) then raise exception 'Byes are not allowed in this match.' using errcode = '22023'; end if;
  -- #111 free hit: the ball after a no-ball (and again after a wide/no-ball on a free hit)
  select * into lastb from public.balls where innings_id = i.id order by seq desc limit 1;
  fh := coalesce(coalesce((rules->>'free_hit')::boolean, true) and found and (lastb.extra_type = 'no_ball' or (lastb.free_hit and lastb.extra_type in ('wide','no_ball'))), false);
  if fh and wk in ('bowled','caught','lbw','stumped','hit_wicket','caught_and_bowled') then
    raise exception 'Free hit: the batter can only be run out on this ball.' using errcode = '22023';
  end if;
  if out_end not in ('striker','non_striker') then raise exception 'Choose which batter is out.' using errcode = '22023'; end if;
  if out_end = 'non_striker' and wk not in ('run_out','obstructing','retired_hurt','retired_out','timed_out') then
    raise exception 'Only a run out (or retirement) can dismiss the non-striker.' using errcode = '22023';
  end if;
  if fielder is not null and not exists (select 1 from public.match_players where match_id = p_match_id and team_id = i.bowling_team_id and player_id = fielder) then
    raise exception 'The fielder must be from the fielding side.' using errcode = '22023';
  end if;

  extra_runs := case ext when 'wide' then coalesce((rules->>'wide_runs')::int, 1) + ext_add when 'no_ball' then coalesce((rules->>'no_ball_runs')::int, 1) + ext_add when 'bye' then ext_add when 'leg_bye' then ext_add else 0 end;
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
                            runs_bat, extra_type, extra_runs, is_legal, is_wicket, wicket_type, dismissed_id, fielder_id, commentary, created_by, client_id, free_hit)
  values (p_match_id, i.id, seq_no, over_idx, in_over, b, s, ns, last_b,
          runs_bat, ext, extra_runs, legal, is_wkt, wk, dismissed, fielder,
          nullif(pg_catalog.btrim(coalesce(p->>'commentary', '')), ''), (select auth.uid()), cid, fh);

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
