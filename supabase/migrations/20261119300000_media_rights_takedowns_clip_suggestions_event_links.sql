-- Batch 14 part A (media): #375 media rights and upload permissions, #373 automatic highlight clip suggestion,
--                          #374 video-to-score event linking.

-- ---------- #375 rights, upload policy, takedowns ----------
alter table public.tournaments add column if not exists media_policy jsonb not null default '{"upload_who":"participants","require_rights":false}'::jsonb;

do $$
declare c text;
begin
  select conname into c from pg_constraint where conrelid = 'public.media_items'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%visible%';
  if c is not null then execute format('alter table public.media_items drop constraint %I', c); end if;
end $$;
alter table public.media_items add constraint media_items_status_check check (status in ('visible', 'hidden', 'pending_rights'));
alter table public.media_items add column if not exists takedown_at timestamptz;
alter table public.media_items add column if not exists started_at timestamptz;
alter table public.media_items add column if not exists link_delay_s smallint not null default 0 check (link_delay_s between -120 and 600);

create table if not exists public.media_rights (
  media_id uuid primary key references public.media_items(id) on delete cascade,
  holder text not null check (char_length(btrim(holder)) between 2 and 120),
  licence text not null check (licence in ('own_work', 'permission', 'public_licence')),
  people text not null check (people in ('none', 'consented', 'unsure')),
  allow_reuse boolean not null default false,
  declared_by uuid not null,
  declared_at timestamptz not null default now()
);
alter table public.media_rights enable row level security;

create table if not exists public.media_takedowns (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references public.media_items(id) on delete cascade,
  requester_id uuid not null,
  reason text not null check (char_length(btrim(reason)) between 10 and 1000),
  status text not null default 'open' check (status in ('open', 'removed', 'kept')),
  decided_by uuid,
  decided_at timestamptz,
  decision_note text check (decision_note is null or char_length(decision_note) <= 1000),
  created_at timestamptz not null default now()
);
create unique index if not exists media_takedowns_one_open on public.media_takedowns (media_id, requester_id) where status = 'open';
create index if not exists media_takedowns_media_idx on public.media_takedowns (media_id, created_at desc);
alter table public.media_takedowns enable row level security;

-- Who is in charge of a scope (for notifications).
create or replace function private.media_moderators(p_scope text, p_scope_id uuid) returns setof uuid language sql stable security definer set search_path = '' as $$
  select x from (
    select case p_scope
      when 'tournament' then (select owner_id from public.tournaments where id = p_scope_id)
      when 'match' then (select created_by from public.matches where id = p_scope_id)
      else (select coalesce(profile_id, created_by) from public.players where id = p_scope_id) end as x
    union
    select (select t.owner_id from public.matches m join public.tournaments t on t.id = m.tournament_id where m.id = p_scope_id and p_scope = 'match')
  ) q where x is not null;
$$;
revoke all on function private.media_moderators(text, uuid) from public, anon, authenticated;

-- Upload policy and "rights first" gate, applied to every insert (also through add_media).
create or replace function private.media_policy_gate() returns trigger language plpgsql security definer set search_path = '' as $$
declare tid uuid; pol jsonb; who text; uid uuid := (select auth.uid());
begin
  tid := case new.scope when 'tournament' then new.scope_id when 'match' then (select tournament_id from public.matches where id = new.scope_id) else null end;
  if tid is null then return new; end if;
  select media_policy into pol from public.tournaments where id = tid;
  if pol is null then return new; end if;
  who := coalesce(pol ->> 'upload_who', 'participants');
  if new.kind <> 'stream' and who <> 'participants' and uid is not null then
    if not private.can_moderate_media(new.scope, new.scope_id)
       and not (who = 'organisers_officials' and new.scope = 'match' and private.is_match_official(new.scope_id)) then
      raise exception '%', case who when 'organiser_only' then 'The organiser has limited uploads for this tournament to the organiser.'
                                    else 'The organiser has limited uploads for this tournament to the organiser and match officials.' end using errcode = '42501';
    end if;
  end if;
  if coalesce((pol ->> 'require_rights')::boolean, false) and new.kind in ('photo', 'video', 'highlight') then new.status := 'pending_rights'; end if;
  return new;
end;
$$;
revoke all on function private.media_policy_gate() from public, anon, authenticated;
drop trigger if exists media_policy_gate on public.media_items;
create trigger media_policy_gate before insert on public.media_items for each row execute function private.media_policy_gate();

