# Mentor View and Admin Panel Implementation Plan (Plan 4a)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Also follow `AGENTS.md`. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mentors and NGO admins sign in with Google and work from a web section of the same app. This plan builds:

- **Mentors:** see their cohorts and who needs attention; open a student; review speaking recordings; issue and reset backup codes; change a student's level; mark lab attendance.
- **Admins:** run the organisation: labs, cohorts, mentors, students, feature switches and branding.
- **Audit:** every staff action goes in an audit log.

**Architecture:** Same shape as Plans 3a and 3b:

- **API:** new `/v1/staff/...` routes call services in `packages/server`. They take the caller's role and cohorts from the verified token through a `StaffRepo` lookup, never from the request.
- **Progress summaries:** a per-learner summary row is re-derived with `learner-core` after every upload, so staff screens never read the raw event log per request.
- **Level changes:** a mentor's level change is a server-written `level_set` event, which phones receive through the normal pull.
- **Staff screens:** they live in the same Svelte app under `#/staff/...`. They are a lazily loaded chunk with their own Google session, so the students' first-load budget is untouched.

**Tech Stack:** Unchanged: Svelte 5, Vite PWA, Dexie, Supabase (Postgres, Auth, Storage, Edge Functions), `postgres`, Zod 4, Vitest, Playwright. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-15-learning-platform-design.md`: §8 (mentor view), §8.1 (admin panel: setup, manage students, feature switches, branding name and colours, audit log), §5.3 (backup codes reset by mentors), §7.4, §12. Rules: `.claude/rules/security.md` ("mentors only their cohorts; admins everything"), `privacy.md` (audit entries anonymised on deletion), `database.md` (RLS policy per role, tested with 2+ students and 2+ cohorts).

**Requires:**

- Plan 3b merged (PR #15).
- Branch `feature/mentor-admin` from `main`.
- Docker running. Run `npm ci` in the worktree.

### Plan series

- **Plan 4a** (this plan).
- **Plan 4b:**
  - the org-wide progress dashboard (§8.1 "Track progress") with date and cohort filters, and CSV export of lists and dashboards;
  - the per-student timeline view beyond the recent events shown here;
  - logo upload with server-generated PWA icons and a dynamic manifest;
  - the branding live preview and "reset to default".
- **Plan 5:** AI (doubt limits, safeguarding contact, "flag a bad AI answer"). **Plan 6:** meetings and community (booking rules; a code student adds Google).

**Not in this plan:**

- dashboards, CSV and logo/icons (4b);
- AI doubt limits and the safeguarding contact (5);
- booking rules (6);
- students seeing their mentor's comments on recordings _(builder's call)_ ⚑ (comments are for mentors in 4a);
- from the Plan 3b review: **M5** (the bucket checks the declared type, and an upsert URL can overwrite after completion) and **M7** (a before-user-created Auth hook to refuse email self-sign-up). Both stay deferred, recorded in the decision record.

## Global Constraints

Everything marked _(builder's call)_ is open in the spec. ⚑ marks values for the owner to confirm when reviewing this plan.

- All Plan 3a and 3b global constraints still apply: portability, layers, identity from the token, the error format, the privacy rule, the database rule, rate limits, logging with ids only, the size budget and the code limits.
- **Roles:** `mentor` and `admin`, in a `staff` table. A staff account is a **Google** sign-in only.
  - Staff are invited by email. An admin adds `email` + role, and the person's first Google sign-in with that email claims the row (case-insensitive match).
  - The first admin is added by the owner: `npm run admin -- add-staff --email <e> --role admin`.
  - A Google account linked to a learner cannot be staff, and a staff account cannot link as a learner. Both are refused with `FORBIDDEN`.
- **Scope:** a mentor sees and acts only on learners whose `cohort_id` is one of their cohorts (`staff_cohorts`). An admin sees and acts on everyone. Every staff service checks this first. A learner outside scope answers `FORBIDDEN`, the same as one that does not exist, so ids cannot be probed.
- **New error codes:**
  - `NOT_STAFF` (403): signed in, but not staff, or not yet claimed;
  - `DEACTIVATED` (403): the learner was deactivated; their sync is refused and their data kept.
- **Needs attention** _(builder's call)_ ⚑. Any of these flags a learner:
  - **inactive:** no activity for **≥ 3 days** (spec), counting from `last_active_day`, or from the link date for a learner who never learned;
  - **stuck:** the same lesson started on **≥ 3 different days** without being completed;
  - **low scores:** the last **3** completed lessons each scored **< 60%** (`correct / scored`; lessons with `scored = 0` are ignored).
- **Level change:** event `level_set` with data `{ track: string, startLesson: string }`, written by the server with a new uuid and `at` = now. The latest `level_set` for a track wins over placement. Old phones ignore an event type they do not know: they must not break.
- **Recording review:** a comment of at most **280** characters (optional). Review sets `reviewed_at`, which starts the 30-day retention clock (Plan 3b). Download URLs last **300 s**.
- **Attendance:** a mark per learner per lab day, `present` true or false. The date is an IST calendar date (`YYYY-MM-DD`). A future date is refused.
- **Audit log:** every staff write action stores `{ staffId, action, learnerId?, details, at }`.
  - `details` never holds a code, a token or a comment's text: it holds ids, keys and old → new values of switches and levels.
  - Deleting a learner on request sets their audit rows' `learner_id` to null and `details.learner` to `'DELETED'` (privacy rule).
  - Admins can read the log; mentors cannot.
  - It is kept until the NGO deletes it _(builder's call)_ ⚑.
- **Deactivate:** `learners.deactivated_at`. Push, pull, me and recordings for that learner answer `DEACTIVATED`. The phone keeps working offline and shows "आपकी प्रोफ़ाइल अभी बंद है — अपने मेंटर से बात करें" on the me screen. Reactivating clears it.
- **Staff screens:**
  - routes `#/staff`, `#/staff/student/<id>`, `#/staff/recordings`, `#/staff/admin/<section>`;
  - built mobile-first and also laid out for ≥ 1024 px;
  - Hindi and English from the catalogue;
  - code-split: the learner app's first-load JS stays ≤ **120 KB** gzipped, and the staff chunk loads only on `#/staff`.
