alter table public.tournaments add column series_match_count integer
  check (series_match_count between 2 and 15);

create function public.create_cricket_series(p jsonb, p_match_count integer)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  created jsonb;
begin
  if p_match_count is null or p_match_count not between 2 and 15 then
    raise exception 'Choose between 2 and 15 matches.' using errcode = '22023';
  end if;
  -- The existing creation function checks sign-in and account status.
  created := public.create_tournament(p || '{"category":"Series","teams_count":2}'::jsonb);
  update public.tournaments
     set series_match_count = p_match_count
   where id = (created->>'id')::uuid and owner_id = (select auth.uid())
   returning to_jsonb(tournaments) into created;
  if not found then
    raise exception 'Could not save the series.' using errcode = '42501';
  end if;
  return created;
end;
$$;

revoke all on function public.create_cricket_series(jsonb, integer) from public, anon;
grant execute on function public.create_cricket_series(jsonb, integer) to authenticated;