-- An item waiting for rights, or taken down, cannot be switched back to visible by its uploader.
create or replace function private.media_status_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'visible' and old.status = 'pending_rights' and not exists (select 1 from public.media_rights r where r.media_id = new.id and r.people <> 'unsure') then
    new.status := 'pending_rights';
  end if;
  if new.status = 'visible' and old.takedown_at is not null and not (private.can_moderate_media(new.scope, new.scope_id) or private.is_admin()) then
    new.status := 'hidden';
  end if;
  new.takedown_at := old.takedown_at;
  return new;
end;
$$;
revoke all on function private.media_status_guard() from public, anon, authenticated;
drop trigger if exists media_status_guard on public.media_items;
create trigger media_status_guard before update on public.media_items for each row execute function private.media_status_guard();

create or replace function public.get_media_policy(p_tournament_id uuid) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('upload_who', coalesce(media_policy ->> 'upload_who', 'participants'), 'require_rights', coalesce((media_policy ->> 'require_rights')::boolean, false),
                            'can_edit', private.is_tournament_organiser(id))
    from public.tournaments where id = p_tournament_id;
$$;

create or replace function public.set_media_policy(p_tournament_id uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_active_user(); who text := coalesce(p ->> 'upload_who', 'participants'); req boolean := coalesce((p ->> 'require_rights')::boolean, false);
begin
  perform private.require_tournament_organiser(p_tournament_id);
  if who not in ('participants', 'organisers_officials', 'organiser_only') then raise exception 'Choose who may upload.' using errcode = '22023'; end if;
  update public.tournaments set media_policy = jsonb_build_object('upload_who', who, 'require_rights', req), updated_at = now() where id = p_tournament_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, 'MEDIA_POLICY_SET', 'tournaments', p_tournament_id::text, jsonb_build_object('upload_who', who, 'require_rights', req));
  return public.get_media_policy(p_tournament_id);
end;
$$;

create or replace function public.declare_media_rights(p_media_id uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_active_user(); mi public.media_items; h text := btrim(coalesce(p ->> 'holder', '')); lic text := p ->> 'licence'; ppl text := coalesce(p ->> 'people', 'none');
begin
  select * into mi from public.media_items where id = p_media_id for update;
  if not found then raise exception 'Media not found.' using errcode = '22023'; end if;
  if mi.uploader_id <> uid and not private.can_moderate_media(mi.scope, mi.scope_id) then raise exception 'Only the person who added it or the organiser can declare its rights.' using errcode = '42501'; end if;
  if char_length(h) < 2 or char_length(h) > 120 then raise exception 'Say who owns the photo or video (2 to 120 characters).' using errcode = '22023'; end if;
  if lic not in ('own_work', 'permission', 'public_licence') then raise exception 'Choose how you may use it.' using errcode = '22023'; end if;
  if ppl not in ('none', 'consented', 'unsure') then raise exception 'Say whether people in it have agreed.' using errcode = '22023'; end if;
  if coalesce((p ->> 'confirmed')::boolean, false) is not true then raise exception 'Tick the box to confirm that what you say is true.' using errcode = '22023'; end if;
  insert into public.media_rights (media_id, holder, licence, people, allow_reuse, declared_by)
  values (mi.id, h, lic, ppl, coalesce((p ->> 'allow_reuse')::boolean, false), uid)
  on conflict (media_id) do update set holder = excluded.holder, licence = excluded.licence, people = excluded.people, allow_reuse = excluded.allow_reuse, declared_by = excluded.declared_by, declared_at = now();
  if mi.status = 'pending_rights' and ppl <> 'unsure' then update public.media_items set status = 'visible', updated_at = now() where id = mi.id returning * into mi; end if;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, 'MEDIA_RIGHTS_DECLARED', 'media_items', mi.id::text, jsonb_build_object('licence', lic, 'people', ppl, 'allow_reuse', coalesce((p ->> 'allow_reuse')::boolean, false)));
  return jsonb_build_object('media', private.media_json(mi), 'waiting', mi.status = 'pending_rights');
end;
$$;

