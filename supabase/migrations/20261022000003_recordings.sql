-- Speaking recordings (spec §6.5, §7.2; Plan 3b). The bytes live in the private `recordings`
-- bucket at `<learner_id>/<id>`; this table holds their details. Idempotent.
create table if not exists public.recordings (
  id uuid primary key,
  learner_id uuid not null references public.learners(id) on delete cascade,
  lesson_id text not null check (char_length(lesson_id) <= 64),
  item_id text not null check (char_length(item_id) <= 64),
  mime text not null check (mime in ('audio/webm', 'audio/ogg', 'audio/mp4')),
  bytes integer not null check (bytes between 1 and 1048576),
  duration_ms integer not null check (duration_ms between 1 and 31000),
  recorded_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'uploaded')),
  uploaded_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists recordings_learner_idx on public.recordings (learner_id);
create index if not exists recordings_status_uploaded_idx on public.recordings (status, uploaded_at);
create index if not exists recordings_reviewed_idx on public.recordings (reviewed_at);

alter table public.recordings enable row level security;
revoke all on public.recordings from anon;
revoke insert, update, delete, truncate on public.recordings from authenticated;
drop policy if exists recordings_select_own on public.recordings;
create policy recordings_select_own on public.recordings
  for select to authenticated using (learner_id = public.current_learner_id());

drop trigger if exists set_updated_at on public.recordings;
create trigger set_updated_at before update on public.recordings
  for each row execute function public.set_updated_at();

-- The bucket, so `db push` gives every project the same limits. Private: no policy on
-- storage.objects lets a student or anon read or write it; only the API signs URLs.
-- This is the plan's one Supabase-specific statement (decision record, Plan 3b).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recordings', 'recordings', false, 1048576,
        array['audio/webm', 'audio/ogg', 'audio/mp4'])
on conflict (id) do nothing;
