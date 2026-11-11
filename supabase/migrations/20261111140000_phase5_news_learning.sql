-- Phase 5 – Category K: local cricket news and learning (#200–#215).
-- One articles table for every kind of news and learning article, plus likes, reports and quizzes.
-- Writing is open to every registered member (open platform); some kinds are tied to what the author runs:
--   tournament announcements → that tournament's organiser; academy updates → the academy's owner.
-- Articles by the organiser / match officials / admins are marked "official".

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in (
    'news','announcement','preview','match_report','interview','story','success_story','academy_update','community_update',
    'coaching','guide','equipment','rules','umpiring','scoring')),
  title text not null check (length(title) between 5 and 140),
  summary text check (summary is null or length(summary) <= 300),
  body text not null check (length(body) between 20 and 20000),
  cover_url text,
  video_url text check (video_url is null or video_url ~* '^https://'),
  level text check (level is null or level in ('beginner','intermediate','advanced')),
  byline text check (byline is null or length(byline) <= 80),
  tournament_id uuid references public.tournaments(id) on delete cascade,
  match_id uuid references public.matches(id) on delete cascade,
  player_id uuid references public.players(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  listing_id uuid references public.directory_listings(id) on delete cascade,
  city text check (city is null or length(city) <= 80),
  author_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'published' check (status in ('draft','published','hidden')),
  is_official boolean not null default false,
  is_featured boolean not null default false,
  views bigint not null default 0,
  likes integer not null default 0,
  reading_minutes integer not null default 1,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists articles_feed_idx on public.articles (status, published_at desc);
create index if not exists articles_kind_idx on public.articles (kind, published_at desc);
create index if not exists articles_tournament_idx on public.articles (tournament_id);
create index if not exists articles_match_idx on public.articles (match_id);
create index if not exists articles_player_idx on public.articles (player_id);
create index if not exists articles_listing_idx on public.articles (listing_id);
create index if not exists articles_author_idx on public.articles (author_id);
alter table public.articles enable row level security;
revoke all on public.articles from anon, authenticated;

create table if not exists public.article_likes (
  article_id uuid not null references public.articles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (article_id, user_id)
);
alter table public.article_likes enable row level security;
revoke all on public.article_likes from anon, authenticated;

create table if not exists public.article_reports (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (length(reason) between 3 and 500),
  status text not null default 'open' check (status in ('open','resolved')),
  created_at timestamptz not null default now(),
  unique (article_id, reporter_id)
);
alter table public.article_reports enable row level security;
revoke all on public.article_reports from anon, authenticated;

-- ---------- helpers ----------
create or replace function private.article_learning(p_kind text)
returns boolean language sql immutable set search_path = ''
as $$ select p_kind in ('coaching','guide','equipment','rules','umpiring','scoring'); $$;

create or replace function private.can_edit_article(a public.articles)
returns boolean language sql stable security definer set search_path = ''
as $$ select (select auth.uid()) is not null and (a.author_id = (select auth.uid()) or private.is_admin()); $$;

create or replace function private.article_json(a public.articles, p_full boolean)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select (to_jsonb(a) - 'author_id' - case when p_full then 'x' else 'body' end) || jsonb_build_object(
    'author', coalesce(a.byline, (select display_name from public.profiles where id = a.author_id)),
    'is_mine', a.author_id = (select auth.uid()),
    'can_edit', private.can_edit_article(a),
    'liked', exists (select 1 from public.article_likes l where l.article_id = a.id and l.user_id = (select auth.uid())),
    'tournament', (select jsonb_build_object('id', t.id, 'name', t.name, 'code', t.code) from public.tournaments t where t.id = a.tournament_id),
    'match', (select jsonb_build_object('id', m.id, 'title', coalesce(m.title, ta.name || ' vs ' || tb.name), 'status', m.status, 'date', coalesce(m.started_at, m.scheduled_at))
              from public.matches m left join public.teams ta on ta.id = m.team_a_id left join public.teams tb on tb.id = m.team_b_id where m.id = a.match_id),
    'player', (select jsonb_build_object('id', p.id, 'name', p.display_name, 'photo_url', p.photo_url, 'player_code', p.player_code) from public.players p where p.id = a.player_id),
    'team', (select jsonb_build_object('id', t.id, 'name', t.name) from public.teams t where t.id = a.team_id),
    'listing', (select jsonb_build_object('id', l.id, 'name', l.name, 'kind', l.kind) from public.directory_listings l where l.id = a.listing_id));
$$;

-- ---------- write ----------
create or replace function public.save_article(p_article_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := private.require_active_user(); a public.articles; aid uuid := p_article_id;
  v_kind text := p->>'kind'; v_tid uuid := nullif(p->>'tournament_id', '')::uuid; v_mid uuid := nullif(p->>'match_id', '')::uuid;
  v_pid uuid := nullif(p->>'player_id', '')::uuid; v_team uuid := nullif(p->>'team_id', '')::uuid; v_lid uuid := nullif(p->>'listing_id', '')::uuid;
  v_status text := coalesce(nullif(p->>'status', ''), 'published'); v_body text := pg_catalog.btrim(coalesce(p->>'body', ''));
  v_video text := nullif(pg_catalog.btrim(coalesce(p->>'video_url', '')), ''); v_official boolean := false;
begin
  if aid is not null then
    select * into a from public.articles where id = aid for update;
    if not found then raise exception 'Article not found.' using errcode = '22023'; end if;
    if not private.can_edit_article(a) then raise exception 'Only the writer can change this article.' using errcode = '42501'; end if;
    v_kind := a.kind;   -- kind and links stay as written
    v_tid := a.tournament_id; v_mid := a.match_id; v_pid := a.player_id; v_lid := a.listing_id;
  end if;
  if v_kind is null or v_kind not in ('news','announcement','preview','match_report','interview','story','success_story','academy_update','community_update',
                                      'coaching','guide','equipment','rules','umpiring','scoring') then
    raise exception 'Choose what kind of article this is.' using errcode = '22023';
  end if;
  if v_status not in ('draft', 'published') then raise exception 'Unknown status.' using errcode = '22023'; end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p->>'title', ''))) < 5 then raise exception 'Write a headline (at least 5 characters).' using errcode = '22023'; end if;
  if pg_catalog.length(v_body) < 20 then raise exception 'Write a little more – at least a couple of sentences.' using errcode = '22023'; end if;
  if pg_catalog.length(v_body) > 20000 then raise exception 'The article is too long (20,000 characters at most).' using errcode = '22023'; end if;
  if v_video is not null and v_video !~* '^https://(www\.|m\.)?(youtube\.com/|youtu\.be/)' then raise exception 'Videos must be YouTube links.' using errcode = '22023'; end if;
  -- links each kind needs
  if v_kind = 'announcement' then
    if v_tid is null then raise exception 'Choose the tournament.' using errcode = '22023'; end if;
    perform private.require_tournament_organiser(v_tid);
    v_official := true;
  elsif v_kind in ('preview', 'match_report') then
    if v_mid is null or not exists (select 1 from public.matches where id = v_mid) then raise exception 'Choose the match.' using errcode = '22023'; end if;
    v_official := private.can_manage_match(v_mid) or private.is_match_official(v_mid);
    select tournament_id into v_tid from public.matches where id = v_mid;
  elsif v_kind in ('interview', 'success_story') then
    if v_pid is null or not exists (select 1 from public.players where id = v_pid) then raise exception 'Choose the player.' using errcode = '22023'; end if;
  elsif v_kind = 'academy_update' then
    if v_lid is null or not exists (select 1 from public.directory_listings where id = v_lid and kind in ('academy', 'coaching', 'club', 'nets')
                                     and (owner_id = uid or private.is_admin())) then
      raise exception 'Choose one of your own academies, coaching centres, clubs or nets.' using errcode = '22023';
    end if;
    v_official := true;
  end if;
  if v_tid is not null and v_kind not in ('announcement', 'preview', 'match_report') and not exists (select 1 from public.tournaments where id = v_tid) then v_tid := null; end if;
  if private.is_admin() then v_official := true; end if;
  if aid is null then
    if (select count(*) from public.articles where author_id = uid and created_at > now() - interval '1 day') >= 10 then
      raise exception 'You can write up to 10 articles a day.' using errcode = '22023';
    end if;
    insert into public.articles (kind, title, body, author_id, status) values (v_kind, pg_catalog.btrim(p->>'title'), v_body, uid, 'draft') returning id into aid;
  end if;
  update public.articles set
    title = pg_catalog.left(pg_catalog.btrim(p->>'title'), 140),
    summary = nullif(pg_catalog.left(pg_catalog.btrim(coalesce(p->>'summary', '')), 300), ''),
    body = v_body, video_url = v_video,
    level = case when private.article_learning(v_kind) and p->>'level' in ('beginner','intermediate','advanced') then p->>'level' end,
    byline = case when private.is_admin() then nullif(pg_catalog.left(pg_catalog.btrim(coalesce(p->>'byline', '')), 80), '') else null end,
    tournament_id = v_tid, match_id = v_mid, player_id = v_pid, listing_id = v_lid,
    team_id = case when v_team is not null and exists (select 1 from public.teams where id = v_team) then v_team end,
    city = nullif(pg_catalog.left(pg_catalog.btrim(coalesce(p->>'city', '')), 80), ''),
    is_official = v_official,
    status = case when status = 'hidden' then 'hidden' else v_status end,
    published_at = case when v_status = 'published' then coalesce(published_at, now()) else published_at end,
    reading_minutes = greatest(1, round(array_length(regexp_split_to_array(v_body, '\s+'), 1) / 200.0)::int),
    updated_at = now()
  where id = aid returning * into a;
  -- tell followers of the subject: team owners for previews / reports, the player for interviews and success stories
  if p_article_id is null and v_status = 'published' then
    insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
    select distinct x.rcpt, 'article_about_you', 'New article: ' || pg_catalog.left(a.title, 80), coalesce(a.summary, ''), jsonb_build_object('article_id', a.id)
      from (select t.owner_id rcpt from public.matches m join public.teams t on t.id in (m.team_a_id, m.team_b_id) where a.kind in ('preview', 'match_report') and m.id = a.match_id
            union select pl.profile_id from public.players pl where a.kind in ('interview', 'success_story') and pl.id = a.player_id) x
     where x.rcpt is not null and x.rcpt <> uid;
  end if;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, case when p_article_id is null then 'ARTICLE_CREATED' else 'ARTICLE_UPDATED' end, 'articles', a.id::text, jsonb_build_object('kind', a.kind, 'status', a.status));
  return private.article_json(a, true);
