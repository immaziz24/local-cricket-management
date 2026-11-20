-- Batch 19: #348 pitch map, #353 batter vs bowler, #362 incident evidence, #384 two-person approval,
-- #387 security alerts, #397 geotagged check-in with consent, #393 lineup-correction notifications.

-- ===== #348 Pitch map =====
alter table public.balls add column if not exists pitch_x smallint check (pitch_x between 0 and 100);
alter table public.balls add column if not exists pitch_y smallint check (pitch_y between 0 and 100);

create or replace function public.set_last_ball_pitch(p_match_id uuid, p_x int, p_y int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare b record;
begin
  perform private.require_scorer(p_match_id);
  if (p_x is null) <> (p_y is null) then raise exception 'Give both sides of the pitch position.' using errcode = '22023'; end if;
  if p_x is not null and (p_x < 0 or p_x > 100 or p_y < 0 or p_y > 100) then raise exception 'That spot is outside the pitch.' using errcode = '22023'; end if;
  select id, created_at into b from public.balls where match_id = p_match_id order by created_at desc, id desc limit 1;
  if not found then raise exception 'No ball has been scored yet.' using errcode = '22023'; end if;
  if b.created_at < now() - interval '20 minutes' then raise exception 'Only the ball you just scored can be marked.' using errcode = '22023'; end if;
  update public.balls set pitch_x = p_x::smallint, pitch_y = p_y::smallint where id = b.id;
  return jsonb_build_object('ball_id', b.id, 'cleared', p_x is null);
end $$;

create or replace function public.get_pitch_map(p_match_id uuid, p_innings_no int default null, p_bowler_id uuid default null) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'marked', (select count(*) from public.balls b where b.match_id = p_match_id and b.pitch_x is not null),
    'total', (select count(*) from public.balls b where b.match_id = p_match_id),
    'bowlers', (select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'name', q.n, 'count', q.c) order by q.c desc, q.n), '[]'::jsonb)
                  from (select b.bowler_id id, p.display_name n, count(*) c from public.balls b join public.players p on p.id = b.bowler_id
                         where b.match_id = p_match_id and b.pitch_x is not null group by 1, 2) q),
    'balls', (select coalesce(jsonb_agg(jsonb_build_object('x', b.pitch_x, 'y', b.pitch_y, 'runs', b.runs_bat, 'extra', b.extra_type, 'wicket', b.is_wicket,
                       'bowler_id', b.bowler_id, 'over', b.over_no, 'ball', b.ball_in_over) order by i.innings_no, b.seq), '[]'::jsonb)
                from public.balls b join public.innings i on i.id = b.innings_id
               where b.match_id = p_match_id and b.pitch_x is not null
                 and (p_innings_no is null or i.innings_no = p_innings_no) and (p_bowler_id is null or b.bowler_id = p_bowler_id)));
$$;

