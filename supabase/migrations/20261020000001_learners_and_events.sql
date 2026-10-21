-- Learners, their Google identity link, the append-only event log and feature switches.
-- Spec §5.5 (our own ids), §7.2, §7.3, §8.1. Idempotent: safe to run more than once.

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.cohorts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.learners (
  id uuid primary key,
  name text not null check (char_length(name) between 1 and 40),
  cohort_id uuid references public.cohorts(id) on delete set null,
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists learners_cohort_id_idx on public.learners (cohort_id);

-- The only place the auth provider's user id appears (portability rule 4).
create table if not exists public.learner_identities (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  learner_id uuid not null unique references public.learners(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Append-only; de-duplicated by the event id the phone generated.
create table if not exists public.learner_events (
  seq bigint generated always as identity primary key,
  id uuid not null unique,
  learner_id uuid not null references public.learners(id) on delete cascade,
  type text not null check (char_length(type) <= 64),
  at timestamptz not null,
  data jsonb not null,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists learner_events_learner_seq_idx on public.learner_events (learner_id, seq);

create table if not exists public.feature_switches (
  key text primary key,
  enabled_for_all boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.feature_overrides (
  learner_id uuid references public.learners(id) on delete cascade,
  key text references public.feature_switches(key) on delete cascade,
  enabled boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (learner_id, key)
);
create index if not exists feature_overrides_key_idx on public.feature_overrides (key);

do $$
declare
  t text;
begin
  foreach t in array array['cohorts', 'learners', 'learner_identities', 'learner_events',
                           'feature_switches', 'feature_overrides'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function public.set_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;

-- The signed-in user's learner id, for row-level security.
create or replace function public.current_learner_id() returns uuid
language sql stable security definer set search_path = public as $$
  select learner_id from public.learner_identities where auth_user_id = auth.uid();
$$;

-- Read-only policies for signed-in students; no policy grants any write, and none for anon.
-- Writes happen only through the /v1 API's own database connection.
drop policy if exists learners_select_own on public.learners;
create policy learners_select_own on public.learners
  for select to authenticated using (id = public.current_learner_id());

drop policy if exists identities_select_own on public.learner_identities;
create policy identities_select_own on public.learner_identities
  for select to authenticated using (auth_user_id = auth.uid());

drop policy if exists events_select_own on public.learner_events;
create policy events_select_own on public.learner_events
  for select to authenticated using (learner_id = public.current_learner_id());

drop policy if exists overrides_select_own on public.feature_overrides;
create policy overrides_select_own on public.feature_overrides
  for select to authenticated using (learner_id = public.current_learner_id());

drop policy if exists switches_select_all on public.feature_switches;
create policy switches_select_all on public.feature_switches
  for select to authenticated using (true);
