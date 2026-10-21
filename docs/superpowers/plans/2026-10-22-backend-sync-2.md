# Backend and Sync, Part 2 Implementation Plan (Plan 3b)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Also follow `AGENTS.md`. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the pilot backend. This plan adds:

- speaking recordings uploaded on Wi-Fi or in the lab, then deleted on schedule;
- export and deletion of a student's data, with the deletion reaching their phone;
- mentor-issued backup login codes;
- a branding file the app applies;
- NGO-owned encrypted backups;
- rate limits;
- the hardening left over from the Plan 3a review;
- the minors carried over from Plan 2c.

**Architecture:** Same shape as Plan 3a:

- The `/v1` handlers stay thin and call services in `packages/server`. Services talk to the outside world only through ports, with Postgres and Supabase adapters behind them.
- Recordings go from the phone straight to a private Supabase Storage bucket through short-lived signed upload URLs. The function only signs URLs and records metadata, behind a `RecordingStorage` port that S3 or R2 could implement later.
- A backup-code student is a Supabase Auth user with a made-up email. The server signs them in with a password derived from the code, so the rest of `/v1` and the app's session handling stay unchanged.
- There are no mentor or admin screens yet. Until Plan 4, the owner runs `npm run admin -- <command>`, a `tsx` command-line tool over the same services, to issue codes, export, delete, run retention and set branding.

**Tech Stack:**

- Unchanged from Plan 3a: Supabase (Postgres, Auth, Storage, Edge Functions), `postgres`, `@supabase/supabase-js` (adapters only), Zod 4, Vitest, Playwright.
- New: `tsx`, already a root dev dependency, runs the admin tool.
- New: GitHub Actions, the Postgres client tools, `age` and the AWS CLI for the nightly backup. These are installed in the workflow, not added to `package.json`.

**Spec:** `docs/superpowers/specs/2026-10-15-learning-platform-design.md`: §5.3 (backup code), §5.4 (Storage, login-code Edge Function), §5.5 rules 5 and 7 (storage interface, NGO-owned backups), §6.5, §7.1–7.4, §8.1 (delete on request, reset the backup code, branding, server refusing switched-off features), §11, §12. Rules: `.claude/rules/security.md` (rate limits, upload limits, signed URLs), `privacy.md` (retention, export, delete).

**Requires:**

