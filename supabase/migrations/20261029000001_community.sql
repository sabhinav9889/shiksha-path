-- Community posts (spec §10.2, Plan 6b in reduced form): mentors and admins post, students read.
-- No attachments. A post goes to everyone (cohort_id null) or to one cohort. Idempotent.
create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  -- A removed author leaves the post in place; the feed then shows the platform name.
  author_id uuid references public.staff(id) on delete set null,
  -- A deleted cohort takes its own posts with it. `set null` would turn them into posts to
  -- everyone and show them to every student.
  cohort_id uuid references public.cohorts(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  body text not null default '' check (char_length(body) <= 4000),
  session_starts_at timestamptz,
  session_minutes int check (session_minutes between 15 and 480),
  session_link text check (session_link like 'https://%' and char_length(session_link) <= 500),
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((session_starts_at is null) = (session_minutes is null)),
  check (session_link is null or session_starts_at is not null)
);
create index if not exists community_posts_author_idx on public.community_posts (author_id);
create index if not exists community_posts_cohort_idx on public.community_posts (cohort_id);
create index if not exists community_posts_created_idx
  on public.community_posts (created_at desc, id desc);

alter table public.community_posts enable row level security;
revoke all on public.community_posts from anon;
revoke insert, update, delete, truncate on public.community_posts from authenticated;

-- Who may read a post: an active admin; an active mentor for their own posts, posts to everyone
-- and posts to their cohorts; a student for posts to everyone and to their own cohort.
create or replace function public.can_read_post(cohort uuid, author uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.staff s
    where s.auth_user_id = auth.uid() and s.active
      and (s.role = 'admin' or author = s.id or cohort is null
        or exists (select 1 from public.staff_cohorts sc
                   where sc.staff_id = s.id and sc.cohort_id = cohort))
  ) or exists (
    select 1 from public.learners l
    where l.id = public.current_learner_id() and (cohort is null or l.cohort_id = cohort)
  );
$$;
revoke execute on function public.can_read_post(uuid, uuid) from anon;

drop policy if exists posts_select on public.community_posts;
create policy posts_select on public.community_posts
  for select to authenticated using (public.can_read_post(cohort_id, author_id));

drop trigger if exists set_updated_at on public.community_posts;
create trigger set_updated_at before update on public.community_posts
  for each row execute function public.set_updated_at();
