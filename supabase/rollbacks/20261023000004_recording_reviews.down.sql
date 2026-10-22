-- Undo 20261023000004_recording_reviews.sql.
alter table if exists public.recordings drop column if exists reviewed_by;
alter table if exists public.recordings drop column if exists review_comment;
