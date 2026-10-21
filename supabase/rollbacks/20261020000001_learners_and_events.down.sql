-- Undo 20261020000001_learners_and_events.sql, in reverse order.
drop table if exists public.feature_overrides;
drop table if exists public.feature_switches;
drop table if exists public.learner_events;
drop table if exists public.learner_identities;
drop table if exists public.learners;
drop table if exists public.cohorts;
drop function if exists public.current_learner_id();
drop function if exists public.set_updated_at();