create or replace function public.get_media_rights(p_media_id uuid) returns jsonb language sql stable security definer set search_path = '' as $$
  select case when r.media_id is null then null else jsonb_build_object('holder', r.holder, 'licence', r.licence, 'allow_reuse', r.allow_reuse, 'declared_at', r.declared_at,
           'people', case when mi.uploader_id = (select auth.uid()) or private.can_moderate_media(mi.scope, mi.scope_id) then r.people end) end
    from public.media_items mi left join public.media_rights r on r.media_id = mi.id
   where mi.id = p_media_id and (mi.status = 'visible' or mi.uploader_id = (select auth.uid()) or private.can_moderate_media(mi.scope, mi.scope_id));
$$;

create or replace function public.request_media_takedown(p_media_id uuid, p_reason text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_active_user(); mi public.media_items; why text := btrim(coalesce(p_reason, ''));
begin
  select * into mi from public.media_items where id = p_media_id;
  if not found or mi.status <> 'visible' then raise exception 'Media not found.' using errcode = '22023'; end if;
  if mi.uploader_id = uid then raise exception 'You added this yourself. Delete or hide it instead.' using errcode = '22023'; end if;
  if char_length(why) < 10 or char_length(why) > 1000 then raise exception 'Say why it should be removed (10 to 1000 characters).' using errcode = '22023'; end if;
  if (select count(*) from public.media_takedowns where requester_id = uid and created_at > now() - interval '1 day') >= 5 then raise exception 'You can send 5 removal requests a day.' using errcode = '22023'; end if;
  begin
    insert into public.media_takedowns (media_id, requester_id, reason) values (mi.id, uid, why);
  exception when unique_violation then raise exception 'You have already asked for this to be removed.' using errcode = '22023'; end;
  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  select distinct u, 'media_takedown', 'Someone asked to remove a photo or video', why, jsonb_build_object('media_id', mi.id, 'scope', mi.scope, 'scope_id', mi.scope_id)
    from (select mi.uploader_id as u union select private.media_moderators(mi.scope, mi.scope_id)) x where u is not null and u <> uid;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata) values (uid, 'MEDIA_TAKEDOWN_REQUESTED', 'media_items', mi.id::text, jsonb_build_object('reason', why));
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.list_media_takedowns(p_scope text, p_scope_id uuid, p_status text default 'open') returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_moderate_media(p_scope, p_scope_id) then raise exception 'Only the organiser can see removal requests.' using errcode = '42501'; end if;
  if p_status not in ('open', 'removed', 'kept') then raise exception 'Unknown status.' using errcode = '22023'; end if;
  return jsonb_build_object('items', coalesce((
    select jsonb_agg(jsonb_build_object('id', d.id, 'media_id', mi.id, 'kind', mi.kind, 'title', mi.title, 'url', mi.url, 'reason', d.reason, 'status', d.status,
             'by', (select display_name from public.profiles where id = d.requester_id), 'uploader', (select display_name from public.profiles where id = mi.uploader_id),
             'created_at', d.created_at, 'decision_note', d.decision_note) order by d.created_at desc)
      from public.media_takedowns d join public.media_items mi on mi.id = d.media_id
     where mi.scope = p_scope and mi.scope_id = p_scope_id and d.status = p_status), '[]'::jsonb));
end;
$$;

create or replace function public.decide_media_takedown(p_id uuid, p_remove boolean, p_note text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_active_user(); d public.media_takedowns; mi public.media_items; nt text := btrim(coalesce(p_note, ''));
begin
  select * into d from public.media_takedowns where id = p_id for update;
  if not found then raise exception 'Request not found.' using errcode = '22023'; end if;
  select * into mi from public.media_items where id = d.media_id for update;
  if not (private.can_moderate_media(mi.scope, mi.scope_id) or private.is_admin()) then raise exception 'Only the organiser can decide.' using errcode = '42501'; end if;
  if d.status <> 'open' then raise exception 'This request was already decided.' using errcode = '22023'; end if;
  if char_length(nt) < 5 or char_length(nt) > 1000 then raise exception 'Write the reason for your decision (5 to 1000 characters).' using errcode = '22023'; end if;
  update public.media_takedowns set status = case when p_remove then 'removed' else 'kept' end, decided_by = uid, decided_at = now(), decision_note = nt where id = d.id;
  if p_remove then update public.media_items set status = 'hidden', takedown_at = now(), updated_at = now() where id = mi.id; end if;
  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  select distinct u, 'media_takedown', case when p_remove then 'Photo or video removed' else 'Removal request declined' end, nt, jsonb_build_object('media_id', mi.id)
    from (select d.requester_id as u union select mi.uploader_id) x where u is not null and u <> uid;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, case when p_remove then 'MEDIA_TAKEDOWN_REMOVED' else 'MEDIA_TAKEDOWN_KEPT' end, 'media_items', mi.id::text, jsonb_build_object('note', nt));
  return public.list_media_takedowns(mi.scope, mi.scope_id, 'open');
