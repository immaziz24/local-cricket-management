-- Batch 14 fix: microsite banner image must be https:// (the site is served over https; http images would be blocked).
create or replace function public.save_microsite(p_tournament_id uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_active_user(); s text := lower(nullif(btrim(coalesce(p ->> 'slug', '')), '')); chk jsonb; col text := nullif(btrim(coalesce(p ->> 'brand_color', '')), ''); hero text; ft text := nullif(btrim(coalesce(p ->> 'footer', '')), ''); v jsonb;
begin
  perform private.require_tournament_organiser(p_tournament_id);
  if s is not null then
    chk := public.check_microsite_slug(p_tournament_id, s);
    if not (chk ->> 'ok')::boolean then raise exception '%', chk ->> 'reason' using errcode = '22023'; end if;
  end if;
  if col is not null and col !~* '^#[0-9a-f]{6}$' then raise exception 'The brand colour must look like #1a7f37.' using errcode = '22023'; end if;
  hero := private.clean_https(p ->> 'hero_url');
  if hero = 'INVALID' or (hero is not null and hero !~* '^https://') then raise exception 'The banner image link must start with https://' using errcode = '22023'; end if;
  if ft is not null and char_length(ft) > 160 then raise exception 'The footer text can be at most 160 characters.' using errcode = '22023'; end if;
  v := jsonb_strip_nulls(jsonb_build_object('brand_color', lower(col), 'hero_url', hero, 'footer', ft, 'standalone', coalesce((p ->> 'standalone')::boolean, false)));
  update public.tournaments set microsite_slug = s, microsite = v, updated_at = now() where id = p_tournament_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata) values (uid, 'MICROSITE_SAVED', 'tournaments', p_tournament_id::text, jsonb_build_object('slug', s));
  return jsonb_build_object('slug', s, 'microsite', v);
end;
$$;
revoke execute on function public.save_microsite(uuid,jsonb) from public, anon;
grant execute on function public.save_microsite(uuid,jsonb) to authenticated;