-- ===== #353 Batter versus bowler =====
create or replace function public.get_batter_vs_bowler(p_batter_id uuid, p_bowler_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare res jsonb; bn text; wn text;
begin
  select display_name into bn from public.players where id = p_batter_id;
  select display_name into wn from public.players where id = p_bowler_id;
  if bn is null or wn is null then raise exception 'Choose two players.' using errcode = '22023'; end if;
  if p_batter_id = p_bowler_id then raise exception 'Choose two different players.' using errcode = '22023'; end if;
  with x as (
    select b.*, m.scheduled_at, m.created_at as m_created, m.title, m.team_a_id, m.team_b_id
      from public.balls b join public.matches m on m.id = b.match_id
     where b.striker_id = p_batter_id and b.bowler_id = p_bowler_id and m.status in ('completed', 'live')
  ), d as (
    select b.match_id, b.wicket_type from public.balls b join public.matches m on m.id = b.match_id
     where b.bowler_id = p_bowler_id and b.dismissed_id = p_batter_id and b.is_wicket
       and b.wicket_type in ('bowled','caught','lbw','stumped','hit_wicket','caught_and_bowled') and m.status in ('completed', 'live')
  )
  select jsonb_build_object(
    'batter', bn, 'bowler', wn,
    'balls', (select count(*) from x where is_legal),
    'runs', (select coalesce(sum(runs_bat), 0) from x),
    'fours', (select count(*) from x where runs_bat = 4),
    'sixes', (select count(*) from x where runs_bat = 6),
    'dots', (select count(*) from x where is_legal and runs_bat = 0),
    'dismissals', (select count(*) from d),
    'dismissal_types', (select coalesce(jsonb_object_agg(wicket_type, c), '{}'::jsonb) from (select wicket_type, count(*) c from d group by 1) t),
    'matches', (select count(distinct match_id) from x),
    'by_match', (select coalesce(jsonb_agg(r order by r ->> 'when' desc), '[]'::jsonb) from (
        select jsonb_build_object('match_id', q.match_id, 'when', coalesce(q.scheduled_at, q.m_created),
                 'title', coalesce(q.title, (select name from public.teams where id = q.team_a_id) || ' vs ' || (select name from public.teams where id = q.team_b_id)),
                 'balls', q.balls, 'runs', q.runs, 'out', exists (select 1 from d where d.match_id = q.match_id)) r
          from (select match_id, max(scheduled_at) scheduled_at, max(m_created) m_created, max(title) title, max(team_a_id::text)::uuid team_a_id, max(team_b_id::text)::uuid team_b_id,
                       count(*) filter (where is_legal) balls, coalesce(sum(runs_bat), 0) runs from x group by match_id order by max(coalesce(scheduled_at, m_created)) desc limit 10) q) z)
  ) into res;
  return res;
end $$;

-- ===== #362 Official incident evidence attachments =====
create table if not exists public.match_report_evidence (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.match_reports(id) on delete cascade,
  added_by uuid not null,
  kind text not null check (kind in ('link', 'statement')),
  url text check (url is null or (char_length(url) <= 500 and url ~* '^https://')),
  statement text check (statement is null or char_length(statement) <= 1000),
  created_at timestamptz not null default now(),
  check ((kind = 'link' and url is not null) or (kind = 'statement' and statement is not null))
);
create index if not exists match_report_evidence_report_idx on public.match_report_evidence (report_id);
alter table public.match_report_evidence enable row level security;
revoke all on public.match_report_evidence from anon, authenticated;

create or replace function private.report_visible(p_report uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.match_reports r join public.matches m on m.id = r.match_id
                  where r.id = p_report and (r.kind = 'decision' or private.is_match_official(m.id) or private.is_admin()
                        or exists (select 1 from public.teams t where t.id in (m.team_a_id, m.team_b_id) and t.owner_id = (select auth.uid()))));
$$;

create or replace function public.list_match_report_evidence(p_report_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  if not private.report_visible(p_report_id) then raise exception 'You cannot see this report.' using errcode = '42501'; end if;
  return jsonb_build_object('items', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'kind', e.kind, 'url', e.url, 'statement', e.statement, 'created_at', e.created_at,
            'by', (select display_name from public.profiles where id = e.added_by)) order by e.created_at), '[]'::jsonb)
     from public.match_report_evidence e where e.report_id = p_report_id),
     'can_add', exists (select 1 from public.match_reports r where r.id = p_report_id and r.status = 'open' and private.is_match_official(r.match_id)));
end $$;