end;
$$;

create or replace function public.set_article_cover(p_article_id uuid, p_url text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare a public.articles;
begin
  perform private.require_active_user();
  select * into a from public.articles where id = p_article_id;
  if not found or not private.can_edit_article(a) then raise exception 'Only the writer can change this article.' using errcode = '42501'; end if;
  if p_url is not null and p_url not like '%/storage/v1/object/public/media/articles/' || a.id::text || '/%' then raise exception 'Upload the picture first.' using errcode = '22023'; end if;
  update public.articles set cover_url = p_url, updated_at = now() where id = a.id returning * into a;
  return private.article_json(a, true);
end;
$$;

create or replace function public.delete_article(p_article_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := private.require_active_user(); a public.articles;
begin
  select * into a from public.articles where id = p_article_id;
  if not found or not private.can_edit_article(a) then raise exception 'Only the writer can delete this article.' using errcode = '42501'; end if;
  delete from public.articles where id = a.id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata) values (uid, 'ARTICLE_DELETED', 'articles', a.id::text, jsonb_build_object('title', a.title));
  return jsonb_build_object('deleted', true);
end;
$$;

-- Admins: hide / feature. The player an interview or success story is about may hide it.
create or replace function public.moderate_article(p_article_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := private.require_active_user(); a public.articles; is_subject boolean;
begin
  select * into a from public.articles where id = p_article_id for update;
  if not found then raise exception 'Article not found.' using errcode = '22023'; end if;
  is_subject := a.player_id is not null and exists (select 1 from public.players where id = a.player_id and profile_id = uid);
  if not private.is_admin() and not (is_subject and p ? 'status' and not (p ? 'is_featured')) then
    raise exception 'Only admins can do this.' using errcode = '42501';
  end if;
  if p ? 'status' and p->>'status' not in ('published', 'hidden') then raise exception 'Unknown status.' using errcode = '22023'; end if;
  update public.articles set status = coalesce(p->>'status', status), is_featured = coalesce((p->>'is_featured')::boolean, is_featured), updated_at = now()
   where id = a.id returning * into a;
  if p ? 'status' then update public.article_reports set status = 'resolved' where article_id = a.id; end if;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata) values (uid, 'ARTICLE_MODERATED', 'articles', a.id::text, p);
  return private.article_json(a, true);
end;
$$;

-- ---------- read ----------
create or replace function public.get_article(p_article_id uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select private.article_json(a, true) || jsonb_build_object('can_moderate', private.is_admin(),
           'is_subject', a.player_id is not null and exists (select 1 from public.players where id = a.player_id and profile_id = (select auth.uid())))
  from public.articles a
  where a.id = p_article_id and (a.status = 'published' or private.can_edit_article(a)
        or (a.player_id is not null and exists (select 1 from public.players where id = a.player_id and profile_id = (select auth.uid()))));
$$;

create or replace function public.record_article_view(p_article_id uuid)
returns void language sql security definer set search_path = ''
as $$ update public.articles set views = views + 1 where id = p_article_id and status = 'published'; $$;

-- Feed: filter by kinds, tournament, match, player, listing, author ("mine"), text; newest first (featured first if asked).
create or replace function public.list_articles(p jsonb default '{}'::jsonb)
returns jsonb language sql stable security definer set search_path = ''
as $$
  with q as (
    select (select array_agg(x) from jsonb_array_elements_text(case when jsonb_typeof(p->'kinds') = 'array' then p->'kinds' else '[]'::jsonb end) x) kinds,
           coalesce(p->>'group', '') grp,
           nullif(p->>'tournament_id', '')::uuid tid, nullif(p->>'match_id', '')::uuid mid, nullif(p->>'player_id', '')::uuid pid, nullif(p->>'listing_id', '')::uuid lid,
           coalesce((p->>'mine')::boolean, false) mine, coalesce((p->>'featured_first')::boolean, false) feat,
           nullif(pg_catalog.btrim(coalesce(p->>'query', '')), '') txt, nullif(p->>'level', '') lvl,
           least(greatest(coalesce((p->>'limit')::int, 20), 1), 60) lim, greatest(coalesce((p->>'offset')::int, 0), 0) off)
  select coalesce(jsonb_agg(private.article_json(art, false) order by s.ord), '[]'::jsonb) from (
    select a.id, row_number() over (order by case when q.feat then a.is_featured end desc nulls last, coalesce(a.published_at, a.created_at) desc) ord
      from public.articles a, q
     where (case when q.mine then a.author_id = (select auth.uid()) else a.status = 'published' end)
       and (q.kinds is null or a.kind = any(q.kinds))
       and (q.grp = '' or (q.grp = 'learn' and private.article_learning(a.kind)) or (q.grp = 'news' and not private.article_learning(a.kind)))
       and (q.tid is null or a.tournament_id = q.tid) and (q.mid is null or a.match_id = q.mid)
       and (q.pid is null or a.player_id = q.pid) and (q.lid is null or a.listing_id = q.lid)
       and (q.lvl is null or a.level = q.lvl)
       and (q.txt is null or a.title ilike '%' || q.txt || '%' or a.summary ilike '%' || q.txt || '%')
     order by ord offset (select off from q) limit (select lim from q)) s
  join public.articles art on art.id = s.id;
$$;

create or replace function public.like_article(p_article_id uuid, p_like boolean)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := private.require_active_user(); n int;
begin
  if not exists (select 1 from public.articles where id = p_article_id and status = 'published') then raise exception 'Article not found.' using errcode = '22023'; end if;
  if p_like then insert into public.article_likes (article_id, user_id) values (p_article_id, uid) on conflict do nothing;
  else delete from public.article_likes where article_id = p_article_id and user_id = uid; end if;
  select count(*) into n from public.article_likes where article_id = p_article_id;
  update public.articles set likes = n where id = p_article_id;
  return jsonb_build_object('likes', n, 'liked', p_like);
end;
$$;

create or replace function public.report_article(p_article_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := private.require_active_user(); a public.articles;
begin
  select * into a from public.articles where id = p_article_id and status = 'published';
  if not found then raise exception 'Article not found.' using errcode = '22023'; end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_reason, ''))) < 3 then raise exception 'Say briefly what is wrong.' using errcode = '22023'; end if;
  insert into public.article_reports (article_id, reporter_id, reason) values (a.id, uid, pg_catalog.left(pg_catalog.btrim(p_reason), 500))
  on conflict (article_id, reporter_id) do update set reason = excluded.reason, status = 'open', created_at = now();
  insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
  select distinct r.user_id, 'article_reported', 'Article reported', pg_catalog.left(a.title, 120), jsonb_build_object('article_id', a.id)
    from public.user_role_assignments r where r.role in ('admin', 'super_admin') and r.is_active and r.scope_type = 'global';
  return jsonb_build_object('reported', true);
