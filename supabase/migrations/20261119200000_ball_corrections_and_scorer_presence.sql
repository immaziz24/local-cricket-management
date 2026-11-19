-- Batch 8: #315 #316 correct who batted / bowled a delivery, #317 recompute afterwards, #318 reason + approval workflow,
-- #319 immutable correction revisions, #320 scorer conflict detection across devices.

-- ---------- #319 immutable revisions ----------
create table if not exists public.ball_revisions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  ball_id bigint not null,           -- no foreign key: the history stays even if the ball is later undone
  innings_id uuid not null,
  seq integer not null,
  revision_no integer not null,
  before jsonb not null,
  after jsonb not null,
  reason text not null check (char_length(btrim(reason)) between 5 and 400),
  status text not null check (status in ('pending','applied','rejected')),
  requested_by uuid,
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now()
);
create index if not exists ball_revisions_match_idx on public.ball_revisions (match_id, created_at desc);
create index if not exists ball_revisions_ball_idx on public.ball_revisions (ball_id);
alter table public.ball_revisions enable row level security;

create or replace function private.ball_revisions_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.matches where id = old.match_id) then
      raise exception 'Correction history cannot be deleted.' using errcode = '42501';
    end if;
    return old;
  end if;
  if old.status <> 'pending' or new.status not in ('applied','rejected')
     or new.match_id <> old.match_id or new.ball_id <> old.ball_id or new.innings_id <> old.innings_id or new.seq <> old.seq
     or new.revision_no <> old.revision_no or new.before <> old.before or new.after <> old.after or new.reason <> old.reason
     or new.requested_by is distinct from old.requested_by or new.created_at <> old.created_at then
    raise exception 'Correction history cannot be changed.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists ball_revisions_immutable on public.ball_revisions;
create trigger ball_revisions_immutable before update or delete on public.ball_revisions for each row execute function private.ball_revisions_guard();
revoke all on function private.ball_revisions_guard() from public, anon, authenticated;

-- ---------- apply one revision (#317 recompute) ----------
create or replace function private.apply_ball_revision(p_rev uuid, p_actor uuid, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.ball_revisions%rowtype; b public.balls%rowtype; k text; cur jsonb;
begin
  select * into r from public.ball_revisions where id = p_rev for update;
  select * into b from public.balls where id = r.ball_id and match_id = r.match_id for update;
  if not found then raise exception 'That ball no longer exists (it was undone).' using errcode = '22023'; end if;
  cur := jsonb_build_object('striker_id', b.striker_id, 'non_striker_id', b.non_striker_id, 'bowler_id', b.bowler_id,
                            'fielder_id', b.fielder_id, 'dismissed_id', b.dismissed_id);
  for k in select jsonb_object_keys(r.before) loop
    if cur -> k is distinct from r.before -> k then
      raise exception 'This ball was changed after the correction was requested. Ask for it again.' using errcode = '22023';
    end if;
  end loop;
  update public.balls set
    striker_id = case when r.after ? 'striker_id' then nullif(r.after ->> 'striker_id', '')::uuid else striker_id end,
    non_striker_id = case when r.after ? 'non_striker_id' then nullif(r.after ->> 'non_striker_id', '')::uuid else non_striker_id end,
    bowler_id = case when r.after ? 'bowler_id' then nullif(r.after ->> 'bowler_id', '')::uuid else bowler_id end,
    fielder_id = case when r.after ? 'fielder_id' then nullif(r.after ->> 'fielder_id', '')::uuid else fielder_id end,
    dismissed_id = case when r.after ? 'dismissed_id' then nullif(r.after ->> 'dismissed_id', '')::uuid else dismissed_id end
   where id = b.id;
  perform private.admin_recompute_innings(b.innings_id);
  update public.ball_revisions set status = 'applied', decided_by = p_actor, decided_at = now(), decision_note = nullif(btrim(coalesce(p_note, '')), '') where id = r.id and status = 'pending';
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (p_actor, 'BALL_ATTRIBUTION_CORRECTED', 'matches', r.match_id::text,
          jsonb_build_object('match_id', r.match_id, 'seq', r.seq, 'revision', r.revision_no, 'before', r.before, 'after', r.after, 'reason', r.reason));
end;
$$;
revoke all on function private.apply_ball_revision(uuid, uuid, text) from public, anon, authenticated;

create or replace function public.list_ball_revisions(p_match_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  if not private.is_match_official(p_match_id) then raise exception 'Only the match scorers and organisers can see corrections.' using errcode = '42501'; end if;
  return jsonb_build_object('can_decide', private.can_manage_match(p_match_id), 'items', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id, 'seq', r.seq, 'revision_no', r.revision_no, 'status', r.status, 'reason', r.reason, 'created_at', r.created_at,
      'decided_at', r.decided_at, 'decision_note', r.decision_note,
      'over', (select b.over_no || '.' || b.ball_in_over from public.balls b where b.id = r.ball_id),
      'innings_no', (select i.innings_no from public.innings i where i.id = r.innings_id),
      'requested_by', (select p.display_name from public.profiles p where p.id = r.requested_by),
      'decided_by', (select p.display_name from public.profiles p where p.id = r.decided_by),
      'changes', coalesce((select jsonb_agg(jsonb_build_object('field', e.key,
          'before', (select pl.display_name from public.players pl where pl.id = nullif(r.before ->> e.key, '')::uuid),
          'after', (select pl.display_name from public.players pl where pl.id = nullif(e.value, '')::uuid)))
        from jsonb_each_text(r.after) e), '[]'::jsonb)) order by r.created_at desc)
    from public.ball_revisions r where r.match_id = p_match_id), '[]'::jsonb));