create or replace function public.add_match_report_evidence(p_report_id uuid, p_kind text, p_url text default null, p_statement text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.match_reports%rowtype; u text := nullif(pg_catalog.btrim(coalesce(p_url, '')), ''); s text := nullif(pg_catalog.btrim(coalesce(p_statement, '')), '');
begin
  select * into r from public.match_reports where id = p_report_id;
  if not found then raise exception 'Report not found.' using errcode = '22023'; end if;
  perform private.require_match_official(r.match_id);
  if r.status <> 'open' then raise exception 'This report is closed, so evidence can no longer be added.' using errcode = '22023'; end if;
  if p_kind not in ('link', 'statement') then raise exception 'Choose link or statement.' using errcode = '22023'; end if;
  if p_kind = 'link' and (u is null or u !~* '^https://[^ ]+$' or pg_catalog.length(u) > 500) then raise exception 'Give a web address starting with https:// (up to 500 characters).' using errcode = '22023'; end if;
  if p_kind = 'statement' and (s is null or pg_catalog.length(s) < 5 or pg_catalog.length(s) > 1000) then raise exception 'Write a statement of 5 to 1000 characters.' using errcode = '22023'; end if;
  if (select count(*) from public.match_report_evidence where report_id = p_report_id) >= 15 then raise exception 'A report can hold at most 15 pieces of evidence.' using errcode = '22023'; end if;
  insert into public.match_report_evidence (report_id, added_by, kind, url, statement) values (p_report_id, (select auth.uid()), p_kind, case when p_kind = 'link' then u end, case when p_kind = 'statement' then s end);
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'MATCH_REPORT_EVIDENCE_ADDED', 'match_reports', p_report_id::text, jsonb_build_object('match_id', r.match_id, 'kind', p_kind));
  return public.list_match_report_evidence(p_report_id);
end $$;

-- ===== #384 Two-person approval for score overrides =====
alter table public.tournaments add column if not exists two_person_approval boolean not null default false;

create or replace function private.two_person_on(p_match uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select t.two_person_approval from public.matches m join public.tournaments t on t.id = m.tournament_id where m.id = p_match), false);
$$;

create or replace function private.enforce_two_person() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'pending' and new.status <> 'pending' and new.decided_by is not null and new.decided_by = old.requested_by
     and private.two_person_on(old.match_id) and not private.is_admin() then
    raise exception 'Two-person approval is on for this tournament: someone other than the person who made the request must decide it.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists zz_two_person_ball on public.ball_revisions;
create trigger zz_two_person_ball before update on public.ball_revisions for each row execute function private.enforce_two_person();
drop trigger if exists zz_two_person_rule on public.rule_override_requests;
create trigger zz_two_person_rule before update on public.rule_override_requests for each row execute function private.enforce_two_person();

