-- One-to-one mentor slots and bookings (spec §10.1, Plan 6a in reduced form: no Google Calendar,
-- the mentor pastes their own https link). Idempotent.
create table if not exists public.mentor_slots (
  id uuid primary key default gen_random_uuid(),
  -- A removed mentor takes their slots (and those bookings) with them.
  mentor_id uuid not null references public.staff(id) on delete cascade,
  starts_at timestamptz not null,
  minutes int not null check (minutes between 15 and 120 and minutes % 15 = 0),
  link text check (link like 'https://%' and char_length(link) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mentor_slots_mentor_idx on public.mentor_slots (mentor_id, starts_at);
create index if not exists mentor_slots_starts_idx on public.mentor_slots (starts_at);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.mentor_slots(id) on delete cascade,
  -- Deleting a student removes their bookings and notes with them.
  learner_id uuid not null references public.learners(id) on delete cascade,
  topic text not null check (topic in ('doubt', 'progress', 'career', 'resume')),
  -- A minor's own words: plain text, kept off logs and audit entries.
  note text not null default '' check (char_length(note) <= 280),
  -- The mentor's link as it was when this was booked: only this booking's student may read it.
  link text,
  status text not null default 'booked' check (status in ('booked', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- One live booking per slot, whatever the code does: the database refuses the second.
create unique index if not exists bookings_one_live_per_slot
  on public.bookings (slot_id) where status = 'booked';
create index if not exists bookings_learner_idx on public.bookings (learner_id);

alter table public.mentor_slots enable row level security;
alter table public.bookings enable row level security;
revoke all on public.mentor_slots from anon;
revoke all on public.bookings from anon;
revoke insert, update, delete, truncate on public.mentor_slots from authenticated;
revoke insert, update, delete, truncate on public.bookings from authenticated;

-- Students read no slot rows at all (a slot holds the mentor's link); the API lists open slots
-- without it. An active admin reads every slot, an active mentor their own.
create or replace function public.can_read_slot(mentor uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.staff s
    where s.auth_user_id = auth.uid() and s.active and (s.role = 'admin' or s.id = mentor)
  );
$$;
revoke execute on function public.can_read_slot(uuid) from anon;

-- A booking: its own student while not paused, an active admin, and the mentor who owns the
-- slot (even if the student has since moved cohort). Another mentor of the same cohort does not:
-- the note is the student's own words to one mentor.
create or replace function public.can_read_booking(slot uuid, learner uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select (
    learner = public.current_learner_id()
    and exists (select 1 from public.learners l where l.id = learner and l.deactivated_at is null)
  ) or exists (
    select 1 from public.staff s
    where s.auth_user_id = auth.uid() and s.active and s.role = 'admin'
  ) or exists (
    select 1 from public.staff s join public.mentor_slots ms on ms.mentor_id = s.id
    where s.auth_user_id = auth.uid() and s.active and ms.id = slot
  );
$$;
revoke execute on function public.can_read_booking(uuid, uuid) from anon;

drop policy if exists slots_select on public.mentor_slots;
create policy slots_select on public.mentor_slots
  for select to authenticated using (public.can_read_slot(mentor_id));
drop policy if exists bookings_select on public.bookings;
create policy bookings_select on public.bookings
  for select to authenticated using (public.can_read_booking(slot_id, learner_id));

drop trigger if exists set_updated_at on public.mentor_slots;
create trigger set_updated_at before update on public.mentor_slots
  for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.bookings;
create trigger set_updated_at before update on public.bookings
  for each row execute function public.set_updated_at();