- **Staff session:** its own Supabase client with storage key `staff` in the `auth` table, separate from every learner profile's session. Signing out of staff never touches a learner profile.

## Review Focus

1. **A mentor reaching a learner outside their cohorts.** By guessing an id in any staff route (student detail, recording URL, review, code, level, attendance), or through Supabase REST with the mentor's token. Each must answer `FORBIDDEN` and change nothing. Tasks 2, 5, 6, 7.
2. **Someone becoming staff who should not.** A Google account whose email matches no invite, an email differing only in case, an invite claimed twice, a learner's Google account, a backup-code (email-provider) account claiming an invite. Only an unclaimed invite plus a matching Google email may claim. Task 2.
3. **A level change or deactivation that the phone mishandles.** An old app version receiving `level_set`; a `level_set` naming a lesson that is not in the installed content; a deactivated learner learning offline and then syncing. Old phones must not crash, unknown lessons must not break home, and offline work must be kept for when the learner is reactivated. Tasks 1, 8.
4. **The audit log holding what it must not, or missing an action.** A comment's text, a code, a token or a deleted learner's id must never appear. Every write route must write exactly one entry. Tasks 3, 6, 7, 8.
5. **Summaries drifting from the truth.** A duplicate push, events arriving out of order, two phones of one learner pushing at once, a deleted learner. The summary must equal `summarise(all events)` and never double-count. Task 4.

---

### Task 1: The `level_set` event in the core and the app

**Files:**

- Modify: `packages/learner-core/src/events.ts`, `packages/learner-core/src/progress.ts`, `packages/server/src/services/sync.ts` (a phone may never push `level_set`)
- Test: `packages/learner-core/test/progress.test.ts`, `packages/learner-core/test/events.test.ts`, `packages/server/test/services.test.ts`, `apps/learner/src/screens/home/home.test.ts`

**Interfaces:**

- Produces: `EventType` gains `'level_set'` with data `{ track: string; startLesson: string }`, a loose object like the others. `deriveProgress` sets `startLessonByTrack[track]` from the latest `level_set` by `at`, over any placement.