create or replace function public.get_tournament_security(p_tournament_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare t public.tournaments%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  select * into t from public.tournaments where id = p_tournament_id;
  if not found then raise exception 'Tournament not found.' using errcode = '22023'; end if;
  return jsonb_build_object('two_person', t.two_person_approval, 'can_manage', private.is_tournament_organiser(p_tournament_id));
end $$;

create or replace function public.set_two_person_approval(p_tournament_id uuid, p_on boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_tournament_organiser(p_tournament_id);
  update public.tournaments set two_person_approval = coalesce(p_on, false) where id = p_tournament_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'TWO_PERSON_APPROVAL_SET', 'tournaments', p_tournament_id::text, jsonb_build_object('on', coalesce(p_on, false)));
  return public.get_tournament_security(p_tournament_id);
end $$;

create or replace function public.propose_ball_correction(p_match_id uuid, p_ball_id bigint, p_changes jsonb, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare m public.matches%rowtype; b public.balls%rowtype; uid uuid := (select auth.uid()); k text; v text;
        bef jsonb := '{}'::jsonb; aft jsonb := '{}'::jsonb; cur jsonb; rno int; rid uuid; new_striker uuid; new_non uuid; manager boolean;
begin
  m := private.require_scorer(p_match_id, 'edit_ball');
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then raise exception 'Please give a reason (at least 5 characters).' using errcode = '22023'; end if;
  select * into b from public.balls where id = p_ball_id and match_id = p_match_id;
  if not found then raise exception 'That ball was not found in this match.' using errcode = '22023'; end if;
  cur := jsonb_build_object('striker_id', b.striker_id, 'non_striker_id', b.non_striker_id, 'bowler_id', b.bowler_id,
                            'fielder_id', b.fielder_id, 'dismissed_id', b.dismissed_id);
  for k in select jsonb_object_keys(coalesce(p_changes, '{}'::jsonb)) loop
    if k not in ('striker_id','non_striker_id','bowler_id','fielder_id','dismissed_id') then raise exception 'Unknown field: %', k using errcode = '22023'; end if;
    v := nullif(p_changes ->> k, '');
    if k in ('striker_id','non_striker_id','bowler_id') and v is null then raise exception 'A batter or bowler is needed.' using errcode = '22023'; end if;
    if k in ('fielder_id','dismissed_id') and not b.is_wicket then raise exception 'This ball has no wicket.' using errcode = '22023'; end if;
    if k = 'dismissed_id' and v is null then raise exception 'Who was out is needed.' using errcode = '22023'; end if;
    if v is not null and not exists (select 1 from public.match_players mp where mp.match_id = p_match_id and mp.player_id = v::uuid) then
      raise exception 'That player is not in this match''s squads.' using errcode = '22023';
    end if;
    if (cur ->> k) is distinct from v then
      bef := bef || jsonb_build_object(k, cur -> k);
      aft := aft || jsonb_build_object(k, to_jsonb(v));
    end if;
  end loop;
  if aft = '{}'::jsonb then raise exception 'Nothing to change.' using errcode = '22023'; end if;
  new_striker := coalesce(nullif(aft ->> 'striker_id', '')::uuid, b.striker_id);
  new_non := coalesce(nullif(aft ->> 'non_striker_id', '')::uuid, b.non_striker_id);
  if new_striker is not null and new_striker = new_non then raise exception 'The striker and non-striker cannot be the same player.' using errcode = '22023'; end if;
  if aft ? 'bowler_id' and (aft ->> 'bowler_id')::uuid in (new_striker, new_non) then raise exception 'A bowler cannot also be one of the batters.' using errcode = '22023'; end if;
  if exists (select 1 from public.ball_revisions where ball_id = b.id and status = 'pending') then
    raise exception 'A correction for this ball is already waiting for approval.' using errcode = '22023';
  end if;
  select coalesce(max(revision_no), 0) + 1 into rno from public.ball_revisions where ball_id = b.id;
  manager := private.can_manage_match(p_match_id) and not private.two_person_on(p_match_id);
  insert into public.ball_revisions (match_id, ball_id, innings_id, seq, revision_no, before, after, reason, status, requested_by)
  values (p_match_id, b.id, b.innings_id, b.seq, rno, bef, aft, btrim(p_reason), 'pending', uid) returning id into rid;
  if manager then
    perform private.apply_ball_revision(rid, uid);
  else
    insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
    select distinct u, 'score_correction', 'Score correction waiting', 'A correction to who played a ball is waiting for approval. Open the match History to approve or reject.', jsonb_build_object('match_id', p_match_id, 'revision_id', rid)
      from (select m.created_by u union select owner_id from public.tournaments where id = m.tournament_id) x where u is not null and u <> uid;
  end if;
  return public.list_ball_revisions(p_match_id);
end $$;

-- ===== #387 Security alert notifications =====
create or replace function private.alert_user(p_user uuid, p_title text, p_body text, p_kind text) returns void
language sql security definer set search_path = '' as $$
  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  select p_user, 'security_alert', p_title, p_body, jsonb_build_object('kind', p_kind) where p_user is not null;
$$;

create or replace function private.trg_auth_security() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(old.encrypted_password, '') <> '' and new.encrypted_password is distinct from old.encrypted_password then
    perform private.alert_user(new.id, 'Your password was changed', 'If this was not you, reset your password now and contact support.', 'password_changed');
  end if;
  if new.email is distinct from old.email and old.email is not null then
    perform private.alert_user(new.id, 'Your sign-in email was changed', 'The email on your account changed from ' || left(old.email, 2) || '***' || substring(old.email from '@.*$') || '. If this was not you, contact support.', 'email_changed');
  end if;
  if new.phone is distinct from old.phone and coalesce(old.phone, '') <> '' then
    perform private.alert_user(new.id, 'Your sign-in phone number was changed', 'If this was not you, contact support.', 'phone_changed');
  end if;
  return new;
end $$;
drop trigger if exists zz_security_alerts on auth.users;
create trigger zz_security_alerts after update of encrypted_password, email, phone on auth.users for each row execute function private.trg_auth_security();

create or replace function private.trg_profile_security() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.mobile_number is distinct from old.mobile_number and old.mobile_number is not null then
    perform private.alert_user(new.id, 'Your mobile number was changed', 'The mobile number on your profile was changed. If this was not you, contact support.', 'mobile_changed');
  end if;
  if new.account_status is distinct from old.account_status then
    perform private.alert_user(new.id, case when new.account_status in ('suspended', 'disabled') then 'Your account was ' || new.account_status else 'Your account status changed' end,
      'Account status is now ' || new.account_status || '.', 'account_status');
  end if;
  return new;
end $$;
drop trigger if exists zz_profile_security on public.profiles;
create trigger zz_profile_security after update of mobile_number, account_status on public.profiles for each row execute function private.trg_profile_security();

create or replace function private.trg_role_security() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.role::text ilike '%admin%' and (tg_op = 'INSERT' or new.is_active is distinct from old.is_active) then
    perform private.alert_user(new.user_id, case when new.is_active then 'You were given the ' || new.role::text || ' role' else 'Your ' || new.role::text || ' role was removed' end,
      'A platform-level role on your account changed. If you did not expect this, contact support.', 'admin_role');
  end if;
  return new;
end $$;
drop trigger if exists zz_role_security on public.user_role_assignments;
create trigger zz_role_security after insert or update of is_active on public.user_role_assignments for each row execute function private.trg_role_security();

create or replace function public.list_security_alerts() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  return jsonb_build_object('unread', (select count(*) from public.notifications where recipient_user_id = (select auth.uid()) and notification_type = 'security_alert' and read_at is null),
    'items', (select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'title', n.title, 'body', n.body, 'kind', n.payload ->> 'kind', 'created_at', n.created_at, 'read', n.read_at is not null) order by n.created_at desc), '[]'::jsonb)
                from (select * from public.notifications where recipient_user_id = (select auth.uid()) and notification_type = 'security_alert' order by created_at desc limit 30) n));
