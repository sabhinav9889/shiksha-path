-- Students deleted on request (privacy rule): only the id stays, so their phones can wipe their
-- copy on the next sync. No name, email or anything else. Idempotent.
create table if not exists public.deleted_learners (
  id uuid primary key,
  deleted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.deleted_learners enable row level security;
revoke all on public.deleted_learners from anon, authenticated;

drop trigger if exists set_updated_at on public.deleted_learners;
create trigger set_updated_at before update on public.deleted_learners
  for each row execute function public.set_updated_at();
