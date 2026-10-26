# Mentors and admins: roles, scope and the audit log

**Status:** decided · 2026-10-23 · spec §8, §8.1, §5.3, §7.4 · plan `2026-10-22-mentor-admin.md`

## Context

Plan 4a adds the people who look after students: mentors, who see and help their own cohorts,
and admins, who run the organisation. Both handle minors' data, so who may see what, and how
every change is traced, has to be fixed before the first staff member signs in. The owner
confirmed the builder's-call values in the plan on 2026-10-22.

## Decision

- **Two roles, scope from the server.** A mentor reaches only the students in the cohorts they
  are assigned to; an admin reaches everyone. Identity and role come from the verified session
  and the `staff` table, never from the request. An unknown student and one out of scope both
  answer `FORBIDDEN`, so a mentor cannot probe for ids. Row-level security repeats the scope on
  every new table (`staff_can_see()`).
- **Invites by email, claimed by Google.** An admin (the first one through
  `npm run admin -- add-staff`) invites an email. The first Google sign-in with that email claims
  the invite; code sign-ins and learner accounts never can, and a staff account cannot become a
  learner. An inactive or unclaimed staff row is `NOT_STAFF`.
- **The staff section lives in the same app**, at `#/staff`, as a lazily loaded chunk with its
  own Supabase session (auth rows under `staff:`). Learner profiles on the same device are never
  signed in or out by it, and nothing of it is in the students' first load (the size check fails
  if a first-load script names `/v1/staff/`).
- **Dashboards read a summary row per learner** (`learner_summaries`), refreshed after every push
  under a per-learner advisory lock, never the raw event log per request. "Needs attention" is
  inactive for 3 days, one lesson started on 3 different days in India time, or the last three
  scored lessons under 60%.
- **A mentor's level change is an event.** `level_set` is written by the server only (phones
  may not push it), pulled like any other event, and the latest per track wins over the starting
  test. Progress stays append-only.
- **Deactivating a student** stops their syncing (`DEACTIVATED`); the phone says so and keeps
  working offline. Turning them back on uploads what was done meanwhile.
- **Every staff change is in the audit log** (reads such as playing a recording are not logged): who, what, which student, and ids, keys and
  old → new values only. A code, a token or a comment's text is refused by the audit writer.
  Deleting a student keeps their audit entries but removes their id and marks them
  `learner: DELETED`.
- **Branding colours must be readable** under white text and as text on the page background
  (`#f4f5fa`), WCAG 4.5:1 both. The app derives the darker and softer shades from the primary.

## Consequences

- A new staff screen or route has to call `inScope` or require the admin role, and a new action
  has to go through `withAudit`; the shared contract tests run both on memory and Postgres.
- Mentors see a student's activity in plain words, not raw events; a new event type needs a line
  in `staff/words.ts`.
- Codes for students without Google are now issued by mentors in the app; the admin tool still
  can, and needs `CODE_PEPPER` only for that.