end $$;

create or replace function public.ack_security_alerts() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  update public.notifications set read_at = now() where recipient_user_id = (select auth.uid()) and notification_type = 'security_alert' and read_at is null;
  return public.list_security_alerts();
end $$;

-- ===== #397 Geotagged arrival check-in with consent =====
alter table public.match_arrivals add column if not exists geo_lat numeric(8, 5);
alter table public.match_arrivals add column if not exists geo_lng numeric(8, 5);
alter table public.match_arrivals add column if not exists geo_accuracy_m int;
alter table public.match_arrivals add column if not exists geo_distance_m int;
alter table public.match_arrivals add column if not exists geo_status text check (geo_status is null or geo_status in ('at_ground', 'away', 'no_ground_location'));
alter table public.match_arrivals add column if not exists geo_consent_at timestamptz;

create or replace function public.check_in_team_geo(p_match_id uuid, p_team_id uuid, p_geo jsonb, p_players int default null, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare lat numeric; lng numeric; acc int; g record; dist int; st text; m public.matches%rowtype;
begin
  if coalesce(p_geo ->> 'consent', '') <> 'true' then raise exception 'Location is only recorded if you agree to it.' using errcode = '22023'; end if;
  begin lat := (p_geo ->> 'lat')::numeric; lng := (p_geo ->> 'lng')::numeric; acc := coalesce(round((p_geo ->> 'accuracy')::numeric)::int, 0);
  exception when others then raise exception 'The location could not be read.' using errcode = '22023'; end;
  if lat is null or lng is null or lat < -90 or lat > 90 or lng < -180 or lng > 180 then raise exception 'The location could not be read.' using errcode = '22023'; end if;
  if acc < 0 or acc > 100000 then acc := 100000; end if;
  perform public.check_in_team(p_match_id, p_team_id, null, p_players, p_note);
  select * into m from public.matches where id = p_match_id;
  select latitude, longitude into g from public.grounds where id = m.ground_id;
  if g.latitude is null or g.longitude is null then st := 'no_ground_location'; dist := null;
  else
    dist := round(2 * 6371000 * asin(sqrt(power(sin(radians(g.latitude - lat) / 2), 2) + cos(radians(lat)) * cos(radians(g.latitude)) * power(sin(radians(g.longitude - lng) / 2), 2))))::int;
    st := case when dist <= 300 + least(acc, 500) then 'at_ground' else 'away' end;
  end if;
  update public.match_arrivals set geo_lat = round(lat, 5), geo_lng = round(lng, 5), geo_accuracy_m = acc, geo_distance_m = dist, geo_status = st, geo_consent_at = now()
   where match_id = p_match_id and team_id = p_team_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'ARRIVAL_LOCATION_CONSENT', 'matches', p_match_id::text, jsonb_build_object('team_id', p_team_id, 'status', st));
  return public.get_arrival_geo(p_match_id);
