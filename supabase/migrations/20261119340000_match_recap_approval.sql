-- #380 Match recap drafted automatically from the scorecard, published only after a person approves it.
-- No outside AI model: the draft is built by fixed rules from the real scorecard (a model can be plugged in later at the draft step).
create table if not exists public.match_recaps (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected','superseded')),
  title text not null, summary text, body text not null,
  drafted_title text not null, drafted_body text not null,
  source text not null default 'rules',
  edited boolean not null default false,
  drafted_by uuid not null, reviewed_by uuid, reviewed_at timestamptz, reject_reason text,
  article_id uuid references public.articles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists match_recaps_one_pending on public.match_recaps (match_id) where status = 'pending';
create index if not exists match_recaps_match on public.match_recaps (match_id, created_at desc);
alter table public.match_recaps enable row level security;
revoke all on public.match_recaps from anon, authenticated;

create or replace function private.can_review_recap(p_match_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.can_manage_match(p_match_id) or private.is_match_official(p_match_id) or private.is_admin();
$$;
revoke all on function private.can_review_recap(uuid) from public, anon, authenticated;

create or replace function private.recap_overs(b int) returns text language sql immutable set search_path = '' as $$
  select (b / 6)::text || case when b % 6 > 0 then '.' || (b % 6)::text else '' end;
$$;
revoke all on function private.recap_overs(int) from public, anon, authenticated;

create or replace function private.build_recap(p_match_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  m public.matches; l jsonb; ta text; tb text; res text; lines text[] := '{}'; body text; i jsonb; b jsonb; w jsonb;
  tourn text; toss text; pom text; mo text[];
begin
  select * into m from public.matches where id = p_match_id;
  select name into ta from public.teams where id = m.team_a_id;
  select name into tb from public.teams where id = m.team_b_id;
  select name into tourn from public.tournaments where id = m.tournament_id;
  l := public.get_live_state(p_match_id);
  res := coalesce(nullif(m.result_summary, ''), nullif(l->>'result_summary', ''), 'Result to be confirmed.');
  lines := lines || ('## Result'::text) || res::text;
  if m.toss_winner_id is not null then
    lines := lines || (case when m.toss_winner_id = m.team_a_id then ta else tb end || ' won the toss and chose to ' || case when m.toss_decision = 'bat' then 'bat' else 'bowl' end || ' first.')::text;
  end if;
  lines := lines || ('## Scores'::text);
  for i in select * from jsonb_array_elements(coalesce(l->'innings', '[]'::jsonb)) loop
    lines := lines || ('- **' || coalesce(i->'batting_team'->>'name', 'Innings ' || (i->>'innings_no')) || ':** ' || (i->>'runs') || '/' || (i->>'wickets') || ' (' || private.recap_overs((i->>'legal_balls')::int) || ' overs)')::text;
  end loop;
  lines := lines || ('## Top batters'::text);
  for b in select x from (select jsonb_array_elements(coalesce(i2->'batting','[]'::jsonb)) x from jsonb_array_elements(coalesce(l->'innings','[]'::jsonb)) i2) s
           where (x->>'balls')::int > 0 order by (x->>'runs')::int desc limit 3 loop
    lines := lines || ('- ' || (b->>'name') || ' – ' || (b->>'runs') || case when b->'out' is null or jsonb_typeof(b->'out') = 'null' then '*' else '' end || ' off ' || (b->>'balls') || ' balls'
      || case when (b->>'fours')::int > 0 then ', ' || (b->>'fours') || ' fours' else '' end || case when (b->>'sixes')::int > 0 then ', ' || (b->>'sixes') || ' sixes' else '' end)::text;
  end loop;
  lines := lines || ('## Top bowlers'::text);
  for w in select x from (select jsonb_array_elements(coalesce(i2->'bowling','[]'::jsonb)) x from jsonb_array_elements(coalesce(l->'innings','[]'::jsonb)) i2) s
           where (x->>'legal_balls')::int > 0 order by (x->>'wickets')::int desc, (x->>'runs')::int asc limit 3 loop
    lines := lines || ('- ' || (w->>'name') || ' – ' || (w->>'wickets') || '/' || (w->>'runs') || ' in ' || private.recap_overs((w->>'legal_balls')::int) || ' overs')::text;
  end loop;
  if m.player_of_match_id is not null then
    select p.display_name into pom from public.players p where p.id = m.player_of_match_id;
    if pom is not null then lines := lines || ('## Player of the Match'::text) || ('**' || pom || '**')::text; end if;
  end if;
  select coalesce(array_agg(concat('- ', mm.label, ' (', mm.score, ')')::text order by mm.seq), '{}') into mo
    from (select * from private.match_moments(p_match_id) where kind in ('fifty','hundred','haul') order by seq limit 6) mm;
  if array_length(mo, 1) > 0 then lines := lines || ('## Key moments'::text) || mo; end if;
  body := array_to_string(lines, E'\n\n');
  return jsonb_build_object(
    'title', case when m.status = 'completed' then ta || ' vs ' || tb || ': ' || res else ta || ' vs ' || tb || ': match report' end,
    'summary', left(concat_ws(' · ', res, tourn), 290),
    'body', body);
end $$;
revoke all on function private.build_recap(uuid) from public, anon, authenticated;

create or replace function public.draft_match_recap(p_match_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_active_user(); m public.matches; d jsonb; r public.match_recaps;
begin
  select * into m from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found.' using errcode = '22023'; end if;
  if not private.can_review_recap(p_match_id) then raise exception 'Only the people running this match can draft its recap.' using errcode = '42501'; end if;
  if m.status <> 'completed' then raise exception 'The recap can be drafted once the match is completed.' using errcode = '22023'; end if;
  update public.match_recaps set status = 'superseded', updated_at = now() where match_id = p_match_id and status = 'pending';
  d := private.build_recap(p_match_id);
  insert into public.match_recaps (match_id, title, summary, body, drafted_title, drafted_body, drafted_by)
  values (p_match_id, d->>'title', d->>'summary', d->>'body', d->>'title', d->>'body', uid) returning * into r;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, 'MATCH_RECAP_DRAFTED', 'match_recaps', r.id::text, jsonb_build_object('match_id', p_match_id));
  return to_jsonb(r);
end $$;

create or replace function public.edit_match_recap(p_recap_id uuid, p_title text, p_summary text, p_body text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_active_user(); r public.match_recaps;
begin
  select * into r from public.match_recaps where id = p_recap_id for update;
  if not found then raise exception 'Recap not found.' using errcode = '22023'; end if;
  if not private.can_review_recap(r.match_id) then raise exception 'Only the people running this match can edit its recap.' using errcode = '42501'; end if;
  if r.status <> 'pending' then raise exception 'Only a recap waiting for approval can be edited.' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_title,''))) < 5 then raise exception 'Write a headline (at least 5 characters).' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_body,''))) < 20 or length(p_body) > 20000 then raise exception 'The recap must be 20 to 20,000 characters.' using errcode = '22023'; end if;
  update public.match_recaps set title = left(btrim(p_title),140), summary = nullif(left(btrim(coalesce(p_summary,'')),300),''), body = btrim(p_body),
    edited = (btrim(p_body) <> drafted_body or left(btrim(p_title),140) <> drafted_title), updated_at = now() where id = p_recap_id returning * into r;
  return to_jsonb(r);
