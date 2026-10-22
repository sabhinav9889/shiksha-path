-- The platform's name and colours (spec §8.1 branding, Plan 3b): one row, versioned. Phones read
-- it through GET /v1/branding only. Idempotent.
create table if not exists public.branding (
  id boolean primary key default true check (id),
  name_hi text not null check (char_length(name_hi) between 1 and 40),
  name_en text not null check (char_length(name_en) between 1 and 40),
  primary_color text not null check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  accent_color text not null check (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.branding enable row level security;
revoke all on public.branding from anon, authenticated;

drop trigger if exists set_updated_at on public.branding;
create trigger set_updated_at before update on public.branding
  for each row execute function public.set_updated_at();

insert into public.branding (id, name_hi, name_en, primary_color, accent_color, version)
values (true, 'शिक्षा पथ', 'Shiksha Path', '#2f3ab2', '#b45309', 0)
on conflict (id) do nothing;
