# Plan series map: Plans 4b, 5a, 5b, 6a, 6b

> Not a plan: the one page every plan in this series is written against. Read it before any of the
> five plans. It says which plan builds each shared piece, what every plan must obey, and how to run
> a plan. Each plan still has its own Goal, Interfaces, Review Focus and ⚑ values.

**Status:** written, not started. Update this line to "4b done (PR #…)" and so on as each plan merges.

**Written:** 2026-10-23, against the code on branch `feature/mentor-admin` (PR #17, Plan 4a). Plans
4b to 6b were written before any of them was built, so each later plan is **provisional until the
one before it is merged**: its executor first reconciles the plan's Interfaces blocks with the
merged code (names, files, signatures), writes any difference into the ledger as a `Ruling:`, and
only then starts Task 1.

## The order and why

| Order | Plan | File                                                               | Needs                           |
| ----- | ---- | ------------------------------------------------------------------ | ------------------------------- |
| 1     | 4b   | [admin-dashboard](2026-10-23-admin-dashboard.md)                   | Plan 4a merged (PR #17)         |
| 2     | 5a   | [ai-doubts](2026-10-23-ai-doubts.md)                               | 4b (dashboard and detail hooks) |
| 3     | 5b   | [ai-summaries-and-content](2026-10-23-ai-summaries-and-content.md) | 5a (AIProvider, jobs, doubts)   |
| 4     | 6a   | [meetings](2026-10-23-meetings.md)                                 | 5a (jobs, org settings, Email)  |
| 5     | 6b   | [community](2026-10-23-community.md)                               | 6a (Google event link, hooks)   |

Plans 5a and 6a share the owner's long-lead work (Google Workspace for Nonprofits, the Anthropic
account and spend cap, a safeguarding contact). Those are **owner runbook steps** and start now,
long before the code is merged.

## Who builds what (shared pieces)

| Piece                                                                       | Built in | Used by    | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------------------------------------------- | -------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard card registry and student-detail sections                         | 4b       | 5a, 5b, 6a | A card is `{ id, title, component }` (component props `{ filter, lang }`) and a section is `{ id, title, component }` (props `{ studentId, lang }`); each loads its own data from its own route. Registered in one list. Later plans add an entry; they never edit the dashboard or student page body.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `learner_daily_activity` (one row per learner per IST day)                  | 4b       | 5a, 5b     | Summaries keep only `lastActiveDay`; "active per day/week" needs real days. Filled in the same lock as the summary refresh.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| CSV writer (formula-safe, BOM)                                              | 4b       | 5a, 6a     | Every export is audited (`export_made`, no row data in the entry).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `org_settings` table and service                                            | 5a       | 6a         | Typed keys with defaults: `ai_doubt_max`, `safeguarding_email`, `booking_*` rules (6a adds its keys). Admin screen section "सेटिंग".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `requireFeature(deps, learnerId, key)`                                      | 5a       | 6a, 6b     | Extracts the inline check in `services/recordings.ts` (`speaking_practice` → `FEATURE_OFF`). Every new feature route calls it first.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `server_jobs` table, `JobRepo` port, runner                                 | 5a       | 5b, 6a     | A Postgres table of retryable work: `kind`, `payload`, `run_after`, `attempts`, `last_error` (a code, no personal data), `dedupe_key`, `done_at`, `dead_at`. `JobRepo` = `enqueue({ kind, payload, runAfter?, dedupeKey? })` (a `dedupeKey` is used once, in any state, done and dead included), `claimDue(now, limit, kinds?)`, `complete`, `fail`, `deadCount()`, `prune(before)`. `JobHandler = (payload, job: { id, attempts, final }) => Promise<void>`; `runDueJobs({ jobs, handlers }, now, limit)` claims only the kinds it has handlers for; `makeJobHandlers(deps)` builds the registry. Payloads are ids only (`assertIdsOnly`: strings ≤ 64 characters, no whitespace, no `@`). Kinds: `doubt_answer`, `safeguarding_email` (5a), `weekly_summary` (5b), `calendar_event`, `calendar_cancel` (6a). See the decision-record note below. |
| `Email` port + fake + Gmail API adapter                                     | 5a       | 6a         | HTTPS with a Workspace service account (`gmail.send` only); Edge Functions block SMTP ports. Alerts are queued as jobs; never sent inline from a request.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `AIProvider` port + fake + Anthropic adapter                                | 5a       | 5b         | CI never makes a live call. The key is env only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Event types (`doubt_asked`, `doubt_rated`; server-written `doubt_answered`) | 5a       | 5b         | Phones may not push `doubt_answered` (as with `level_set`). Adding a type changes `KNOWN_EVENT_TYPES`, which re-pulls old phones automatically (`pullCursorKey`). 5b, 6a and 6b add no event type.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `Calendar` port + fake + Google adapter                                     | 6a       | —          | 6a's only phone-side helper is `formatIstRange` (`packages/learner-core/src/ist-format.ts`). 6a has no calendar-link helper, so 6b's "Add to calendar" keeps its own `calendarLink` (`apps/learner/src/community/calendar-link.ts`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Job runs: Edge background + GitHub Actions schedule                         | 5a       | 5b, 6a     | The Edge Function runs due jobs in the background right after a push (5a) and after a booking or cancel (6a) through `HandlerDeps.background` (`EdgeRuntime.waitUntil`), so answers and Meet links normally arrive in seconds. `.github/workflows/jobs.yml` runs `npm run admin -- run-jobs` **every 30 minutes** as the retry safety net (every 5 minutes would need about 8,600 Actions minutes a month against the free plan's 2,000). Not `pg_cron` (portability rules 3 and 6), recorded in 5a's decision.                                                                                                                                                                                                                                                                                                                                    |

**Decision-record note (put in Plan 5a's record):** "message queues" are on the not-using list. A
`server_jobs` table polled by a scheduled workflow is a retry log inside Postgres, not a queue
product: no broker, no consumer groups, at-least-once with idempotent handlers, a few hundred rows
a day. State that, and revisit if volume ever grows past a few thousand a day.

**Migration order:** after `20261023000005` (4a): 4b `20261024000001`–`03`, 5a `20261025000001`–`02`, 5b `20261101000001`, 6a `20261102000001`, 6b `20261103000001`. Renumber only to stay after whatever merged last.

## What every plan must obey (Global Constraints, repeated in each plan)

**From the project rules** (read `CLAUDE.md` and `.claude/rules/*.md`): TypeScript strict; Zod at
every boundary; parameterised SQL only; RLS on every table with a policy per role; nothing personal
in logs or URLs; secrets only in env; minors' data; Hindi first with an English string beside it;
no stack traces to clients; ports and adapters (no Supabase, Anthropic or Google import outside an
adapter).

**Learned in Plan 4a's review** (each cost a fix pass; plan for them):

1. **Contract tests run on both repositories, with more rows than one page.** The NUL-cursor bug in
   admin paging passed every in-memory test and crashed on page 2 in Postgres. Run `npm run test:db`
   for any adapter, migration or policy change.
2. **An old phone must not lose new server data.** A phone that does not know a new event type
   drops it. `pullCursorKey` fingerprints `KNOWN_EVENT_TYPES`, so a new type re-pulls from 0. Any
   plan that adds a type or a pulled field keeps that test green and adds its own old-phone case.
3. **Derived data goes stale.** Anything computed at upload (summaries, counts, "this week") is
   corrected on read with the day it was made (`asOf`, `asOfToday`), or recomputed on a schedule.
   Add a test with a record N days old.
4. **Revocation.** For every new permission, say what happens when it is taken away (a mentor
   leaves, a feature switches off, a student is paused, a Google connection expires) and test it.
5. **Shared phones.** A staff or mentor session on a student's phone times out (`idleGuard`, 30
   minutes). Any new signed-in surface does the same, and never keeps a secret in `localStorage`.
6. **Every new personal-data table or column gets six explicit steps:** export
   (`exportLearner`), delete cascade (`deleteWithTombstone`, plus a search of every column for the
   id in `learner-data.db.test.ts`), retention period (and the job that applies it), audit
   anonymisation, an RLS policy, and an RLS test with a mentor token and **2 cohorts**.
7. **Every write route writes exactly one audit entry** (`withAudit`, record form), with ids and
   keys only. Never a code, token, comment or message body.
8. **Trace both ends at plan time.** Every screen: name its route and response field. Every e2e step:
   name its screen. Plan 4a only found two missing screens (a new-student form, the pause-staff
   screen) while executing.
9. **First-load JS is 118.8 KB of a 120 KB budget.** Every new student-facing screen is a lazy
   chunk, and every plan has a task step that runs `npm run size -w @shiksha/learner-app`. The
   size check also fails if a first-load script contains `/v1/staff/`.
10. **Admin names never go in URLs.** Search by name is a POST (4b converts the existing GET) and
    cursors are ids.
11. **Server-side refusal for every switch.** A feature that can be switched off is refused by the
    server (`requireFeature` → `FEATURE_OFF`), tested with an un-synced phone.

## How to run a plan (the executor's page)

The helper scripts in `.superpowers/bin` are git-ignored and not in a fresh clone. Use these commands.

- **Setup:** `git worktree add ../shiksha-path-<slug> -b feature/<slug> origin/main`, then `npm ci`
  (hooks do nothing until you do: [gotcha](../../gotchas/worktree-hooks-need-npm-ci.md)). Docker
  running; `npm run db:start`.
- **Method:** the plan is the brief. Execute task by task, test first, watch it fail, then pass. Keep
  a ledger in `.superpowers/sdd/<plan-basename>/progress.md` (git-ignored) and write every deviation
  as `Ruling: <what> — <why> — <cost if wrong>`. Commit per task; the body explains why. The
  commit trailer and the PR footer come from the session's attribution reminder.
- **Gate after every task (all from the repo root):**
  `npx prettier --write apps packages tooling supabase` ·
  `npx vitest run` · `npm run typecheck` · `npm run lint` · `npm run format:check`.
  Add `npm run test:db` when a task touches `packages/server/src/adapters`, `supabase/`, a contract
  test or the admin tool.
- **Before the final review:** `npm run test:cov` (≥ 70%), `npm run test:db`, `npm run test:e2e`,
  `npm run functions:build` and restart `functions:serve`, `npm run test:e2e:backend`,
  `npm run size -w @shiksha/learner-app`, `bash tooling/backup/restore-check.sh`.
- **Final review:** one fresh reviewer on the strongest model available reads the whole branch
  (the plan's Review Focus verbatim), then one fix pass: every Critical and Important finding gets a
  test that fails first. Minors go in the PR body.
- **PR:** the template in `.github/pull_request_template.md`, the rulings list and deferred minors.
  The owner merges. Never push to `main`.
- **Traps:** read `docs/gotchas/` first: Vitest from the root, rebuild the function before e2e,
  `test:db` is separate, commit body lines, lint limits, Playwright flags.

## The 4a code the plans are written against

The 4a plan document differs from the code in places. Use the code on `feature/mentor-admin` (the
merged PR #17). These are the names that matter:

| Thing                      | Where and how it is now                                                                                                                                                                                                                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Staff caller and scope     | `packages/server/src/services/staff.ts`: `StaffCaller { staffId, role, cohortIds }`, `staffCaller`, `claimStaff`, `inScope` (FORBIDDEN for unknown and out-of-scope alike)                                                                                                                                                           |
| Audit                      | `services/audit.ts`: `withAudit(deps, { staff, action, learnerId, details }, work)`; refuses `code`/`token`/`comment` keys; `AuditAction` union lists every action                                                                                                                                                                   |
| Summaries                  | `services/summary.ts`: `summarise`, `asOfToday`, `needsAttention`; `SummaryRepo.refresh`; stored with `asOf`; refreshed in `services/sync.ts` under `pg_advisory_xact_lock`                                                                                                                                                          |
| Staff reads                | `services/staff-read.ts` (`listCohorts`, `studentDetail`); admin in `services/admin.ts` (`getSetup`, `searchStudents` paged by id, `saveStaff`, `editStudent`, …)                                                                                                                                                                    |
| Routes                     | `http/router.ts` (staff and learner), `http/admin-routes.ts` (`ADMIN_ROUTES`), `http/request.ts` (`caller`, `jsonBody`, `parseWith`), `http/respond.ts` (error codes → status)                                                                                                                                                       |
| Contract                   | `packages/api-contract/src/*.ts`; two entry points: `@shiksha/api-contract` (phones) and `@shiksha/api-contract/staff` (staff screens only, so students never download them)                                                                                                                                                         |
| Ports and testing          | `packages/server/src/ports.ts`; memory repos in `src/testing/memory-*.ts`; shared contracts `service-contract.ts`, `staff-contract.ts`, `admin-contract.ts`, `code-contract.ts`; `staff-world.ts` (`staffWorld`, `codeOf`, `google`)                                                                                                 |
| Phone sync                 | `apps/learner/src/runtime/*` (`pull.ts`, `http-transport.ts`), `account/restore-flow.ts` (`pullCursorKey`), `packages/learner-core/src/events.ts` (`KNOWN_EVENT_TYPES`, `parseEvents`)                                                                                                                                               |
| Staff app                  | `apps/learner/src/staff/*`: `staff-api.ts` (`staffMethods`, `createStaffApi`), `staff-auth.ts`, `staff-idle.ts` (`idleGuard`), `staff-state.svelte.ts`, `i18n.ts` and `admin-i18n.ts` (`st`, `at`), `words.ts`, `screens/*`, `screens/admin/*`; the admin area shares styles through `.staff :global(.admin …)` in `StaffApp.svelte` |
| Fake backend for app tests | `apps/learner/test/helpers/fake-backend.ts`: the real `handle()` over memory repos through a fake fetch; `useStaffAccount(email)`, `issueCode`, `setOnline`, `repos`                                                                                                                                                                 |
| e2e                        | `apps/learner/e2e/*.spec.ts`, `backend-setup.ts` (`ownerAddsStaff`, `returnToStaff`, `makeGoogleUser`, `database`, …); project `chromium-backend` matches `backend                                                                                                                                                                   | staff` specs |
| Admin CLI                  | `tooling/admin/commands.ts` (`makeAdminDeps`; `CODE_PEPPER` optional except code commands; `SettingMissing`), `cli.ts`                                                                                                                                                                                                               |
| Rate limits                | `services/limits.ts` (`LIMITS`, `enforce`); buckets are `<action>:<learnerId>` or `<action>:ip:<hash>`; deletion removes `%:<learnerId>`                                                                                                                                                                                             |
| Branding                   | `api-contract/src/branding.ts` (`isReadable`, `primaryShades`, `PAGE_BACKGROUND`), `apps/learner/src/runtime/branding.ts`, `PgBrandingRepo`                                                                                                                                                                                          |
| Content                    | `packages/content`: the build already refuses `review !== 'approved'` unless `preview` is set; tracks are a list in the content                                                                                                                                                                                                      |

## The values the owner confirms (⚑), by plan

Each plan lists its own ⚑ values with a recommended default and says "builder's call" when the spec
leaves it open. The owner confirms them when merging the plan, as for earlier plans. The ones that
need the owner's judgment, not just a nod:

- **4b:** whether student-list CSVs may contain names (recommended: lists yes, with a banner and an
  audit entry; dashboard exports never).
- **5a:** the distress keyword list and helpline wording (owner and a mentor write them: the
  plan gives a structure, not the words); doubt retention; the AI cost cap.
- **5b:** how the weekly job is triggered; whether the weekly note shows in the cohort list.
- **6a:** the booking rules (the spec's defaults are the recommendation) and Workspace set-up.
- **6b:** post attachment types and sizes.

## Decisions the plan writers made that the owner should confirm

- **4b icons:** the admin's browser renders the 192, 512, maskable and favicon PNGs and the server
  checks them (magic bytes, exact size). The spec says "the server generates" them; this needs no
  new server dependency. The alternative is `resvg-wasm` in the Edge Function.
- **6a calendar:** the narrowest scope that creates and deletes events is
  `calendar.events.owned`. The Meet link is made by a `calendar_event` job that the Edge Function
  runs in the background right after the booking answers (seconds), with the 30-minute `run-jobs`
  schedule as the retry net; never during the booking request. The live Google check is an owner
  runbook step.
- **5a email:** the Gmail API over HTTPS with a Workspace service account, not SMTP (Edge Functions
  block SMTP ports).
- **6a code retire:** after a code student adds Google, the code is retired and cannot be reissued
  (a learner has exactly one identity); "mentor can reissue" from the brief is not possible.
- **6b files:** post attachments are left out of the nightly backup.
- **Spec §9.3** says `pg_cron`; the series uses a GitHub Actions schedule (portability rules).
