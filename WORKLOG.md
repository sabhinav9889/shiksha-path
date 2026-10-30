# Worklog

Active tasks. Read this at the start of every session. Details live in `.claude/worklog/<slug>.md`
(format: [.claude/worklog/README.md](.claude/worklog/README.md)).

**Statuses:** `in-progress` · `blocked` · `shipped` · `on-hold`

| Task                                             | Status      | Assignee | Branch                     | Next step                                                                        | Detail                                                           |
| ------------------------------------------------ | ----------- | -------- | -------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Hackathon submission (deadline 30 Oct 2026, EOD) | in-progress | Owner    | `docs/submission-accuracy` | Record the demo, tag, build the ZIP and submit (FREEZE.md)                       | [freeze procedure](docs/submission/FREEZE.md)                    |
| Community posts (Plan 6b, reduced)               | in-progress | Owner    | `feat/community-posts`     | Review, merge, apply the migration to the hosted database, redeploy the function | [decision](docs/decisions/backend-2026-10-30-community-posts.md) |
| One-to-one slot booking (Plan 6a, reduced)       | in-progress | Owner    | `feat/slot-booking`        | Review, merge, apply the hosted migration, redeploy the function                 | [decision](docs/decisions/backend-2026-10-30-slot-booking.md)    |

## Backlog

Not started. Move a line into the table above when someone picks it up.

- **Plans 4b, 5a, 5b, 6a, 6b** are written and merged (PR #18) but not built: admin dashboard and
  CSV, AI doubts, weekly summaries and content tools, meetings, community. Start with the
  [series map](docs/superpowers/plans/2026-10-23-series-map-plans-4b-to-6b.md). After the hackathon
  freeze (6 November).
- **The profiles test flake.** `profiles.test.ts > a locked profile stays locked…` can fail in a
  full run and passes alone. Possibly a real race, not just slowness.
- **Backups.** The nightly backup needs the owner's keys (runbook §9); until then it fails nightly.

## Archive

Shipped tasks move here with their merge date.

- Plan 0 – project guardrails · merged 2026-10-18 (PR #2)
- Plan 1 – content system · merged 2026-10-18 (PR #3, review fixes PR #4)
- Plan 1 follow-up – content hardening · merged 2026-10-18 (PR #5)
- Plan 2a – learner core · merged 2026-10-19 (PR #7)
- Plan 2b – learner app · merged 2026-10-19 (PR #8 plan, PR #9 app)
- Plan 2c – learner app, part 2 · merged 2026-10-20 (PR #10 plan, PR #11 app)
- Plan 3a plan, AGENTS.md and GEMINI.md · merged 2026-10-20 (PR #12)
- Plan 3a – backend and sync · merged 2026-10-21 (PR #13)
- Plan 3b plan · merged 2026-10-22 (PR #14)
- Plan 3b – backend and sync, part 2 · merged 2026-10-22 (PR #15)
- Plan 4a plan · merged 2026-10-22 (PR #16)
- Plan 4a – mentor view and admin panel · merged 2026-10-23 (PR #17)
- Plans 4b to 6b plans and executor gotchas · merged 2026-10-24 (PR #18)
- Fix: a link that loses a race to its own sign-in · merged 2026-10-24 (PR #19)
- Staff language switch recorded as backlog · merged 2026-10-25 (PR #22)
- Hackathon polish: quality fixes, staff language switch, demo cohort, submission documents ·
  merged 2026-10-26 (PR #23)
