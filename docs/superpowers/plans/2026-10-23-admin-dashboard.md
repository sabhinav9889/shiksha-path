# Admin Dashboard, Exports, Timeline and Logo Implementation Plan (Plan 4b)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Also follow `AGENTS.md`. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins track progress across the organisation and export it, mentors see a student's full timeline and per-track progress, and admins brand the app with a logo that reaches the installed icon. This plan builds:

- **Dashboard:** an org-wide progress dashboard filtered by cohort, lab and date range, built on a new `learner_daily_activity` table and richer summaries, with a card registry that Plans 5a and 6a extend.
- **Students:** a per-student timeline and per-track progress, on a student page made of registered sections; more list filters; search by POST; a rename screen.
- **Exports:** a formula-safe CSV of the student list and the dashboard, each one audited.
- **Branding:** a logo upload, PWA icons, a dynamic manifest, a live preview and "reset to default".
- **Plan 4a leftovers:** six deferred minors, each with a test that fails first.

**Architecture:** Same shape as Plan 4a:

- **Derived data:** a push already re-derives the learner's summary under `pg_advisory_xact_lock`. The same transaction now also rewrites that learner's `learner_daily_activity` rows, so the dashboard reads summaries and daily rows and never reads the event log per request.
- **API:** new admin routes in `http/admin-routes.ts` (dashboard, export, logo, reset) and one staff route (timeline). The branding manifest and icons are public routes, and the handler can now return a non-JSON `Response`.
- **Icons:** the admin's browser renders the logo into four PNGs with a canvas. The server accepts only PNGs and checks their bytes, size and dimensions. No SVG is ever stored or served.
- **Screens:** the dashboard and student page are registries (`DASHBOARD_CARDS`, `STUDENT_SECTIONS`) inside the lazily loaded staff chunk. The learner app gains only a lazily imported logo loader.

