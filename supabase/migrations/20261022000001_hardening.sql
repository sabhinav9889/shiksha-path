-- Hardening from the Plan 3a review. Idempotent: safe to run more than once.

-- A pull must never move its cursor past an event whose transaction has not committed yet
-- (`seq` is taken at insert, not at commit). Each row remembers its transaction; a pull returns
-- only rows from transactions older than every one still running.
alter table public.learner_events
  add column if not exists tx_id xid8 not null default pg_current_xact_id();
create index if not exists learner_events_learner_seq_tx_idx
  on public.learner_events (learner_id, seq, tx_id);

-- Nobody reaches the tables through the database API except to read their own rows (RLS).
-- The app uses only /v1; the service role inside the function is unaffected.
revoke all on all tables in schema public from anon;
revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public from authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public
  revoke insert, update, delete, truncate, references, trigger on tables from authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon;

-- No GraphQL endpoint (architecture rule: not using GraphQL).
drop extension if exists pg_graphql;
