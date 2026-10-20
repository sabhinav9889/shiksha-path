# Backend and Sync Implementation Plan (Plan 3a)

> **For agentic workers:** follow `AGENTS.md`. Execute the tasks in order, tests first, and run every check after each task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Supabase backend and a versioned `/v1` API that let a learner link their phone profile to Google sign-in, upload their progress events (deduplicated by event id), restore everything on a new phone, and receive feature switches, while learning stays fully offline-first.

**Architecture:** Business logic lives in a plain TypeScript package (`packages/server`) behind ports (`Auth`, repositories) with no Supabase imports outside adapters; request and response shapes live in a browser-safe Zod package (`packages/api-contract`) shared by app and server. One Supabase Edge Function, `api`, is a thin wrapper that routes `/v1/...` paths to framework-free handlers `(Request, deps) → Response`. Postgres is reached with parameterised SQL through `postgres` (postgres.js); every table has row-level security as a second line of defence. In the app, a single API module talks to `/v1`, Supabase Auth is used only for Google sign-in (lazy-loaded), and the core's `SyncTransport` port gets an HTTP adapter.

**Tech Stack:** Supabase (Postgres 15+, Auth with Google, Edge Functions on Deno), Supabase CLI via the `supabase` npm package (local stack in Docker), `postgres` (postgres.js) for SQL, `@supabase/supabase-js` (auth only, in adapters), Zod 4, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-15-learning-platform-design.md` (§5.2, §5.3, §5.4, §5.5, §7.2, §7.3, §7.4, §8.1 "Feature switches", §11 "Sync failure", §12).

**Requires:** Plans 2a–2c merged (they are). Branch `feature/backend-sync` from `main`. Docker running locally.

### Plan series

- **Plan 3a** (this plan): database, `/v1` sync push and pull, Google sign-in and learner linking, restore on a new device, feature switches (read side).
- **Plan 3b:** speaking-recording upload (Wi-Fi/lab only) and retention, student data export and deletion (cascade, on the phone too), mentor-issued backup login codes, branding file, NGO-owned backups, rate limits, and the minors carried over from the Plan 2c review.
- **Plan 4:** mentor view and admin panel (including editing feature switches). **Plan 5:** AI. **Plan 6:** mentor connect and community.

**Not in this plan:** any admin or mentor screen (switches are seeded and changed by SQL until Plan 4); recordings upload; backup codes; deploying to a real Supabase project (Task 12 writes the owner's runbook, the owner performs it).

## Global Constraints

Everything marked _(builder's call)_ is a product decision the spec leaves open.

- **Portability (spec §5.5, decision `backend-2026-10-18-portability-rules`):** the app calls only `/v1/...` through one API module, never tables; business logic in `packages/server` has no Supabase import (only files under `packages/server/src/adapters/` and `supabase/functions/` may import Supabase); our own learner ids everywhere, the Supabase Auth user id appears only in `learner_identities`; schema only as SQL migration files, standard Postgres.
- **Layers (architecture rule):** handler (parse with Zod, call one service, map the result) → service (rules, no SQL) → repository (the only code with SQL).
- **Identity:** taken from the verified access token on the server, never from the request body. A body's `learnerId` must equal the caller's linked learner, or the request is refused.
- **Sync (spec §7.3, offline-sync rule):** events only append; ingest is idempotent on event `id`; batches of at most **100** events and **262_144** bytes per request _(builder's call; the outbox sends 50)_; a failed sync never blocks learning and shows "saved on phone, will upload later".
- **Errors:** the API answers errors as `{ "error": "<CODE>" }` with codes `UNAUTHENTICATED` (401), `NOT_LINKED` (403), `FORBIDDEN` (403), `INVALID_REQUEST` (400), `PROFILE_TAKEN` (409), `TOO_LARGE` (413), `INTERNAL` (500). No stack traces, SQL errors or paths ever reach a client. The app maps failures to plain Hindi/English text from the catalogue.
- **Privacy (privacy rule, spec §7.4):** the server stores the learner's name, Google identity link, events and switches; nothing else. Logs (if any) carry learner ids only. Google sign-in scopes are `email profile` only.
- **Database rule:** migrations named `<timestamp>_<snake_case>.sql`, idempotent (`if not exists`), each with a matching down migration in `supabase/rollbacks/`; RLS enabled on every table; `created_at`/`updated_at` on every table; indexes on foreign keys.
- **Size budget:** the app's first-load JavaScript stays ≤ 120 KB gzipped: Supabase Auth code is loaded only when a learner links or restores (dynamic import).
- Plan 0/2 limits apply (lines ≤ 100, files ≤ 300, Svelte ≤ 200, functions ≤ 50, complexity ≤ 10, coverage ≥ 70%). New dependencies, each with its reason in the PR: `supabase` (dev: CLI and local stack), `esbuild` (dev: bundles the server code for Deno), `postgres` (server: SQL), `@supabase/supabase-js` (server auth adapter and app sign-in adapter).

## Review Focus

1. **One learner reading or writing another's data.** A token for learner A must never read B's events or switches, push events as B, or claim B's learner id when linking, through the API or directly through Supabase's REST endpoints with a valid token. Tasks 2, 5, 6.
2. **Replayed, duplicated and hostile events.** A retried push, a push of events already on the server, an event whose `learnerId` is someone else's, an event id that already belongs to another learner, malformed events and oversized bodies: each ends in `accepted` / `rejected` / an error code, never a duplicate row or a 500. Tasks 3, 4, 5.
3. **Restore on a new phone.** Signing in with Google on a fresh phone recovers the same learner id and every event; doing it twice, or after some local learning on a profile that was never linked, never mixes two learners or loses progress. Tasks 3, 8, 11.
4. **Offline, expired or revoked sign-in.** No network, an expired access token or a revoked one must leave events safely pending and learning untouched, then upload once sign-in works again. Tasks 7, 9.
5. **Switch values offline and by override.** An individual override beats the all-students value; a phone that cannot reach the server keeps the last known values; an unknown switch defaults to on. Tasks 3, 10.

---

### Task 1: Local Supabase, server and contract packages

**Files:**

- Create: `supabase/` via `npx supabase init` (keep the generated `config.toml`; set `project_id = "shiksha-path"`, enable `[auth.external.google]` with `client_id = "env(SUPABASE_AUTH_GOOGLE_CLIENT_ID)"`, `secret = "env(SUPABASE_AUTH_GOOGLE_SECRET)"`, `skip_nonce_check = false`, and `enabled = false` locally unless both are set; `[auth] site_url = "http://localhost:4173"`, `additional_redirect_urls = ["http://localhost:4173/", "http://localhost:5173/"]`), `supabase/rollbacks/.gitkeep`, `supabase/tests/.gitkeep`
- Create: `packages/api-contract/{package.json,tsconfig.json,src/index.ts}` (`@shiksha/api-contract`, depends on `zod` only, `lib: ["ES2023"]`), `packages/server/{package.json,tsconfig.json,src/index.ts}` (`@shiksha/server`, depends on `@shiksha/api-contract`, `@shiksha/learner-core`, `zod`, `postgres`, `@supabase/supabase-js`)
- Create: `vitest.db.config.ts` (includes `**/*.db.test.ts` and `supabase/tests/**/*.test.ts`, `testTimeout: 30_000`, single fork), `docs/decisions/backend-2026-10-20-api-shape.md`
- Modify: root `package.json` (dev dependency `supabase`; scripts `db:start` = `supabase start`, `db:stop` = `supabase stop`, `db:reset` = `supabase db reset`, `test:db` = `vitest run -c vitest.db.config.ts`, `functions:build` = `node tooling/build-functions.mjs`, `functions:serve` = `npm run functions:build && supabase functions serve api --no-verify-jwt --env-file supabase/functions/.env.local`), root `vitest.config.ts` (exclude `**/*.db.test.ts` and `supabase/**`), `tsconfig.json` (include `packages/*/src`, `packages/*/test` already; add nothing for `supabase/functions`, which Deno checks), `.gitignore` (`supabase/.branches`, `supabase/.temp`, `supabase/functions/.env*`), CI workflow (new `db` job: checkout, setup-node, `npm ci`, `npx supabase start -x studio,imgproxy,inbucket,edge-runtime,logflare,vector`, `npm run test:db`; pin actions to the SHAs the other jobs use)
- Test: `packages/api-contract/test/boundaries.test.ts`, `packages/server/test/boundaries.test.ts`

**Interfaces:**

- Produces: workspaces `@shiksha/api-contract` and `@shiksha/server` with `typecheck` scripts; `npm run test:db` runs against the local stack (`supabase start` prints the DB URL `postgresql://postgres:postgres@127.0.0.1:54322/postgres` and the service and anon keys).
- Decision record `backend-2026-10-20-api-shape.md`: one Edge Function `api` routing `/v1/*` (base URL `<SUPABASE_URL>/functions/v1/api`); SQL through postgres.js from repositories; access tokens verified by the Auth adapter; Supabase Auth used only for Google sign-in; RLS as defence in depth.

- [ ] **Step 1: Write the failing tests.** `api-contract` boundaries: every `src/**/*.ts` imports only `zod` or relative files (walk imports like `packages/content/test/schema-entry.test.ts` does). `server` boundaries: no file outside `src/adapters/` imports `@supabase/supabase-js` or `postgres`; no file references `console`.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL (packages missing).
- [ ] **Step 3: Implement** the scaffolding above. Start the stack once with `npm run db:start` to confirm Docker works (stop it with `npm run db:stop`).
- [ ] **Step 4: Run** `npm test`, `lint`, `typecheck`, `format:check`. Expected: PASS.
- [ ] **Step 5: Commit** `build(server): add local Supabase, the server and API contract packages`

---

### Task 2: Schema, row-level security and isolation tests

**Files:**

- Create: `supabase/migrations/20261020000001_learners_and_events.sql`, `supabase/rollbacks/20261020000001_learners_and_events.down.sql`, `supabase/seed.sql`
- Test: `supabase/tests/rls.test.ts` (uses `postgres` with the local DB URL), `supabase/tests/migrations.test.ts`

**Interfaces:**

- Produces (all `public`, all `if not exists`, all with `created_at timestamptz not null default now()` and `updated_at timestamptz not null default now()` plus a shared `set_updated_at()` trigger):
  - `cohorts (id uuid primary key default gen_random_uuid(), name text not null)`
  - `learners (id uuid primary key, name text not null check (char_length(name) between 1 and 40), cohort_id uuid references cohorts(id) on delete set null, deactivated_at timestamptz)`; index on `cohort_id`
  - `learner_identities (auth_user_id uuid primary key references auth.users(id) on delete cascade, learner_id uuid not null unique references learners(id) on delete cascade)`
  - `learner_events (seq bigint generated always as identity primary key, id uuid not null unique, learner_id uuid not null references learners(id) on delete cascade, type text not null check (char_length(type) <= 64), at timestamptz not null, data jsonb not null, received_at timestamptz not null default now())`; index on `(learner_id, seq)`
  - `feature_switches (key text primary key, enabled_for_all boolean not null default true)`
  - `feature_overrides (learner_id uuid references learners(id) on delete cascade, key text references feature_switches(key) on delete cascade, enabled boolean not null, primary key (learner_id, key))`; index on `key`
  - function `public.current_learner_id() returns uuid` (`stable`, `security definer`, `set search_path = public`): the `learner_id` of `learner_identities` where `auth_user_id = auth.uid()`
  - RLS enabled on **every** table. Policies, role `authenticated` only, **select only**: `learners` where `id = current_learner_id()`; `learner_identities` where `auth_user_id = auth.uid()`; `learner_events` where `learner_id = current_learner_id()`; `feature_overrides` where `learner_id = current_learner_id()`; `feature_switches` all rows. No policy on `cohorts`. No insert/update/delete policy for `anon` or `authenticated` on any table: writes happen only through the API's database connection.
  - `seed.sql`: the six switches `ai_doubts`, `speaking_practice`, `placement_test`, `english_only_option`, `mentor_booking`, `community_feed`, all `enabled_for_all = true`.
  - The down migration drops exactly what the up migration created, in reverse order.

- [ ] **Step 1: Write the failing tests.** In `rls.test.ts`, with two cohorts, two learners A and B (each linked to an `auth.users` row created with `insert into auth.users (id, ...)` or the admin API) and events for both, run queries inside a transaction as `set local role authenticated; select set_config('request.jwt.claims', '{"sub":"<A's auth id>","role":"authenticated"}', true);`: A sees only A's learner row, identity, events and overrides; A sees all switches; A cannot `insert`, `update` or `delete` any row in any table (each raises or affects 0 rows); as role `anon` every table returns 0 rows; B's view mirrors A's. In `migrations.test.ts`: every table in `public` has `relrowsecurity = true`; applying the down migration then the up migration again succeeds (idempotence) and the up migration can run twice.
- [ ] **Step 2: Run** `npm run db:reset && npm run test:db`. Expected: FAIL.
- [ ] **Step 3: Implement** the migration, rollback and seed.
- [ ] **Step 4: Run** `npm run db:reset && npm run test:db`, then the four standard checks. Expected: PASS.
- [ ] **Step 5: Commit** `feat(db): add learners, identities, events and feature switches with RLS`

---

### Task 3: API contract and services

**Files:**

- Create: `packages/api-contract/src/{errors.ts,learners.ts,sync.ts,me.ts,index.ts}`; `packages/server/src/{ports.ts,services/link.ts,services/sync.ts,services/me.ts,testing/memory-repos.ts}`
- Test: `packages/api-contract/test/contract.test.ts`, `packages/server/test/services.test.ts`

**Interfaces:**

- `@shiksha/api-contract` produces (Zod schemas + inferred types):
  - `API_ERRORS` tuple and `ApiError` type with the codes from Global Constraints; `errorBody = z.strictObject({ error: z.enum(API_ERRORS) })`
  - `FEATURE_KEYS = ['ai_doubts', 'speaking_practice', 'placement_test', 'english_only_option', 'mentor_booking', 'community_feed'] as const`, `FeatureKey`
  - `linkRequest = z.strictObject({ profileId: z.uuid(), name: z.string().trim().min(1).max(40) })`; `linkResponse = z.strictObject({ learnerId: z.uuid(), name: z.string(), created: z.boolean() })`
  - `pushRequest = z.strictObject({ learnerId: z.uuid(), events: z.array(z.unknown()).min(1).max(100) })`; `pushResponse = z.strictObject({ accepted: z.array(z.uuid()), rejected: z.array(z.string()) })`
  - `pullQuery = z.strictObject({ after: z.coerce.number().int().min(0).default(0), limit: z.coerce.number().int().min(1).max(500).default(500) })`; `pullResponse = z.strictObject({ events: z.array(z.unknown()), next: z.number().int().nullable() })` (`next` is the cursor for the next page, `null` when done)
  - `meResponse = z.strictObject({ learner: z.strictObject({ id: z.uuid(), name: z.string() }), switches: z.record(z.enum(FEATURE_KEYS), z.boolean()) })`
  - `MAX_BODY_BYTES = 262_144`
- `@shiksha/server` produces:
  - Ports: `interface LearnerRepo { findByAuthUser(authUserId: string): Promise<{ id: string; name: string } | null>; findById(id: string): Promise<{ id: string; name: string } | null>; createLinked(input: { id: string; name: string; authUserId: string }): Promise<void> }`; `interface EventRepo { insertMany(learnerId: string, events: LearnerEvent[]): Promise<{ inserted: string[]; ownedByOthers: string[] }>; existingIds(learnerId: string, ids: string[]): Promise<string[]>; page(learnerId: string, after: number, limit: number): Promise<{ events: (LearnerEvent & { seq: number })[] }> }`; `interface SwitchRepo { allStudents(): Promise<Record<string, boolean>>; overrides(learnerId: string): Promise<Record<string, boolean>> }`; `interface Auth { verify(accessToken: string): Promise<{ authUserId: string } | null> }`
  - `class ApiFailure extends Error { constructor(readonly code: ApiError) }`
  - `linkLearner(deps: { learners: LearnerRepo }, authUserId: string, request: LinkRequest): Promise<LinkResponse>`: an identity already linked returns its learner (`created: false`, whatever `profileId` was sent); otherwise, if `profileId` already exists as a learner (linked to someone else) → `ApiFailure('PROFILE_TAKEN')`; otherwise create the learner with `id = profileId` and link it (`created: true`)
  - `pushEvents(deps: { learners: LearnerRepo; events: EventRepo }, authUserId: string, request: PushRequest): Promise<PushResponse>`: no linked learner → `NOT_LINKED`; `request.learnerId` ≠ the caller's learner → `FORBIDDEN`; each event is parsed with the core's `parseEvents` semantics (use `learnerEventSchema`); invalid ones and ones whose `learnerId` ≠ the caller's are `rejected` (by their `id` when it is a string, else by `"#<index>"`); valid ones are inserted with `insertMany`; `accepted` = inserted ids + ids that already existed **for this learner** (a retry); ids already owned by another learner are `rejected`
  - `pullEvents(deps, authUserId, query: PullQuery): Promise<PullResponse>`: `NOT_LINKED` when unlinked; returns the learner's events with `seq > after` in `seq` order, `limit` at most; `next` = last `seq` when the page is full, otherwise `null`
  - `getMe(deps: { learners; switches }, authUserId): Promise<MeResponse>`: `NOT_LINKED` when unlinked; `switches` has **every** `FEATURE_KEYS` entry: the override when present, else the all-students value, else `true`
  - `testing/memory-repos.ts`: in-memory `LearnerRepo`, `EventRepo`, `SwitchRepo` used by the service tests (and later by handler tests)

- [ ] **Step 1: Write the failing tests.** Contract: each schema accepts a valid example and rejects unknown keys, a non-UUID, 0 and 101 events, a 41-character name, `limit` 0 and 501; `pullQuery` fills defaults from an empty object. Services (two learners A and B, **Review Focus 1–3, 5**): link creates A with A's `profileId`; linking A's identity again with a different `profileId` returns A's id with `created: false`; B's identity trying A's id as `profileId` gets `PROFILE_TAKEN`; push the same 3 events twice → second time all `accepted`, the repo holds 3; a push with `learnerId` = B by A → `FORBIDDEN`; an event inside A's batch whose `learnerId` is B → `rejected`; an event id that already belongs to B → `rejected`, not inserted for A; malformed events (`42`, `{}`, a wrong `type`) → `rejected` by `#index` or id, and the valid rest accepted; unlinked caller → `NOT_LINKED` for push, pull and me; pull pages through 7 events with `limit` 3 (`next` 3, 6, then `null`) and never returns B's; switches: all-students off + override on → on; all-students on + override off → off; a key missing from the table → `true`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** all checks. Expected: PASS.
- [ ] **Step 5: Commit** `feat(server): add the /v1 contract and the link, sync and me services`

---

### Task 4: Postgres repositories

**Files:**

- Create: `packages/server/src/adapters/{pg.ts,pg-learner-repo.ts,pg-event-repo.ts,pg-switch-repo.ts}`
- Test: `packages/server/test/pg-repos.db.test.ts`

**Interfaces:**

- Consumes: the ports (Task 3), the schema (Task 2).
- Produces: `createSql(url: string): Sql` (postgres.js, `max: 5`, `prepare: false` for the Supabase pooler, `idle_timeout: 20`); `PgLearnerRepo`, `PgEventRepo`, `PgSwitchRepo` implementing the ports with tagged-template (parameterised) SQL only. `createLinked` inserts the learner and identity in one transaction. `insertMany` uses `insert ... on conflict (id) do nothing returning id` and then reads which of the remaining ids belong to another learner.

- [ ] **Step 1: Write the failing tests:** run the **same** behavioural cases as the Task 3 service tests against the Pg repos (export the service test cases as a function `describeServiceContract(makeRepos)` from `packages/server/src/testing/` and call it from both test files); plus: 100 events insert in one call; a learner deleted from `learners` takes their identity, events and overrides with them (cascade); SQL text never interpolates values (assert by reading the adapter source for `${` outside tagged templates: use `sql\`` templates only).
- [ ] **Step 2: Run** `npm run test:db`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm run test:db` and the standard checks. Expected: PASS.
- [ ] **Step 5: Commit** `feat(server): add Postgres repositories`

---

### Task 5: HTTP handlers and the router

**Files:**

- Create: `packages/server/src/http/{router.ts,respond.ts,cors.ts}`
- Test: `packages/server/test/http.test.ts`

**Interfaces:**

- Produces: `handle(request: Request, deps: { auth: Auth; learners: LearnerRepo; events: EventRepo; switches: SwitchRepo; allowedOrigins: readonly string[] }): Promise<Response>`. Routes: `POST /v1/learners/link`, `POST /v1/sync/push`, `GET /v1/sync/pull`, `GET /v1/me`, `OPTIONS *` (CORS preflight). The path is matched after the last `/api` segment, so it works both at `/functions/v1/api/v1/...` and `/v1/...`.
- Rules: the bearer token from `Authorization` is verified with `auth.verify` (missing or invalid → 401 `UNAUTHENTICATED`); bodies over `MAX_BODY_BYTES` → 413 `TOO_LARGE` (check `content-length` and the read length); bodies and queries parsed with the contract schemas (failure → 400 `INVALID_REQUEST`); `ApiFailure` → its status and code; any other error → 500 `INTERNAL` with no detail; responses are JSON validated against the response schema before sending; CORS: `Access-Control-Allow-Origin` echoes the request `Origin` only when it is in `allowedOrigins`, `Vary: Origin`, allowed headers `authorization, content-type`, methods `GET, POST, OPTIONS`; unknown route → 404 `{ "error": "INVALID_REQUEST" }`.

- [ ] **Step 1: Write the failing tests** with the in-memory repos and a fake `Auth` (`token-a` → A, `token-b` → B): each route's success; 401 without and with a bad token; 400 for malformed JSON and for schema failures; 413 for a 300 KB body; 403 `FORBIDDEN` when A pushes as B; 403 `NOT_LINKED`; 409 `PROFILE_TAKEN`; a repo that throws → 500 with body exactly `{"error":"INTERNAL"}` (no message leaks); CORS echoes an allowed origin and omits the header for another; preflight returns 204; both path forms route.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** all checks. Expected: PASS.
- [ ] **Step 5: Commit** `feat(server): add the /v1 HTTP handlers`

---

### Task 6: The `api` Edge Function

**Files:**

- Create: `packages/server/src/edge-entry.ts` (exports `handle`, `createSql`, the Pg repos and `createSupabaseAuth`), `tooling/build-functions.mjs` (`--help`; bundles `edge-entry.ts` with esbuild: `format: 'esm'`, `platform: 'neutral'`, `target: 'es2022'`, `bundle: true`, `external: ['postgres', '@supabase/supabase-js']`, output `supabase/functions/api/server.bundle.js`), `supabase/functions/api/index.ts` (imports `./server.bundle.js`), `supabase/functions/api/deno.json` (imports: `postgres` → `npm:postgres@^3`, `@supabase/supabase-js` → `npm:@supabase/supabase-js@^2`), `packages/server/src/adapters/supabase-auth.ts`, `supabase/functions/.env.local.example` (no secrets: `ALLOWED_ORIGINS=http://localhost:4173,http://localhost:5173`); add `supabase/functions/api/server.bundle.js` to `.gitignore` (it is generated before every serve and deploy)
- Why a bundle: our packages import each other with `.js` specifiers that point at `.ts` files (Node and Vite resolve those; Deno does not). Bundling keeps the source unchanged. If the Supabase runtime still cannot load the bundle, stop and report it in the PR; do not rewrite the core packages' imports.
- Test: `packages/server/test/supabase-auth.db.test.ts`, `supabase/tests/api.test.ts`

**Interfaces:**

- Produces: `createSupabaseAuth(url: string, serviceRoleKey: string): Auth` (`auth.getUser(token)`; returns `null` on any error). `index.ts` reads `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL` and `ALLOWED_ORIGINS` from the environment, builds the deps once, and calls `Deno.serve((request) => handle(request, deps))`. Nothing else lives in it.

- [ ] **Step 1: Write the failing tests.** `supabase-auth.db.test.ts`: against the local stack, create two users with the admin API, sign each in with email and password (local only) to get access tokens; `verify` returns each user's id, and `null` for a garbage token and for a token of a deleted user. `api.test.ts` (needs `npm run functions:serve` running): A links, pushes 3 events, pushes them again (all accepted, 3 rows), pulls them back; B cannot pull A's events or push as A; **with B's access token, querying `learner_events` directly through Supabase's REST endpoint (`/rest/v1/learner_events`) returns only B's rows and an insert is refused** (Review Focus 1); `GET /v1/me` returns all six switches.
- [ ] **Step 2: Run** `npm run test:db` with the function served. Expected: FAIL.
- [ ] **Step 3: Implement.** Add to the CI `db` job: start the functions server in the background (`npm run functions:serve &`, wait until `curl` answers) before `npm run test:db`. The runbook (Task 12) runs `npm run functions:build` before `supabase functions deploy api`.
- [ ] **Step 4: Run** `npm run test:db` and the standard checks. Expected: PASS.
- [ ] **Step 5: Commit** `feat(server): serve /v1 from a Supabase Edge Function`

---

### Task 7: The app's API module and Google sign-in

**Files:**

- Create: `apps/learner/src/api/{api-client.ts,auth.ts,auth-storage.ts,config.ts}`, `apps/learner/src/i18n/account.ts`
- Modify: `apps/learner/src/storage/db.ts` (database version 3: table `auth (key)` for sign-in sessions), `apps/learner/package.json` (dependency `@shiksha/api-contract`, `@supabase/supabase-js`), `apps/learner/src/csp.ts` and `vite.config.ts` (allow `VITE_SUPABASE_URL`'s origin in `connect-src`), `.env.example` (`VITE_SUPABASE_URL=`, `VITE_SUPABASE_ANON_KEY=`; the anon key is public by design, but still never committed with a real value)
- Test: `apps/learner/src/api/api-client.test.ts`, `apps/learner/src/api/auth-storage.test.ts`, `apps/learner/src/csp.test.ts` (extend)

**Interfaces:**

- Produces:
  - `apiConfig(): { baseUrl: string; supabaseUrl: string; anonKey: string } | null` (`null` when the env values are missing: the app then behaves exactly as in Plan 2c)
  - `type ApiResult<T> = { ok: true; value: T } | { ok: false; error: ApiError | 'OFFLINE' }`
  - `createApiClient(deps: { baseUrl: string; token: () => Promise<string | null>; fetchFn?: typeof fetch; timeoutMs?: number }): { link(body: LinkRequest): Promise<ApiResult<LinkResponse>>; push(body: PushRequest): Promise<ApiResult<PushResponse>>; pull(query: { after: number }): Promise<ApiResult<PullResponse>>; me(): Promise<ApiResult<MeResponse>> }`: every response parsed with the contract schema (a body that fails → `INTERNAL`); network failure or timeout (default 20 s) → `OFFLINE`; no token → `UNAUTHENTICATED` without a request
  - `IdbAuthStorage` (`getItem/setItem/removeItem`, async, keys prefixed by profile id) so each profile keeps its own sign-in session (spec §5.3)
  - `auth.ts` (dynamically imported): `startGoogleSignIn(profileId: string): Promise<void>` (remembers the profile id in `sessionStorage` under `shiksha.linking`, then `signInWithOAuth({ provider: 'google', options: { redirectTo: <origin>/#/auth-callback, scopes: 'email profile' } })` with `flowType: 'pkce'`); `finishGoogleSignIn(url: string): Promise<{ profileId: string } | null>` (returns `null` when no profile id is remembered; otherwise exchanges the `code` in the URL when there is one, then, if that profile now has a valid session, returns the remembered profile id and clears it); `accessToken(profileId: string): Promise<string | null>` (refreshes when needed; `null` when signed out or refresh fails); `signOutGoogle(profileId)` (local only)

- [ ] **Step 1: Write the failing tests:** `api-client` against a fake `fetchFn`: sends `Authorization: Bearer <token>` and JSON; parses each response; maps 401/403/409/413/500 bodies to their codes; a body that fails the schema → `INTERNAL`; a rejected fetch and a timeout → `OFFLINE`; no token → `UNAUTHENTICATED` and no request sent. `auth-storage`: values round-trip; two profiles' keys never collide; removing one leaves the other. CSP: a configured Supabase URL's origin appears in `connect-src`. (Real Google sign-in is exercised manually in Task 12; tests never call Google.)
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Keep `auth.ts` behind `await import('./auth.js')` so it is not in the first-load bundle.
- [ ] **Step 4: Run** all checks, then `npm run build -w @shiksha/learner-app` and `npm run size -w @shiksha/learner-app`. Expected: PASS, ≤ 120 KB.
- [ ] **Step 5: Commit** `feat(app): add the /v1 API client and Google sign-in adapter`

---

### Task 8: Linking a profile and restoring on a new phone

**Files:**

- Create: `apps/learner/src/account/{link-flow.ts,restore-flow.ts}`, `apps/learner/src/screens/account/{AuthCallback.svelte,LinkCard.svelte}`
- Modify: `router.svelte.ts` (route `auth-callback`), `App.svelte`, `screens/profiles/CreateProfile.svelte` (after the PIN: a "Google से जुड़ें" step with "बाद में" to skip), `screens/profiles/ProfilesScreen.svelte` ("पुरानी प्रोफ़ाइल वापस लाएँ" restore entry), `screens/home/HomeScreen.svelte` (a "not linked" nudge card), `screens/me/MeScreen.svelte` (account row: linked or "Google से जुड़ें"), `storage/idb-event-store.ts` (add `appendSent(events: LearnerEvent[]): Promise<void>`: append idempotently and mark sent in one transaction), `runtime/runtime.ts`
- Test: `apps/learner/src/account/account.test.ts`, `apps/learner/src/storage/event-profile-store.test.ts` (extend)

**Interfaces:**

- Produces:
  - `linkProfile(profileId: string): Promise<LinkOutcome>` with `type LinkOutcome = { kind: 'linked' } | { kind: 'adopted'; learnerId: string } | { kind: 'elsewhere' } | { kind: 'failed'; error: ApiError | 'OFFLINE' }`, called after `finishGoogleSignIn`: posts `/v1/learners/link` with the profile's id and name. `created: true`, or the same id returned → `linked`. A different `learnerId` returned (this Google account already has a learner): if the local profile has no events other than `language_changed` → **adopt**: create a local profile with the server's id, the server's name and the same PIN hash, move the sign-in session to it, delete the old local profile and its events, pull the learner's events (`restoreEvents`), → `adopted`; otherwise → `elsewhere` (nothing changes; the learner sees "यह Google खाता दूसरी प्रोफ़ाइल से जुड़ा है") _(builder's call: never merge two learners' histories)_
  - Linked state per profile: meta `linked:<profileId>` = `'1'`
  - `restoreEvents(learnerId: string): Promise<{ pulled: number }>`: pages `/v1/sync/pull` from cursor 0 and stores events with `appendSent`; stores the cursor in meta `pullCursor:<learnerId>`
  - Restore entry on the picker: "पुरानी प्रोफ़ाइल वापस लाएँ" → asks for a new 4-digit PIN for this phone → Google sign-in → `/v1/me` gives id and name → local profile created with that id → `restoreEvents` → signed in. A Google account with no learner yet → "इस Google खाते की कोई प्रोफ़ाइल नहीं मिली" and nothing is created.
  - Copy (draft, mentor to review): link step `अपनी प्रोग्रेस सुरक्षित रखने के लिए Google से जुड़ें` / `Connect Google to keep your progress safe`; nudge `प्रोग्रेस सिर्फ़ इस फ़ोन पर है। Google से जुड़ें ताकि फ़ोन बदलने पर भी न खोए।` / `Your progress is only on this phone. Connect Google so it is not lost if you change phones.`

- [ ] **Step 1: Write the failing tests** (fake API client and fake auth module injected through the runtime): a new profile links (`linked`, meta set); linking when the server returns another id on a fresh profile adopts it: the old local profile is gone, the new one has the server id, the same PIN works, the pulled events are present and **not pending** (they are not uploaded again); the same with local lessons already done → `elsewhere`, nothing changed; restore on an empty phone recovers name, events and progress (`deriveProgress` equals the server's), and running restore twice adds nothing (**Review Focus 3**); a Google account with no learner → the message, no profile; offline at any step → `failed: OFFLINE`, the profile stays usable and unlinked; `appendSent` is idempotent and leaves nothing pending; the callback route with no remembered profile goes to the picker.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** all checks. Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): link profiles to Google and restore them on a new phone`

---

### Task 9: Uploading and pulling events

**Files:**

- Create: `apps/learner/src/runtime/http-transport.ts`, `apps/learner/src/runtime/pull.ts`
- Modify: `runtime/runtime.ts` (`flush` uses the HTTP transport for linked profiles, `noServerTransport` otherwise), `runtime/auto-sync.ts` (after a successful flush, pull), `app-state.svelte.ts` (`refreshSession({ force: true })` reopens the session when a pull added events), `screens/me/MeScreen.svelte` (sync result text)
- Test: `apps/learner/src/runtime/http-transport.test.ts`, `apps/learner/src/runtime/pull.test.ts`

**Interfaces:**

- Produces: `httpTransport(client: ApiClient): SyncTransport`: `push` returns the server's `accepted` and `rejected`; any failure (`OFFLINE`, `UNAUTHENTICATED`, `NOT_LINKED`, `INTERNAL`, …) **rejects**, so the core's outbox keeps the events pending and backs off (**Review Focus 4**); `pullNew(learnerId: string, deps): Promise<{ added: number }>`: pages from the stored cursor, stores with `appendSent`, advances the cursor, never throws (returns `added: 0` on failure).

- [ ] **Step 1: Write the failing tests:** a linked profile's flush sends its pending events and marks the accepted ones sent, leaving rejected ones out of the queue but in the log; an expired token (fake auth returns `null`), `OFFLINE` and `INTERNAL` each leave every event pending and the result `ok: false` (the screen shows "saved on phone, will upload later"); an unlinked profile never calls the server; `pullNew` adds events made on another phone and is idempotent; after a pull that added events, the session's progress includes them; a failing pull leaves the cursor unchanged.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** all checks. Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): upload and pull progress through /v1`

---

### Task 10: Feature switches in the app

**Files:**

- Create: `apps/learner/src/runtime/switches.ts`
- Modify: `app-state.svelte.ts` (`appState.switches: Record<FeatureKey, boolean>`, loaded at sign-in from the cache and refreshed from `/v1/me` at sign-in and after each sync), `screens/home/home-data.ts` (placement card only when `placement_test`), `screens/practice/items/SpeakView.svelte` (no record panel when `speaking_practice` is off: model audio and "आगे" only), `screens/profiles/CreateProfile.svelte`, `screens/me/MeScreen.svelte`, `screens/placement/PlacementResult.svelte` (the English-only choice only when `english_only_option`)
- Test: `apps/learner/src/runtime/switches.test.ts`, extend the screen tests touched

**Interfaces:**

- Produces: `ALL_ON: Record<FeatureKey, boolean>`; `loadSwitches(runtime, learnerId): Promise<Record<FeatureKey, boolean>>` (the cached value in meta `switches:<learnerId>`, else `ALL_ON`, with any missing key filled as `true`); `refreshSwitches(runtime, client, learnerId): Promise<void>` (fetches `/v1/me`, stores the switches; on failure keeps the cache).

- [ ] **Step 1: Write the failing tests** (**Review Focus 5**): with nothing cached every switch is on; a cached `placement_test: false` hides the placement card; `speaking_practice: false` shows no record button and "आगे" still works; `english_only_option: false` hides the English-only choice in create profile, the me screen and the placement result; a failing `/v1/me` keeps the cached values; a cached object missing a key treats it as on; two learners on one phone keep separate switch values.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** all checks. Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): apply feature switches from the server`

---

### Task 11: End-to-end against the local backend

**Files:**

- Create: `apps/learner/e2e/backend.spec.ts`, `apps/learner/e2e/backend-setup.ts`
- Modify: `apps/learner/playwright.config.ts` (a `chromium-backend` project that runs only `backend.spec.ts`, skipped unless `E2E_BACKEND=1`), root `package.json` (`test:e2e:backend` = build the app with `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` from `supabase status -o env`, then `E2E_BACKEND=1 playwright test -c apps/learner --project chromium-backend`), CI `db` job (run it after `test:db`)

**Interfaces:**

- `backend-setup.ts`: creates a test user with the admin API and signs it in with email and password (local stack only) to get a session. To "link" in the browser it writes that session into the app's `auth` table for the profile, sets `sessionStorage['shiksha.linking']` to the profile id, and opens `#/auth-callback`: the app's real callback path then finds the session and runs `linkProfile`. Restore on a second phone does the same with a fresh browser context. No test-only code path is added to the app.

- [ ] **Step 1: Write the failing spec:** create a profile, skip linking, learn a lesson; link it as above; sync: the Me screen shows everything uploaded and the server has the events; in a second, fresh browser context (a new phone), restore with the same user: the lesson shows as done and the streak matches (**Review Focus 3**); turn `placement_test` off for that learner with SQL, sync: the placement card disappears (**Review Focus 5**); stop the functions server, learn another lesson: it shows "saved on phone", and after restarting the server and syncing, the server has it (**Review Focus 4**).
- [ ] **Step 2: Run** `npm run test:e2e:backend`. Expected: FAIL.
- [ ] **Step 3: Implement** the setup and config.
- [ ] **Step 4: Run** `npm run test:e2e:backend`, `npm run test:e2e`, `npm run test:db`, `npm test`, `npm run test:cov`, lint, typecheck, format, size. Expected: all PASS.
- [ ] **Step 5: Commit** `test(app): add end-to-end tests against the local backend`

---

### Task 12: The owner's setup runbook

**Files:**

- Create: `docs/runbooks/supabase-setup.md`
- Modify: `WORKLOG.md`

The runbook is for the product owner; the agent writes it and does **not** perform any step. Steps: create the Supabase project in the **Mumbai (ap-south-1)** region on the Free plan for the pilot (Pro before any ad-driven intake, spec §5.4); create a Google Cloud OAuth client (Web) with the Supabase callback URL; set the Google client id and secret in Supabase Auth; set Site URL and redirect URLs to the app's real address; link the CLI (`npx supabase link`), push migrations (`npx supabase db push`), run the seed once; set function secrets (`ALLOWED_ORIGINS`) and deploy (`npx supabase functions deploy api`); set the app's `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the hosting settings (Cloudflare Pages); a manual check list (sign in on a real phone, learn offline, sync, restore on a second phone); and the warning that Free projects pause after inactivity and have no backups (backups arrive in Plan 3b).

- [ ] **Step 1:** Write the runbook; every command in it must be one the repo's scripts or the Supabase CLI actually provide (check with `npx supabase --help`).
- [ ] **Step 2: Run** `npm run format:check`. Expected: PASS.
- [ ] **Step 3: Commit** `docs(runbook): add the Supabase setup steps for the owner`

---

## What this plan satisfies

| Spec                                                                          | Task(s)     |
| ----------------------------------------------------------------------------- | ----------- |
| §5.2 sync service; §5.4 Supabase Postgres, Auth, Edge Functions               | 1, 2, 4, 6  |
| §5.3 Google sign-in required; each profile keeps its own session              | 7, 8        |
| §5.3, §7.3 new/lost device: sign in, progress restored                        | 8, 11       |
| §5.5 our own `/v1` API, plain modules, own ids, SQL migrations                | 1, 3, 5, 6  |
| §7.2 learners, append-only event log                                          | 2, 4        |
| §7.3 small batches, de-duplication by event id, last synced                   | 3, 5, 9     |
| §7.4 collect only what is needed; minimal scopes                              | 2, 7        |
| §8.1 feature switches: all-students value, individual override, offline cache | 2, 3, 10    |
| §11 sync failure: waits and retries, "saved on phone"                         | 9, 11       |
| §12 RLS isolation tests (2+ students, 2+ cohorts), sync tests                 | 2, 3, 6, 11 |
| Security rule: RLS on every table, Zod at every boundary, no leaks            | 2, 5, 6     |

Deferred to Plan 3b: recordings upload and retention, export and deletion (including on the phone), backup login codes, branding, backups, rate limits.