end;
$$;

-- ---------- moments picked from the ball-by-ball record (shared by #373 and #374) ----------
create or replace function private.match_moments(p_match_id uuid)
returns table (ball_id bigint, seq integer, innings_no integer, over_no integer, ball_in_over integer, kind text, label text, score integer, at timestamptz)
language sql stable security definer set search_path = '' as $$
  with w as (
    select bl.id, bl.seq, bl.over_no, bl.ball_in_over, bl.created_at, bl.is_wicket, bl.wicket_type, bl.striker_id, bl.bowler_id, bl.dismissed_id, i.innings_no, i.overs_limit,
           case when bl.extra_type in ('wide', 'bye', 'leg_bye') then 0 else coalesce(bl.runs_bat, 0) end as off,
           sum(case when bl.extra_type in ('wide', 'bye', 'leg_bye') then 0 else coalesce(bl.runs_bat, 0) end) over (partition by bl.innings_id, bl.striker_id order by bl.seq) as cum,
           count(*) filter (where bl.is_wicket and coalesce(bl.wicket_type, '') in ('bowled', 'caught', 'lbw', 'stumped', 'hit_wicket', 'caught_and_bowled'))
             over (partition by bl.innings_id, bl.bowler_id order by bl.seq) as bw,
           max(bl.seq) over (partition by bl.match_id) as last_seq
      from public.balls bl join public.innings i on i.id = bl.innings_id
     where bl.match_id = p_match_id and not i.is_super_over),
  x as (
    select w.*, w.cum - w.off as prev_cum,
           (select display_name from public.players where id = w.striker_id) as bat, (select display_name from public.players where id = w.bowler_id) as bowl,
           (select display_name from public.players where id = w.dismissed_id) as out_name,
           (case when w.innings_no >= 2 and w.overs_limit is not null and w.over_no >= w.overs_limit - 1 then 2 else 0 end) + (case when w.seq = w.last_seq then 3 else 0 end) as bonus
      from w)
  select x.id, x.seq, x.innings_no, x.over_no, x.ball_in_over, 'wicket'::text, ('Wicket: ' || coalesce(x.out_name, x.bat, 'batter') || ' ' || replace(coalesce(x.wicket_type, 'out'), '_', ' ') || coalesce(' (b ' || x.bowl || ')', ''))::text, 5 + x.bonus, x.created_at from x where x.is_wicket
  union all select x.id, x.seq, x.innings_no, x.over_no, x.ball_in_over, 'six'::text, ('Six by ' || coalesce(x.bat, 'batter'))::text, 4 + x.bonus, x.created_at from x where x.off = 6 and not x.is_wicket
  union all select x.id, x.seq, x.innings_no, x.over_no, x.ball_in_over, 'four'::text, ('Four by ' || coalesce(x.bat, 'batter'))::text, 2 + x.bonus, x.created_at from x where x.off = 4 and not x.is_wicket
  union all select x.id, x.seq, x.innings_no, x.over_no, x.ball_in_over, 'fifty'::text, (coalesce(x.bat, 'Batter') || ' reaches 50')::text, 6 + x.bonus, x.created_at from x where x.prev_cum < 50 and x.cum >= 50
  union all select x.id, x.seq, x.innings_no, x.over_no, x.ball_in_over, 'hundred'::text, (coalesce(x.bat, 'Batter') || ' reaches 100')::text, 10 + x.bonus, x.created_at from x where x.prev_cum < 100 and x.cum >= 100
  union all select x.id, x.seq, x.innings_no, x.over_no, x.ball_in_over, 'haul'::text, (coalesce(x.bowl, 'Bowler') || ' takes ' || x.bw || ' wickets')::text, 6 + x.bonus, x.created_at
    from x where x.is_wicket and x.bw in (3, 5) and coalesce(x.wicket_type, '') in ('bowled', 'caught', 'lbw', 'stumped', 'hit_wicket', 'caught_and_bowled');
$$;
revoke all on function private.match_moments(uuid) from public, anon, authenticated;

create or replace function private.can_edit_media_timing(p_media_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.media_items mi where mi.id = p_media_id and mi.scope = 'match' and mi.kind in ('video', 'highlight', 'stream')
                   and ((select auth.uid()) is not null and (mi.uploader_id = (select auth.uid()) or private.can_moderate_media(mi.scope, mi.scope_id))));
$$;
revoke all on function private.can_edit_media_timing(uuid) from public, anon, authenticated;

-- ---------- #374 links between a video and the score ----------
create table if not exists public.media_event_links (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references public.media_items(id) on delete cascade,
  ball_id bigint not null references public.balls(id) on delete cascade,
  kind text not null default 'moment' check (kind in ('moment', 'clip')),
  offset_s integer not null check (offset_s between 0 and 43200),
  clip_start_s integer check (clip_start_s is null or clip_start_s between 0 and 43200),
  clip_end_s integer check (clip_end_s is null or clip_end_s between 0 and 43200),
  title text check (title is null or char_length(title) <= 120),
  auto boolean not null default false,
  linked_by uuid not null,
  created_at timestamptz not null default now(),
  unique (media_id, ball_id, kind),
  check (clip_end_s is null or clip_start_s is null or (clip_end_s > clip_start_s and clip_end_s - clip_start_s <= 120))
);
create index if not exists media_event_links_media_idx on public.media_event_links (media_id, offset_s);
alter table public.media_event_links enable row level security;

create or replace function public.set_media_timing(p_media_id uuid, p_started_at timestamptz, p_delay_s integer default 0) returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_active_user(); mi public.media_items;
begin
  if not private.can_edit_media_timing(p_media_id) then raise exception 'Only the person who added this video or the organiser can set its start time.' using errcode = '42501'; end if;
  if p_started_at is null or p_started_at > now() + interval '1 hour' or p_started_at < now() - interval '90 days' then raise exception 'Enter the date and time when the video started.' using errcode = '22023'; end if;
  if p_delay_s is null or p_delay_s < -120 or p_delay_s > 600 then raise exception 'The scoring delay must be between -120 and 600 seconds.' using errcode = '22023'; end if;
  update public.media_items set started_at = p_started_at, link_delay_s = p_delay_s, updated_at = now() where id = p_media_id returning * into mi;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata) values (uid, 'MEDIA_TIMING_SET', 'media_items', mi.id::text, jsonb_build_object('started_at', p_started_at, 'delay_s', p_delay_s));
  return private.media_json(mi);
