-- Rate-limit counters (Plan 3b). Buckets hold learner ids or hashed addresses, never an IP or an
-- email. Only the server's own connection uses this table. Idempotent.
create table if not exists public.rate_limits (
  bucket text not null check (char_length(bucket) <= 128),
  window_start timestamptz not null,
  hits integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (bucket, window_start)
);
create index if not exists rate_limits_window_idx on public.rate_limits (window_start);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

drop trigger if exists rate_limits_updated_at on public.rate_limits;
create trigger rate_limits_updated_at before update on public.rate_limits
  for each row execute function public.set_updated_at();