end;
$$;

create or replace function public.list_reported_articles()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_admin() then raise exception 'Only admins can see reports.' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(private.article_json(a, false) || jsonb_build_object('reports', x.n, 'reasons', x.reasons) order by x.last desc)
    from (select article_id, count(*) n, jsonb_agg(reason) reasons, max(created_at) last from public.article_reports where status = 'open' group by article_id) x
    join public.articles a on a.id = x.article_id), '[]'::jsonb);
end;
$$;

-- ---------- #212 quizzes ----------
create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 5 and 120),
  description text check (description is null or length(description) <= 400),
  category text not null default 'general' check (category in ('rules','umpiring','scoring','history','skills','general')),
  level text not null default 'beginner' check (level in ('beginner','intermediate','advanced')),
  author_id uuid not null references auth.users(id) on delete cascade,
  byline text,
  status text not null default 'published' check (status in ('draft','published','hidden')),
  is_official boolean not null default false,
  plays integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  position integer not null,
  question text not null check (length(question) between 5 and 300),
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 6),
  correct integer not null,
  explanation text check (explanation is null or length(explanation) <= 500)
);
create index if not exists quiz_questions_quiz_idx on public.quiz_questions (quiz_id, position);
create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  score integer not null,
  total integer not null,
  answers jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists quiz_attempts_quiz_idx on public.quiz_attempts (quiz_id, score desc);
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts enable row level security;
revoke all on public.quizzes, public.quiz_questions, public.quiz_attempts from anon, authenticated;

