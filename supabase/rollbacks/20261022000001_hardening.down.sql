-- Undo 20261022000001_hardening.sql. Grants return to Supabase's defaults for these roles.
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
grant execute on all functions in schema public to anon;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon;
drop index if exists public.learner_events_learner_seq_tx_idx;
alter table public.learner_events drop column if exists tx_id;
