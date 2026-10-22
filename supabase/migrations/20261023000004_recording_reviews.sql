-- A mentor's review of a recording (spec §8: recordings with short comments; Plan 4a). Setting
-- reviewed_at starts the 30-day retention clock (Plan 3b). Idempotent.
alter table public.recordings add column if not exists review_comment text
  check (char_length(review_comment) <= 280);
alter table public.recordings add column if not exists reviewed_by uuid
  references public.staff(id) on delete set null;
create index if not exists recordings_reviewed_by_idx on public.recordings (reviewed_by);