create or replace function public.save_quiz(p_quiz_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := private.require_active_user(); qz public.quizzes; qid uuid := p_quiz_id; q jsonb; i int := 0; n int;
begin
  if qid is not null then
    select * into qz from public.quizzes where id = qid for update;
    if not found or not (qz.author_id = uid or private.is_admin()) then raise exception 'Only the quiz writer can change it.' using errcode = '42501'; end if;
  end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p->>'title', ''))) < 5 then raise exception 'Give the quiz a title.' using errcode = '22023'; end if;
  if jsonb_typeof(p->'questions') <> 'array' or jsonb_array_length(p->'questions') not between 3 and 30 then raise exception 'A quiz needs 3 to 30 questions.' using errcode = '22023'; end if;
  for q in select * from jsonb_array_elements(p->'questions') loop
    n := case when jsonb_typeof(q->'options') = 'array' then jsonb_array_length(q->'options') else 0 end;
    if pg_catalog.length(pg_catalog.btrim(coalesce(q->>'question', ''))) < 5 then raise exception 'Question % is empty.', i + 1 using errcode = '22023'; end if;
    if n not between 2 and 6 then raise exception 'Question % needs 2 to 6 answers.', i + 1 using errcode = '22023'; end if;
    if coalesce((q->>'correct')::int, -1) not between 0 and n - 1 then raise exception 'Mark the right answer for question %.', i + 1 using errcode = '22023'; end if;
    i := i + 1;
  end loop;
  if qid is null then
    if (select count(*) from public.quizzes where author_id = uid and created_at > now() - interval '1 day') >= 5 then raise exception 'You can make up to 5 quizzes a day.' using errcode = '22023'; end if;
    insert into public.quizzes (title, author_id) values (pg_catalog.btrim(p->>'title'), uid) returning id into qid;
  end if;
  update public.quizzes set title = pg_catalog.left(pg_catalog.btrim(p->>'title'), 120),
    description = nullif(pg_catalog.left(pg_catalog.btrim(coalesce(p->>'description', '')), 400), ''),
    category = case when p->>'category' in ('rules','umpiring','scoring','history','skills','general') then p->>'category' else 'general' end,
    level = case when p->>'level' in ('beginner','intermediate','advanced') then p->>'level' else 'beginner' end,
    status = case when status = 'hidden' then 'hidden' when p->>'status' = 'draft' then 'draft' else 'published' end,
    byline = case when private.is_admin() then nullif(pg_catalog.btrim(coalesce(p->>'byline', '')), '') end,
    is_official = private.is_admin(), updated_at = now()
  where id = qid returning * into qz;
  delete from public.quiz_questions where quiz_id = qid;
  insert into public.quiz_questions (quiz_id, position, question, options, correct, explanation)
  select qid, ord::int, pg_catalog.left(pg_catalog.btrim(x->>'question'), 300),
         (select jsonb_agg(pg_catalog.left(pg_catalog.btrim(o), 150)) from jsonb_array_elements_text(x->'options') o), (x->>'correct')::int,
         nullif(pg_catalog.left(pg_catalog.btrim(coalesce(x->>'explanation', '')), 500), '')
    from jsonb_array_elements(p->'questions') with ordinality as t(x, ord);
  return to_jsonb(qz) - 'author_id';
