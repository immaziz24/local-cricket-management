create or replace function public.tournament_creator_name(public.tournaments)
returns text language sql stable security definer set search_path = ''
as $$
  select nullif(pg_catalog.btrim(p.display_name), '')
  from public.tournaments t
  join public.profiles p on p.id = t.owner_id
  where t.id = $1.id
$$;
revoke all on function public.tournament_creator_name(public.tournaments) from public;
grant execute on function public.tournament_creator_name(public.tournaments) to anon, authenticated;
