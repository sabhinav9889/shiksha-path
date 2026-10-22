-- Backup login codes (spec §5.3, Plan 3b). Only a keyed hash of the code is stored; the auth
-- user behind it has a made-up email. Only the server's own connection reads this. Idempotent.
create table if not exists public.login_codes (
  learner_id uuid primary key references public.learners(id) on delete cascade,
  lookup text not null unique check (char_length(lookup) = 64),
  auth_user_id uuid not null unique,
  auth_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.login_codes enable row level security;
revoke all on public.login_codes from anon, authenticated;

drop trigger if exists set_updated_at on public.login_codes;
create trigger set_updated_at before update on public.login_codes
  for each row execute function public.set_updated_at();