end $$;

create or replace function public.approve_match_recap(p_recap_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_active_user(); r public.match_recaps; art jsonb; prev uuid; label text; fullbody text;
begin
  select * into r from public.match_recaps where id = p_recap_id for update;
  if not found then raise exception 'Recap not found.' using errcode = '22023'; end if;
  if not private.can_review_recap(r.match_id) then raise exception 'Only the people running this match can approve its recap.' using errcode = '42501'; end if;
  if r.status <> 'pending' then raise exception 'This recap is not waiting for approval.' using errcode = '22023'; end if;
  label := case when r.edited then '_Drafted automatically from the scorecard, edited and approved by a match official._'
                else '_Drafted automatically from the scorecard and approved by a match official._' end;
  fullbody := r.body || E'\n\n' || label;
  select article_id into prev from public.match_recaps where match_id = r.match_id and status = 'approved' and article_id is not null order by reviewed_at desc limit 1;
  begin
    if prev is not null then
      art := public.save_article(prev, jsonb_build_object('title', r.title, 'summary', r.summary, 'body', fullbody, 'status', 'published'));
    else
      art := public.save_article(null, jsonb_build_object('kind', 'match_report', 'match_id', r.match_id, 'title', r.title, 'summary', r.summary, 'body', fullbody, 'status', 'published'));
    end if;
  exception when insufficient_privilege then
    art := public.save_article(null, jsonb_build_object('kind', 'match_report', 'match_id', r.match_id, 'title', r.title, 'summary', r.summary, 'body', fullbody, 'status', 'published'));
  end;
  update public.match_recaps set status = 'approved', reviewed_by = uid, reviewed_at = now(), article_id = (art->>'id')::uuid, updated_at = now() where id = p_recap_id returning * into r;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, 'MATCH_RECAP_APPROVED', 'match_recaps', r.id::text, jsonb_build_object('match_id', r.match_id, 'article_id', r.article_id, 'edited', r.edited));
  return to_jsonb(r);
end $$;

create or replace function public.reject_match_recap(p_recap_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_active_user(); r public.match_recaps;
begin
  select * into r from public.match_recaps where id = p_recap_id for update;
  if not found then raise exception 'Recap not found.' using errcode = '22023'; end if;
  if not private.can_review_recap(r.match_id) then raise exception 'Only the people running this match can reject its recap.' using errcode = '42501'; end if;
  if r.status <> 'pending' then raise exception 'This recap is not waiting for approval.' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_reason,''))) < 5 then raise exception 'Tell us why (at least 5 characters).' using errcode = '22023'; end if;
  update public.match_recaps set status = 'rejected', reviewed_by = uid, reviewed_at = now(), reject_reason = left(btrim(p_reason), 300), updated_at = now() where id = p_recap_id returning * into r;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, 'MATCH_RECAP_REJECTED', 'match_recaps', r.id::text, jsonb_build_object('match_id', r.match_id));
  return to_jsonb(r);
end $$;

create or replace function public.list_match_recaps(p_match_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_active_user();
  if not private.can_review_recap(p_match_id) then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from (select * from public.match_recaps where match_id = p_match_id order by created_at desc limit 20) r), '[]'::jsonb);
end $$;

revoke all on function public.draft_match_recap(uuid), public.edit_match_recap(uuid,text,text,text), public.approve_match_recap(uuid),
  public.reject_match_recap(uuid,text), public.list_match_recaps(uuid) from public, anon;
grant execute on function public.draft_match_recap(uuid), public.edit_match_recap(uuid,text,text,text), public.approve_match_recap(uuid),
  public.reject_match_recap(uuid,text), public.list_match_recaps(uuid) to authenticated;
