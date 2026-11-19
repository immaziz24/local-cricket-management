-- Batch 13 follow-up: penalty history rows get a strictly increasing timestamp so same-moment changes keep their order.
alter table public.late_penalty_events alter column created_at set default clock_timestamp();