end;
$$;

create or replace function public.list_quizzes(p jsonb default '{}'::jsonb)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(x order by (x->>'is_official')::boolean desc, (x->>'plays')::int desc, x->>'created_at' desc), '[]'::jsonb) from (
    select to_jsonb(z) - 'author_id' || jsonb_build_object(
             'author', coalesce(z.byline, (select display_name from public.profiles where id = z.author_id)),
             'questions', (select count(*) from public.quiz_questions where quiz_id = z.id),
             'is_mine', z.author_id = (select auth.uid()),
             'my_best', (select max(score) from public.quiz_attempts where quiz_id = z.id and user_id = (select auth.uid()))) x
      from public.quizzes z
     where (case when coalesce((p->>'mine')::boolean, false) then z.author_id = (select auth.uid()) else z.status = 'published' end)
       and (nullif(p->>'category', '') is null or z.category = p->>'category')
     limit 100) y;
$$;

-- Questions without the answers (answers come back only after submitting).
create or replace function public.get_quiz(p_quiz_id uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select to_jsonb(z) - 'author_id' || jsonb_build_object(
    'author', coalesce(z.byline, (select display_name from public.profiles where id = z.author_id)),
    'can_edit', z.author_id = (select auth.uid()) or private.is_admin(),
    'questions', coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'question', q.question, 'options', q.options)
                   || case when z.author_id = (select auth.uid()) or private.is_admin() then jsonb_build_object('correct', q.correct, 'explanation', q.explanation) else '{}'::jsonb end
                   order by q.position) from public.quiz_questions q where q.quiz_id = z.id), '[]'::jsonb),
    'my_best', (select max(score) from public.quiz_attempts where quiz_id = z.id and user_id = (select auth.uid())),
    'leaderboard', coalesce((select jsonb_agg(jsonb_build_object('name', l.name, 'score', l.score, 'total', l.total) order by l.score desc, l.first_at) from (
        select (select display_name from public.profiles where id = a.user_id) name, max(a.score) score, max(a.total) total, min(a.created_at) first_at
          from public.quiz_attempts a where a.quiz_id = z.id group by a.user_id order by 2 desc, 4 limit 10) l), '[]'::jsonb))
  from public.quizzes z where z.id = p_quiz_id and (z.status = 'published' or z.author_id = (select auth.uid()) or private.is_admin());