end;
$$;

create or replace function public.auto_link_media(p_media_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_active_user(); mi public.media_items; n int;
begin
  if not private.can_edit_media_timing(p_media_id) then raise exception 'Only the person who added this video or the organiser can link it to the score.' using errcode = '42501'; end if;
  select * into mi from public.media_items where id = p_media_id for update;
  if mi.started_at is null then raise exception 'Say when the video started first.' using errcode = '22023'; end if;
  delete from public.media_event_links where media_id = mi.id and kind = 'moment' and auto;
  insert into public.media_event_links (media_id, ball_id, kind, offset_s, title, auto, linked_by)
  select mi.id, q.ball_id, 'moment', q.off, q.label, true, uid
    from (select distinct on (m.ball_id) m.ball_id, m.label, round(extract(epoch from (m.at - mi.started_at)) - mi.link_delay_s)::int as off
            from private.match_moments(mi.scope_id) m order by m.ball_id, m.score desc) q
   where q.off between 0 and 43200
  on conflict (media_id, ball_id, kind) do nothing;
  get diagnostics n = row_count;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata) values (uid, 'MEDIA_AUTO_LINKED', 'media_items', mi.id::text, jsonb_build_object('links', n));
  return public.list_media_event_links(mi.id);
end;
$$;

create or replace function public.link_media_event(p_media_id uuid, p_ball_id bigint, p_offset_s integer, p_title text default null) returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_active_user(); mi public.media_items; ttl text := nullif(btrim(coalesce(p_title, '')), '');
begin
  if not private.can_edit_media_timing(p_media_id) then raise exception 'Only the person who added this video or the organiser can link it to the score.' using errcode = '42501'; end if;
  select * into mi from public.media_items where id = p_media_id;
  if not exists (select 1 from public.balls where id = p_ball_id and match_id = mi.scope_id) then raise exception 'That ball is not from this match.' using errcode = '22023'; end if;
  if p_offset_s is null or p_offset_s < 0 or p_offset_s > 43200 then raise exception 'The time in the video must be between 0 seconds and 12 hours.' using errcode = '22023'; end if;
  if ttl is not null and char_length(ttl) > 120 then raise exception 'The title can be at most 120 characters.' using errcode = '22023'; end if;
  if (select count(*) from public.media_event_links where media_id = mi.id) >= 300 then raise exception 'This video already has 300 links.' using errcode = '22023'; end if;
  insert into public.media_event_links (media_id, ball_id, kind, offset_s, title, auto, linked_by) values (mi.id, p_ball_id, 'moment', p_offset_s, ttl, false, uid)
  on conflict (media_id, ball_id, kind) do update set offset_s = excluded.offset_s, title = excluded.title, auto = false, linked_by = uid;
  return public.list_media_event_links(mi.id);