end $$;

create or replace function public.get_arrival_geo(p_match_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare m public.matches%rowtype; seeall boolean;
begin
  if (select auth.uid()) is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  select * into m from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found.' using errcode = '22023'; end if;
  seeall := private.is_match_official(p_match_id) or private.can_manage_match(p_match_id) or private.is_admin();
  return jsonb_build_object('items', (select coalesce(jsonb_agg(jsonb_build_object('team_id', a.team_id, 'team', t.name, 'status', a.geo_status, 'distance_m', a.geo_distance_m, 'accuracy_m', a.geo_accuracy_m,
            'at', a.geo_consent_at, 'can_clear', seeall or t.owner_id = (select auth.uid()) or a.checked_in_by = (select auth.uid()))) filter (where a.geo_status is not null and (seeall or t.owner_id = (select auth.uid()) or a.checked_in_by = (select auth.uid()))), '[]'::jsonb)
     from public.match_arrivals a join public.teams t on t.id = a.team_id where a.match_id = p_match_id));
end $$;

create or replace function public.clear_arrival_geo(p_match_id uuid, p_team_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  if not (private.can_check_in(p_match_id, p_team_id) or private.is_admin()) then raise exception 'Only the team owner, the match owner or a match official can remove this.' using errcode = '42501'; end if;
  update public.match_arrivals set geo_lat = null, geo_lng = null, geo_accuracy_m = null, geo_distance_m = null, geo_status = null, geo_consent_at = null where match_id = p_match_id and team_id = p_team_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'ARRIVAL_LOCATION_CLEARED', 'matches', p_match_id::text, jsonb_build_object('team_id', p_team_id));
  return public.get_arrival_geo(p_match_id);
end $$;

-- ===== #393 Notifications for lineup corrections =====
create or replace function private.notify_lineup_change(p_match uuid, p_team uuid, p_title text, p_body text) returns void
language plpgsql security definer set search_path = '' as $$
declare m public.matches%rowtype; actor uuid := (select auth.uid());
begin
  select * into m from public.matches where id = p_match;
  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  select distinct x.u, 'lineup_correction', p_title, p_body, jsonb_build_object('match_id', p_match, 'team_id', p_team)
    from (select owner_id u from public.teams where id in (m.team_a_id, m.team_b_id)
          union select m.created_by
          union select owner_id from public.tournaments where id = m.tournament_id
          union select p.profile_id from public.team_members tm join public.players p on p.id = tm.player_id where tm.team_id = p_team and (tm.is_captain or tm.is_vice_captain)
          union select mo.user_id from public.match_officials mo where mo.match_id = p_match and mo.status = 'accepted') x
   where x.u is not null and x.u is distinct from actor;
end $$;

create or replace function public.replace_match_player(p_match_id uuid, p_team_id uuid, p_out uuid, p_in uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare m public.matches%rowtype; outp record; other uuid; reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), ''); in_name text; out_name text;
begin
  m := private.require_lineup_editor(p_match_id, p_team_id);
  if m.status not in ('scheduled','live') then raise exception 'Replacements can only be made before or during the match.' using errcode = '22023'; end if;
  if reason is null then raise exception 'Give a reason for the replacement (e.g. injury).' using errcode = '22023'; end if;
  select * into outp from public.match_players where match_id = p_match_id and team_id = p_team_id and player_id = p_out and role = 'playing';
  if not found then raise exception 'The player going out must be in the playing side.' using errcode = '22023'; end if;
  if not exists (select 1 from public.team_members where team_id = p_team_id and player_id = p_in) then
    raise exception 'The new player must be in the team squad.' using errcode = '22023';
  end if;
  if exists (select 1 from public.match_players where match_id = p_match_id and player_id = p_in and role in ('playing','replaced')) then
    raise exception 'The new player has already played in this match.' using errcode = '22023';
  end if;
  other := case when m.team_a_id = p_team_id then m.team_b_id else m.team_a_id end;
  if exists (select 1 from public.match_players where match_id = p_match_id and team_id = other and player_id = p_in) then
    raise exception 'The new player is picked by the other team.' using errcode = '22023';
  end if;

  update public.match_players set role = 'replaced', replaced_at = now(), is_captain = false, is_wicket_keeper = false
   where match_id = p_match_id and player_id = p_out;
  insert into public.match_players (match_id, team_id, player_id, role, batting_order, is_captain, is_wicket_keeper,
                                    replaces_player_id, replacement_reason, replaced_at, selected_by)
  values (p_match_id, p_team_id, p_in, 'playing', outp.batting_order, outp.is_captain, outp.is_wicket_keeper,
          p_out, reason, now(), (select auth.uid()))
  on conflict (match_id, player_id) do update set role = 'playing', batting_order = excluded.batting_order,
     is_captain = excluded.is_captain, is_wicket_keeper = excluded.is_wicket_keeper,
     replaces_player_id = excluded.replaces_player_id, replacement_reason = excluded.replacement_reason,
     replaced_at = excluded.replaced_at, selected_by = excluded.selected_by;

  select display_name into in_name from public.players where id = p_in;
  select display_name into out_name from public.players where id = p_out;
  perform private.notify_lineup_change(p_match_id, p_team_id, 'Player replaced',
    (select name from public.teams where id = p_team_id) || ': ' || in_name || ' replaces ' || out_name || ' (' || reason || ').');
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'MATCH_PLAYER_REPLACED', 'teams', p_team_id::text,
          jsonb_build_object('match_id', p_match_id, 'out', p_out, 'in', p_in, 'reason', reason));
  return jsonb_build_object('in', p_in, 'out', p_out);
