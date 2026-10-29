-- Undo 20261029000001_community.sql.
drop table if exists public.community_posts;
drop function if exists public.can_read_post(uuid, uuid);