- [ ] **Step 1: Write the failing tests:**
  - `level_set` after a placement moves that track's start lesson, and the other track keeps the placement's;
  - two `level_set` for one track: the later one wins, whatever their order in the log;
  - a `level_set` naming a lesson missing from the manifest leaves "today's lesson" on the first unfinished lesson (home shows a lesson, never crashes);
  - `parseEvents` keeps a `level_set`, and a version of `parseEvents` that predates it (an event with an unknown type) drops it without throwing (old phones);
  - a push containing a `level_set` from a phone has it in `rejected`.
- [ ] **Step 2: Run** `npx vitest run packages/learner-core packages/server apps/learner/src/screens/home`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** all checks. Expected: PASS.
- [ ] **Step 5: Commit** `feat(core): let a mentor set a learner's level with a level_set event`

### Task 2: Staff accounts, roles and scope

**Files:**

- Create:
  - `supabase/migrations/20261023000001_staff.sql` (+ rollback);
  - `packages/server/src/services/staff.ts`;
  - `packages/server/src/adapters/pg-staff-repo.ts`;
  - `packages/server/src/testing/memory-staff.ts`;
  - `packages/api-contract/src/staff.ts`.
- Modify: `ports.ts` (`Caller` gains `email: string | null`, used only to claim an invite and never logged), `adapters/supabase-auth.ts`, `services/link.ts` (staff cannot link), `http/router.ts`, `tooling/admin/commands.ts` (`add-staff`), `supabase/tests/rls.test.ts`
- Test: a shared `describeStaffContract` (memory + Postgres), `supabase/tests/rls.test.ts`, `tooling/test/admin-cli.db.test.ts`

**Interfaces:**

- Produces:
  - **Tables:**
    - `labs(id, name)`;
    - `cohorts` gains `lab_id uuid null → labs`;
    - `staff(id uuid pk, email citext unique, role text check in ('mentor','admin'), name text, auth_user_id uuid unique null → auth.users on delete set null, active boolean default true)`;
    - `staff_cohorts(staff_id, cohort_id, pk both)`;
    - `learners` gains `deactivated_at timestamptz null`.

    All have RLS. A security-definer `current_staff()` returns the caller's staff row, used by select-only policies: a mentor reads learners, events, recordings, summaries and attendance of their cohorts, and an admin reads all. Test with 2 mentors, 2 cohorts and 2 students each.

  - **Types and functions:**
    - `StaffCaller = { staffId: string; role: 'mentor' | 'admin'; cohortIds: string[] }`;
    - `staffCaller(deps, caller: Caller): Promise<StaffCaller>` (`NOT_STAFF` otherwise);
    - `claimStaff(deps, caller): Promise<StaffCaller>`: Google provider plus an unclaimed invite with that email;
    - `inScope(deps, staff, learnerId): Promise<void>` (`FORBIDDEN`).
  - **Routes:** `POST /v1/staff/claim`, `GET /v1/staff/me` → `{ role, name, cohorts: { id, name }[] }`.

- [ ] **Step 1: Write the failing tests:**
  - an invite is claimed only by a Google sign-in with that email, in any letter case, and only once;
  - an email-provider (code) account cannot claim;
  - a Google account already linked to a learner cannot claim;
  - a claimed staff account cannot link as a learner;
  - `staffCaller` for an unclaimed or inactive staff member is `NOT_STAFF`;
  - a mentor's `inScope` passes for their cohorts only, and an admin's for everyone;
  - RLS: mentor A selects only cohort A's learners, events and recordings with their token through PostgREST, and nothing of cohort B; a student's token sees no `staff` rows;
  - `npm run admin -- add-staff --email x@y --role admin` creates an invite and never prints anything but the id.
