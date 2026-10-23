-- Undo 20261023000001_staff.sql.
drop policy if exists recordings_select_staff on public.recordings;
drop policy if exists events_select_staff on public.learner_events;
drop policy if exists learners_select_staff on public.learners;
drop function if exists public.staff_can_see(uuid);
drop table if exists public.staff_cohorts;
drop table if exists public.staff;
alter table if exists public.learners drop column if exists deactivated_at;
alter table if exists public.cohorts drop column if exists lab_id;
drop table if exists public.labs;