- Plan 3a merged (PR #13).
- Branch `feature/backend-sync-2` from `main`.
- Docker running. Run `npm ci` in the worktree.

### Plan series

- **Plan 3b** (this plan).
- **Plan 4:** mentor view and admin panel. Its screens call the services this plan writes: issue and reset codes, export, delete, edit switches and branding, review recordings, which sets `reviewed_at`. Plan 4 also covers logo upload, icon generation, the installed app's name and icon, and the audit log.
- **Plan 5:** AI. **Plan 6:** mentor connect and community, where bookings need Google, so a code student adds Google sign-in there.

**Not in this plan:**

- any mentor or admin screen;
- logo upload, server-generated icons and a dynamic PWA manifest (Plan 4, with the logo editor). The installed app's name and icon stay the built ones;
- the audit log (Plan 4). This plan's admin tool prints what it did, but stores no log;
- adding Google sign-in to a code student (Plan 6);
- doubt and booking rate limits (Plans 5 and 6 reuse the limiter from this plan).

## Global Constraints

Everything marked _(builder's call)_ is open in the spec. ⚑ marks values the owner confirms when reviewing this plan.

- All Plan 3a global constraints still apply: portability, layers, identity from the token, sync, error format, the privacy rule, the database rule, the size budget (≤ 120 KB first-load JS) and the code limits. New error codes:
  - `RATE_LIMITED` (429);
  - `FEATURE_OFF` (403), when a switched-off feature's request is refused;
  - `BAD_CODE` (401), a wrong or reset backup code.

  The app treats `RATE_LIMITED` like `OFFLINE`: the work stays on the phone, saved for later.

- **Recordings:**
  - At most **1_048_576** bytes. Types `audio/webm`, `audio/ogg` and `audio/mp4` only. At most **31_000** ms.
  - Private bucket `recordings`; objects at `<learnerId>/<recordingId>`.
  - Signed upload URLs come from Supabase Storage. Download URLs, for Plan 4, last **300** s.
- **When the phone uploads recordings** _(builder's call)_ ⚑:
  - automatically only when `navigator.connection.type` is `wifi` or `ethernet`;
  - otherwise only when the learner taps "रिकॉर्डिंग अपलोड करें" on the me screen (the lab case);
  - never over mobile data without that tap.

  A recording's bytes are deleted from the phone after the server confirms the upload. Its metadata stays.

- **Retention:**
  - A recording is deleted **30 days after mentor review** (privacy rule).
  - An unreviewed recording is deleted **90 days after upload** _(builder's call)_ ⚑.
  - Old rate-limit windows are deleted after **1 day**.
  - Retention runs nightly, after the backup.
- **Backup codes:**
  - 8 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, shown as `ABCD-EFGH`. Input ignores case, spaces and dashes.
  - The server stores only `lookup = HMAC-SHA256(CODE_PEPPER, "lookup:" + normalised)`. The auth password is `base64url(HMAC-SHA256(CODE_PEPPER, "password:" + normalised))`.
  - The auth email is `code-<uuid>@codes.invalid`.
  - Resetting a code deletes that auth user and makes a new one, so old sessions stop working at once.
  - `CODE_PEPPER` is a secret of at least 32 bytes, kept only in function secrets and the owner's shell.
- **Email sign-up is off.** `[auth.email] enable_signup = false` in `config.toml`, and the same setting in production. Only the server, through the admin API, creates email-and-password users.
- **Rate limits** _(builder's call)_ ⚑. A bucket key never holds an IP or an email. The IP part is the first `x-forwarded-for` entry, as `HMAC(CODE_PEPPER, "ip:" + ip)` cut to 16 hex characters.

  | Bucket                    | Limit | Window |
  | ------------------------- | ----- | ------ |
  | `code:ip:<hash>`          | 10    | 15 min |
  | `code:all`                | 300   | 1 h    |
  | `push:<learnerId>`        | 60    | 1 min  |
  | `pull:<learnerId>`        | 60    | 1 min  |
  | `link:<authUserId>`       | 10    | 1 h    |
  | `recording:<learnerId>`   | 100   | 1 day  |
  | `deleted-check:ip:<hash>` | 30    | 1 h    |

- **Branding:**
  - name in `hi` and `en` (1–40 characters each);
  - `primary` and `accent` as `#rrggbb`, each needing contrast ≥ **4.5** with `#ffffff` (WCAG AA, white text on that colour);
  - an integer `version` that increases on every change.

  Defaults: `{ hi: 'शिक्षा पथ', en: 'Shiksha Path' }`, primary `#2f3ab2`, accent `#b45309`. `GET /v1/branding` is public: branding is needed before sign-in and is not personal data.

- **Deletion and export:**
  - Delete removes, in one run:
    - the learner row, with cascades to identities, events, overrides and recording rows;
    - the recording objects;
    - every Supabase Auth user mapped to the learner, which removes the Google email, name and avatar (Plan 3a review M8).
  - A tombstone `deleted_learners(id, deleted_at)` keeps only the uuid, so phones can wipe their copy.
  - Backups age out after **30 days** (R2 lifecycle), so deleted data leaves them within 30 days. The runbook and the NGO consent wording say so.
  - Export writes `learner.json`, holding the learner, cohort, identities with email, events, overrides and recording metadata, plus `recordings/<id>.<ext>`, into a folder the owner chooses.
- **Backups** _(builder's call)_ ⚑, NGO-owned (spec §5.5 rule 7):
  - a nightly GitHub Actions job runs `pg_dump --format=custom` and copies the `recordings` bucket;
  - both are encrypted with `age` to the NGO's public key and uploaded to an NGO-owned Cloudflare R2 bucket;
  - secrets live only in GitHub Actions secrets;
  - the job fails loudly, never silently.
- **Logging** (Plan 3a review M9): one JSON line per request through a `Logger` port: `{ level, route, status, code?, learnerId?, ms }`. It never holds names, emails, codes, tokens, IPs or bodies. `console` is allowed only in `supabase/functions/api/index.ts` and in `tooling/`.

## Review Focus

1. **A code that guesses or outlives its reset.** Wrong codes are refused with `BAD_CODE`, and the 11th try in 15 minutes from one IP gets `RATE_LIMITED`. A reset code signs nobody in, and a session made with the old code is refused right away, not just when its token expires. Tasks 6, 7.
2. **One learner's recordings reaching another.** A learner cannot get an upload URL for another learner's path, complete another's recording, or exceed the size and type limits by changing the bytes after signing. The bucket refuses objects over 1 MB or of another type even when the metadata lied. Tasks 4, 5.
3. **Deletion that leaves something behind.** After `admin delete`, the server has no rows for the learner in any table, no objects under their prefix and no Auth user. Their phone wipes their profile, events, recordings and session on its next sync, while another profile on the same phone is untouched. Tasks 8, 9.
4. **Recordings never blocking learning or spending mobile data.** With no Wi-Fi, a server error, a rate limit or the speaking switch off, a lesson still finishes, recordings stay on the phone, and nothing uploads over mobile data without the learner's tap. Task 5.
5. **A backup that silently fails or can be read.** The backup job exits non-zero on any failed step. What reaches R2 is only `age`-encrypted. No secret appears in the job's logs, and restoring a dump into a fresh local stack works. Task 11.

---

### Task 1: Server hardening from the Plan 3a review

**Files:**

- Create: `packages/server/src/logger.ts` (`Logger` port, `memoryLogger()` for tests, `jsonLogger(write: (line: string) => void)`)
- Modify: `packages/server/src/http/request.ts` (stream-capped body), `packages/server/src/http/router.ts` (log each request), `packages/server/src/adapters/pg-learner-repo.ts` and `packages/server/src/services/link.ts` (concurrent link), `supabase/functions/api/index.ts` (`jsonLogger(console.log)`)
- Test: `packages/server/test/http.test.ts`, `packages/server/test/services.test.ts`, `packages/server/test/pg-repos.db.test.ts`

**Interfaces:**

- Produces:
  - `interface Logger { info(entry: LogEntry): void; error(entry: LogEntry): void }`, with `LogEntry = { route: string; status: number; code?: string; learnerId?: string; ms: number }`;
  - `HandlerDeps` gains `logger: Logger`;
  - `LearnerRepo.createLinked` throws `LinkConflict` (exported from `ports.ts`) on a unique violation.

- [ ] **Step 1: Write the failing tests:**
  - A chunked body (a `ReadableStream`, no `content-length`) of 262_145 bytes gives 413, and the reader stops after at most 262_145 + 65_536 bytes. Count the stream's pulls.
  - Every request logs exactly one entry with route, status and ms. A 500 logs `level: error` with code `INTERNAL`.
  - No logged entry ever contains the request body, the token, or the strings `name` and `email`. Assert this against a push with a name in the body.
  - Two `linkLearner` calls at once, for the same auth user and the same profile id, give one `created: true` and one `created: false`, never INTERNAL. Use the Pg fixture with two connections.
- [ ] **Step 2: Run** `npx vitest run packages/server` and `npm run test:db`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Read the body with `request.body.getReader()`, adding up chunk sizes and cancelling past `MAX_BODY_BYTES`. Keep the content-length fast path.
  - `createLinked` maps Postgres code `23505` to `LinkConflict`. `linkLearner` catches it once and re-runs the "existing identity" read: `created: false`, or `PROFILE_TAKEN` when the profile id belongs to another learner.
- [ ] **Step 4: Run** all checks, then `npm run test:db` and `npm run test:e2e:backend`. Expected: PASS.
- [ ] **Step 5: Commit** `fix(server): log requests, cap streamed bodies and survive concurrent links`

### Task 2: Pull visibility, database grants and the email sign-up switch

**Files:**

- Create: `supabase/migrations/20261022000001_hardening.sql`, `supabase/rollbacks/20261022000001_hardening.down.sql`
- Modify: `packages/server/src/adapters/pg-event-repo.ts` (`page`), `supabase/config.toml` (`[auth.email] enable_signup = false`; `[api] schemas = ["public"]`), `docs/runbooks/supabase-setup.md` (step 3 becomes "Email: turn off sign-ups, keep the provider on"), `docs/decisions/backend-2026-10-20-api-shape.md` (note on pull visibility)
- Test: `packages/server/test/pg-repos.db.test.ts`, `supabase/tests/rls.test.ts`, `supabase/tests/api.test.ts`

**Interfaces:**

- Produces: `learner_events.tx_id xid8 not null default pg_current_xact_id()`, indexed with `(learner_id, seq)`. `page()` returns only rows with `tx_id < pg_snapshot_xmin(pg_current_snapshot())`.

- [ ] **Step 1: Write the failing tests:**
  - Transaction T1 inserts event e1 and stays open. T2 inserts e2 (higher `seq`) and commits. A pull returns neither, so the cursor cannot pass e1. Commit T1: the next pull returns both, in `seq` order.
  - Role `anon` holds no privilege on any table in `public`. Role `authenticated` holds only `select` (check `information_schema.role_table_grants`).
  - `select count(*) from pg_extension where extname = 'pg_graphql'` is 0.
  - An anon `supabase.auth.signUp({ email, password })` against the local stack returns an error, and the admin API can still create an email user who then signs in with the password.
- [ ] **Step 2: Run** `npm run db:reset && npm run test:db`. Expected: FAIL.
- [ ] **Step 3: Implement** the migration: the column and index, `revoke all ... from anon`, `revoke insert, update, delete, truncate ... from authenticated`, the same through `alter default privileges`, and `drop extension if exists pg_graphql`. Write the rollback, the repo filter, and the config and runbook changes.
- [ ] **Step 4: Run** `npm run db:reset`, `npm run test:db`, `npm run test:e2e:backend` and all checks. Expected: PASS.
- [ ] **Step 5: Commit** `fix(db): never skip events in a pull and remove default grants`

### Task 3: Rate limits

**Files:**

- Create: `supabase/migrations/20261022000002_rate_limits.sql` (+ rollback), `packages/server/src/adapters/pg-rate-limiter.ts`, `packages/server/src/services/limits.ts` (the table of limits above, as constants)
- Modify: `packages/server/src/ports.ts`, `packages/server/src/testing/memory-repos.ts`, `packages/server/src/testing/service-contract.ts`, `packages/server/src/http/router.ts` (push, pull, link), `packages/api-contract/src/errors.ts` (`RATE_LIMITED` 429, `FEATURE_OFF` 403, `BAD_CODE` 401), `apps/learner/src/api/api-client.ts` (429 → `RATE_LIMITED`), `apps/learner/src/runtime/http-transport.ts`
- Test: the shared service contract, `packages/server/test/http.test.ts`, `apps/learner/src/runtime/http-transport.test.ts`

**Interfaces:**

- Produces:
  - `interface RateLimiter { hit(bucket: string, limit: number, windowSeconds: number): Promise<boolean> }`, where `false` means refused;
  - `LIMITS: Record<'code' | 'codeAll' | 'push' | 'pull' | 'link' | 'recording' | 'deletedCheck', { limit: number; windowSeconds: number }>`;
  - `clientKey(request: Request, pepper: string): string`, the hashed IP;
  - table `rate_limits(bucket text, window_start timestamptz, hits int, primary key (bucket, window_start))`, with RLS on and no policies;
  - `PgRateLimiter.prune(olderThanSeconds: number): Promise<number>`, used in Task 10.

- [ ] **Step 1: Write the failing tests** (shared contract, memory and Pg):
  - the 60th push in a minute passes and the 61st gives 429 `RATE_LIMITED`;
  - another learner is unaffected;
  - a new window resets the count (inject a clock);
  - two `hit`s at once never both pass the last slot (Pg).
  - In the app: a 429 on flush leaves events pending and shows "saved on phone".
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** `hit` runs `insert ... on conflict (bucket, window_start) do update set hits = rate_limits.hits + 1 returning hits`, with `window_start` truncated to the window. Handlers call the limiter after `caller()`.
- [ ] **Step 4: Run** all checks, `npm run test:db` and `npm run test:e2e:backend`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(server): rate-limit sync and linking`

### Task 4: Recordings on the server

**Files:**

- Create:
  - `supabase/migrations/20261022000003_recordings.sql` (+ rollback);
  - `packages/api-contract/src/recordings.ts`;
  - `packages/server/src/services/recordings.ts`;
  - `packages/server/src/adapters/pg-recording-repo.ts`;
  - `packages/server/src/adapters/supabase-recording-storage.ts`.
- Modify: `packages/server/src/ports.ts`, the memory repos and service contract, `router.ts`, `supabase/functions/api/index.ts`
- The migration also creates the bucket, so `db push` gives production the same limits as local: `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('recordings', 'recordings', false, 1048576, array['audio/webm','audio/ogg','audio/mp4']) on conflict (id) do nothing`. This is the plan's one Supabase-specific statement; note it in the decision record (Task 14).
- Test: the service contract, `packages/server/test/http.test.ts`, `supabase/tests/api.test.ts`, `supabase/tests/rls.test.ts`

**Interfaces:**

- Produces:
  - **Table** `recordings(id uuid pk, learner_id uuid → learners on delete cascade, lesson_id text, item_id text, mime text, bytes int, duration_ms int, recorded_at timestamptz, status text check in ('pending','uploaded'), uploaded_at timestamptz null, reviewed_at timestamptz null, created_at, updated_at)`. RLS: a learner may select only their own rows. Indexes on `learner_id` and `(status, uploaded_at)`.
  - **Port** `RecordingStorage { signUpload(path: string): Promise<{ url: string; token: string }>; size(path: string): Promise<number | null>; signDownload(path: string, seconds: number): Promise<string>; remove(paths: string[]): Promise<void> }`.
  - **Port** `RecordingRepo { create(row): Promise<'created' | 'exists' | 'ownedByOther'>; get(id): Promise<RecordingRow | null>; markUploaded(id: string, at: Date): Promise<void>; listByLearner(learnerId): Promise<RecordingRow[]>; due(now: Date): Promise<RecordingRow[]>; delete(ids: string[]): Promise<void> }`.
  - **Contract:**
    - `recordingStart` = `{ id, lessonId, itemId, mime, bytes, durationMs, at }`, to `POST /v1/recordings/start`, answered with `{ uploadUrl: string | null; token: string | null }` (null when already uploaded);
    - `recordingComplete` = `{ id }`, to `POST /v1/recordings/complete`, answered with `{ status: 'uploaded' }`.

- [ ] **Step 1: Write the failing tests:**
  - start, then upload to the signed URL, then complete gives `uploaded`, with the object at `<learnerId>/<id>`;
  - repeating start for an uploaded id returns nulls, and repeating it for a pending id gives a fresh URL;
  - a start for an id owned by another learner gives `FORBIDDEN`;
  - a complete before any object exists gives `INVALID_REQUEST`;
  - a complete for another learner's id gives `FORBIDDEN`;
  - `bytes` 1_048_577, mime `audio/wav` or `durationMs` 31_001 gives `INVALID_REQUEST`;
  - uploading 1_048_577 bytes or `text/html` to a valid signed URL is refused by the bucket (api test);
  - with `speaking_practice` off for that learner, start gives `FEATURE_OFF`;
  - the 101st start in a day gives `RATE_LIMITED`;
  - learner B cannot select A's `recordings` rows, or list or read A's objects, with B's token through PostgREST or Storage.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - The services check the caller's linked learner, the switch (through `SwitchRepo` with the Plan 3a precedence) and the limit.
  - `complete` checks that `storage.size(path)` is present and ≤ 1_048_576.
  - The Supabase adapter uses `storage.from('recordings').createSignedUploadUrl`, `.list` / `.info`, `.createSignedUrl` and `.remove`, with the service role inside the function only.
- [ ] **Step 4: Run** `npm run db:reset`, `npm run functions:build`, restart `functions:serve`, then `npm run test:db` and all checks. Expected: PASS.
- [ ] **Step 5: Commit** `feat(server): accept speaking recordings through signed uploads`

### Task 5: Uploading recordings from the phone

**Files:**

- Create: `apps/learner/src/runtime/recording-upload.ts`, `apps/learner/src/runtime/network.ts`, `apps/learner/src/screens/me/RecordingsCard.svelte`
- Modify:
  - `apps/learner/src/storage/recording-store.ts` and `idb-recording-store.ts`: add `pendingUpload(learnerId): Promise<Recording[]>` and `markUploaded(id): Promise<void>`. The second drops the bytes and keeps the metadata with `uploadedAt`. This is a Dexie v4 schema change, and the rows keep their fields;
  - `api-client.ts`: `startRecording`, `completeRecording`, and `uploadTo(url, token, bytes, mime)`;
  - `runtime/runtime.ts`: `sync()` uploads when `onUnmeteredNetwork()`;
  - `screens/me/MeScreen.svelte` and the i18n catalogue.
- Test: `apps/learner/src/runtime/recording-upload.test.ts`, `screens/me/me.test.ts`, `storage/recording-store.test.ts`

**Interfaces:**

- Consumes: the Task 4 contract.
- Produces:
  - `uploadRecordings(runtime: Runtime, learnerId: string): Promise<{ uploaded: number; left: number }>`. It never throws, and stops at the first failure;
  - `onUnmeteredNetwork(nav?: Navigator): boolean`. It is true only for `connection.type` of `wifi` or `ethernet`, and false when the API is missing;
  - `Runtime.sync` returns `{ flush, added, recordings: { uploaded, left } }`.

- [ ] **Step 1: Write the failing tests** (fake backend plus a fake storage URL):
  - on Wi-Fi, sync uploads two pending recordings, frees their bytes, and `summary()` then counts 0 bytes waiting;
  - on `cellular`, with no connection API, or when unlinked, sync uploads nothing;
  - the me screen button "रिकॉर्डिंग अपलोड करें" uploads over `cellular`;
  - when the upload PUT fails, the recording keeps its bytes and is retried on the next sync, and the lesson flow is never awaited on it;
  - `FEATURE_OFF` and `RATE_LIMITED` leave everything on the phone with "फ़ोन में सेव · इंटरनेट मिलते ही अपलोड";
  - a profile's recordings are never uploaded as another profile.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Add the i18n strings `me.recordingsUpload` ("रिकॉर्डिंग अपलोड करें" / "Upload recordings"), `me.recordingsWaiting` ("{count} रिकॉर्डिंग अपलोड होनी हैं" / "{count} recordings to upload") and `me.recordingsDone` ("सब रिकॉर्डिंग अपलोड हो गईं" / "All recordings uploaded").
- [ ] **Step 4: Run** all checks and `npm run size -w @shiksha/learner-app` (≤ 120 KB). Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): upload speaking recordings on Wi-Fi or on request`

### Task 6: Backup login codes on the server

**Files:**

- Create:
  - `supabase/migrations/20261022000004_login_codes.sql` (+ rollback): `login_codes(learner_id uuid pk → learners on delete cascade, lookup text unique not null, auth_user_id uuid not null, auth_email text not null, created_at, updated_at)`. `auth_email` is the made-up `code-<uuid>@codes.invalid`, needed to sign in, with RLS on and no policies;
  - `packages/server/src/services/codes.ts`, `packages/server/src/codes/code-format.ts`, `packages/server/src/adapters/pg-code-repo.ts`;
  - `packages/api-contract/src/codes.ts`: `codeSignIn = { code: string }` in; `session = { accessToken: string; refreshToken: string; expiresAt: number }` out (`expiresAt` in Unix seconds). `type Session = z.infer<typeof session>` is the type the `Auth` port below uses.
- Modify: `ports.ts` (`Auth` gains `createCodeUser(password: string): Promise<{ authUserId: string }>`, `deleteUser(authUserId: string): Promise<void>` and `signInWithPassword(email: string, password: string): Promise<Session | null>`), `adapters/supabase-auth.ts`, the memory fixture, `router.ts` (`POST /v1/auth/code`, no bearer needed)
- Test: the service contract, `packages/server/test/codes.test.ts`, `supabase/tests/api.test.ts`

**Interfaces:**

- Produces:
  - `newCode(random: (n: number) => Uint8Array): string`, giving `ABCD-EFGH`;
  - `normaliseCode(input: string): string | null`;
  - `issueCode(deps, input: { learnerId: string } | { name: string; cohortId?: string }): Promise<{ learnerId: string; code: string }>`. The second form creates the learner;
  - `resetCode(deps, learnerId): Promise<{ code: string }>`;
  - `signInWithCode(deps, code: string, clientKey: string): Promise<Session>`.

  The code is returned once, to the owner tool, and is never stored or logged.

- [ ] **Step 1: Write the failing tests:**
  - `normaliseCode(' abcd-efgh ')` gives `ABCDEFGH`;
  - `0`, `O`, `1`, `I`, `L` or the wrong length gives null;
  - issue a code, then sign in with it: the token `verify`s to the code user, and `/v1/me` returns the learner;
  - a wrong code gives `BAD_CODE`;
  - the 11th attempt from one client key in 15 minutes gives `RATE_LIMITED`, even with the right code;
  - after `resetCode`, the old code gives `BAD_CODE`, and an access token issued before the reset is refused by `/v1/me` (`UNAUTHENTICATED`);
  - `login_codes` holds no column equal to the code or its normalised form;
  - the function's log lines never contain the code;
  - with email sign-up off (Task 2), code sign-in still works.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** `CODE_PEPPER` comes from the environment (validated by Zod as at least 32 characters) and is added to `supabase/functions/.env.local.example` as `CODE_PEPPER=local-only-pepper-change-me-0123456789`, a local placeholder. `resetCode` creates the new user first, then updates `login_codes` and `learner_identities`, then deletes the old user.
- [ ] **Step 4: Run** all checks, `npm run test:db` and `npm run test:e2e:backend`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(server): sign students in with a mentor-issued backup code`

### Task 7: Backup codes in the app

**Files:**

- Create: `apps/learner/src/screens/account/CodeEntry.svelte`
- Modify: `api/auth.ts` (`signInWithCode(profileId: string, code: string): Promise<'ok' | ApiError | 'OFFLINE'>`, which calls `/v1/auth/code` and then `client.auth.setSession`), `api/api-client.ts` (`codeSignIn`, sent without a token), `screens/account/LinkCard.svelte` and `RestoreProfile.svelte` (a "मेरे पास कोड है" / "I have a code" choice), the i18n catalogue
- Test: `apps/learner/src/account/account.test.ts`, `screens/account/account-screens.test.ts`, `apps/learner/e2e/backend.spec.ts`

**Interfaces:**

- Consumes: Task 6.
- Produces: after `signInWithCode` the profile has a session exactly like a Google one, so `linkProfile`, `completeRestore` and sync work unchanged.

- [ ] **Step 1: Write the failing tests:**
  - a fresh profile entering a valid code adopts that learner (Plan 3a rules, including the shared-phone guard);
  - restore with a code on an empty phone brings back the progress;
  - a wrong code shows "यह कोड सही नहीं है" and nothing changes;
  - `RATE_LIMITED` shows "बहुत कोशिशें हुईं, थोड़ी देर बाद फिर करें";
  - offline shows the existing `account.failed`;
  - the code never reaches `sessionStorage`, the meta table, a URL or the DOM after submit;
  - e2e: `backend-setup.ts` issues a code with `issueCode` over the Pg repos (the same call the admin tool makes), then a fresh browser context restores with that code.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** all checks, `npm run test:e2e:backend` and the size check. Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): sign in or restore with a backup code`

### Task 8: Export and delete, and the owner's admin tool

**Files:**

- Create:
  - `packages/server/src/services/learner-data.ts`;
  - `supabase/migrations/20261022000005_deleted_learners.sql` (+ rollback), creating `deleted_learners(id uuid pk, deleted_at timestamptz, created_at, updated_at)` with RLS on and no policies;
  - `tooling/admin/cli.ts`, `tooling/admin/commands.ts`.
- Modify: root `package.json` (`"admin": "tsx tooling/admin/cli.ts"`), `ports.ts` (`LearnerRepo.delete(id)` and `LearnerRepo.exportRows(id)`)
- Test: `packages/server/test/learner-data.db.test.ts`, `tooling/test/admin-cli.test.ts`

**Interfaces:**

- Produces:
  - `exportLearner(deps, learnerId): Promise<{ data: LearnerExport; recordings: { id: string; mime: string; bytes: Uint8Array }[] }>`;
  - `deleteLearner(deps, learnerId): Promise<{ events: number; recordings: number; authUsers: number }>`;
  - admin commands, each taking `--help` and `--dry-run`:
    - `issue-code --learner <id> | --name <name>`
    - `reset-code --learner <id>`
    - `export --learner <id> --out <dir>`
    - `delete --learner <id> --yes`
    - `retention` (Task 10)
    - `set-branding --file <json>` (Task 12)
  - The tool reads `SUPABASE_DB_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `CODE_PEPPER` from the environment, validated by Zod. It never prints them, and never prints a name or email, apart from the export file it writes.

- [ ] **Step 1: Write the failing tests** (local stack, with learners A and B in two cohorts):
  - the export holds exactly A's rows, events and recordings, and none of B's;
  - after `delete --yes` for A, every table in `public` has zero rows with A's id, apart from `deleted_learners`;
  - after it, `storage.objects` has no object under `A/`, and `auth.users` has neither A's Google user nor A's code user;
  - B is unchanged;
  - `delete` without `--yes` changes nothing and exits 1;
  - `--dry-run` prints the counts only;
  - a thrown storage error stops before the database delete, so nothing is half-deleted.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Order: remove the recording objects, then delete the Auth users, then delete the learner row and insert the tombstone in one transaction. Re-running after a partial failure completes the deletion.
- [ ] **Step 4: Run** all checks and `npm run test:db`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(server): export and delete a student's data on request`

### Task 9: Deletion reaching the phone, and removing a profile from this phone

**Files:**

- Create: `apps/learner/src/account/forget.ts`, `apps/learner/src/screens/me/RemoveProfile.svelte`
- Modify: `packages/api-contract` (`deletedCheck = { learnerIds: uuid[1..20] }` in, `{ deleted: uuid[] }` out), `router.ts` (`POST /v1/learners/deleted`, public, rate-limited per IP), `apps/learner/src/runtime/runtime.ts` (`sync` checks when the session is refused), `ProfilesScreen.svelte` (a one-time notice), `MeScreen.svelte`, the i18n catalogue
- Test: `apps/learner/src/account/forget.test.ts`, `screens/me/me.test.ts`, `packages/server/test/http.test.ts`, `apps/learner/e2e/backend.spec.ts`

**Interfaces:**

- Produces: `wipeProfile(runtime, profileId): Promise<void>`. It removes the profile, events, recordings, partials, `meta` keys with the `:<profileId>` suffix, and the auth session.

- [ ] **Step 1: Write the failing tests:**
  - after a server-side delete, the next sync of that profile wipes it, and the picker shows "यह प्रोफ़ाइल NGO के कहने पर हटा दी गई" once;
  - a second profile on the phone keeps everything;
  - an id that is not tombstoned is never wiped, even with `UNAUTHENTICATED`;
  - an unlinked profile is never checked;
  - the endpoint answers only for the listed ids, refuses more than 20, and is rate-limited;
  - from the me screen, "इस फ़ोन से प्रोफ़ाइल हटाएँ", the PIN and a confirm removes this profile from this phone only; the server keeps its data, so restore still works;
  - a wrong PIN removes nothing.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** all checks, `npm run test:e2e:backend` and the size check. Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): wipe deleted students from the phone and remove a profile on request`

### Task 10: Retention

**Files:**

- Create: `packages/server/src/services/retention.ts`
- Modify: `tooling/admin/commands.ts` (`retention`), `PgRateLimiter` (Task 3)
- Test: `packages/server/test/retention.db.test.ts`

**Interfaces:**

- Produces: `runRetention(deps, now: Date): Promise<{ recordings: number; rateWindows: number }>`. It deletes recordings reviewed more than 30 days ago, recordings uploaded more than 90 days ago that were never reviewed, and pending rows older than 7 days (an abandoned upload). It removes their objects first, and prunes rate-limit windows older than 1 day.

- [ ] **Step 1: Write the failing tests:** set `now`, then check:
  - reviewed 31 days ago: removed, row and object;
  - reviewed 29 days ago: kept;
  - unreviewed and uploaded 91 days ago: removed;
  - unreviewed and uploaded 89 days ago: kept;
  - pending for 8 days: row removed;
  - another learner's rows are judged on their own dates;
  - a run twice in a row removes nothing more.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** all checks and `npm run test:db`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(server): delete recordings on schedule`

### Task 11: NGO-owned backups

**Files:**

- Create: `.github/workflows/backup.yml`, `tooling/backup/backup.sh`, `tooling/backup/restore-check.sh`
- Modify: `.github/workflows/ci.yml` (a `backup-script` job that runs `restore-check.sh` against the local stack), `docs/runbooks/supabase-setup.md` (new section "Backups")
- Test: `restore-check.sh` in CI

**Interfaces:**

- Produces:
  - `backup.sh` with `--help` and `--dry-run`, run under `set -euo pipefail`. It does:
    - `pg_dump --format=custom "$BACKUP_DB_URL" | age -r "$BACKUP_AGE_RECIPIENT" > db-<date>.dump.age`;
    - an `aws s3 sync` of the `recordings` bucket through Supabase's S3-compatible endpoint into a temporary directory;
    - a `tar` of that directory piped through `age` into `recordings-<date>.tar.age`;
    - `aws s3 cp` of both files to `s3://$BACKUP_R2_BUCKET/` with the R2 endpoint.
  - The schedule is `cron: '30 20 * * *'` (02:00 IST), plus `workflow_dispatch`. After the backup the job runs `npm run admin -- retention`.
  - Secrets (GitHub Actions only): `BACKUP_DB_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_S3_ACCESS_KEY`, `SUPABASE_S3_SECRET_KEY`, `BACKUP_AGE_RECIPIENT`, `BACKUP_R2_BUCKET`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `CODE_PEPPER`.

- [ ] **Step 1: Write the failing check.** `restore-check.sh` seeds the local stack (two learners with events and one recording) and runs `backup.sh` with a local MinIO standing in for R2, plus a throwaway age key. It then restores the dump into a fresh database with `pg_restore` and checks:
  - the row counts match;
  - the recording bytes match;
  - the uploaded files start with the age header `age-encryption.org/v1`;
  - with one secret missing, `backup.sh` exits non-zero;
  - `grep` over the job output finds none of the secret values.
- [ ] **Step 2: Run** it locally. Expected: FAIL (no script yet).
- [ ] **Step 3: Implement** the script, the workflow and the runbook section. The runbook covers: create the R2 bucket with a 30-day lifecycle rule; `age-keygen` on an NGO machine, with the private key printed and kept offline in two places; add the secrets; run it once by hand; and restore with `age -d` and `pg_restore`.
- [ ] **Step 4: Run** `tooling/backup/restore-check.sh` and all checks. Expected: PASS.
- [ ] **Step 5: Commit** `feat(ops): back up the database and recordings to NGO storage every night`

### Task 12: Branding

**Files:**

- Create:
  - `supabase/migrations/20261022000006_branding.sql` (+ rollback): a single-row `branding` table with `id boolean pk default true check (id)`, `name_hi`, `name_en`, `primary_color`, `accent_color`, `version int`, `created_at` and `updated_at`, seeded with the defaults. RLS select for `anon` and `authenticated`;
  - `packages/api-contract/src/branding.ts` (schema, `contrastRatio(hexA: string, hexB: string): number`, `DEFAULT_BRANDING`);
  - `packages/server/src/services/branding.ts`;
  - `apps/learner/src/runtime/branding.ts`.
- Modify: `router.ts` (`GET /v1/branding`, public), `tooling/admin/commands.ts` (`set-branding`), `apps/learner/src/styles/tokens.css` (add `--color-accent: #b45309`; streak keeps its own token), `ui/NavBar.svelte` and `screens/profiles/ProfilesScreen.svelte` (show the branded name), `app-state.svelte.ts` and `main.ts` (load the cached branding before mount, refresh on sync)
- Test: `packages/api-contract/test/branding.test.ts`, `packages/server/test/services.test.ts`, `apps/learner/src/runtime/branding.test.ts`

**Interfaces:**

- Produces:
  - `setBranding(deps, input): Promise<{ version: number }>`. It refuses contrast below 4.5 with `INVALID_REQUEST` and increases `version`;
  - `loadBranding(runtime): Promise<Branding>`, from meta `branding`, else the default;
  - `refreshBranding(runtime, client): Promise<void>`;
  - `applyBranding(branding, root: HTMLElement): void`, which sets `--color-primary` and `--color-accent`. The `-dark` and `-soft` shades stay the built ones in this plan.

- [ ] **Step 1: Write the failing tests:**
  - `contrastRatio('#ffffff', '#2f3ab2')` ≥ 4.5;
  - `contrastRatio('#ffffff', '#ffd400')` < 4.5;
  - `set-branding` with `#ffd400` is refused, and nothing changes;
  - a valid change increases `version` by 1;
  - the phone shows the new name and colour after a sync, and keeps it offline after a reload;
  - a damaged cache falls back to the default;
  - `GET /v1/branding` works with no token and returns no other field;
  - the first-load JS stays ≤ 120 KB.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Branding is applied before the first paint from the cache, with no network wait.
- [ ] **Step 4: Run** all checks, `npm run test:db` and the size check. Expected: PASS.
- [ ] **Step 5: Commit** `feat: serve and apply the platform branding`

### Task 13: Plan 2c carry-overs

**Files:** `packages/content` (validator), `apps/learner/src/runtime/content-service.ts`, `screens/practice/items/RecordPanel.svelte`, `screens/me/MeScreen.svelte`, `screens/placement/PlacementResult.svelte`, `screens/placement/*` (skip), `runtime/install-prompt.ts`, `apps/learner/e2e/wide.spec.ts`, `apps/learner/e2e/speaking-mic.spec.ts`, the i18n catalogue

- [ ] **Step 1: Write a failing test for each item:**
  - the content build rejects a `speak_compare` item inside the placement test, with a clear message (placement speech is never saved or scored) _(builder's call)_;
  - a manifest-only content change (a new title, same bundles) raises `content.version`, so the session reopens;
  - while recording, `visibilitychange` to hidden (screen lock, call) stops and saves the recording, as the 30 s stop does;
  - the me screen sync button, accepting English only, skipping placement and the install prompt each recover from a thrown error: the button is enabled again and `status.savedLater` or `account.failed` is shown;
  - the me screen's language names come from the i18n catalogue (`me.langHiEn`, `me.langEn`);
  - the refused-mic e2e expects exactly one message (`speak.micDenied`);
  - a new e2e at 1024 px checks the wide layout of home, lessons and me, with no sideways scroll and tap targets ≥ 44 px;
  - `npm run typecheck` reports 0 svelte-check warnings.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** all checks, `npm run test:e2e` and the size check. Expected: PASS.
- [ ] **Step 5: Commit** `fix(app): close the Plan 2c review items`

### Task 14: End-to-end, runbook and worklog

**Files:** `apps/learner/e2e/backend.spec.ts`, `docs/runbooks/supabase-setup.md`, `docs/decisions/` (new record `backend-2026-10-22-codes-recordings-backups.md`), `WORKLOG.md`

- [ ] **Step 1: Extend the backend e2e.** A linked learner records on the speaking item with a fake microphone (the `chromium-backend` project gains the mic flags), and sets `navigator.connection` to Wi-Fi through an init script. After a sync, the server has the recording row `uploaded` and the object. `npm run admin -- delete` for that learner, then a sync on the phone, wipes the profile and shows the notice.
- [ ] **Step 2: Run** `npm run test:e2e:backend`. Expected: FAIL until the spec's setup is in place, then PASS.
- [ ] **Step 3: Update the runbook:**
  - `CODE_PEPPER` (generate with `openssl rand -base64 48`), set with `npx supabase secrets set`;
  - the `recordings` bucket comes from the migration (Task 4), so `db push` creates it. Check in the dashboard that it is private, with a 1 MB limit and audio types only;
  - email sign-ups off;
  - how to issue, reset, export and delete with `npm run admin`, and from which machine;
  - backups and the restore drill;
  - the consent wording on backups (deleted data leaves backups within 30 days).
- [ ] **Step 4: Write the decision record:** codes as Auth users with derived passwords, signed uploads, deletion tombstones, the backup design, and the ⚑ values the owner confirmed. Update `WORKLOG.md`.
- [ ] **Step 5: Run** every check: `npm test`, `npm run test:cov`, `npm run test:db`, `npm run test:e2e`, `npm run test:e2e:backend`, lint, typecheck, format, size and `restore-check.sh`. Expected: PASS. **Commit** `docs: runbook, decisions and e2e for Plan 3b`

---

## What this plan satisfies

| Spec / rule                                                                                | Task(s)     |
| ------------------------------------------------------------------------------------------ | ----------- |
| §5.3 backup code: reusable, mentor can reset; multiple profiles per phone                  | 6, 7        |
| §5.4 Storage for recordings, login-code Edge Function                                      | 4, 6        |
| §5.5 rule 5 one storage interface; rule 7 NGO-owned backups                                | 4, 11       |
| §6.5, §7.1, §7.2 recordings kept until synced, uploaded on Wi-Fi/lab                       | 4, 5        |
| §7.4 recordings only for the student and mentors; deletion on request                      | 4, 8, 9     |
| §8.1 delete on request, reset backup code, branding, server refuses a feature switched off | 4, 6, 8, 12 |
| §11 sync failure never blocks learning; mic denied                                         | 3, 5, 13    |
| security rule: rate limits, upload limits, signed URLs, no secrets in logs                 | 1, 3, 4, 6  |
| privacy rule: retention table, export, delete cascade, logs with ids only                  | 1, 8, 9, 10 |
| Plan 3a review M1, M2, M4, M6, M8, M9                                                      | 1, 2, 8     |
| Plan 2c deferred minors                                                                    | 13          |