end;
$$;

-- ---------- #315 #316 #318 propose (or apply) a correction ----------
create or replace function public.propose_ball_correction(p_match_id uuid, p_ball_id bigint, p_changes jsonb, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
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
  manager := private.can_manage_match(p_match_id);
  insert into public.ball_revisions (match_id, ball_id, innings_id, seq, revision_no, before, after, reason, status, requested_by)
  values (p_match_id, b.id, b.innings_id, b.seq, rno, bef, aft, btrim(p_reason), 'pending', uid) returning id into rid;
  if manager then
    perform private.apply_ball_revision(rid, uid);
  elsif m.created_by is not null and m.created_by <> uid then
    insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
    values (m.created_by, 'score_correction', 'Score correction waiting', 'A scorer asked to correct who played a ball. Open the match History to approve or reject.', jsonb_build_object('match_id', p_match_id, 'revision_id', rid));
  end if;
  return public.list_ball_revisions(p_match_id);
end;
$$;

create or replace function public.decide_ball_correction(p_revision_id uuid, p_approve boolean, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.ball_revisions%rowtype; uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  select * into r from public.ball_revisions where id = p_revision_id for update;
  if not found then raise exception 'Correction not found.' using errcode = '22023'; end if;
  if not private.can_manage_match(r.match_id) then raise exception 'Only the match creator or tournament organiser can approve corrections.' using errcode = '42501'; end if;
  if r.status <> 'pending' then raise exception 'This correction was already decided.' using errcode = '22023'; end if;
  if p_approve then
    perform private.apply_ball_revision(r.id, uid, p_note);
  else
    update public.ball_revisions set status = 'rejected', decided_by = uid, decided_at = now(), decision_note = nullif(btrim(coalesce(p_note, '')), '') where id = r.id;
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
    values (uid, 'BALL_CORRECTION_REJECTED', 'matches', r.match_id::text, jsonb_build_object('match_id', r.match_id, 'seq', r.seq, 'revision', r.revision_no, 'note', p_note));
  end if;
  if r.requested_by is not null and r.requested_by <> uid then
    insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
    values (r.requested_by, 'score_correction', case when p_approve then 'Correction approved' else 'Correction rejected' end,
            case when p_approve then 'Your score correction was approved and applied.' else 'Your score correction was rejected.' end || coalesce(' Note: ' || nullif(btrim(coalesce(p_note, '')), ''), ''),
            jsonb_build_object('match_id', r.match_id, 'revision_id', r.id));
  end if;
  return public.list_ball_revisions(r.match_id);
end;
$$;

-- ---------- #320 two scorers on one match ----------
create table if not exists public.scoring_presence (
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null,
  device_id text not null,
  last_seen timestamptz not null default now(),
  primary key (match_id, user_id, device_id)
);
alter table public.scoring_presence enable row level security;

create or replace function public.scoring_heartbeat(p_match_id uuid, p_device_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); dev text := pg_catalog.left(btrim(coalesce(p_device_id, '')), 64);
begin
  if uid is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  if dev = '' then raise exception 'Missing device id.' using errcode = '22023'; end if;
  if not private.can_score_match(p_match_id) then raise exception 'You cannot score this match.' using errcode = '42501'; end if;
  insert into public.scoring_presence (match_id, user_id, device_id, last_seen) values (p_match_id, uid, dev, now())
  on conflict (match_id, user_id, device_id) do update set last_seen = now();
  delete from public.scoring_presence where match_id = p_match_id and last_seen < now() - interval '15 minutes';
  return jsonb_build_object('others', coalesce((
    select jsonb_agg(jsonb_build_object('user_id', s.user_id, 'name', coalesce(p.display_name, 'Another scorer'), 'same_user', s.user_id = uid,
                                        'seconds_ago', extract(epoch from (now() - s.last_seen))::int))
      from public.scoring_presence s left join public.profiles p on p.id = s.user_id
     where s.match_id = p_match_id and s.last_seen > now() - interval '45 seconds' and not (s.user_id = uid and s.device_id = dev)), '[]'::jsonb));
end;
$$;

do $$
declare f text;
begin
  foreach f in array array['public.list_ball_revisions(uuid)', 'public.propose_ball_correction(uuid,bigint,jsonb,text)',
    'public.decide_ball_correction(uuid,boolean,text)', 'public.scoring_heartbeat(uuid,text)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
