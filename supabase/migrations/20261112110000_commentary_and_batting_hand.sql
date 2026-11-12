-- #19 automatic commentary: allow longer ball commentary (generated text of 25+ words plus the scorer's note).
do $$
declare c text;
begin
  select conname into c from pg_constraint where conrelid = 'public.balls'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%length(commentary) <= 300%';
  if c is not null then execute format('alter table public.balls drop constraint %I', c); end if;
end $$;
alter table public.balls drop constraint if exists balls_commentary_length;
alter table public.balls add constraint balls_commentary_length check (commentary is null or length(commentary) <= 600);

-- The live state tells the scorer each batter's batting hand, so the wagon wheel and commentary
-- name the right side (off / leg) for left-handers.
do $$
declare d text; n text;
begin
  d := pg_get_functiondef('public.get_live_state(uuid)'::regprocedure);
  n := replace(d, E'''batting_side'', coalesce((select jsonb_agg(jsonb_build_object(''player_id'', mp.player_id, ''name'', p.display_name,',
                  E'''batting_side'', coalesce((select jsonb_agg(jsonb_build_object(''player_id'', mp.player_id, ''name'', p.display_name, ''batting_style'', p.batting_style,');
  if n = d then raise exception 'get_live_state: batting_side not found'; end if;
  execute n;
end $$;
