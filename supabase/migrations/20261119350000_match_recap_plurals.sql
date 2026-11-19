-- #380 small wording fix: "1 four", "1 over", "1 ball" in the drafted recap.
create or replace function private.recap_overs(b int) returns text language sql immutable set search_path = '' as $$
  select (b / 6)::text || case when b % 6 > 0 then '.' || (b % 6)::text else '' end || case when b = 6 then ' over' else ' overs' end;
$$;
-- build_recap was patched in place on the live database (replace of the unit words); the full text is in 20261119340000 plus these rules:
-- ' overs' removed from callers (recap_overs now adds the unit), ' balls'/' fours'/' sixes' become singular when the count is 1.
