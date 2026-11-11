-- Phase 5 – Category I: live streaming and media (#177–#188)
-- One table holds every photo, video, highlight clip and live-stream link, attached to a match, a tournament or a player.
-- Posters, score/player/result cards and promo videos (#185–#188) are made in the browser from existing data – no tables needed.

-- ---------- storage: short video clips (#181, #182, #180) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('videos', 'videos', true, 20971520, array['video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do update set public = true, file_size_limit = 20971520, allowed_mime_types = array['video/mp4', 'video/webm', 'video/quicktime'];

-- ---------- table ----------
create table if not exists public.media_items (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('match', 'tournament', 'player')),
  scope_id uuid not null,
  kind text not null check (kind in ('photo', 'video', 'highlight', 'stream')),
  source text not null check (source in ('upload', 'youtube', 'facebook', 'instagram', 'link')),
  url text check (url is null or url ~* '^https?://'),
  title text check (title is null or length(title) <= 120),
  caption text check (caption is null or length(caption) <= 500),
  moment text check (moment is null or length(moment) <= 40),
  is_live boolean not null default false,
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  file_bytes bigint,
  uploader_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind <> 'stream' or (scope = 'match' and source <> 'upload')),
  check (kind <> 'photo' or source in ('upload', 'link'))
);
create index if not exists media_items_scope_idx on public.media_items (scope, scope_id, created_at desc);
create index if not exists media_items_live_idx on public.media_items (is_live) where is_live;
create index if not exists media_items_uploader_idx on public.media_items (uploader_id);
alter table public.media_items enable row level security;
revoke all on public.media_items from anon, authenticated;

-- ---------- who may do what ----------
-- Moderators: the match manager (creator / tournament organiser / admin), the tournament organiser, the player themself.
create or replace function private.can_moderate_media(p_scope text, p_scope_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and (private.is_admin() or case p_scope
    when 'match' then private.can_manage_match(p_scope_id)
    when 'tournament' then exists (select 1 from public.tournaments t where t.id = p_scope_id and t.owner_id = (select auth.uid()))
                        or exists (select 1 from public.user_role_assignments r where r.user_id = (select auth.uid()) and r.role = 'organiser'
                                   and r.scope_type = 'tournament' and r.scope_id = p_scope_id and r.is_active)
    when 'player' then exists (select 1 from public.players p where p.id = p_scope_id
                               and (p.profile_id = (select auth.uid()) or (p.profile_id is null and p.created_by = (select auth.uid()))))
    else false end)
  and not exists (select 1 from public.profiles where id = (select auth.uid()) and account_status in ('suspended', 'disabled'));
$$;

-- Contributors: moderators, plus people earned into the match / tournament / player's team.
create or replace function private.can_add_media(p_scope text, p_scope_id uuid, p_kind text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.can_moderate_media(p_scope, p_scope_id) or (
    (select auth.uid()) is not null
    and not exists (select 1 from public.profiles where id = (select auth.uid()) and account_status in ('suspended', 'disabled'))
    and case
      when p_kind = 'stream' then p_scope = 'match' and private.is_match_official(p_scope_id)
      when p_scope = 'match' then private.is_match_official(p_scope_id)
        or exists (select 1 from public.matches m join public.teams t on t.id in (m.team_a_id, m.team_b_id)
                    where m.id = p_scope_id and t.owner_id = (select auth.uid()))
        or exists (select 1 from public.matches m join public.team_members tm on tm.team_id in (m.team_a_id, m.team_b_id)
                    join public.players p on p.id = tm.player_id
                    where m.id = p_scope_id and p.profile_id = (select auth.uid()))
      when p_scope = 'tournament' then exists (select 1 from public.tournament_teams tt join public.teams t on t.id = tt.team_id
                    where tt.tournament_id = p_scope_id and tt.status = 'approved' and t.owner_id = (select auth.uid()))
      when p_scope = 'player' then exists (select 1 from public.team_members tm join public.teams t on t.id = tm.team_id
                    where tm.player_id = p_scope_id and t.owner_id = (select auth.uid()))
      else false end);
$$;

-- Storage: gallery photos go to media/gallery/<media id>/…, clips to videos/clips/<media id>/…
create or replace function private.can_edit_media(p_name text)
returns boolean language plpgsql stable security definer set search_path = ''
as $$
declare parts text[] := storage.foldername(p_name); target uuid;
begin
  if (select auth.uid()) is null or pg_catalog.array_length(parts, 1) < 2 then return false; end if;
  begin target := parts[2]::uuid; exception when others then return false; end;
  if parts[1] = 'teams' then
    return exists (select 1 from public.teams where id = target and owner_id = (select auth.uid()));
  elsif parts[1] = 'players' then
    return exists (select 1 from public.players where id = target
                   and (profile_id = (select auth.uid()) or (profile_id is null and created_by = (select auth.uid()))));
  elsif parts[1] = 'tournaments' then
    return exists (select 1 from public.tournaments where id = target and owner_id = (select auth.uid()))
        or exists (select 1 from public.user_role_assignments where user_id = (select auth.uid()) and role = 'organiser'
                   and scope_type = 'tournament' and scope_id = target and is_active)
        or private.is_admin();
  elsif parts[1] = 'grounds' then
    return exists (select 1 from public.grounds where id = target and owner_id = (select auth.uid())) or private.is_admin();
  elsif parts[1] = 'listings' then
    return exists (select 1 from public.directory_listings where id = target and owner_id = (select auth.uid())) or private.is_admin();
  elsif parts[1] = 'items' then
    return exists (select 1 from public.market_items where id = target and seller_id = (select auth.uid())) or private.is_admin();
  elsif parts[1] in ('gallery', 'clips') then
    return exists (select 1 from public.media_items mi where mi.id = target
                   and (mi.uploader_id = (select auth.uid()) or private.can_moderate_media(mi.scope, mi.scope_id)));
  end if;
  return false;
end;
$$;

drop policy if exists videos_insert on storage.objects;
drop policy if exists videos_update on storage.objects;
drop policy if exists videos_delete on storage.objects;
create policy videos_insert on storage.objects for insert to authenticated with check (bucket_id = 'videos' and private.can_edit_media(name));
create policy videos_update on storage.objects for update to authenticated using (bucket_id = 'videos' and private.can_edit_media(name)) with check (bucket_id = 'videos' and private.can_edit_media(name));
create policy videos_delete on storage.objects for delete to authenticated using (bucket_id = 'videos' and private.can_edit_media(name));

-- ---------- helpers ----------
create or replace function private.media_source_ok(p_source text, p_url text)
returns boolean language sql immutable set search_path = ''
as $$
  select case p_source
    when 'youtube' then p_url ~* '^https://(www\.|m\.)?(youtube\.com/(watch\?|live/|shorts/|embed/)|youtu\.be/)'
    when 'facebook' then p_url ~* '^https://(www\.|m\.|web\.)?(facebook\.com|fb\.watch)/'
    when 'instagram' then p_url ~* '^https://(www\.)?instagram\.com/'
    when 'link' then p_url ~* '^https://'
    else false end;
$$;

create or replace function private.media_json(mi public.media_items)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select to_jsonb(mi) - 'uploader_id' || jsonb_build_object(
    'uploader', (select display_name from public.profiles where id = mi.uploader_id),
    'is_mine', mi.uploader_id = (select auth.uid()),
    'can_edit', mi.uploader_id = (select auth.uid()) or private.can_moderate_media(mi.scope, mi.scope_id));
$$;

-- ---------- add / change / remove ----------
create or replace function public.add_media(p jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := private.require_active_user();
  v_scope text := p->>'scope'; v_kind text := p->>'kind'; v_source text := coalesce(nullif(p->>'source', ''), 'upload');
  v_url text := nullif(pg_catalog.btrim(coalesce(p->>'url', '')), '');
  v_scope_id uuid; mi public.media_items;
begin
  begin v_scope_id := (p->>'scope_id')::uuid; exception when others then raise exception 'Unknown match, tournament or player.' using errcode = '22023'; end;
  if v_scope not in ('match', 'tournament', 'player') then raise exception 'Unknown place for this media.' using errcode = '22023'; end if;
  if v_kind not in ('photo', 'video', 'highlight', 'stream') then raise exception 'Choose photo, video, highlight or live stream.' using errcode = '22023'; end if;
  if v_scope = 'match' and not exists (select 1 from public.matches where id = v_scope_id)
     or v_scope = 'tournament' and not exists (select 1 from public.tournaments where id = v_scope_id)
     or v_scope = 'player' and not exists (select 1 from public.players where id = v_scope_id) then
    raise exception 'Not found.' using errcode = '22023';
  end if;
  if v_kind = 'stream' and v_scope <> 'match' then raise exception 'Live streams belong to a match.' using errcode = '22023'; end if;
  if not private.can_add_media(v_scope, v_scope_id, v_kind) then
    raise exception '%', case when v_kind = 'stream' then 'Only the match organiser, scorer or an accepted official can add the live stream.'
      when v_scope = 'match' then 'Only the organiser, officials, team owners and players of this match can add media.'
      when v_scope = 'tournament' then 'Only the organiser and owners of teams in this tournament can add media.'
      else 'Only the player or their team owner can add videos here.' end using errcode = '42501';
  end if;
  if v_kind = 'photo' and v_source <> 'upload' then raise exception 'Photos are uploaded from your phone or computer.' using errcode = '22023'; end if;
  if v_source = 'upload' then
    if v_kind = 'stream' then raise exception 'Paste the YouTube or Facebook live link.' using errcode = '22023'; end if;
    v_url := null; -- set by set_media_file after the upload
    if v_kind in ('video', 'highlight') and (select count(*) from public.media_items where uploader_id = uid and source = 'upload' and kind in ('video', 'highlight')) >= 10 then
      raise exception 'You can keep up to 10 uploaded videos. Delete one, or add a YouTube link instead.' using errcode = '22023';
    end if;
  elsif v_url is null or not private.media_source_ok(v_source, v_url) then
    raise exception '%', case v_source when 'youtube' then 'Paste a YouTube link (youtube.com or youtu.be).'
      when 'facebook' then 'Paste a Facebook video link.' when 'instagram' then 'Paste an Instagram link.' else 'Paste a link starting with https://' end using errcode = '22023';
  end if;
  if (select count(*) from public.media_items where uploader_id = uid and created_at > now() - interval '1 day') >= 100 then
    raise exception 'You can add up to 100 media items a day.' using errcode = '22023';
  end if;
  insert into public.media_items (scope, scope_id, kind, source, url, title, caption, moment, is_live, uploader_id)
  values (v_scope, v_scope_id, v_kind, v_source, v_url,
          nullif(pg_catalog.btrim(coalesce(p->>'title', '')), ''), nullif(pg_catalog.btrim(coalesce(p->>'caption', '')), ''),
          nullif(pg_catalog.btrim(coalesce(p->>'moment', '')), ''), v_kind = 'stream' and coalesce((p->>'is_live')::boolean, true), uid)
  returning * into mi;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, 'MEDIA_ADDED', 'media_items', mi.id::text, jsonb_build_object('scope', v_scope, 'scope_id', v_scope_id, 'kind', v_kind, 'source', v_source));
  if v_kind = 'stream' and mi.is_live then
    insert into public.notifications (recipient_user_id, notification_type, title, body, payload)
    select distinct t.owner_id, 'match_live_stream', 'Match is live on video', coalesce(mi.title, 'Watch the live stream on the match page.'),
           jsonb_build_object('match_id', v_scope_id, 'media_id', mi.id)
      from public.matches m join public.teams t on t.id in (m.team_a_id, m.team_b_id)
     where m.id = v_scope_id and t.owner_id <> uid;
  end if;
  return private.media_json(mi);
end;
$$;

create or replace function public.set_media_file(p_media_id uuid, p_url text, p_bytes bigint default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := private.require_active_user(); mi public.media_items;
begin
  select * into mi from public.media_items where id = p_media_id for update;
  if not found or mi.uploader_id <> uid then raise exception 'Media not found.' using errcode = '22023'; end if;
  if mi.source <> 'upload' then raise exception 'This item is a link, not an upload.' using errcode = '22023'; end if;
  if p_url is null or (p_url not like '%/storage/v1/object/public/media/gallery/' || mi.id::text || '/%'
                       and p_url not like '%/storage/v1/object/public/videos/clips/' || mi.id::text || '/%') then
    raise exception 'Upload the file first.' using errcode = '22023';
  end if;
  if mi.kind = 'photo' and p_url not like '%/media/gallery/%' or mi.kind <> 'photo' and p_url not like '%/videos/clips/%' then
    raise exception 'Wrong file type.' using errcode = '22023';
  end if;
  update public.media_items set url = p_url, file_bytes = p_bytes, updated_at = now() where id = mi.id returning * into mi;
  return private.media_json(mi);
end;
$$;

create or replace function public.update_media(p_media_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := private.require_active_user(); mi public.media_items;
begin
  select * into mi from public.media_items where id = p_media_id for update;
  if not found then raise exception 'Media not found.' using errcode = '22023'; end if;
  if mi.uploader_id <> uid and not private.can_moderate_media(mi.scope, mi.scope_id) then raise exception 'Only the person who added it or the organiser can change it.' using errcode = '42501'; end if;
  if p ? 'status' and p->>'status' not in ('visible', 'hidden') then raise exception 'Unknown status.' using errcode = '22023'; end if;
  if p ? 'url' and mi.source <> 'upload' and not private.media_source_ok(mi.source, pg_catalog.btrim(p->>'url')) then raise exception 'That link does not look right.' using errcode = '22023'; end if;
  update public.media_items set
    title = case when p ? 'title' then nullif(pg_catalog.btrim(coalesce(p->>'title', '')), '') else title end,
    caption = case when p ? 'caption' then nullif(pg_catalog.btrim(coalesce(p->>'caption', '')), '') else caption end,
    moment = case when p ? 'moment' then nullif(pg_catalog.btrim(coalesce(p->>'moment', '')), '') else moment end,
    url = case when p ? 'url' and mi.source <> 'upload' then pg_catalog.btrim(p->>'url') else url end,
    is_live = case when p ? 'is_live' and mi.kind = 'stream' then (p->>'is_live')::boolean else is_live end,
    status = coalesce(p->>'status', status), updated_at = now()
  where id = mi.id returning * into mi;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, 'MEDIA_UPDATED', 'media_items', mi.id::text, p - 'caption');
  return private.media_json(mi);
end;
$$;

create or replace function public.delete_media(p_media_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := private.require_active_user(); mi public.media_items;
begin
  select * into mi from public.media_items where id = p_media_id for update;
  if not found then raise exception 'Media not found.' using errcode = '22023'; end if;
  if mi.uploader_id <> uid and not private.can_moderate_media(mi.scope, mi.scope_id) then raise exception 'Only the person who added it or the organiser can delete it.' using errcode = '42501'; end if;
  delete from public.media_items where id = mi.id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, 'MEDIA_DELETED', 'media_items', mi.id::text, jsonb_build_object('scope', mi.scope, 'scope_id', mi.scope_id, 'kind', mi.kind));
  return jsonb_build_object('deleted', true);
end;
$$;

-- ---------- read ----------
create or replace function public.list_media(p_scope text, p_scope_id uuid, p_kind text default null)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(private.media_json(mi) order by mi.is_live desc, mi.created_at desc)
              from public.media_items mi
             where mi.scope = p_scope and mi.scope_id = p_scope_id and (p_kind is null or mi.kind = p_kind)
               and (mi.url is not null or mi.uploader_id = (select auth.uid()))
               and (mi.status = 'visible' or mi.uploader_id = (select auth.uid()) or private.can_moderate_media(mi.scope, mi.scope_id))), '[]'::jsonb),
    'can_add', private.can_add_media(p_scope, p_scope_id, 'photo'),
    'can_stream', p_scope = 'match' and private.can_add_media(p_scope, p_scope_id, 'stream'),
    'can_moderate', private.can_moderate_media(p_scope, p_scope_id));
$$;

-- Site-wide: live streams now + latest videos / highlights / photos (#177, #180, #181)
create or replace function private.media_about(p_scope text, p_scope_id uuid)
returns text language sql stable security definer set search_path = ''
as $$
  select case p_scope
    when 'match' then (select coalesce(m.title, ta.name || ' vs ' || tb.name) from public.matches m
                        left join public.teams ta on ta.id = m.team_a_id left join public.teams tb on tb.id = m.team_b_id where m.id = p_scope_id)
    when 'tournament' then (select name from public.tournaments where id = p_scope_id)
    else (select display_name from public.players where id = p_scope_id) end;
$$;

create or replace function public.media_feed(p jsonb default '{}'::jsonb)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'live', coalesce((select jsonb_agg(private.media_json(mi) || jsonb_build_object('about', private.media_about(mi.scope, mi.scope_id)) order by mi.created_at desc)
              from (select * from public.media_items where kind = 'stream' and is_live and status = 'visible' order by created_at desc limit 20) mi), '[]'::jsonb),
    'latest', coalesce((select jsonb_agg(private.media_json(mi) || jsonb_build_object('about', private.media_about(mi.scope, mi.scope_id)) order by mi.created_at desc)
              from (select * from public.media_items where kind <> 'stream' and status = 'visible' and url is not null
                       and (nullif(p->>'kind', '') is null or kind = p->>'kind') order by created_at desc limit 60) mi), '[]'::jsonb));
$$;

-- ---------- grants ----------
revoke all on function private.can_moderate_media(text, uuid) from public, anon, authenticated;
revoke all on function private.can_add_media(text, uuid, text) from public, anon, authenticated;
revoke all on function private.media_source_ok(text, text) from public, anon, authenticated;
revoke all on function private.media_json(public.media_items) from public, anon, authenticated;
revoke all on function private.media_about(text, uuid) from public, anon, authenticated;
revoke all on function public.add_media(jsonb) from public, anon;
revoke all on function public.set_media_file(uuid, text, bigint) from public, anon;
revoke all on function public.update_media(uuid, jsonb) from public, anon;
revoke all on function public.delete_media(uuid) from public, anon;
revoke all on function public.list_media(text, uuid, text) from public;
revoke all on function public.media_feed(jsonb) from public;
grant execute on function public.add_media(jsonb) to authenticated;
grant execute on function public.set_media_file(uuid, text, bigint) to authenticated;
grant execute on function public.update_media(uuid, jsonb) to authenticated;
grant execute on function public.delete_media(uuid) to authenticated;
grant execute on function public.list_media(text, uuid, text) to anon, authenticated;
grant execute on function public.media_feed(jsonb) to anon, authenticated;