- [ ] **Step 2: Run** `npm run db:reset && npm run test:db` and `npx vitest run packages/server`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** all checks, `npm run test:db` and `npm run test:e2e:backend`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(server): staff accounts, roles and cohort scope`

### Task 3: The audit log

**Files:**

- Create: `supabase/migrations/20261023000002_audit_log.sql` (+ rollback), `packages/server/src/services/audit.ts`, `packages/server/src/adapters/pg-audit-repo.ts`, the memory repo
- Modify: `services/learner-data.ts` (anonymise on delete), `router.ts` (`GET /v1/staff/audit?before=<id>&limit=` for admins)
- Test: the staff contract, `packages/server/test/learner-data.db.test.ts`

**Interfaces:**

- Produces:
  - `audit_log(id bigint identity pk, staff_id uuid null → staff on delete set null, action text, learner_id uuid null, details jsonb, at timestamptz)`, with an index on `(learner_id)` and on `(at)`;
  - `AuditRepo.add(entry)`, `AuditRepo.page(before: number | null, limit: number)`;
  - `withAudit<T>(deps, staff: StaffCaller, action: AuditAction, learnerId: string | null, details: Record<string, string | number | boolean | null>, work: () => Promise<T>): Promise<T>`: writes the entry only if `work` succeeds;
  - `AuditAction` = `'code_issued' | 'code_reset' | 'level_set' | 'attendance_marked' | 'recording_reviewed' | 'student_edited' | 'student_moved' | 'student_deactivated' | 'student_reactivated' | 'student_deleted' | 'switch_changed' | 'override_changed' | 'branding_changed' | 'cohort_saved' | 'lab_saved' | 'staff_invited' | 'staff_changed'`.

- [ ] **Step 1: Write the failing tests:**
  - a failed action writes no entry;
  - `details` refuses objects and arrays (the type) and is checked to never contain a key named `code`, `token` or `comment`;
  - after `deleteLearner`, no audit row holds that learner's id and the rows say `learner: 'DELETED'`;
  - a mentor gets `FORBIDDEN` from `GET /v1/staff/audit`; an admin pages it newest first.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** all checks and `npm run test:db`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(server): keep an audit log of staff actions`

### Task 4: Progress summaries and "needs attention"

**Files:**