end;
$$;

create or replace function public.unlink_media_event(p_link_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare l public.media_event_links;
begin
  select * into l from public.media_event_links where id = p_link_id;
  if not found or not private.can_edit_media_timing(l.media_id) then raise exception 'Link not found.' using errcode = '22023'; end if;
  delete from public.media_event_links where id = l.id;
  return public.list_media_event_links(l.media_id);
end;
$$;

create or replace function public.list_media_event_links(p_media_id uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare mi public.media_items;
begin
  select * into mi from public.media_items where id = p_media_id;
  if not found or mi.scope <> 'match' then return jsonb_build_object('items', '[]'::jsonb, 'can_edit', false); end if;
  if mi.status <> 'visible' and mi.uploader_id is distinct from (select auth.uid()) and not private.can_moderate_media(mi.scope, mi.scope_id) then
    return jsonb_build_object('items', '[]'::jsonb, 'can_edit', false);
  end if;
  return jsonb_build_object('can_edit', private.can_edit_media_timing(mi.id), 'started_at', mi.started_at, 'link_delay_s', mi.link_delay_s,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('id', l.id, 'ball_id', l.ball_id, 'kind', l.kind, 'offset_s', l.offset_s, 'clip_start_s', l.clip_start_s, 'clip_end_s', l.clip_end_s, 'auto', l.auto,
               'innings_no', i.innings_no, 'over', b.over_no || '.' || b.ball_in_over,
               'label', coalesce(l.title, mm.label, 'Over ' || b.over_no || '.' || b.ball_in_over)) order by coalesce(l.clip_start_s, l.offset_s), l.created_at)
        from public.media_event_links l join public.balls b on b.id = l.ball_id join public.innings i on i.id = b.innings_id
        left join (select distinct on (m.ball_id) m.ball_id, m.label from private.match_moments(mi.scope_id) m order by m.ball_id, m.score desc) mm on mm.ball_id = l.ball_id
       where l.media_id = mi.id), '[]'::jsonb));
end;
$$;

-- ---------- #373 suggested highlight clips ----------
create or replace function public.suggest_highlight_clips(p_match_id uuid, p_media_id uuid default null, p_limit integer default 8) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  mi public.media_items; r record; lim int := greatest(least(coalesce(p_limit, 8), 20), 1); n int := 0; kept_i int[] := '{}'; kept_s int[] := '{}';
  res jsonb := '[]'::jsonb; off numeric; pre int; post int; s_start int; s_end int;
