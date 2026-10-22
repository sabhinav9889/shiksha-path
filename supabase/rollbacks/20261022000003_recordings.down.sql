-- Undo 20261022000003_recordings.sql. The `recordings` bucket stays: Supabase refuses direct
-- deletes from its storage tables. Empty and remove it with the Storage API if it must go.
drop table if exists public.recordings;