$$;

-- Anyone can play; scores are saved only for signed-in members.
create or replace function public.submit_quiz(p_quiz_id uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := (select auth.uid()); res jsonb; v_score int; v_total int;
begin
  if not exists (select 1 from public.quizzes where id = p_quiz_id and status = 'published') then raise exception 'Quiz not found.' using errcode = '22023'; end if;
  if jsonb_typeof(p_answers) <> 'array' then raise exception 'Answers missing.' using errcode = '22023'; end if;
  select jsonb_agg(jsonb_build_object('question', q.question, 'options', q.options, 'correct', q.correct, 'explanation', q.explanation,
                    'chosen', (p_answers->>(q.position - 1)::int)::int, 'right', (p_answers->>(q.position - 1)::int)::int = q.correct) order by q.position),
         count(*) filter (where (p_answers->>(q.position - 1)::int)::int = q.correct), count(*)
    into res, v_score, v_total
    from public.quiz_questions q where q.quiz_id = p_quiz_id;
  update public.quizzes set plays = plays + 1 where id = p_quiz_id;
  if uid is not null and not exists (select 1 from public.profiles where id = uid and account_status in ('suspended', 'disabled')) then
    if (select count(*) from public.quiz_attempts where user_id = uid and created_at > now() - interval '1 hour') < 60 then
      insert into public.quiz_attempts (quiz_id, user_id, score, total, answers) values (p_quiz_id, uid, v_score, v_total, p_answers);
    end if;
  end if;
  return jsonb_build_object('score', v_score, 'total', v_total, 'saved', uid is not null, 'results', coalesce(res, '[]'::jsonb));
end;
$$;

create or replace function public.delete_quiz(p_quiz_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := private.require_active_user();
begin
  if not exists (select 1 from public.quizzes where id = p_quiz_id and (author_id = uid or private.is_admin())) then raise exception 'Only the quiz writer can delete it.' using errcode = '42501'; end if;
  delete from public.quizzes where id = p_quiz_id;
  return jsonb_build_object('deleted', true);
end;
$$;

create or replace function public.moderate_quiz(p_quiz_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_active_user();
  if not private.is_admin() then raise exception 'Only admins can do this.' using errcode = '42501'; end if;
  if p_status not in ('published', 'hidden') then raise exception 'Unknown status.' using errcode = '22023'; end if;
  update public.quizzes set status = p_status where id = p_quiz_id;
  return jsonb_build_object('status', p_status);
end;
$$;

-- ---------- upload folder for article pictures ----------
do $$
declare d text; n text;
begin
  d := pg_get_functiondef('private.can_edit_media(text)'::regprocedure);
  n := replace(d, $a$  elsif parts[1] = 'merch' then$a$,
    $b$  elsif parts[1] = 'articles' then
    return exists (select 1 from public.articles a where a.id = target and private.can_edit_article(a));
  elsif parts[1] = 'merch' then$b$);
  if n = d then raise exception 'can_edit_media patch point not found'; end if;
  execute n;
end $$;

-- ---------- grants ----------
revoke all on function private.article_learning(text) from public, anon, authenticated;
revoke all on function private.can_edit_article(public.articles) from public, anon, authenticated;
revoke all on function private.article_json(public.articles, boolean) from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array['save_article(uuid, jsonb)', 'set_article_cover(uuid, text)', 'delete_article(uuid)', 'moderate_article(uuid, jsonb)', 'like_article(uuid, boolean)',
    'report_article(uuid, text)', 'list_reported_articles()', 'save_quiz(uuid, jsonb)', 'delete_quiz(uuid)', 'moderate_quiz(uuid, text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['get_article(uuid)', 'record_article_view(uuid)', 'list_articles(jsonb)', 'list_quizzes(jsonb)', 'get_quiz(uuid)', 'submit_quiz(uuid, jsonb)'] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
end $$;