- Create: `supabase/migrations/20261023000003_learner_summaries.sql` (+ rollback), `packages/server/src/services/summary.ts`, `packages/server/src/adapters/pg-summary-repo.ts`, the memory repo
- Modify: `services/sync.ts` (refresh after a push that inserted events), `adapters/pg-event-repo.ts` (`insertMany` takes `pg_advisory_xact_lock(hashtext(learner_id))`, closing the Plan 3b review's pull race M3)
- Test: `packages/server/test/summary.test.ts`, the service contract

**Interfaces:**

- Produces:
  - `learner_summaries(learner_id pk → learners on delete cascade, lessons_done int, lessons_this_week int, streak int, last_active_day date null, current_lesson text null, low_scores boolean, stuck_lesson text null, updated_at)`;
  - `summarise(events: LearnerEvent[], today: string): Summary`, a pure function using `deriveProgress`;
  - `needsAttention(summary: Summary, linkedOn: string, today: string): ('inactive' | 'stuck' | 'low_scores')[]`, with the Global Constraints thresholds;
  - `SummaryRepo.save(learnerId, summary)`, `SummaryRepo.forCohorts(cohortIds: string[] | 'all')`.

- [ ] **Step 1: Write the failing tests** (dates as IST days):
  - `summarise` counts completed lessons once, even when a lesson is completed twice or an event arrives twice;
  - "this week" counts Monday to Sunday IST;
  - inactive at exactly 3 days, not at 2;
  - stuck at 3 different days of starting `ef1-03` without completing it, not at 3 starts on one day;
  - low scores for 2/5, 1/5 and 0/5 as the last three, but not when one of them is 4/5, and lessons with `scored: 0` are ignored;
  - after a push, the saved summary equals `summarise(all events)`;
  - a duplicate push leaves it unchanged;
  - two pushes for one learner at once leave it equal to `summarise(all)` (Postgres).
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** The refresh re-reads that learner's events and re-derives; it is cheap at pilot sizes. A summary failure is logged and never fails the push.
- [ ] **Step 4: Run** all checks and `npm run test:db`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(server): keep a progress summary per learner for staff screens`

### Task 5: The mentor's read API

**Files:**

- Create: `packages/server/src/services/staff-read.ts`, `packages/api-contract/src/staff-read.ts`
- Modify: `router.ts`, the repos (cohort and learner reads for staff)
- Test: the staff contract, `packages/server/test/http.test.ts`, `supabase/tests/api.test.ts`

**Interfaces:**

- Produces:
  - `GET /v1/staff/cohorts` → `{ cohorts: { id, name, labName, students: { id, name, deactivated: boolean, summary: Summary | null, attention: string[], lastSyncedAt: string | null }[] }[] }`, the caller's cohorts (all for an admin), with "needs attention" students first;
  - `GET /v1/staff/student?id=<uuid>` → `{ student: { id, name, cohortId, deactivated }, summary, attention, recent: LearnerEvent[] (newest 50), weakLessons: { lessonId: string; wrong: number }[] (the 5 lessons with the most wrong answers, from `item_answered`), recordings: { id, lessonId, itemId, durationMs, recordedAt, status, reviewedAt, comment }[], attendance: { date, present }[] (last 30 days), switches: Record<FeatureKey, boolean>, hasCode: boolean }`.

- [ ] **Step 1: Write the failing tests:**
  - mentor A lists only cohort A, with the flagged student first;
  - an admin lists both cohorts;
  - `student?id=` of a cohort-B learner, as mentor A, answers `FORBIDDEN`, exactly as a random uuid does;
  - a malformed id answers `INVALID_REQUEST`;
  - a learner's token on any `/v1/staff/*` route answers `NOT_STAFF`;
  - `weakLessons` lists lessons by wrong answers, most first, at most 5, and counts a replayed duplicate event once;
  - the student detail never includes an email or a code.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** all checks and `npm run test:db`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(server): let mentors read their cohorts and students`

### Task 6: Reviewing recordings

**Files:**

- Create: `supabase/migrations/20261023000004_recording_reviews.sql` (+ rollback: `recordings` gains `review_comment text check (char_length <= 280)`, `reviewed_by uuid null → staff on delete set null`)
- Modify: `services/staff-read.ts` or a new `services/recording-review.ts`, `router.ts`
- Test: the staff contract, `supabase/tests/api.test.ts`

**Interfaces:**

- Produces:
  - `GET /v1/staff/recordings?status=unreviewed` → the caller's cohorts' uploaded, unreviewed recordings, oldest first, with student id and name;
  - `GET /v1/staff/recording-url?id=` → `{ url }` (signed, 300 s; only for an `uploaded` recording in scope);
  - `POST /v1/staff/recordings/review { id, comment? }` → `{ reviewedAt }`, which sets `reviewed_at`, `reviewed_by` and the comment, audited as `recording_reviewed` with `{ recordingId }`.

- [ ] **Step 1: Write the failing tests:**
  - a mentor gets a working URL for an in-scope recording (the api test downloads the bytes), and `FORBIDDEN` for another cohort's;
  - review sets `reviewed_at`, so retention deletes the recording 31 days later (call `runRetention` with that date);
  - reviewing twice keeps the first `reviewed_at` and updates the comment;
  - a 281-character comment is `INVALID_REQUEST`;
  - the audit entry has no comment text;
  - a pending (not uploaded) recording has no URL.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** all checks and `npm run test:db`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(server): let mentors review speaking recordings`

### Task 7: The mentor's actions

**Files:**

- Create: `supabase/migrations/20261023000005_attendance.sql` (+ rollback: `lab_attendance(learner_id → learners on delete cascade, day date, present boolean, marked_by uuid null → staff on delete set null, pk(learner_id, day))`), `packages/server/src/services/mentor-actions.ts`
- Modify: `router.ts`, `services/codes.ts` (new students join a cohort), `tooling/admin/commands.ts` (`issue-code --cohort`)
- Test: the staff contract, `supabase/tests/api.test.ts`

**Interfaces:**

- Produces:
  - `POST /v1/staff/codes/issue { learnerId } | { name, cohortId }` → `{ learnerId, code }`. The code is shown once and audited as `code_issued` without it;
  - `POST /v1/staff/codes/reset { learnerId }` → `{ code }`;
  - `POST /v1/staff/level { learnerId, track, startLesson }` → `{ eventId }`. It writes a `level_set` event through `EventRepo.insertMany` and refreshes the summary;
  - `POST /v1/staff/attendance { cohortId, day, present: uuid[] }` → `{ marked: number }`. Every cohort member is marked: those listed present, the rest absent.

- [ ] **Step 1: Write the failing tests:**
  - a mentor issues a code for a new student in their own cohort, which lands in that cohort, and is refused for a cohort that is not theirs;
  - a reset by a mentor stops the old code (Plan 3b behaviour);
  - a level change for an in-scope learner reaches the phone: the fake backend pull adds the event, and the session's start lesson changes;
  - attendance for a future day is `INVALID_REQUEST`;
  - marking twice for one day replaces the earlier marks;
  - `present` naming a learner of another cohort is `FORBIDDEN`, and nothing is written;
  - every route writes exactly one audit entry.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** all checks and `npm run test:db`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(server): mentor actions for codes, levels and attendance`

### Task 8: The admin API, and deactivation reaching the phone

**Files:**

- Create: `packages/server/src/services/admin.ts`, `packages/api-contract/src/admin.ts`
- Modify: `router.ts`, `services/sync.ts`, `services/me.ts` and `services/recordings.ts` (refuse `DEACTIVATED`), `apps/learner/src/runtime/runtime.ts` and `screens/me/*` (show the message), the i18n catalogue
- Test: the staff contract, `packages/server/test/http.test.ts`, `apps/learner/src/account/deactivated.test.ts`

**Interfaces:**

- Produces (admin only; a mentor gets `FORBIDDEN`, each audited):
  - `POST /v1/staff/admin/lab { id?, name }`;
  - `POST /v1/staff/admin/cohort { id?, name, labId }`;
  - `POST /v1/staff/admin/staff { id?, email, role, name, cohortIds, active }`;
  - `GET /v1/staff/admin/students?q=&cohortId=&mentorId=&active=&attention=&after=&limit=`. Search is on name (`ilike`, parameterised), returning 50 per page;
  - `POST /v1/staff/admin/student { learnerId, name?, cohortId? }`;
  - `POST /v1/staff/admin/deactivate { learnerId, active }`;
  - `POST /v1/staff/admin/delete { learnerId }`, which reuses `deleteLearner`;
  - `POST /v1/staff/admin/switch { key, enabledForAll }`;
  - `POST /v1/staff/admin/override { learnerId, key, enabled | null }` (null removes the override);
  - `POST /v1/staff/admin/branding`, which reuses `setBranding`.
  - The app's `SyncResult` gains `deactivated: boolean`.

- [ ] **Step 1: Write the failing tests:**
  - every admin route refuses a mentor, and refuses a learner with `NOT_STAFF`;
  - `students?q=` with `%`, `_` or a quote finds by literal text;
  - moving a student moves them out of their old mentor's scope;
  - deactivating makes push, pull, me and recordings `DEACTIVATED`;
  - the phone keeps the offline lesson's events pending and shows the deactivated message on the me screen; after reactivation the next sync uploads them;
  - deleting through the admin API leaves the audit entry anonymised;
  - an override set to null falls back to the all-students value;
  - switching speaking off for everyone refuses recordings (Plan 3b);
  - a staff invite with an email already used is `INVALID_REQUEST`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** all checks, `npm run test:db` and `npm run test:e2e:backend`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(server): the admin API, and deactivation reaching the phone`

### Task 9: The staff section of the app: shell, sign-in and code splitting

**Files:**

- Create: `apps/learner/src/staff/StaffApp.svelte`, `staff/staff-auth.ts`, `staff/staff-api.ts`, `staff/staff-state.svelte.ts`, `staff/StaffNav.svelte`, `staff/i18n.ts`
- Modify: `router.svelte.ts` (the `staff` routes), `App.svelte` (a lazy `import('./staff/StaffApp.svelte')` on a staff route), `screens/profiles/ProfilesScreen.svelte` (a small "मेंटर / एडमिन" link), `tooling/check-bundle-size.mjs` (the learner first-load stays ≤ 120 KB, and the staff chunk is reported separately)
- Test: `apps/learner/src/staff/staff.test.ts`, the size check

**Interfaces:**

- Produces:
  - `staffAuth`: `startSignIn()`, `finish(url)`, `token()`, `signOut()`, with the session stored under key `staff:*` in the `auth` table;
  - `staffApi` (typed calls for every `/v1/staff/*` route, contract-checked);
  - `staffState` `{ me: StaffMe | null; lang: Lang }`.

- [ ] **Step 1: Write the failing tests:**
  - opening `#/staff` signed out shows "Google से साइन इन करें", with no learner session touched;
  - after a fake sign-in, `claim` then `me` shows the role and the cohorts in the nav;
  - `NOT_STAFF` shows "यह खाता स्टाफ़ के लिए नहीं है" and signs out;
  - signing out of staff leaves every learner profile's session in place;
  - the learner first-load JS is unchanged within 1 KB, and no staff module appears in the first-load chunk list.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** all checks and `npm run size -w @shiksha/learner-app`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): a staff section with its own sign-in, loaded only when opened`

### Task 10: The mentor screens: cohorts, student detail and recordings

**Files:**

- Create: `staff/screens/Cohorts.svelte`, `staff/screens/Student.svelte`, `staff/screens/Recordings.svelte`, `staff/screens/AttentionBadge.svelte`
- Test: `apps/learner/src/staff/mentor-screens.test.ts`

- [ ] **Step 1: Write the failing tests** (fake backend with two cohorts):
  - the cohort list shows each student's lessons this week, streak, last sync ("आज", "2 दिन पहले") and attention badges ("3 दिन से नहीं आए", "एक पाठ पर अटके", "कम अंक"), flagged students first;
  - the detail page shows progress, the recent activity in plain words (not event names), attendance and recordings;
  - the recordings page plays a recording (the URL is fetched only on tap), saves a review with a comment, and removes it from "unreviewed";
  - nothing is rendered as HTML from data (a name like `<b>x</b>` shows literally);
  - each page works at 360 px and 1024 px, with no sideways scroll and tap targets ≥ 44 px (unit layout checks where possible, the rest in the Task 14 e2e).
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** all checks. Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): mentor screens for cohorts, students and recordings`

### Task 11: The mentor action screens: codes, level and attendance

**Files:**

- Create: `staff/screens/IssueCode.svelte`, `staff/screens/SetLevel.svelte`, `staff/screens/Attendance.svelte`
- Test: `apps/learner/src/staff/mentor-actions.test.ts`

- [ ] **Step 1: Write the failing tests:**
  - issuing a code shows it once, large and grouped (`ABCD-EFGH`), with "इसे लिख लें — दोबारा नहीं दिखेगा"; after "हो गया" it is gone from the page;
  - set level lists the tracks and lessons from the installed manifest and confirms before saving;
  - attendance shows the cohort with checkboxes for today (IST), saves, and shows "सेव हो गया";
  - an error shows a plain message and keeps the form.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** all checks. Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): mentor actions for codes, levels and attendance`

### Task 12: The admin screens

**Files:**

- Create: `staff/screens/admin/Setup.svelte` (labs, cohorts, staff), `admin/Students.svelte`, `admin/StudentActions.svelte`, `admin/Switches.svelte`, `admin/Branding.svelte`, `admin/Audit.svelte`
- Modify: `packages/api-contract/src/branding.ts` (contrast also against `#f4f5fa`, and darker and lighter shades derived from the primary: Plan 3b review M4), `apps/learner/src/runtime/branding.ts` (apply the derived shades)
- Test: `apps/learner/src/staff/admin-screens.test.ts`, `packages/api-contract/test/branding.test.ts`

- [ ] **Step 1: Write the failing tests:**
  - setup creates a lab, a cohort in it, and a mentor invite for that cohort;
  - students: search, filter by cohort and "needs attention", 50 per page, then move, deactivate (asks first), delete (asks twice: "हमेशा के लिए हटाएँ?" then type the student's name);
  - switches show the all-students value and per-student overrides, saving each;
  - branding shows the contrast result as you type, and blocks saving below 4.5 against white **and** against the page background;
  - the derived `-dark` and `-soft` shades follow a new primary;
  - the audit page lists entries newest first, with "हटाया गया छात्र" for anonymised rows.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** all checks and the size check. Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): admin screens for setup, students, switches, branding and the audit log`

### Task 13: Plan 3b review minors

**Files:** `packages/server/src/adapters/pg-learner-data-repo.ts`, `tooling/admin/commands.ts`, `.github/workflows/backup.yml`, `docs/runbooks/supabase-setup.md`, `packages/server/test/learner-data.db.test.ts`, `tooling/test/admin-cli.db.test.ts`

- [ ] **Step 1: Write the failing tests:**
  - **M1:** after deletion no `rate_limits` row has a bucket ending in `:<learnerId>`; the deletion test's search covers text columns too;
  - **M6:** `npm run admin -- retention` and `set-branding` run without `CODE_PEPPER`; `issue-code` still requires it;
  - the backup workflow's retention job no longer receives `CODE_PEPPER` (workflow test);
  - **M8:** `POST /v1/auth/code` with `x-forwarded-for: forged, real` is limited by `real` (HTTP test).
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** In the runbook:
  - the R2 token for the nightly job should be **Object Write** only, with a separate read key kept offline for restores;
  - after restoring an older backup, re-run `npm run admin -- delete` for every id in the current `deleted_learners` list.
- [ ] **Step 4: Run** all checks and `npm run test:db`. Expected: PASS.
- [ ] **Step 5: Commit** `fix: close the Plan 3b review minors`

### Task 14: End-to-end, runbook and worklog

**Files:** `apps/learner/e2e/staff.spec.ts` (in the `chromium-backend` project), `apps/learner/e2e/backend-setup.ts`, `docs/runbooks/supabase-setup.md`, `docs/decisions/backend-2026-10-23-staff.md`, `docs/decisions/README.md`, `WORKLOG.md`

- [ ] **Step 1: Write the e2e:**
  1. The owner adds the first admin with `add-staff`. The admin signs in (a Google stand-in user), creates a lab and a cohort, and invites a mentor.
  2. The mentor signs in and claims. A student phone joins the cohort with a backup code the mentor issued, then learns and records on Wi-Fi.
  3. The mentor sees the student, plays and reviews the recording, and sets the English level to `ef1-03`. The student's phone syncs and home offers `ef1-03`.
  4. The admin deactivates the student. The phone's me screen says so, and learning still works.
  5. The admin reactivates the student. The pending work uploads.
  6. The audit page shows each step, and no code or comment text.

  Layout checks at 360 px and 1024 px on the cohorts, student and admin students pages.

- [ ] **Step 2: Run** `npm run test:e2e:backend`. Expected: PASS once the setup helpers exist.
- [ ] **Step 3: Update the runbook:**
  - add the first admin;
  - invite mentors;
  - what mentors and admins can do;
  - the roles' limits.
- [ ] **Step 4: Write the decision record:** roles and scope, invites by email, the staff section in the same app (code-split), summaries refreshed on upload, `level_set` as an event, and the audit log's contents and anonymisation. Update `WORKLOG.md`.
- [ ] **Step 5: Run** every check: `npm test`, `npm run test:cov`, `npm run test:db`, `npm run test:e2e`, `npm run test:e2e:backend`, lint, typecheck, format, size and `restore-check.sh`. Expected: PASS. **Commit** `docs: runbook, decisions and e2e for Plan 4a`

---

## What this plan satisfies

| Spec / rule                                                                             | Task(s)   |
| --------------------------------------------------------------------------------------- | --------- |
| §8 mentor view: cohort list (level, lessons this week, streak, last sync)               | 4, 5, 10  |
| §8 needs attention: inactive ≥ 3 days, stuck, repeated low scores                       | 4, 10     |
| §8 student detail: progress, weak topics (wrong answers), recordings with comments      | 5, 6, 10  |
| §8 actions: create login codes, change level, mark lab attendance                       | 1, 7, 11  |
| §8.1 admin: setup labs, cohorts, mentors                                                | 2, 8, 12  |
| §8.1 manage students: list, search, filters, edit, move, reset code, deactivate, delete | 7, 8, 12  |
| §8.1 feature switches: all-students value and individual override                       | 8, 12     |
| §8.1 branding: name and colours with a contrast block (logo in 4b)                      | 12        |
| §8.1 audit log: every admin action, viewable                                            | 3, 12     |
| security rule: mentors only their cohorts; admins everything; identity from token       | 2, 5–8    |
| database rule: RLS policy per role, tested with 2+ students and 2+ cohorts              | 2         |
| privacy rule: audit entries anonymised on deletion; nothing personal in logs            | 3         |
| Plan 3b review minors M1, M3, M4, M6, M8                                                | 4, 12, 13 |
