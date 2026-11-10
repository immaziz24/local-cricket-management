-- Phase 2 / Category B – #46 Double-elimination format
-- A team is out after its second defeat. Matches carry a bracket: winners, losers or grand_final.
-- Rounds are created by the website: unbeaten teams play each other (winners bracket), teams with one
-- defeat play each other (losers bracket); the last unbeaten team meets the last one-defeat team in the grand final.

alter table public.tournaments drop constraint if exists tournaments_structure_check;
alter table public.tournaments add constraint tournaments_structure_check
  check (structure in ('league','round_robin','double_round_robin','knockout','groups_knockout','double_elimination','custom'));

alter table public.matches add column if not exists bracket text
  check (bracket is null or bracket in ('winners','losers','grand_final'));

-- save fixtures now also stores the bracket
create or replace function public.save_generated_fixtures(p_tournament_id uuid, p_fixtures jsonb, p_replace boolean default true)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare f jsonb; n int := 0; next_no int; a uuid; b uuid;
begin
  perform private.require_tournament_organiser(p_tournament_id);
  if jsonb_typeof(p_fixtures) <> 'array' or jsonb_array_length(p_fixtures) = 0 then
    raise exception 'No fixtures to save.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_fixtures) > 500 then raise exception 'Too many fixtures.' using errcode = '22023'; end if;
  if p_replace then
    delete from public.matches where tournament_id = p_tournament_id and status = 'scheduled';
  end if;
  select coalesce(max(match_no), 0) into next_no from public.matches where tournament_id = p_tournament_id;

  for f in select * from jsonb_array_elements(p_fixtures) loop
    a := nullif(f->>'team_a_id', '')::uuid; b := nullif(f->>'team_b_id', '')::uuid;
    if (a is not null and not exists (select 1 from public.tournament_teams where tournament_id = p_tournament_id and team_id = a and status = 'approved'))
       or (b is not null and not exists (select 1 from public.tournament_teams where tournament_id = p_tournament_id and team_id = b and status = 'approved')) then
      raise exception 'Fixtures can only use approved teams of this tournament.' using errcode = '22023';
    end if;
    next_no := next_no + 1;
    insert into public.matches (tournament_id, group_id, stage, bracket, round_no, match_no, team_a_id, team_b_id, scheduled_at, venue, created_by)
    values (p_tournament_id, nullif(f->>'group_id', '')::uuid, coalesce(nullif(f->>'stage', ''), 'league'), nullif(f->>'bracket', ''),
            nullif(f->>'round_no', '')::int, next_no, a, b, nullif(f->>'scheduled_at', '')::timestamptz,
            coalesce(nullif(f->>'venue', ''), (select venue from public.tournaments where id = p_tournament_id)), (select auth.uid()));
    n := n + 1;
  end loop;

  update public.tournaments set matches_total = (select count(*) from public.matches where tournament_id = p_tournament_id),
         status = case when status = 'registration' then 'upcoming' else status end
   where id = p_tournament_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'FIXTURES_GENERATED', 'tournaments', p_tournament_id::text, jsonb_build_object('matches', n));
  return jsonb_build_object('matches', n);
end;
$$;