end $$;

create or replace function public.set_match_lineup(p_match_id uuid, p_team_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  m public.matches%rowtype; per_side int := 11; max_subs int := 4; playing uuid[]; subs uuid[]; cap uuid; wk uuid; other uuid; i int; why text; old_sig text; new_sig text;
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
  if m.tournament_id is not null then
    select string_agg(pl.display_name || ' is ' || r.reason, '; ') into why
      from unnest(playing || subs) x cross join lateral (select private.player_block_reason(m.tournament_id, p_team_id, x) as reason) r join public.players pl on pl.id = x where r.reason is not null;
    if why is not null then raise exception 'Not eligible: %.', why using errcode = '22023'; end if;
  end if;
  other := case when m.team_a_id = p_team_id then m.team_b_id else m.team_a_id end;
  if exists (select 1 from public.match_players where match_id = p_match_id and team_id = other and player_id = any (playing || subs)) then
    raise exception 'One of these players is already picked by the other team for this match.' using errcode = '22023';
  end if;
  if cap is not null and not cap = any (playing) then raise exception 'The captain must be in the playing side.' using errcode = '22023'; end if;
  if wk is not null and not wk = any (playing) then raise exception 'The wicket-keeper must be in the playing side.' using errcode = '22023'; end if;

  old_sig := private.lineup_signature(p_match_id, p_team_id);
  delete from public.match_players where match_id = p_match_id and team_id = p_team_id;
  for i in 1 .. pg_catalog.cardinality(playing) loop
    insert into public.match_players (match_id, team_id, player_id, role, batting_order, is_captain, is_wicket_keeper, selected_by)
    values (p_match_id, p_team_id, playing[i], 'playing', i, playing[i] = coalesce(cap, '00000000-0000-0000-0000-000000000000'::uuid),
            playing[i] = coalesce(wk, '00000000-0000-0000-0000-000000000000'::uuid), (select auth.uid()));
  end loop;
  insert into public.match_players (match_id, team_id, player_id, role, selected_by)
  select p_match_id, p_team_id, x, 'substitute', (select auth.uid()) from unnest(subs) x;

  new_sig := private.lineup_signature(p_match_id, p_team_id);
  if old_sig <> '' and old_sig <> new_sig then
    perform private.notify_lineup_change(p_match_id, p_team_id, 'Lineup changed',
      (select name from public.teams where id = p_team_id) || ' changed their lineup for ' || (select name from public.teams where id = m.team_a_id) || ' vs ' || (select name from public.teams where id = m.team_b_id) || '.');
  end if;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'MATCH_LINEUP_SET', 'teams', p_team_id::text,
          jsonb_build_object('match_id', p_match_id, 'playing', pg_catalog.cardinality(playing), 'substitutes', pg_catalog.cardinality(subs)));
  return jsonb_build_object('playing', pg_catalog.cardinality(playing), 'substitutes', pg_catalog.cardinality(subs));
