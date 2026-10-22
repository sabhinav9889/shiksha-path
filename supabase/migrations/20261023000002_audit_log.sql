-- Every staff action (spec §8.1 audit log; Plan 4a). Ids, keys and old/new values only: never a
-- code, a token or a comment's text. Read by admins through /v1. Idempotent.
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  staff_id uuid references public.staff(id) on delete set null,
  action text not null check (char_length(action) <= 40),
  learner_id uuid,
  details jsonb not null default '{}'::jsonb,
  at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists audit_log_learner_idx on public.audit_log (learner_id);
create index if not exists audit_log_at_idx on public.audit_log (at);
create index if not exists audit_log_staff_idx on public.audit_log (staff_id);
alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;

drop trigger if exists set_updated_at on public.audit_log;
create trigger set_updated_at before update on public.audit_log
  for each row execute function public.set_updated_at();