**Tech Stack:** Unchanged: Svelte 5, Vite PWA, Dexie, Supabase (Postgres, Auth, Storage, Edge Functions), `postgres`, Zod 4, Vitest, Playwright. **No new dependencies** (icon rendering uses the browser's canvas; see Task 8 and Notes for the owner).

**Spec:** `docs/superpowers/specs/2026-10-15-learning-platform-design.md`: §8.1 "Track progress" and "Branding", §5.3, §7.4, §13 (the ≥ 4 days/week and EF1 targets), §14 principles ("progress per track"). Rules: `.claude/rules/database.md` ("dashboards read summary tables, never the raw log per request"), `privacy.md`, `security.md` (logo ≤ 500 KB, check type and size), `testing.md` (2+ students, 2+ cohorts).

**Requires:**

- Plan 4a merged (PR #17).
- Branch `feature/admin-dashboard` from `main`.
- Docker running. Run `npm ci` in the worktree.

**Not in this plan:** the doubts and AI-cost cards and the doubts section (5a, through `DASHBOARD_CARDS` and `STUDENT_SECTIONS`); the meetings card and section (6a); an audit-log CSV _(builder's call: funder reports need the student list and the dashboard)_; mentors exporting CSV _(builder's call: §8.1 is the admin panel)_.

### Before you start

```bash
git worktree add ../shiksha-path-admin-dashboard -b feature/admin-dashboard origin/main
cd ../shiksha-path-admin-dashboard && npm ci && npm run db:start
```

Read `docs/gotchas/` first. Keep a ledger in `.superpowers/sdd/2026-10-23-admin-dashboard/progress.md` and record every deviation as `Ruling: <what> — <why> — <cost if wrong>`.

**Gate after every task** (repo root): `npx prettier --write apps packages tooling supabase` · `npx vitest run` · `npm run typecheck` · `npm run lint` · `npm run format:check`. Add `npm run test:db` when the task touches `packages/server/src/adapters`, `supabase/`, a contract test or `tooling/admin`.

### Provisional notes (re-verify against merged code before Task 1)

This plan was written against `feature/mentor-admin` at `11c6c8c`. Before Task 1, check each of these against `main` and write any difference as a `Ruling:`:

- `SummaryRepo.refresh(learnerId, derive)` and `PgSummaryRepo`/`memorySummaries`; `Summary`, `summarise`, `asOfToday` and `needsAttention` in `services/summary.ts`; `refreshSummary` in `services/sync.ts`.
- `withAudit(deps, record: AuditRecord, work)` and the `AuditAction` union in `services/audit.ts`.
- `OrgRepo.search(filter)` and its `(name, id)` cursor; `searchStudents`, `editStudent` and `requireAdmin` in `services/admin.ts` (280 lines, close to the 300-line limit).
- `ADMIN_ROUTES`, `HandlerDeps` and `handle()` in `http/`; `studentsQuery`, `studentsPage` and `summary` in `api-contract/src/{admin,staff-read}.ts`.
- `ServiceFixture` (`testing/service-contract.ts`), `makeMemoryRepos`, `makePgFixture` (`test/pg-repos.db.test.ts`).
- `staffMethods`, `StaffView.svelte`'s `admin` map, `ADMIN_SECTIONS` in `router.svelte.ts`, `StaffKey`/`AdminKey`.
- `LearnerRows`/`exportLearner`, the all-columns id search in `learner-data.db.test.ts`, the 2-mentor `describe` in `supabase/tests/rls.test.ts`.
- `COMMANDS`, `USAGE` and `makeAdminDeps` in `tooling/admin/commands.ts` (314 lines: put new commands in a new file).
- The first-load size (118.8 KB of 120 KB), `csp.ts`, `pwa.config.ts`, and the `chromium-backend` project regex.

## Global Constraints

Everything marked _(builder's call)_ is open in the spec. ⚑ marks values for the owner to confirm (listed at the end).

- **All Plan 3a, 3b and 4a constraints still apply:** portability, layers, identity from the token, the error format, logging with ids only, the code limits, and the staff session in the `auth` table under `staff:*`.
- **Series-map constraints 1 to 11 apply.** For this plan:
  1. Contract tests run on memory and Postgres with more rows than one page (> 50).
  2. Old phones keep working with the new `branding.logo` field.
  3. Snapshot figures go through `asOfToday`, and daily rows are recomputed by `npm run admin -- backfill-activity`.
  4. Revocation: an admin demoted to mentor or paused loses the dashboard, export, logo and reset routes on the next call.
  5. The dashboard lives in the staff section, so `idleGuard` (30 min) covers it. A CSV is a download, never put in `localStorage`.
  6. `learner_daily_activity` gets the six steps (Task 1).
  7. Every new write route writes exactly one audit entry.
  8. Traceability: see the table at the end.
  9. Every new screen is in the staff chunk or a lazy import, and Tasks 8, 10 and 13 run the size check.
  10. Names never go in a URL: search and export are POST, and the timeline cursor is an event id.
  11. Not applicable: no new feature switch.
- **Active day:** an IST day with at least one `item_answered` not stamped after "today". This is the same rule as `deriveProgress`'s `activeDays`, so streaks and the dashboard agree.
- **Weeks** run Monday to Sunday IST (as `summary.ts`; Postgres `date_trunc('week', day)` agrees).
- **Share active ≥ 4 days/week (§13):** for each full week inside the range, (learners active on ≥ 4 days) ÷ (learners in the population). The headline figure is the mean over those weeks, or `null` when the range holds no full week _(builder's call)_.
- **Population:** learners in scope (a cohort, a lab's cohorts, or all) who are not deactivated. Every figure counts only them _(builder's call)_. A deleted student's daily rows cascade away, so their past activity leaves the history.
- **Dashboard range:** `from ≤ to ≤ today (IST)` and at most **366 days** inclusive ⚑. Anything else answers `INVALID_REQUEST`. The screen defaults to the last 28 days and clamps the pickers.
- **Snapshot figures** (streaks, inactive, stuck, placement, EF1 completion, progress per track) describe the population today and ignore the range. The screen labels them "आज की स्थिति".
- **English Foundation 1 finished** _(builder's call)_: every lesson of module `english-foundation-1` completed, or that module tested out. The staff app sends the module's lesson ids from the installed manifest, because the server has no content manifest.
- **Placement:** per track, `start` is the mean of each learner's first placement score, and `retake` is the mean of each retaker's latest score (learners with ≥ 2 placements).
- **Weak topics** _(builder's call)_: lessons with the most wrong `item_answered` (source `lesson`) in the range, top 10, from `learner_daily_activity.wrong_by_lesson`. Lessons stand in for topics because the manifest has no topic field.
- **Timeline:** `lesson_completed`, `test_out_completed`, `placement_completed` and `level_set` events, newest first by `(at, id)`, 50 per page, with the cursor being the last event's id.
- **CSV:** UTF-8 with BOM, CRLF line ends, RFC 4180 quoting. A **string** cell starting with `=` `+` `-` `@`, tab or CR gets a leading `'`. Numbers are written plainly _(builder's call: a number cannot hold a formula)_. Student-list CSVs contain names ⚑; dashboard CSVs never do. At most **10 000** rows (`TOO_LARGE` above that). Limited to **30 exports per hour** per staff member. Each export writes one `export_made` entry with `{ what, rows }`.
- **Logo** ⚑: the admin picks an SVG or PNG of at most **500 KB** (512 000 bytes). The admin's browser checks the file:
  - a PNG must start with the PNG signature;
  - an SVG must pass a strict allow-list.

  The browser then renders `icon-192` (192²), `icon-512` (512²), `maskable-512` (512², logo at 80% on white) and `favicon-48` (48²). The server accepts each one only if it is a PNG by its magic bytes, has exactly that IHDR size, and is ≤ 512 000 bytes. The bucket `branding` is private, PNG-only, with a 512 000-byte limit.

- **Manifest:** `GET /v1/branding/manifest`, `application/manifest+json`, cached for 300 s. It sets `id` and `start_url` to `${APP_ORIGIN}/` (the installed app keeps its identity), `scope` to `${APP_ORIGIN}/`, the name from branding, and `theme_color` to the primary. Icons are relative `icon?id=…&name=…` URLs, or the static `${APP_ORIGIN}/icons/*.png` when there is no logo. `APP_ORIGIN` is a new env setting (falls back to the first `ALLOWED_ORIGINS` entry).
- **Reset to default:** always available; restores `DEFAULT_BRANDING`'s name and colours and removes the logo; audited `branding_reset`.

## Review Focus

1. **CSV formula injection.** A student named `=HYPERLINK("http://x","y")`, `+1`, `-2+3`, `@SUM(A1)`, `\tcmd` or `कविता"; रानी` must open in a spreadsheet as text, with the Hindi intact and the BOM present. Task 5.
2. **A logo that is an SVG with a script** (`<script>`, `onload=`, `<foreignObject>`, `xlink:href="http://…"`, `<!ENTITY>`), or a PNG-named file that is not a PNG. The browser refuses it with a plain message, and the server refuses any non-PNG or wrongly sized rendition, so no SVG is ever stored or served. Tasks 7, 12.
3. **A dashboard over 5,000 students.** It must answer from summaries and daily rows without reading `learner_events`. Task 2.
4. **A date range of 10 years**, a range ending tomorrow, or `from > to`: `INVALID_REQUEST`, never a slow query. Task 2.
5. **A mentor requesting an admin route** (dashboard, export, logo, reset, students search), or an admin demoted mid-session: `FORBIDDEN` and nothing written. Tasks 2, 5, 7.
6. **A deleted student in a daily table.** Their rows go with them (cascade), the dashboard counts drop, the id is found in no column, and the backfill never brings them back. Tasks 1, 2.

---

### Task 1: Daily activity and richer summaries, written in the summary lock

**Files:**

- Create:
  - `supabase/migrations/20261024000001_learner_daily_activity.sql` and `supabase/rollbacks/20261024000001_learner_daily_activity.down.sql`;
  - `packages/server/src/services/daily-activity.ts`;
  - `tooling/admin/backfill.ts`.
- Modify:
  - `packages/server/src/ports.ts` (`SummaryRepo.refresh`, `LearnerRows`);
  - `services/summary.ts`, `services/sync.ts` (`refreshSummary`), `services/learner-data.ts` (export);
  - `adapters/pg-summary-repo.ts`, `adapters/pg-learner-data-repo.ts`, `testing/memory-summaries.ts`, `testing/memory-learner-data.ts`;
  - `api-contract/src/staff-read.ts` (`summary`);
  - `tooling/admin/commands.ts` (register the command, `USAGE`).
- Test: `packages/server/test/summary.test.ts`, `packages/server/test/daily-activity.test.ts`, the service contract, `learner-data.db.test.ts`, `supabase/tests/rls.test.ts`, `tooling/test/admin-cli.db.test.ts`

**Interfaces:**

- Consumes: `summarise`, `refreshSummary`, `PgSummaryRepo.refresh` (4a).
- Produces:
  - **Table:** `learner_daily_activity(learner_id uuid references learners on delete cascade, day date, answers int not null, lessons_completed int not null, test_outs int not null, wrong_by_lesson jsonb not null default '{}', created_at, updated_at, primary key (learner_id, day))`, with an index on `(day)`. RLS is on, with a select policy `staff_can_see(learner_id)` and the same revokes as `learner_summaries`. `test_outs` and `wrong_by_lesson` are additive to the shared interface.
  - **Types and functions:**
    - `DayActivity = { day: string; answers: number; lessonsCompleted: number; testOuts: number; wrongByLesson: Record<string, number> }`;
    - `dailyActivity(raw: readonly unknown[], today: string): DayActivity[]` in `services/daily-activity.ts`. It covers days with any count > 0, oldest first, each event id counted once and future-stamped events skipped. `testOuts` counts `passed`; `wrongByLesson` counts `outcome: 'wrong'` with source `lesson`.
    - `Summary` gains these optional fields, so old saved rows still parse:
      - `completedLessons?: string[]`, `testedOutModules?: string[]`;
      - `language?: 'hi_en' | 'en_only'`;
      - `levels?: Record<string, string>` (`startLessonByTrack`);
      - `placementScores?: Record<string, { first: number; latest: number | null }>`;
      - `weakLessons?: { lessonId: string; wrong: number }[]` (top 5; `weakLessons` moves here from `staff-read.ts`).
    - `SummaryRepo.refresh(learnerId, derive: (events: unknown[]) => { summary: Summary; daily: DayActivity[] }): Promise<Summary>`. Inside the same advisory-locked transaction it saves the summary, then deletes and re-inserts that learner's daily rows.
    - `LearnerRows` gains `dailyActivity: DayActivity[]`, and `LearnerExport` carries it.
    - `npm run admin -- backfill-activity [--dry-run]` refreshes every learner, 100 ids at a time, and prints only `refreshed <n>`.

- [ ] **Step 1: Write the failing tests:**
  - `dailyActivity`:
    - two answers on 2026-10-20 IST and one on 2026-10-21 give two rows with `answers` 2 and 1;
    - an event stamped `23:59 +05:30` lands on its IST day, not the UTC day;
    - a duplicate event id counts once;
    - an answer stamped tomorrow is absent;
    - a failed test-out adds no `testOuts`;
    - `wrongByLesson` is `{ 'ef1-01-greetings': 2 }` for two wrong lesson answers plus one wrong review answer.
  - `summarise`:
    - fills `completedLessons` and `language: 'en_only'` after a `language_changed`;
    - `placementScores.english` is `{ first: 0.4, latest: 0.7 }` after two placements and `{ first: 0.4, latest: null }` after one;
    - `levels.english` follows a `level_set`;
    - `weakLessons` matches the 4a `studentDetail` result for the same log.
  - A summary saved without the new fields still parses through the contract `summary` and `asOfToday`.
  - After a push, the daily rows equal `dailyActivity(all events, today)`. Two concurrent pushes leave them equal too (Postgres).
  - **Six steps:**
    - `exportLearner` holds A's daily rows and none of B's;
    - after `deleteLearner(A)`, no row of `learner_daily_activity` holds A (seed a daily row for A so the all-columns search covers the new table);
    - retention is "until deletion" (the cascade applies it), recorded in the decision record;
    - audit anonymisation: no audit entry references daily rows, so nothing changes; say so in the record;
    - RLS (2 mentors, 2 cohorts, 2 students each): mentor A's token selects only cohort A's daily rows; a student's token selects none; nobody can insert.
  - **Deferred minor (c):** the same RLS test for `learner_summaries` and `lab_attendance`: mentor A reads only cohort A's rows.
  - `backfill-activity` on a learner whose daily rows were deleted by hand recreates them, never prints a name, and `--dry-run` writes nothing. A learner deleted on request is not recreated.
- [ ] **Step 2: Run** `npx vitest run packages/server` and `npm run db:reset && npm run test:db`. Expected: FAIL (`dailyActivity` not defined; the table does not exist).
- [ ] **Step 3: Implement.**
  - `refreshSummary` builds `derive` from `summarise` and `dailyActivity` with one `today`.
  - The insert uses `jsonb_to_recordset` with a parameter, never string-built SQL.
  - A failure still never fails the push; the backfill repairs it.
- [ ] **Step 4: Run** the gate and `npm run test:db`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(server): keep daily activity per learner in the summary lock`

### Task 2: The dashboard API

**Files:**

- Create:
  - `packages/server/src/services/dashboard.ts`;
  - `packages/server/src/adapters/pg-activity-repo.ts`;
  - `packages/server/src/testing/memory-activity.ts`;
  - `packages/server/src/testing/dashboard-contract.ts`;
  - `packages/api-contract/src/dashboard.ts` (exported from `staff-index.ts`).
- Modify: `ports.ts` (`ActivityRepo`), `testing/service-contract.ts` (`ServiceFixture.activity`), `testing/memory-repos.ts`, `test/pg-repos.db.test.ts`, `http/router.ts` (`HandlerDeps.activity`), `http/admin-routes.ts`, `supabase/functions/api/index.ts`
- Test: `dashboard-contract.ts` run from `test/services.test.ts` and `test/pg-repos.db.test.ts`, `test/http.test.ts`

**Interfaces:**

- Consumes: `DayActivity` and the new `Summary` fields (Task 1); `asOfToday` and `needsAttention`.
- Produces:
  - `ActivityRepo`. Every method counts only non-deactivated learners in `cohortIds`, and only `learner_daily_activity` and `learner_summaries` are read:

    ```ts
    interface ActivityScope {
      cohortIds: string[] | 'all';
      from: string;
      to: string;
    }
    interface ActivityRepo {
      population(cohortIds: string[] | 'all'): Promise<{ id: string; linkedOn: string }[]>;
      days(scope: ActivityScope): Promise<
        {
          day: string;
          active: number;
          answers: number;
          lessonsCompleted: number;
          testOuts: number;
        }[]
      >;
      weeks(
        scope: ActivityScope,
      ): Promise<{ weekStart: string; active: number; activeFourPlus: number }[]>;
      weakLessons(
        scope: ActivityScope,
        limit: number,
      ): Promise<{ lessonId: string; wrong: number }[]>;
    }
    ```

  - `MAX_DASHBOARD_DAYS = 366`, and `dashboardRequest = z.strictObject({ cohortId: z.uuid().optional(), labId: z.uuid().optional(), from: isoDay, to: isoDay, finishModule: z.strictObject({ moduleId: z.string().min(1).max(64), lessonIds: z.array(z.string().min(1).max(64)).min(1).max(200) }).optional() })`, refined so that `from ≤ to` and the span is ≤ 366 days inclusive.
  - `dashboard` response:

    ```ts
    {
      range: { from: string; to: string };
      students: number; // population
      days: { day; active; answers; lessonsCompleted; testOuts }[]; // every day of the range, zeros filled
      weeks: { weekStart; active; activeFourPlus; full: boolean }[];
      activeFourPlusShare: number | null;
      totals: { lessonsCompleted: number; testOuts: number };
      finishModule: { moduleId: string; finished: number; rate: number } | null;
      placement: { track: string; start: number | null; retake: number | null; starters: number; retakers: number }[];
      streaks: { average: number; atLeast7: number };
      inactive: number;
      stuck: number;
      completedByLesson: { lessonId: string; learners: number }[];
      weakLessons: { lessonId: string; wrong: number }[]; // top 10
    }
    ```

  - `getDashboard(deps: { org: OrgRepo; activity: ActivityRepo; summaries: SummaryRepo }, staff: StaffCaller, request: DashboardRequest): Promise<Dashboard>`. It is admin-only (`FORBIDDEN`) and refuses `to > today` with `INVALID_REQUEST`. A `labId` maps to that lab's cohorts, and a `cohortId` outside the lab gives an empty population.
  - Route `POST /v1/staff/admin/dashboard`.

- [ ] **Step 1: Write the failing contract tests** (memory and Postgres; 2 cohorts in 2 labs):
  - a learner active on Mon, Tue, Wed and Thu and another active on Mon only, in one full week: `weeks[0]` is `{ active: 2, activeFourPlus: 1, full: true }` and `activeFourPlusShare` is `0.5`;
  - a partial week at the range edge is `full: false` and left out of the share;
  - the cohort filter, the lab filter, and a cohort outside the chosen lab (0 students) each give the right population;
  - a deactivated learner counts nowhere;
  - **deleted student:** after `deleteLearner`, `days` and `weakLessons` lose their rows and `students` drops by one;
  - `finishModule` counts a learner with every lesson done and one who tested out, but not one with all but one lesson; `rate` = finished ÷ students;
  - `placement.english` averages first and latest scores as in the Global Constraints;
  - **stale snapshot:** a summary saved 10 days ago with `streak: 5` counts as `inactive` and adds 0 to `streaks.average`;
  - **5,000 students:**
    - memory: 5,000 learners, then a counting `EventRepo` sees 0 `page` calls during `getDashboard`;
    - Postgres: seed 5,000 learners, 30 days of daily rows and summaries with `generate_series`, and get correct totals;
    - `pg-activity-repo.ts`'s source text does not contain `learner_events`.
  - **10 years:**
    - `from: '2016-10-24', to: '2026-10-23'` is `INVALID_REQUEST` at the HTTP layer;
    - 367 days is refused and 366 is accepted;
    - `to` = tomorrow and `from > to` are refused.
  - **Mentor and revocation:**
    - a mentor gets `FORBIDDEN`, and a learner's token gets `NOT_STAFF`;
    - an admin demoted to mentor through `saveStaff` gets `FORBIDDEN` on the next call;
    - a paused admin gets `NOT_STAFF`.
- [ ] **Step 2: Run** `npx vitest run packages/server` and `npm run test:db`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - The day and week counts are `group by` queries over `learner_daily_activity` joined to `learners` (cohort and `deactivated_at is null`).
  - Weak lessons use `jsonb_each_text(wrong_by_lesson)` with `sum(value::int)`, `order by 2 desc, 1`, `limit 10`.
  - Snapshot figures come from `summaries.forLearners(population ids)` through `asOfToday`.
- [ ] **Step 4: Run** the gate and `npm run test:db`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(server): an org-wide progress dashboard from summaries and daily rows`

### Task 3: The student timeline, and student detail without the whole log

**Files:**

- Create: `supabase/migrations/20261024000002_events_by_time.sql` (+ rollback: index `learner_events (learner_id, at desc, id desc)`), `packages/api-contract/src/timeline.ts`
- Modify: `ports.ts` (`EventRepo.latest`), `adapters/pg-event-repo.ts`, the memory event repo in `testing/memory-repos.ts`, `services/staff-read.ts`, `http/router.ts`
- Test: the staff contract (both repos), `test/http.test.ts`

**Interfaces:**

- Produces:
  - `EventRepo.latest(learnerId: string, options: { types?: EventType[]; beforeId?: string; limit: number }): Promise<LearnerEvent[]>`, newest first by `(at desc, id desc)`. `beforeId` is the last id of the previous page, and an unknown or other learner's `beforeId` gives `[]`.
  - `studentTimeline(deps: StaffReadDeps, staff: StaffCaller, query: { id: string; before?: string }): Promise<Timeline>`, which calls `inScope` first.
  - `GET /v1/staff/student/timeline?id=<uuid>&before=<uuid>` → `timeline = { entries: TimelineEntry[]; next: string | null }`, with:
    - `TimelineEntry = { id; at } &` one of `{ kind: 'lesson_completed'; lessonId; correct; scored }`, `{ kind: 'test_out'; moduleId; score; passed }`, `{ kind: 'placement'; sections: { track; score }[] }`, `{ kind: 'level_set'; track; startLesson }`;
    - `TIMELINE_PAGE = 50`.
  - `studentDetail` takes `recent` from `events.latest(id, { limit: 50 })` and `weakLessons` from the saved summary (`[]` when the summary predates Task 1). It never calls `events.page`.

- [ ] **Step 1: Write the failing tests:**
  - 120 completed lessons give three pages (50, 50, 20) newest first, with no entry twice and none missing, on memory **and** Postgres;
  - two events with the same `at` are ordered by id and both appear across a page break;
  - an out-of-order upload (an older `at` pushed later) sits at its date, not its arrival;
  - `item_answered` and `lesson_started` are not in the timeline;
  - mentor A asking for a cohort-B student is `FORBIDDEN`, the same as a random uuid;
  - `before` set to cohort B's event id gives an empty page, never B's events;
  - `studentDetail` on a learner with 5,000 events calls `events.page` 0 times (counting repo) and returns 50 `recent`.
- [ ] **Step 2: Run** `npx vitest run packages/server` and `npm run test:db`. Expected: FAIL.
- [ ] **Step 3: Implement.** The Postgres cursor is `(at, id) < (select at, id from learner_events where id = $before and learner_id = $learner)`.
- [ ] **Step 4: Run** the gate and `npm run test:db`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(server): a student's timeline by date, and detail without the whole log`

### Task 4: Student search by POST, with the spec's filters

**Files:**

- Modify: `api-contract/src/admin.ts` (`studentsSearch` replaces `studentsQuery`), `ports.ts` (`OrgRepo.search` filter), `adapters/pg-org-repo.ts`, the memory org repo, `services/admin.ts` (`StudentFilter`, `searchCohorts`), `http/admin-routes.ts`
- Test: `testing/admin-contract.ts` (both repos), `test/http.test.ts`

**Interfaces:**

- Produces:
  - `studentsSearch = z.strictObject({ q: z.string().max(80).optional(), cohortId: z.uuid().optional(), labId: z.uuid().optional(), mentorId: z.uuid().optional(), active: z.boolean().optional(), attention: z.boolean().optional(), language: z.enum(['hi_en', 'en_only']).optional(), level: z.strictObject({ track: z.string().min(1).max(64), startLesson: z.string().min(1).max(64) }).optional(), after: z.uuid().optional() })`;
  - `POST /v1/staff/admin/students` with that body → `studentsPage` (unchanged). `GET /v1/staff/admin/students` is removed (404 `INVALID_REQUEST`).
  - `OrgRepo.search` gains `language?: 'hi_en' | 'en_only'` and `level?: { track: string; startLesson: string }`, matched in SQL on `learner_summaries.summary` (`->>'language'`, `->'levels'->>track`). A learner with no summary has language `hi_en` and no level.
  - `labId` narrows `searchCohorts` to that lab's cohorts (intersected with `cohortId` and `mentorId`).

- [ ] **Step 1: Write the failing tests** (both repos):
  - 120 learners, half `en_only`, give exactly 60 across pages of 50 with no repeats, including names with combining marks (`अंजलि`, `ज़ोया`) and names equal up to the id;
  - the lab filter, level filter, `mentorId` combined with `labId`, and `active: false` each return the right rows;
  - `q` stays literal (`%`, `_`, a quote);
  - `GET /v1/staff/admin/students?q=x` is 404;
  - the POST body's name never appears in the request log line (logger spy);
  - a mentor gets `FORBIDDEN`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the gate and `npm run test:db`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(server): search students by POST with lab, level and language filters`

### Task 5: CSV export, formula-safe and audited

**Files:**

- Create: `packages/server/src/services/csv.ts`, `packages/server/src/services/exports.ts`, `packages/api-contract/src/exports.ts`
- Modify: `services/audit.ts` (`'export_made'`), `services/limits.ts` (`export: { limit: 30, windowSeconds: 3600 }`), `http/admin-routes.ts`
- Test: `packages/server/test/csv.test.ts`, the admin contract

**Interfaces:**

- Consumes: `searchStudents` (Task 4), `getDashboard` (Task 2).
- Produces:
  - `toCsv(header: string[], rows: (string | number | null)[][]): string`;
  - `exportRequest = z.discriminatedUnion('what', [z.strictObject({ what: z.literal('students'), filter: studentsSearch.omit({ after: true }) }), z.strictObject({ what: z.literal('dashboard'), filter: dashboardRequest })])`;
  - `POST /v1/staff/admin/export` → `{ filename: string; csv: string; rows: number }`, with filenames `students-<YYYY-MM-DD>.csv` and `dashboard-<from>-<to>.csv`;
  - `exportCsv(deps, staff, request): Promise<{ filename; csv; rows }>`: admin-only, `enforce(limiter, 'export', 'export:<staffId>')`, one `withAudit` with `{ what, rows }`.
  - **Student columns:** `Name, Cohort, Lab, Active, Lessons done, Lessons this week, Streak, Last active day, Needs attention` (no email, code or id).
  - **Dashboard columns:** `Day, Active students, Answers, Lessons completed, Test-outs`, then a blank row and one `label, value` row for each headline figure. No names.

- [ ] **Step 1: Write the failing tests:**
  - `toCsv(['Name'], [['कविता']])` is `'﻿Name\r\nकविता\r\n'`;
  - `'=HYPERLINK("http://x","y")'` becomes `"'=HYPERLINK(""http://x"",""y"")"`;
  - `+1`, `-2+3`, `@SUM(A1)`, `'\tx'` and `'\rx'` each gain a leading `'`;
  - the number `-5` stays `-5`, and `null` is an empty cell;
  - `a,b` and a line break are quoted;
  - **students export:**
    - 120 students (more than two pages) give 120 rows with Hindi names intact;
    - the audit gets exactly one `export_made` with `{ what: 'students', rows: 120 }` and nothing else in `details`;
  - **dashboard export:** it contains no learner name, even when a learner is named like a lesson id;
  - 10 001 matching students answer `TOO_LARGE` and write no audit entry;
  - the 31st export in an hour is `RATE_LIMITED`;
  - a mentor gets `FORBIDDEN` with no audit entry.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the gate and `npm run test:db`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(server): CSV exports of students and the dashboard, formula-safe and audited`

### Task 6: Plan 4a server leftovers: audit, attendance and branding contrast

**Files:**

- Modify: `services/audit.ts`, `services/admin.ts` (`editStudent`), `services/staff.ts` (`claimStaff`), `services/mentor-actions.ts`, `api-contract/src/branding.ts`
- Test: the staff and admin contracts, `packages/api-contract/test/branding.test.ts`

**Interfaces:**

- Produces:
  - `AuditRecord<T>` with `learnerId: string | null | ((result: T) => string | null)`, resolved after `work` succeeds;
  - `AuditAction` gains `'staff_claimed' | 'export_made' | 'branding_reset'`.
  - `editStudent` writes **one** entry: `student_moved` with `{ to }` when only the cohort changes, otherwise `student_edited` with `{ renamed: boolean, to?: cohortId }`.
  - `claimStaff` writes `staff_claimed` (learner null, `{}`) on a first claim only.
  - `issueStudentCode` for a new student audits `code_issued` with the new learner's id.
  - `markAttendance` marks only non-deactivated members. A paused learner in `present` is `INVALID_REQUEST`, a day before today − 30 is `INVALID_REQUEST`, and paused learners' earlier marks stay.
  - `isReadablePrimary(colour: string): boolean` = `isReadable(colour) && contrastRatio(colour, primaryShades(colour).soft) >= MIN_CONTRAST`; `brandingInput.primary` uses it, and `accent` keeps `isReadable`.

- [ ] **Step 1: Write the failing tests:**
  - **(b)** a rename and move in one request adds exactly one audit row;
  - **(b)** a first claim adds `staff_claimed`, and calling claim again adds nothing;
  - **(b)** issuing a code with `{ name, cohortId }` adds `code_issued` whose `learnerId` equals the returned id;
  - **(e)** attendance with a paused learner listed is `INVALID_REQUEST` and writes nothing; the day `today − 31` is refused and `today − 30` is accepted; marking a cohort with one paused member returns `marked` = members − 1;
  - **(a)** `#005fff` passes `isReadable` but fails `isReadablePrimary` (soft contrast 4.45), and `brandingInput` refuses it as primary but accepts it as accent; `#2f3ab2` is accepted (7.48).
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the gate and `npm run test:db`. Expected: PASS.
- [ ] **Step 5: Commit** `fix(server): one audit entry per edit, audited claims and codes, attendance limits`

### Task 7: Logo storage, icon and manifest routes, and reset

**Files:**

- Create:
  - `supabase/migrations/20261024000003_branding_logo.sql` (+ rollback): `branding.logo_id uuid null`, and the private bucket `branding` (`file_size_limit 512000`, `allowed_mime_types {'image/png'}`, `on conflict do nothing`);
  - `packages/server/src/services/logo.ts`, `packages/server/src/services/manifest.ts`, `packages/server/src/services/png.ts`.
- Modify:
  - `ports.ts`: `export type ObjectStorage = RecordingStorage`, and `BrandingRepo.setLogo(id: string | null)` and `BrandingRepo.reset()`, each returning `Promise<{ version: number }>`;
  - `adapters/pg-branding-repo.ts`, `testing/memory-branding.ts`;
  - `adapters/supabase-recording-storage.ts`: `createSupabaseStorage(opts: { url: string; serviceRoleKey: string; publicUrl?: string; bucket: string; upsert?: boolean }): ObjectStorage` (`upsert` defaults to `true`, today's recordings behaviour; Plan 6b passes `false`), with `createSupabaseRecordingStorage(url, key, publicUrl)` kept as a wrapper (`bucket: 'recordings'`);
  - `api-contract/src/branding.ts`: `branding` gains `logo: z.object({ id: z.uuid() }).nullable().default(null)`;
  - `http/respond.ts` (`binary`), `http/router.ts` (pass a returned `Response` through with CORS; `HandlerDeps.brandingFiles: ObjectStorage`, `appOrigin: string`), `http/admin-routes.ts`;
  - `supabase/functions/api/index.ts` (`APP_ORIGIN`), `ServiceFixture.brandingFiles`.
- Test: `packages/server/test/logo.test.ts`, `test/http.test.ts`, `supabase/tests/api.test.ts`

**Interfaces:**

- Produces:
  - `ICONS = { 'icon-192': 192, 'icon-512': 512, 'maskable-512': 512, 'favicon-48': 48 } as const`; `type IconName = keyof typeof ICONS`; `MAX_LOGO_BYTES = 512_000`.
  - `pngSize(bytes: Uint8Array): { width: number; height: number } | null`: null unless the 8-byte signature is followed by an `IHDR` chunk.
  - `POST /v1/staff/admin/logo/start {}` → `{ uploadId: uuid, uploads: { name: IconName; url: string; token: string }[] }`, signed for `logo/<uploadId>/<name>.png`.
  - `POST /v1/staff/admin/logo/complete { uploadId }` → `{ version }`:
    - every object must exist, be ≤ `MAX_LOGO_BYTES`, and pass `pngSize` with exactly its size;
    - otherwise it removes them and answers `INVALID_REQUEST`;
    - on success it sets `logo_id`, removes the previous logo's objects, and audits `branding_changed` with `{ logo: 'set' }`.
  - `POST /v1/staff/admin/branding/reset {}` → `{ version }`: default name and colours, `logo_id` null, the old objects removed, audited `branding_reset`.
  - `GET /v1/branding/icon?id=<uuid>&name=<IconName>`: public, `image/png`, `cache-control: public, max-age=31536000, immutable`, `x-content-type-options: nosniff`. It answers 404 `INVALID_REQUEST` unless `id` is the current logo.
  - `GET /v1/branding/manifest`: public, `webManifest(brand: Branding, appOrigin: string): WebManifest` as in the Global Constraints.

- [ ] **Step 1: Write the failing tests:**
  - complete with four valid PNGs sets the logo and bumps the version, and `GET /v1/branding` shows `logo.id`;
  - a 192 rendition that is 191 wide, a file that is SVG text (`<svg onload=…>`) named `.png`, a GIF, a 512 001-byte PNG, and a missing rendition are each `INVALID_REQUEST`, leave the old logo in place, and leave no new objects;
  - the icon route returns the exact bytes with the headers above; an old logo id is 404;
  - the manifest without a logo lists the three static icons at `APP_ORIGIN`; with one, it lists the relative `icon?id=` URLs with `purpose: 'maskable'` on `maskable-512`, `id` and `start_url` both `https://app.example/`, and the branding name and primary;
  - **reset** after a logo and custom colours gives `DEFAULT_BRANDING` values with `logo: null`, removes the objects, and audits once;
  - a mentor gets `FORBIDDEN` on start, complete and reset; an anonymous caller can read the icon and the manifest;
  - **old phone:** a cached branding without `logo` parses with `logo: null`, and an old contract (the 4a `branding` schema) parses a new response;
  - against the local stack (`api.test.ts`): upload through the signed URLs, complete, then fetch the icon. Uploading `image/svg+xml` to the bucket is refused.
- [ ] **Step 2: Run** `npx vitest run packages/server packages/api-contract` and `npm run test:db`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the gate, `npm run test:db`, `npm run functions:build` and `npm run test:e2e:backend`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(server): logo icons in storage, a dynamic manifest and branding reset`

### Task 8: The logo and dynamic manifest in the learner app

**Files:**

- Create: `apps/learner/src/runtime/logo.ts` (imported only with `import()`), `apps/learner/src/manifest-link.ts` (a Vite plugin)
- Modify: `apps/learner/src/csp.ts`, `apps/learner/vite.config.ts`, `apps/learner/src/ui/NavBar.svelte`, `apps/learner/src/app-state.svelte.ts` (`logo: string | null`), `apps/learner/src/App.svelte`
- Test: `apps/learner/src/runtime/logo.test.ts`, `csp.test.ts`, `pwa.config.test.ts`, `vite-config.test.ts`, `ui/shell.test.ts`

**Interfaces:**

- Produces:
  - `refreshLogo(runtime: Runtime, brand: Branding): Promise<string | null>`:
    - when `brand.logo` differs from the cached id, it fetches `icon-192` and `favicon-48` from `${apiConfig().baseUrl}/v1/branding/icon` and stores them as `data:image/png;base64,…` in meta keys `logo:id`, `logo:icon-192` and `logo:favicon-48`;
    - when `logo` is null, it clears them;
    - offline, it keeps the cache.
  - `applyFavicon(doc: Document, dataUrl: string | null): void`.
  - `contentSecurityPolicy` adds `manifest-src 'self' <api origin>` and appends the API origin to `img-src`.
  - `manifestLinkPlugin(apiUrl: string | undefined)` rewrites the PWA plugin's `<link rel="manifest">` to `${apiUrl}/functions/v1/api/v1/branding/manifest` when `VITE_SUPABASE_URL` is set, and leaves the static manifest otherwise.

- [ ] **Step 1: Write the failing tests:**
  - with a fake fetch: a new logo id stores both data URLs, the same id fetches nothing, `logo: null` clears them, and a failed fetch keeps the old ones;
  - the nav bar shows `<img alt="">` beside the name only when `appState.logo` is set;
  - the CSP has `manifest-src 'self' https://x.supabase.co` and `img-src` gains the same origin, but `script-src` is unchanged;
  - the built `index.html` links the dynamic manifest when the API URL is set, and the static one when not;
  - `pwa.config.test.ts` still passes (the static manifest stays as the fallback);
  - no `logo` value is ever written to `localStorage`.
- [ ] **Step 2: Run** `npx vitest run apps/learner/src`. Expected: FAIL.
- [ ] **Step 3: Implement.** `App.svelte` calls `import('./runtime/logo.js')` after branding loads, so the loader stays out of the first load.
- [ ] **Step 4: Run** the gate and `npm run build -w @shiksha/learner-app && npm run size -w @shiksha/learner-app`. Expected: PASS, with first-load JS ≤ 120 KB and at most +0.3 KB over 118.8 KB.
- [ ] **Step 5: Commit** `feat(app): show the NGO's logo and link the dynamic manifest`

### Task 9: The dashboard screen and the card registry

**Files:**

- Create:
  - `apps/learner/src/staff/dashboard/cards.ts`, `dashboard/filter.ts`, `dashboard/load.ts`;
  - `dashboard/Dashboard.svelte`, `dashboard/ActivityCard.svelte`, `dashboard/LearningCard.svelte`, `dashboard/PlacementCard.svelte`, `dashboard/AttentionCard.svelte`, `dashboard/WeakTopicsCard.svelte`, `dashboard/TrackProgressCard.svelte`;
  - `apps/learner/src/staff/ExportButton.svelte`.
- Modify: `router.svelte.ts` (`ADMIN_SECTIONS` gains `'dashboard'`), `staff/StaffView.svelte`, `staff/StaffNav.svelte`, `staff/staff-api.ts` (`dashboard`, `exportCsv`), `staff/admin-i18n.ts`
- Test: `apps/learner/src/staff/dashboard.test.ts`

**Interfaces:**

- Consumes: `POST /v1/staff/admin/dashboard` (Task 2), `POST /v1/staff/admin/export` (Task 5).
- Produces:
  - `DashboardFilter = { cohortId?: string; labId?: string; from: string; to: string }`;
  - `DashboardCard = { id: string; title: AdminKey; component: Component<{ filter: DashboardFilter; lang: Lang }> }`;
  - `DASHBOARD_CARDS: DashboardCard[]` with `activity`, `learning`, `placement`, `attention`, `weak-topics` and `track-progress`;
  - `loadDashboard(filter): Promise<Result<Dashboard>>` memoises one request per filter, so the built-in cards share it while each card still loads its own data;
  - `FINISH_MODULE_ID = 'english-foundation-1'`, whose lesson ids come from the installed manifest (the card shows "—" without one);
  - `Dashboard.svelte` takes `cards = DASHBOARD_CARDS`;
  - `ExportButton` (`{ request: ExportRequest; lang }`) downloads through `Blob` and `URL.createObjectURL`, shows the personal-data banner ⚑ for student exports, and revokes the URL.

- [ ] **Step 1: Write the failing tests** (fake backend, 2 cohorts in 2 labs):
  - the default range is the last 28 IST days;
  - choosing a lab narrows the cohort picker;
  - a `from` more than 366 days before `to` is clamped, and the screen says "अधिकतम 366 दिन";
  - the activity card shows "4+ दिन सक्रिय: 50%" for the Task 2 fixture;
  - weak topics and track progress show lesson and module **titles** from the manifest, not ids;
  - **registry:** a fake card added to `cards` renders its title and receives the current filter, and changing the filter re-renders it with the new one;
  - the dashboard CSV download starts with a BOM; a student-list export shows "इस फ़ाइल में छात्रों के नाम हैं — काम के बाद इसे मिटा दें";
  - a mentor never sees the "डैशबोर्ड" nav entry, and `#/staff/admin/dashboard` as a mentor shows the cohorts list;
  - nothing is written to `localStorage`;
  - the page fits 360 px and 1024 px with no sideways scroll (unit layout checks).
- [ ] **Step 2: Run** `npx vitest run apps/learner/src/staff`. Expected: FAIL.
- [ ] **Step 3: Implement.** Bars are plain CSS widths with the numbers beside them in a table for screen readers (no chart library).
- [ ] **Step 4: Run** the gate and the size check. Expected: PASS, with the first load unchanged.
- [ ] **Step 5: Commit** `feat(app): the admin progress dashboard with a card registry and CSV export`

### Task 10: The student page on sections: progress per track and the timeline

**Files:**

- Create: `staff/screens/student-sections.ts`, `staff/screens/student-detail.ts` (a memoised `loadStudent(id)`), `staff/screens/sections/ProgressSection.svelte`, `sections/TimelineSection.svelte`, `sections/ActionsSection.svelte`, `sections/WeakSection.svelte`, `sections/RecordingsSection.svelte`, `sections/ActivitySection.svelte`
- Modify: `staff/screens/Student.svelte` (header plus the section loop only), `staff/staff-api.ts` (`timeline`), `staff/i18n.ts`, `staff/words.ts`
- Test: `apps/learner/src/staff/mentor-screens.test.ts` (unchanged assertions must still pass), `apps/learner/src/staff/student-sections.test.ts`

**Interfaces:**

- Consumes: `GET /v1/staff/student`, `GET /v1/staff/student/timeline` (Task 3), the new `Summary` fields (Task 1).
- Produces:
  - `StudentSection = { id: string; title: StaffKey | AdminKey; component: Component<{ studentId: string; lang: Lang }> }`;
  - `STUDENT_SECTIONS: StudentSection[]` in order `progress`, `actions`, `timeline`, `activity`, `weak`, `recordings`;
  - `Student.svelte` takes `sections = STUDENT_SECTIONS`.

- [ ] **Step 1: Write the failing tests:**
  - the existing `mentor-screens.test.ts` and `mentor-actions.test.ts` pass unchanged;
  - progress shows per track (from the installed manifest) "अंग्रेज़ी: 3 / 12 पाठ" and the placement score;
  - the timeline lists "पाठ पूरा: नमस्ते कहना — 4/5" newest first, and "और दिखाएँ" loads the next page using the last id;
  - a fake section added to `sections` renders with the `studentId`;
  - `GET /v1/staff/student` is fetched once per page view, however many built-in sections read it.
- [ ] **Step 2: Run** `npx vitest run apps/learner/src/staff`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the gate and the size check. Expected: PASS.
- [ ] **Step 5: Commit** `refactor(app): build the student page from sections, adding per-track progress and a timeline`

### Task 11: Student list filters, rename, and the Plan 4a screen leftovers

**Files:**

- Modify: `staff/screens/admin/Students.svelte`, `admin/StudentActions.svelte` (rename; NFC compare), `staff/screens/Attendance.svelte`, `staff/StaffApp.svelte`, `staff/staff-api.ts` (`students` becomes a POST body), `staff/i18n.ts`, `staff/admin-i18n.ts`
- Test: `apps/learner/src/staff/admin-screens.test.ts`, `mentor-actions.test.ts`, `staff.test.ts`

**Interfaces:**

- Consumes: `POST /v1/staff/admin/students` (Task 4), `POST /v1/staff/admin/student { learnerId, name }` (4a), `POST /v1/staff/admin/export` (Task 5).

- [ ] **Step 1: Write the failing tests:**
  - the filters for lab, mentor, level (track, then a lesson from the manifest), language, active or inactive, and needs attention each send the matching body. The fake backend's request log has no name in any URL;
  - the export button on the list exports the current filter;
  - rename saves, refreshes the row and keeps the form on error;
  - **(d)** delete is enabled when the typed name equals the stored one after NFC (`'क़'` typed as `'क' + U+093C`);
  - **(e)** the attendance screen lists no paused student, and its date picker has `min` = today − 30;
  - **(f)** claim answering `FORBIDDEN` shows "यह Google खाता एक छात्र प्रोफ़ाइल से जुड़ा है — स्टाफ़ के लिए NGO का दूसरा Google खाता इस्तेमाल करें" (not the generic "not staff") and signs out of staff only.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the gate. Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): student filters, rename, and the Plan 4a screen leftovers`

### Task 12: The branding screen: logo, icon preview, live preview and reset

**Files:**

- Create: `staff/logo/check-logo.ts`, `staff/logo/render-icons.ts`, `staff/screens/admin/LogoPicker.svelte`, `staff/screens/admin/BrandPreview.svelte`
- Modify: `staff/screens/admin/Branding.svelte`, `staff/staff-api.ts` (`logoStart`, `logoComplete`, `resetBranding`), `staff/admin-i18n.ts`
- Test: `apps/learner/src/staff/logo.test.ts`, `admin-screens.test.ts`

**Interfaces:**

- Consumes: Task 7's routes and `isReadablePrimary` (Task 6).
- Produces:
  - `checkLogo(file: { name: string; type: string; bytes: Uint8Array }): 'ok' | 'too_big' | 'bad_type' | 'unsafe_svg'`;
  - `unsafeSvg(text: string): boolean`. It parses with `DOMParser('image/svg+xml')` and returns true for:
    - a parse error or a `<!DOCTYPE`/`<!ENTITY`;
    - any element outside `svg g path rect circle ellipse line polyline polygon defs linearGradient radialGradient stop clipPath title desc`;
    - any `on*` attribute;
    - any `href`/`xlink:href` not starting with `#`;
    - any `url(` not starting with `url(#` in a `style` or attribute.
  - `renderIcons(source: Blob): Promise<Record<IconName, Blob>>`: canvas, contain-fit on transparent; `maskable-512` at 80% on `#ffffff`.
  - `BrandPreview` (`{ draft: { name; primary; accent }; logo: string | null; lang }`) shows a home mock (app bar, today's lesson card, primary button, soft chip) and a sign-in mock. It sets CSS variables on its own element only.

- [ ] **Step 1: Write the failing tests:**
  - `checkLogo` gives:
    - `too_big` at 512 001 bytes;
    - `bad_type` for a GIF and for a `.png` whose bytes are not a PNG;
    - `unsafe_svg` for `<svg><script/></svg>`, `<svg onload="x">`, `<svg><foreignObject/></svg>`, `<svg><image href="http://x"/></svg>`, an `<!ENTITY>` and `<svg><rect style="fill:url(http://x)"/></svg>`;
    - `ok` for a plain `<svg><rect/></svg>` and a real PNG;
  - typing a new primary changes the preview's `--color-primary` and not `document.documentElement`'s;
  - `#005fff` as primary blocks saving with the contrast message;
  - the home-screen icon preview appears before saving (`renderIcons` stubbed in jsdom; the real canvas runs in e2e);
  - save calls start, PUTs four PNGs to the signed URLs, then calls complete;
  - "डिफ़ॉल्ट पर लौटाएँ" asks first, then calls reset, and is shown even when the current colours fail the new rule;
  - the screen says "फ़ोन पर ऐप का नाम और आइकन बदलने में कुछ दिन लग सकते हैं".
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** The SVG is drawn only through `<img src=blob:>` (no scripts run in an image) and never uploaded.
- [ ] **Step 4: Run** the gate and the size check. Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): logo upload with icon preview, live branding preview and reset`

### Task 13: End-to-end, runbook, decision record and worklog

**Files:** `apps/learner/e2e/admin-dashboard.spec.ts`, `apps/learner/e2e/fixtures/logo.svg`, `apps/learner/e2e/fixtures/logo-script.svg`, `apps/learner/playwright.config.ts` (both regexes become `/(backend|staff|admin-dashboard)\.spec\.ts/`), `apps/learner/e2e/backend-setup.ts`, `docs/runbooks/supabase-setup.md`, `docs/decisions/backend-2026-10-23-dashboard-and-logo.md`, `docs/decisions/README.md`, `WORKLOG.md`

- [ ] **Step 1: Write the e2e** (`chromium-backend`):
  1. The owner adds an admin (`ownerAddsStaff`). The admin creates a lab and a cohort and issues a backup code. A student phone joins and completes one lesson online.
  2. The admin opens the dashboard: today shows 1 active student and 1 lesson completed. The student export downloads a file that starts with the BOM and holds the student's name.
  3. The admin opens the student: the timeline shows the lesson with its score, and progress shows "अंग्रेज़ी: 1 /".
  4. On branding, `logo-script.svg` is refused with the plain message. `logo.svg` shows the icon preview and saves. CDP `Page.getAppManifest` on a fresh page has no errors, and its icons point at `icon?id=`. The nav bar shows the logo.
  5. Reset to default: the manifest lists the static icons again, and the colours are back.
  6. The audit page shows `export_made`, `branding_changed` and `branding_reset`.

  Layout checks at 360 px and 1024 px on the dashboard and student pages.

- [ ] **Step 2: Run** `npm run functions:build`, restart `functions:serve`, then `npm run test:e2e:backend`. Expected: PASS.
- [ ] **Step 3: Update the runbook** with a new section "11. Dashboard, exports and the logo":
  - set `APP_ORIGIN` (`supabase secrets set APP_ORIGIN=https://<app>`), an owner step;
  - run `npm run admin -- backfill-activity` once after deploying;
  - what a student CSV holds, and that it is deleted after use;
  - logo rules, and the few-day icon delay on Android;
  - recovery when a staff member signed in as a learner first: invite another NGO Google account. If that email was only a test learner, delete it with `npm run admin -- delete --learner <id>` and the invite can then be claimed.
- [ ] **Step 4: Write the decision record:**
  - `learner_daily_activity` and why there is no per-request log read;
  - weak topics from daily `wrong_by_lesson`;
  - the 366-day cap;
  - CSV rules;
  - browser-rendered icons with a server check, versus `resvg-wasm` in the function;
  - no stored SVG;
  - the API-hosted manifest and `id`;
  - the card and section registries.

  Add its README row, update `WORKLOG.md`, and commit `docs: runbook, decisions and e2e for Plan 4b`.

## Definition of done

From the repo root, all PASS with the output read:

- `npx prettier --write apps packages tooling supabase`, `npx vitest run`, `npm run typecheck`, `npm run lint`, `npm run format:check`;
- `npm run test:cov` (≥ 70%), `npm run test:db`;
- `npm run test:e2e`, `npm run functions:build` and restart `functions:serve`, `npm run test:e2e:backend`;
- `npm run size -w @shiksha/learner-app` (≤ 120 KB, no `/v1/staff/` in the first load);
- `bash tooling/backup/restore-check.sh`.

Then one fresh reviewer on the strongest model reads the whole branch with this plan's Review Focus. Fix every Critical and Important finding with a failing test first, and open the PR from the template with the rulings and deferred minors. The owner merges.

---

## What this plan satisfies

| Spec / rule                                                                         | Task(s)     |
| ----------------------------------------------------------------------------------- | ----------- |
| §8.1 dashboard by cohort, lab, date range; active per day/week; ≥ 4 days/week (§13) | 1, 2, 9     |
| §8.1 lessons, test-outs, EF1 completion (§13), placement start vs retake            | 1, 2, 9     |
| §8.1 streaks, inactive ≥ 3 days, stuck; weak topics from wrong answers              | 1, 2, 9     |
| §8.1 doubts/AI cost, meetings (registry only; cards in 5a, 6a)                      | 9           |
| §8.1 per-student timeline in date order (doubts, meetings via sections in 5a, 6a)   | 3, 10       |
| §14 progress per track in admin and mentor views                                    | 1, 9, 10    |
| §8.1 CSV export of any list or dashboard                                            | 5, 9, 11    |
| §8.1 student filters: cohort, lab, mentor, level, language, active, needs attention | 4, 11       |
| §8.1 branding: logo SVG/PNG ≤ 500 KB, icons 192/512/maskable + favicon, preview     | 7, 8, 12    |
| §8.1 branding: live preview of home and login, reset to default, audited            | 7, 12       |
| database rule: dashboards never read the raw log per request                        | 1, 2, 3     |
| privacy rule: export, cascade, retention, RLS for the new table                     | 1           |
| Plan 4a deferred minors (a)–(f), studentDetail last-N, POST search, rename screen   | 3, 4, 6, 11 |

## Traceability (screens ↔ routes ↔ e2e)

| Screen / e2e step                | Route and response field                                                        |
| -------------------------------- | ------------------------------------------------------------------------------- |
| Dashboard cards (e2e 2)          | `POST /v1/staff/admin/dashboard` → `days`, `weeks`, `activeFourPlusShare`, …    |
| Export button (e2e 2)            | `POST /v1/staff/admin/export` → `csv`, `filename`                               |
| Student list filters, rename     | `POST /v1/staff/admin/students` → `students`, `next`; `POST …/admin/student`    |
| Student progress section (e2e 3) | `GET /v1/staff/student` → `summary.completedLessons`, `summary.placementScores` |
| Student timeline section (e2e 3) | `GET /v1/staff/student/timeline` → `entries`, `next`                            |
| Branding logo, preview (e2e 4)   | `POST …/admin/logo/start` → `uploads`; `…/logo/complete` → `version`            |
| Reset (e2e 5)                    | `POST …/admin/branding/reset` → `version`                                       |
| Nav bar logo, favicon (e2e 4)    | `GET /v1/branding` → `logo.id`; `GET /v1/branding/icon` (bytes)                 |
| Installed icon (e2e 4, 5)        | `GET /v1/branding/manifest` → `icons`, `id`, `start_url`                        |
| Audit page (e2e 6)               | `GET /v1/staff/audit` → `entries[].action`                                      |

## ⚑ Values to confirm

1. **CSV names:** student-list CSVs include names, with a banner and an audit entry. Dashboard CSVs never include names. _Recommended: as stated._
2. **Logo format policy:** the admin uploads an SVG (strict allow-list) or a PNG, ≤ 500 KB. Only PNG renditions are stored, and no SVG is ever served. _Recommended: as stated._
3. **Dashboard max date range:** 366 days. _Recommended: 366._
4. **Icon generation:** rendered in the admin's browser (canvas), checked by the server (PNG magic bytes, exact size, ≤ 500 KB). _Recommended: browser rendering, with no new dependency._
5. Smaller calls with defaults:
   - maskable background white at 80% scale;
   - favicon 48 px;
   - exports capped at 10 000 rows and 30 per hour;
   - EF1 "finished" = all lessons or the module tested out;
   - population excludes deactivated students.

## Notes for the owner

- **Icons: what "the server generates" means here.** The spec says the server generates the icons. Rasterising in the Edge Function would need `resvg-wasm` (about 2 MB of Wasm, and an SVG-only path that needs bundled fonts for any text) and a PNG resizer: a new dependency in the function and a larger attack surface parsing untrusted SVG on the server. This plan has the admin's browser render the four PNGs, and the server verifies every byte that it stores and serves. If you want true server-side generation, it is a follow-up behind the same routes.
- **Series map vs the shared interfaces:** the map now describes a card and a section as `{ id, title, component }`, the component loading its own data, as this plan builds them.
- `learner_daily_activity` gains two columns beyond the shared shape (`test_outs`, `wrong_by_lesson`). They are additive, and 5a and 5b read only the shared ones.
- **Removed GET route:** `GET /v1/staff/admin/students` is removed. A staff tab left open on an old build gets a plain "failed" until it reloads, which the auto-updating service worker does on the next visit.
- **`last_synced` reads the event log:** `OrgRepo.search`/`students` still compute it with a `max(received_at)` subquery per learner. That is an index read of the event log, kept for the lists, not used by the dashboard. Moving it into the summary is a candidate minor for a later plan.