end $$;

-- ===== grants =====
do $$ declare f text; begin
  foreach f in array array[
    'public.set_last_ball_pitch(uuid,int,int)', 'public.list_match_report_evidence(uuid)', 'public.add_match_report_evidence(uuid,text,text,text)',
    'public.get_tournament_security(uuid)', 'public.set_two_person_approval(uuid,boolean)', 'public.propose_ball_correction(uuid,bigint,jsonb,text)',
    'public.list_security_alerts()', 'public.ack_security_alerts()', 'public.check_in_team_geo(uuid,uuid,jsonb,int,text)', 'public.get_arrival_geo(uuid)', 'public.clear_arrival_geo(uuid,uuid)',
    'public.replace_match_player(uuid,uuid,uuid,uuid,text)', 'public.set_match_lineup(uuid,uuid,jsonb)']
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  foreach f in array array['public.get_pitch_map(uuid,int,uuid)', 'public.get_batter_vs_bowler(uuid,uuid)']
  loop
    execute format('revoke all on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;
end $$;
revoke all on function private.report_visible(uuid), private.two_person_on(uuid), private.enforce_two_person(), private.alert_user(uuid,text,text,text), private.trg_auth_security(),
  private.trg_profile_security(), private.trg_role_security(), private.notify_lineup_change(uuid,uuid,text,text) from public, anon, authenticated;
