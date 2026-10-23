-- Staff (mentors and admins), labs, and what each mentor may see (spec §8, §8.1; Plan 4a).
-- Idempotent.
create table if not exists public.labs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cohorts add column if not exists lab_id uuid references public.labs(id)
  on delete set null;
create index if not exists cohorts_lab_id_idx on public.cohorts (lab_id);

alter table public.learners add column if not exists deactivated_at timestamptz;

create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(email) between 3 and 254),
  role text not null check (role in ('mentor', 'admin')),
  name text not null check (char_length(name) between 1 and 80),
  active boolean not null default true,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists staff_email_idx on public.staff (lower(email));

create table if not exists public.staff_cohorts (
  staff_id uuid not null references public.staff(id) on delete cascade,
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (staff_id, cohort_id)
);
create index if not exists staff_cohorts_cohort_idx on public.staff_cohorts (cohort_id);

do $$
declare
  t text;
begin
  foreach t in array array['labs', 'staff', 'staff_cohorts'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete, truncate on public.%I from authenticated', t);
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function public.set_updated_at()', t);
  end loop;
end
$$;

-- Defence in depth (the API checks first): may the signed-in staff member see this learner?
create or replace function public.staff_can_see(learner uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.staff s
    where s.auth_user_id = auth.uid() and s.active
      and (s.role = 'admin' or exists (
        select 1 from public.staff_cohorts sc join public.learners l on l.cohort_id = sc.cohort_id
        where sc.staff_id = s.id and l.id = learner))
  );
$$;
revoke execute on function public.staff_can_see(uuid) from anon;

drop policy if exists learners_select_staff on public.learners;
create policy learners_select_staff on public.learners
  for select to authenticated using (public.staff_can_see(id));
drop policy if exists events_select_staff on public.learner_events;
create policy events_select_staff on public.learner_events
  for select to authenticated using (public.staff_can_see(learner_id));
drop policy if exists recordings_select_staff on public.recordings;
create policy recordings_select_staff on public.recordings
  for select to authenticated using (public.staff_can_see(learner_id));
drop policy if exists staff_select_self on public.staff;
create policy staff_select_self on public.staff
  for select to authenticated using (auth_user_id = auth.uid());
