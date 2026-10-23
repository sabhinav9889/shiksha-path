-- Lab attendance (spec §8 mentor actions; Plan 4a): one mark per learner per IST day.
-- Idempotent.
create table if not exists public.lab_attendance (
  learner_id uuid not null references public.learners(id) on delete cascade,
  day date not null,
  present boolean not null,
  marked_by uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (learner_id, day)
);
create index if not exists lab_attendance_marked_by_idx on public.lab_attendance (marked_by);
alter table public.lab_attendance enable row level security;
revoke all on public.lab_attendance from anon;
revoke insert, update, delete, truncate on public.lab_attendance from authenticated;
drop policy if exists attendance_select_staff on public.lab_attendance;
create policy attendance_select_staff on public.lab_attendance
  for select to authenticated using (public.staff_can_see(learner_id));

drop trigger if exists set_updated_at on public.lab_attendance;
create trigger set_updated_at before update on public.lab_attendance
  for each row execute function public.set_updated_at();