begin
  if (select auth.uid()) is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  if not exists (select 1 from public.matches where id = p_match_id) then raise exception 'Match not found.' using errcode = '22023'; end if;
  if not (private.can_add_media('match', p_match_id, 'video') or private.can_moderate_media('match', p_match_id)) then raise exception 'Only people who can add media to this match can see suggestions.' using errcode = '42501'; end if;
  if p_media_id is not null then
    select * into mi from public.media_items where id = p_media_id;
    if not found or mi.scope <> 'match' or mi.scope_id <> p_match_id then raise exception 'That video is not from this match.' using errcode = '22023'; end if;
  end if;
  for r in select * from private.match_moments(p_match_id) order by score desc, seq loop
    exit when n >= lim;
    if exists (select 1 from unnest(kept_i, kept_s) as k(i, s) where k.i = r.innings_no and abs(k.s - r.seq) <= 6) then continue; end if;
    kept_i := kept_i || r.innings_no; kept_s := kept_s || r.seq; n := n + 1;
    pre := case when r.kind = 'wicket' then 12 when r.kind in ('six', 'four') then 8 else 10 end;
    post := case when r.kind in ('six', 'four') then 14 else 20 end;
    s_start := null; s_end := null;
    if mi.started_at is not null then
      off := extract(epoch from (r.at - mi.started_at)) - mi.link_delay_s;
      if off >= 0 and off <= 43200 then s_start := greatest(round(off) - pre, 0)::int; s_end := (round(off) + post)::int; end if;
    end if;
    res := res || jsonb_build_object('ball_id', r.ball_id, 'seq', r.seq, 'innings_no', r.innings_no, 'over', r.over_no || '.' || r.ball_in_over, 'kind', r.kind, 'label', r.label,
             'score', r.score, 'start_s', s_start, 'end_s', s_end,
             'already', p_media_id is not null and exists (select 1 from public.media_event_links l where l.media_id = p_media_id and l.ball_id = r.ball_id and l.kind = 'clip'));
  end loop;
  return jsonb_build_object('started_at', mi.started_at, 'link_delay_s', mi.link_delay_s,
    'items', coalesce((select jsonb_agg(e order by (e ->> 'seq')::int) from jsonb_array_elements(res) e), '[]'::jsonb));
end;
$$;

create or replace function public.accept_clip_suggestion(p_media_id uuid, p_ball_id bigint, p_start_s integer, p_end_s integer, p_title text default null) returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_active_user(); mi public.media_items; ttl text := nullif(btrim(coalesce(p_title, '')), '');
begin
  if not private.can_edit_media_timing(p_media_id) then raise exception 'Only the person who added this video or the organiser can save clips.' using errcode = '42501'; end if;
  select * into mi from public.media_items where id = p_media_id;
  if not exists (select 1 from public.balls where id = p_ball_id and match_id = mi.scope_id) then raise exception 'That ball is not from this match.' using errcode = '22023'; end if;
  if p_start_s is null or p_end_s is null or p_start_s < 0 or p_end_s <= p_start_s then raise exception 'The clip must end after it starts.' using errcode = '22023'; end if;
  if p_end_s - p_start_s > 120 then raise exception 'A clip can be at most 2 minutes long.' using errcode = '22023'; end if;
  if ttl is not null and char_length(ttl) > 120 then raise exception 'The title can be at most 120 characters.' using errcode = '22023'; end if;
  if (select count(*) from public.media_event_links where media_id = mi.id) >= 300 then raise exception 'This video already has 300 links.' using errcode = '22023'; end if;
  insert into public.media_event_links (media_id, ball_id, kind, offset_s, clip_start_s, clip_end_s, title, auto, linked_by)
  values (mi.id, p_ball_id, 'clip', p_start_s, p_start_s, p_end_s, ttl, false, uid)
  on conflict (media_id, ball_id, kind) do update set offset_s = excluded.offset_s, clip_start_s = excluded.clip_start_s, clip_end_s = excluded.clip_end_s, title = excluded.title, linked_by = uid;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata) values (uid, 'MEDIA_CLIP_SAVED', 'media_items', mi.id::text, jsonb_build_object('ball_id', p_ball_id, 'start_s', p_start_s, 'end_s', p_end_s));
  return public.list_media_event_links(mi.id);
end;
$$;

do $$
declare f text;
begin
  foreach f in array array['public.set_media_policy(uuid,jsonb)', 'public.declare_media_rights(uuid,jsonb)', 'public.request_media_takedown(uuid,text)', 'public.list_media_takedowns(text,uuid,text)',
    'public.decide_media_takedown(uuid,boolean,text)', 'public.set_media_timing(uuid,timestamptz,integer)', 'public.auto_link_media(uuid)', 'public.link_media_event(uuid,bigint,integer,text)',
    'public.unlink_media_event(uuid)', 'public.suggest_highlight_clips(uuid,uuid,integer)', 'public.accept_clip_suggestion(uuid,bigint,integer,integer,text)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  foreach f in array array['public.get_media_policy(uuid)', 'public.get_media_rights(uuid)', 'public.list_media_event_links(uuid)'] loop
    execute format('revoke execute on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;
end $$;
