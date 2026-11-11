-- Owner decision 2026-11-11: live streaming (#177/#178) is "coming soon". Only Admin / Super-Admin can add or
-- restart a live stream until it is switched on. Photos, videos, highlights, overlay and share cards stay open.
do $$
declare d text; n text;
begin
  d := pg_get_functiondef('public.add_media(jsonb)'::regprocedure);
  n := replace(d, $a$  if v_kind = 'stream' and v_scope <> 'match' then raise exception 'Live streams belong to a match.' using errcode = '22023'; end if;$a$,
    $b$  if v_kind = 'stream' and v_scope <> 'match' then raise exception 'Live streams belong to a match.' using errcode = '22023'; end if;
  if v_kind = 'stream' and not private.is_admin() then raise exception 'Live streaming is coming soon.' using errcode = '42501'; end if;$b$);
  if n = d then raise exception 'add_media patch point not found'; end if;
  execute n;

  d := pg_get_functiondef('public.update_media(uuid, jsonb)'::regprocedure);
  n := replace(d, $a$  if p ? 'status' and p->>'status' not in ('visible', 'hidden') then$a$,
    $b$  if mi.kind = 'stream' and coalesce((p->>'is_live')::boolean, false) and not private.is_admin() then raise exception 'Live streaming is coming soon.' using errcode = '42501'; end if;
  if p ? 'status' and p->>'status' not in ('visible', 'hidden') then$b$);
  if n = d then raise exception 'update_media patch point not found'; end if;
  execute n;
end $$;

-- The match page only offers the stream form to admins while this is coming soon.
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
    'can_stream', p_scope = 'match' and private.is_admin() and private.can_add_media(p_scope, p_scope_id, 'stream'),
    'streaming_open', false,
    'can_moderate', private.can_moderate_media(p_scope, p_scope_id));
$$;
