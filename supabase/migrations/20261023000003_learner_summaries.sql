-- One row per learner for staff screens (spec §8; database rule: dashboards read summary tables,
-- never the raw log per request). Re-derived after every upload. Idempotent.
create table if not exists public.learner_summaries (
  learner_id uuid primary key references public.learners(id) on delete cascade,
  summary jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.learner_summaries enable row level security;
revoke all on public.learner_summaries from anon;
revoke insert, update, delete, truncate on public.learner_summaries from authenticated;
drop policy if exists summaries_select_staff on public.learner_summaries;
create policy summaries_select_staff on public.learner_summaries
  for select to authenticated using (public.staff_can_see(learner_id));

drop trigger if exists set_updated_at on public.learner_summaries;
create trigger set_updated_at before update on public.learner_summaries
  for each row execute function public.set_updated_at();
