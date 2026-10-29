# Community posts: Plan 6b built in a reduced form

**Status:** decided · 2026-10-30 · spec §10.2 · plan `2026-10-23-community.md` (reduced)

## Context

The spec has a mentor community feed. Plan 6b wrote it in full: attachments in Storage, retention
jobs, an "Add to calendar" button, a countdown, paging and a feature-switch helper from Plan 5a. The
plan was written before Plans 4b to 6a, which are not built, and it depends on two of them. The
owner asked for the feed to be built end to end on the last day of the hackathon, so it is built
small and without those dependencies.

## Decision

- **Built:** mentors and admins write, edit and delete posts; students read them. A post has a
  title, plain-text body, an audience (everyone, or one cohort) and optional session details: a
  time, a length and an `https:` link. A student's feed is kept on the phone for offline reading.
- **Not built (cut from the plan):** attachments and the Storage bucket (so no `BAD_FILE`, no file
  retention), "Add to calendar", the countdown (the screen shows upcoming, on now or over), paging
  (fixed caps: 30 posts for a student, 50 for staff), and the `requireFeature` helper (the existing
  `effectiveSwitches` check is used, and `community_feed` was already a switch).
- **Who posts:** a mentor posts only to their own cohorts; an admin to anyone, or to everyone. An
  author edits their own post while it is in their scope (a mentor must still hold its cohort);
  an admin deletes any post but edits only their own. Anything else is `FORBIDDEN`, the same
  answer as for an unknown post. Role, cohorts and learner come from the verified session.
- **Deleting is real deletion** (no soft delete): the row goes. The audit entry
  (`post_created`, `post_edited`, `post_deleted`) keeps the post id, the audience and the cohort id,
  never the title, body or link.
- **The cohort link is `on delete cascade`, not `set null`.** With `set null`, deleting a cohort
  would turn its posts into posts to everyone and show them to every student. Deleting a cohort
  removes its posts. A removed author leaves the post in place; it then shows the platform name.
- **Text is plain text.** Title and body are never rendered as HTML or Markdown. A session link
  must be `https:` when it is written (the contract) and again when it is shown (a copy from
  another build is not trusted), and opens with `rel="noopener noreferrer"`.
- **Read access** is repeated in row-level security (`can_read_post`): a student reads posts to
  everyone and to their own cohort, a mentor their cohorts, everyone and their own, an admin all.
  Nobody writes through the database API.
- **A paused student gets no feed** (`DEACTIVATED`), as with every other student route. A student
  with no cohort sees only posts to everyone.
- **On the phone:** the feed copy is a setting named `feed:<profileId>`. Removing a profile from
  the phone removes every setting ending in its id, so the copy goes with it. The server saying
  `FEATURE_OFF`, `NOT_LINKED`, `FORBIDDEN` or `DEACTIVATED` clears the copy; being offline keeps it.
  The screen is a lazy chunk, so the first load grew by 0.4 KB only (the link on Home).

## Consequences

- Plan 6b's attachments, calendar button, countdown and paging can still be built later on this
  table; the plan stays, marked as built in reduced form.
- The feed is not checked against `/v1/me`'s switches on the server beyond `community_feed`.
- Known limit, shared with every audited action: the audit entry is written just after the change,
  not in the same transaction.
- Posts are not retained or purged by a job: they stay until deleted by their author or an admin.
