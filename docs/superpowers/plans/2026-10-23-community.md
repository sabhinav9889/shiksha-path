# Community Feed Implementation Plan (Plan 6b)

> **Status, 2026-10-30:** built in a reduced form (text posts, audience, session details, an offline
> copy; no attachments, calendar button, countdown or paging). See
> [the decision](../../decisions/backend-2026-10-30-community-posts.md). The rest of this plan is
> still the plan for those parts.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Also follow `AGENTS.md`. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mentors and NGO admins post to a community feed (title, text, optional session details, optional image or PDF attachments, to everyone or one cohort); students read it in the app, see a countdown and an "Add to calendar" button on session posts, and can read the latest posts offline.

**Architecture:** Same shape as Plans 4a to 6a:

- **API:** staff write through new `/v1/staff/community/*` routes; phones read through `GET /v1/community/feed` and `GET /v1/community/attachment-url`. Both live in a new `http/community-routes.ts` spread into `ROUTES`, call services in `packages/server/src/services/community*.ts`, and take role, cohorts and learner from the verified token.
- **Files:** attachments go to a private `post-files` bucket through the existing S3-style `RecordingStorage` port (a second instance, never overwritable). The server checks size **and** magic bytes after the upload, and students read through 300-second signed URLs fetched on tap.
- **Phone:** the feed is a lazy chunk (`#/community`). The latest 30 posts are cached in the Dexie `meta` table under `feed:<learnerId>`, refreshed on every sync and when the screen opens (stale-while-revalidate). Countdown and calendar link are computed on the phone at render time.
- **Staff screens:** a "पोस्ट" section in the staff chunk (`#/staff/posts`) to compose, edit, upload and delete.

**Tech Stack:** Unchanged: Svelte 5, Vite PWA, Dexie, Supabase (Postgres, Auth, Storage, Edge Functions), `postgres`, Zod 4 (4.6.7), Vitest, Playwright. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-15-learning-platform-design.md`: §10 (needs internet; latest data cached), §10.2 (community), §10.3 (`community_posts`, `post_attachments`, "posts are visible to their audience"), §11 (all errors in plain Hindi), §8.1 (feature switch `community_feed`, refused by the server), §12 (feature-switch test with an un-synced phone). Rules: `security.md` ("attachments ≤ 2 MB; check type and size"; "attachments use short-lived signed URLs"; rate-limit uploads), `privacy.md`, `database.md` (soft delete for user content; RLS per role), `offline-sync.md`.

**Requires:**

- Plan 6a merged (and so 4b, 5a, 5b).
- Branch `feature/community` from `main`.
- Docker running. Run `npm ci` in the worktree.

**Not in this plan** (spec §8.1 "Out of pilot"): student posts or comments, reactions, push notifications, rich text or Markdown, video uploads, attachment thumbnails stored on the phone.

## Before you start

- `git worktree add ../shiksha-path-community -b feature/community origin/main`, then `npm ci` (hooks do nothing until you do), then `npm run db:start`.
- Read `docs/gotchas/` first. Keep a ledger in `.superpowers/sdd/2026-10-23-community/progress.md`; write every deviation as `Ruling: <what> — <why> — <cost if wrong>`.
- Do the **Provisional notes** reconciliation (below) before Task 1.
- **Gate after every task** (repo root): `npx prettier --write apps packages tooling supabase` · `npx vitest run` · `npm run typecheck` · `npm run lint` · `npm run format:check`. Add `npm run test:db` when a task touches `packages/server/src/adapters`, `supabase/`, a contract test or the admin tool.

## Provisional notes (re-verify against merged code before Task 1)

This plan was written against `feature/mentor-admin` (Plan 4a) before 4b to 6a existed. Check each item; write any difference as a `Ruling:`.

1. **`requireFeature(deps: { switches: SwitchRepo }, learnerId: string, key: FeatureKey): Promise<void>`** in `packages/server/src/services/features.ts` (5a), throwing `ApiFailure('FEATURE_OFF')`.
2. **6a's date helper (decided).** 6a defines only `formatIstRange` (`packages/learner-core/src/ist-format.ts`, display text) and no calendar-link or UTC basic-format helper, so Task 7 builds its own `calendarLink` in `apps/learner/src/community/calendar-link.ts`, as written. Not provisional.
3. **4b's storage adapter (decided).** 4b Task 7 generalises it as `createSupabaseStorage(opts: { url; serviceRoleKey; publicUrl?; bucket; upsert? }): ObjectStorage` (`ObjectStorage = RecordingStorage`); Task 3 reuses it with `bucket: 'post-files', upsert: false` and adds no factory of its own. 4b's `pngSize` (`services/png.ts`) only reads PNG sizes; `sniffAttachment` stays this plan's.
4. **Migration order.** Task 2's migration timestamp `20261103000001` must sort after every merged migration; rename if not.
5. **Shared lists other plans also grew:** `AuditAction` (`services/audit.ts`), `API_ERRORS` and `STATUS`, `HandlerDeps` and `ServiceFixture`, `LIMITS`, `RetentionDeps` and `runRetention`'s return (5a may have added doubts), `makeAdminDeps`, the `Route` union and `parseStaff` (5a/6a screens), `StaffNav` links, the Playwright `chromium-backend` `testMatch` and `chromium` `testIgnore` regexes, `edge-entry.ts` and `supabase/functions/api/index.ts`. Add to them; never replace another plan's entries.
6. **The size budget.** Run `npm run size -w @shiksha/learner-app` on `main` first and note the first-load figure in the ledger; Task 8 must not grow it by more than 0.8 KB.
7. **`ApiClient`** (`apps/learner/src/api/api-client.ts`) and the fake backend's `serverFor`: `makeCaller(deps): Call` already exists there and 6a's `meetings-api.ts` builds on it. If merged 6a exposes a `Call` the runtime can reach, Task 7 uses it instead of adding `ApiClient.call`; otherwise add `call` as written.

## Global Constraints

Everything marked _(builder's call)_ is open in the spec. ⚑ marks values for the owner to confirm.

- All Plan 4a Global Constraints still apply, and the series map's: TypeScript strict; Zod at every boundary; parameterised SQL; RLS with a policy per role; nothing personal in logs or URLs; secrets only in env; Hindi first with English beside it; no stack traces to clients; Supabase imports only in adapters.
- **Series-map rules this plan exercises:** (1) contract tests on memory **and** Postgres with more rows than one page; (2) an old phone never loses new server data; (3) derived data (the countdown) is computed on read, never stored; (4) revocation is stated and tested; (5) staff screens idle out at 30 minutes and keep nothing in `localStorage`; (6) the six personal-data steps; (7) every write route writes exactly one audit entry; (8) both ends traced (see **Traceability**); (9) the feed is a lazy chunk and the size check runs; (10) no names in URLs, cursors are ids; (11) the server refuses with `FEATURE_OFF` via `requireFeature`.
- **Who posts** ⚑: a mentor posts only to one of **their own cohorts**; an admin posts to any cohort or to **everyone**. A mentor choosing "everyone" or another cohort gets `FORBIDDEN`.
- **Who edits and deletes:** the author edits and deletes their own post while it is in their scope (a mentor must still have its cohort); an admin deletes any post and edits only their own. Anything else is `FORBIDDEN`, the same as an unknown id.
- **A post** _(builder's call)_: `title` 1–120 characters; `body` 0–4000 characters, both trimmed, **plain text**: never rendered as HTML or Markdown. Optional `session { startsAt (ISO with offset), minutes 15–480 (default 60), link | null }`. Up to **4** attachments.
- **Links** _(builder's call)_: the session link is `z.url({ protocol: /^https$/ })`, ≤ 500 characters; `http:`, `javascript:`, `data:` and anything else are `INVALID_REQUEST`. Any `https://` host is allowed (Meet, YouTube, others). In the body, only `https://…` runs become links; everything else stays text. Every link has `target="_blank" rel="noopener noreferrer"`.
- **Attachments** ⚑: types `image/png`, `image/jpeg`, `image/webp`, `application/pdf` (no SVG, no GIF); ≤ **2 MB** (`MAX_ATTACHMENT_BYTES = 2_097_152`). Signatures: PNG `89 50 4E 47 0D 0A 1A 0A`; JPEG `FF D8 FF`; WebP `52 49 46 46 ?? ?? ?? ?? 57 45 42 50`; PDF `25 50 44 46 2D`. The sniffed type must equal the declared one. No file names are kept (a name could hold a student's name): a file shows as "चित्र 1" / "PDF 1".
- **Bucket:** `post-files`, private, `file_size_limit 2097152`, `allowed_mime_types` = the four types; object path `<attachmentId>`; upload URLs signed with `upsert: false` so a checked file can never be replaced (closes Plan 3b's M5 for this bucket).
- **Signed read URLs:** 300 seconds, issued only for a ready attachment of a post that is not deleted and is visible to the caller.
- **Feed** ⚑: the newest **30** visible posts, by `seq` descending (`FEED_CAP = 30`). Staff list pages of **25** (`STAFF_POSTS_PAGE`), cursor `before=<seq>`.
- **Phone cache** _(builder's call)_: meta key `feed:<learnerId>` holding `{ savedAt, posts }` (≤ 30). Refreshed after every successful `/v1/me` in a sync and when the screen opens. `FEATURE_OFF`, `NOT_LINKED` or `FORBIDDEN` clears it; offline or any other error keeps it. Attachment bytes are **never** stored on the phone (no thumbnails): offline, a file shows "फ़ाइल देखने के लिए इंटरनेट चाहिए". Reason: images on cheap phones cost storage and data, and there is no server-side resizer.
- **Add to calendar** _(builder's call)_: a client-side Google Calendar template link `https://calendar.google.com/calendar/render?action=TEMPLATE&text=<title>&dates=<start>/<end>&details=<link>` (UTC basic format). Reason: Android students use Google Calendar; it opens the app or the web with no OAuth scope beyond `email profile` and no file handling; an `.ics` download is unreliable on Android.
- **Countdown** _(builder's call)_: from `startsAt`, `minutes` and the phone clock at render time: ≥ 24 h → "{n} दिन बाद"; < 24 h → "{h} घंटे {m} मिनट में"; during → "अभी चल रहा है"; after → "हो चुका" (the calendar button hides).
- **Author shown:** the author's name while their staff row is active; otherwise (paused, or row gone) the platform name from branding. Posts never disappear because their author left.
- **Content warning** on the compose screen, always visible: "छात्रों के नाम और फ़ोटो पोस्ट न करें। / Do not post students' names or photos." Posts hold no student personal data; there is no student content, so no moderation queue is needed.
- **Retention** ⚑: posts kept until deleted. On delete, files are removed at once (best effort); the nightly `retention` removes any left within **24 h**, unattached uploads older than **24 h**, and deleted post rows **30 days** after deletion _(builder's call)_.
- **Audit actions:** `post_created`, `post_edited`, `post_deleted` (details `{ postId, audience: 'all' | 'cohort', cohortId | null, attachments: n }`), `attachment_started`, `attachment_checked` (details `{ attachmentId, mime, bytes }`). Never a title, body or link: `withAudit` also refuses the keys `title`, `text`, `link` (6a already added `body`, `note` and `email`).
- **New error code:** `BAD_FILE` (415): the file is not one of the four types. Existing `TOO_LARGE` (413) for > 2 MB.
- **Rate limits** _(builder's call)_: `attachment: { limit: 50, windowSeconds: 86400 }` per staff member (`attachment:<staffId>`); `feed: { limit: 60, windowSeconds: 60 }` per learner (`feed:<learnerId>`).
- **Cohort deletion:** no route deletes a cohort (Plan 4a). `community_posts.cohort_id` is `on delete restrict`, so a post can never widen to "everyone" by accident.

## Review Focus

1. **A dangerous file or link getting through.** A body with `<script>` or `javascript:alert(1)`, a session link `javascript:…`, `data:…` or `http://…`; an upload that is a renamed `.exe` (`MZ`) or `.html` declared `image/png`; a file of 2 MB + 1 byte; a second PUT to the same signed URL after `complete`. Text shows literally, bad links are refused, bad files are `BAD_FILE` / `TOO_LARGE` and leave no object, and the overwrite fails. Tasks 1, 3, 7.
2. **Reading across cohorts.** A cohort-B student calling `attachment-url` for a cohort-A attachment, or reading `community_posts` through PostgREST with their token; a mentor editing or deleting another mentor's post; a mentor posting to everyone. All `FORBIDDEN` (or no rows), nothing changed. Tasks 2, 4, 5.
3. **Deleted or switched-off content still reachable.** A deleted post's attachment through an old signed URL (the file is removed at delete; at worst the URL lives 300 s and retention removes it within 24 h); `community_feed` off for one student on an un-synced phone (server `FEATURE_OFF`, cache cleared). Tasks 4, 5, 6, 7.
4. **An old phone or old cache.** A phone built before this plan (pull and me responses unchanged, no event type added), and a cached feed missing a field or holding an unknown attachment type. Nothing crashes; the cache refreshes. Tasks 1, 7.
5. **The feed on a 360 px screen.** A long unbroken title or link, four attachments, a session post: no sideways scroll, tap targets ≥ 44 px. Tasks 8, 10.

---

### Task 1: The contract: posts, attachments, links and `BAD_FILE`

**Files:**

- Create: `packages/api-contract/src/community.ts` (phones), `packages/api-contract/src/community-staff.ts` (staff)
- Modify: `packages/api-contract/src/index.ts`, `packages/api-contract/src/staff-index.ts`, `packages/api-contract/src/errors.ts` (`BAD_FILE`), `packages/server/src/http/respond.ts` (`BAD_FILE: 415`)
- Test: `packages/api-contract/test/community.test.ts`

**Interfaces:**

- Produces (phones, `@shiksha/api-contract`), all responses `z.object` (extra fields dropped):
  - `feedPost = { id: uuid, title, body, authorName: string | null, toCohort: boolean, createdAt, editedAt: string | null, session: { startsAt, minutes, link: string | null } | null, attachments: { id: uuid, mime: string, bytes: number }[] }`; `feedResponse = { posts: feedPost[] }` (max 30); `FeedPost`, `FeedResponse`;
  - `attachmentUrlQuery = z.strictObject({ id: z.uuid() })`, `attachmentUrlResponse = { url: string }`;
  - `FEED_CAP = 30`.
- Produces (staff, `@shiksha/api-contract/staff`):
  - `ATTACHMENT_TYPES` (the four), `AttachmentType`, `MAX_ATTACHMENT_BYTES = 2_097_152`, `MAX_ATTACHMENTS = 4`, `STAFF_POSTS_PAGE = 25`;
  - `sniffAttachment(head: Uint8Array): AttachmentType | null` (reads at most the first 12 bytes);
  - `sessionLink = z.url({ protocol: /^https$/ }).max(500)`;
  - `postRequest = z.strictObject({ id: z.uuid().optional(), title, body, audience: { kind: 'all' } | { kind: 'cohort', cohortId: uuid }, session: { startsAt: z.iso.datetime({ offset: true }), minutes: int 15–480, link: sessionLink | null } | null, attachmentIds: uuid[] max 4 })`;
  - `postDeleteRequest = { id }`; `uploadStart = { mime: z.enum(ATTACHMENT_TYPES), bytes: int ≥ 1 }` (the size limit is the service's, so it can answer `TOO_LARGE`); `uploadStartResponse = { id, uploadUrl, token }`; `uploadComplete = { id }`; `uploadCompleteResponse = { id, mime, bytes }`;
  - `staffPost = feedPost & { cohortId: uuid | null, authorId: uuid | null, canEdit: boolean, canDelete: boolean }`; `staffPostsQuery = { before?: coerce int }`; `staffPostsPage = { posts: staffPost[], next: number | null }`.

- [ ] **Step 1: Write the failing tests:**
  - `sniffAttachment` returns each type for its signature; `null` for `4D 5A` (`MZ`, an `.exe`), `<!doctype html>`, `<svg`, `GIF89a`, an empty array, and `RIFF????AVI ` (RIFF but not WebP);
  - `postRequest` refuses a session link `javascript:alert(1)`, `data:text/html,x`, `http://meet.google.com/x` and one of 501 characters, and accepts `https://meet.google.com/abc-defg-hij` and `https://youtu.be/x`;
  - it refuses a 121-character title, an empty title after trimming, a 4001-character body, 5 attachment ids, minutes 14 and 481, and an unknown key;
  - `feedResponse` parses a post with an extra field and an attachment `mime: 'video/mp4'` (the phone filters later), so a newer server never breaks an older phone;
  - `API_ERRORS` contains `BAD_FILE`, and `failure('BAD_FILE')` answers 415.
- [ ] **Step 2: Run** `npx vitest run packages/api-contract packages/server/test/http.test.ts`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** the schemas and `sniffAttachment` in the two files; export `community.ts` from `index.ts` and `community-staff.ts` from `staff-index.ts` only.
- [ ] **Step 4: Run** the gate. Expected: PASS.
- [ ] **Step 5: Commit** `feat(contract): community posts, attachments and the BAD_FILE error`

### Task 2: Tables, bucket, RLS and the post repository

**Files:**

- Create: `supabase/migrations/20261103000001_community.sql`, `supabase/rollbacks/20261103000001_community.down.sql`, `packages/server/src/adapters/pg-post-repo.ts`, `packages/server/src/testing/memory-posts.ts`, `packages/server/src/testing/post-repo-contract.ts`
- Modify: `packages/server/src/ports.ts`, `testing/service-contract.ts` (`ServiceFixture` gains `posts`), `testing/memory-repos.ts`, `packages/server/test/pg-repos.db.test.ts`, `packages/server/test/services.test.ts`, `supabase/tests/rls.test.ts`, `supabase/tests/migrations.test.ts`, `packages/server/test/learner-data.db.test.ts`
- Test: the post-repo contract (memory + Postgres), `supabase/tests/rls.test.ts`

**Interfaces:**

- Produces (SQL):
  - `community_posts(id uuid pk default gen_random_uuid(), seq bigint generated always as identity unique, author_id uuid null → staff on delete set null, cohort_id uuid null → cohorts on delete restrict, title text check 1..120, body text check ≤ 4000, session_starts_at timestamptz null, session_minutes int null check 15..480, session_link text null check (session_link like 'https://%' and char_length ≤ 500), check ((session_starts_at is null) = (session_minutes is null)), edited_at, deleted_at, deleted_by uuid null → staff on delete set null, created_at, updated_at)`; indexes on `author_id`, `cohort_id`, `deleted_by`, `deleted_at`;
  - `post_attachments(id uuid pk, post_id uuid null → community_posts on delete cascade, uploaded_by uuid null → staff on delete set null, mime text check in the four, bytes int check 1..2097152, status text check in ('pending','ready') default 'pending', created_at, updated_at)`; indexes on `post_id`, `uploaded_by`, `(status, created_at)`;
  - the `set_updated_at` trigger on both; RLS on both; `revoke all from anon`; `revoke insert, update, delete, truncate from authenticated`;
  - `public.can_read_post(cohort uuid, author uuid, deleted timestamptz) returns boolean`, `security definer`, `set search_path = public`: true for an active admin; for an active mentor when `author` is them, or `cohort` is null, or `cohort` is in their `staff_cohorts`; for a learner (`current_learner_id()`) when `deleted is null` and (`cohort` is null or equals their `cohort_id`). Policies `posts_select` and `attachments_select` (via the parent post) `for select to authenticated using (…)`;
  - the bucket: `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('post-files', 'post-files', false, 2097152, array['image/png','image/jpeg','image/webp','application/pdf']) on conflict (id) do nothing`.
- Produces (`ports.ts`):
  - `AttachmentRow { id; postId: string | null; uploadedBy: string | null; mime: AttachmentType; bytes: number; status: 'pending' | 'ready'; createdAt: string }`;
  - `PostRow { id; seq: number; authorId: string | null; authorName: string | null /* null unless the author is active */; cohortId: string | null; title; body; session: { startsAt; minutes; link: string | null } | null; createdAt; editedAt: string | null; deletedAt: string | null; attachments: AttachmentRow[] }`;
  - `PostRepo`:
    - `save(post: { id?: string; authorId: string; cohortId: string | null; title: string; body: string; session: PostRow['session']; attachmentIds: string[] }, at: Date): Promise<string>`: one transaction; inserts, or updates and sets `edited_at`; points the listed attachments at the post;
    - `get(id: string): Promise<PostRow | null>` (deleted ones too);
    - `feed(cohortId: string | null, limit: number): Promise<PostRow[]>`: not deleted, `cohort_id is null or = cohortId`, `seq` descending;
    - `page(scope: { cohortIds: string[] | 'all'; authorId: string }, before: number | null, limit: number): Promise<PostRow[]>`: not deleted, visible to that staff member, `seq < before`, descending;
    - `softDelete(id: string, staffId: string, at: Date): Promise<void>`;
    - `addAttachment(row: { id: string; uploadedBy: string; mime: AttachmentType; bytes: number }): Promise<void>`; `attachment(id: string): Promise<AttachmentRow | null>`; `markReady(id: string): Promise<void>`; `removeAttachments(ids: string[]): Promise<void>`;
    - `retentionDue(now: Date): Promise<{ attachmentIds: string[]; postIds: string[] }>`: attachments of posts deleted before `now`, unattached ones created more than 24 h before `now`; posts deleted more than 30 days before `now`;
    - `purgePosts(ids: string[]): Promise<void>`.
  - `describePostRepoContract(name, make: () => Promise<ServiceFixture>)` in `testing/post-repo-contract.ts`.

- [ ] **Step 1: Write the failing tests** (contract, memory and Postgres, using `staffWorld`):
  - 31 posts to everyone and 2 to cohort B: `feed(cohortA, 30)` returns the 30 newest to everyone, none of B's, newest first; `feed(null, 30)` the same;
  - `page` with 26 visible posts returns 25 then 1 using the last `seq` as `before`, with no repeat and no gap (more rows than one page, on Postgres);
  - mentor A's `page` holds their own posts, posts to everyone and posts to cohort A, never cohort B's by mentor B; an admin's holds all;
  - a soft-deleted post leaves `feed` and `page` but `get` still returns it with `deletedAt`;
  - `authorName` is the staff name while active and `null` after `staff.save({ …, active: false })`;
  - `retentionDue` at deletion + 23 h lists the deleted post's attachments; an unattached upload at 24 h + 1 min is listed and at 23 h is not; a post deleted 31 days ago is in `postIds`, 29 days ago is not;
  - RLS (`rls.test.ts`, 2 cohorts, 2 students, 2 mentors, real tokens through PostgREST): student A reads cohort-A and everyone posts and no cohort-B post and no deleted post; mentor A reads cohort A, everyone and own, not mentor B's cohort-B post; an admin reads all; a student cannot insert, update or delete a post; anon reads nothing; `post-files` is private (`public = false`);
  - `migrations.test.ts`: the migration runs twice without error and the rollback removes both tables;
  - `learner-data.db.test.ts`: with a post and an attachment present, the all-columns search for a deleted learner's id still finds nothing (posts never hold a learner id).
- [ ] **Step 2: Run** `npm run db:reset && npm run test:db` and `npx vitest run packages/server`. Expected: FAIL.
- [ ] **Step 3: Implement** the migration (idempotent, `if not exists`), the rollback (drop both tables and `can_read_post`; the bucket stays, as in `20261022000003_recordings.down.sql`), `PgPostRepo` (parameterised; attachments loaded in one query per page) and `memoryPostRepo(staff: StaffRepo)`.
- [ ] **Step 4: Run** the gate and `npm run test:db`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(server): community posts and attachments tables with audience RLS`

### Task 3: Uploading an attachment safely

**Files:**

- Create: `packages/server/src/services/attachments.ts`
- Modify: `testing/memory-recording-storage.ts` (`put` takes bytes), `ports.ts` (doc only), `services/limits.ts` (`attachment`, `feed`), `services/audit.ts` (two actions, refused keys), `http/router.ts` (`HandlerDeps.postFiles: ObjectStorage`), `edge-entry.ts`, `supabase/functions/api/index.ts`, `testing/service-contract.ts` (`postFiles: MemoryRecordingStorage`)
- Test: the post-repo contract, `supabase/tests/api.test.ts`

**Interfaces:**

- Consumes: `PostRepo` (Task 2); `sniffAttachment`, `MAX_ATTACHMENT_BYTES`, `uploadStart`, `uploadComplete` (Task 1); `withAudit`, `enforce`, `StaffCaller`.
- Produces:
  - `postFiles = createSupabaseStorage({ url, serviceRoleKey, publicUrl, bucket: 'post-files', upsert: false })` (4b's factory; `recordings` keeps `upsert: true`, unchanged behaviour);
  - `MemoryRecordingStorage.put(path: string, content: number | Uint8Array): void` (`read` returns the bytes put);
  - `attachmentPath = (id: string): string => id`;
  - `startAttachment(deps: AttachmentDeps, staff: StaffCaller, body: UploadStart): Promise<UploadStartResponse>`: `bytes > MAX_ATTACHMENT_BYTES` → `TOO_LARGE`; `enforce(limiter, 'attachment', 'attachment:<staffId>')`; adds a pending row with a server-made uuid; signs the upload; audited `attachment_started`;
  - `completeAttachment(deps, staff, body: UploadComplete): Promise<UploadCompleteResponse>`: the row must be the caller's (`FORBIDDEN` otherwise, same as unknown); size `null` → `INVALID_REQUEST`; size > limit → remove object and row, `TOO_LARGE`; `sniffAttachment(first 12 bytes) !== row.mime` → remove object and row, `BAD_FILE`; else `markReady`, audited `attachment_checked`. Already ready → returns it, no second audit entry and no new write.
  - `AttachmentDeps = { posts: PostRepo; postFiles: RecordingStorage; limiter: RateLimiter; audit: AuditRepo }`.

- [ ] **Step 1: Write the failing tests:**
  - start then `put` a real PNG header and complete: the row is `ready`; one `attachment_started` and one `attachment_checked` entry, details only `attachmentId`, `mime`, `bytes`;
  - declared `image/png` with bytes `4D 5A 90 00` (`.exe`) or `3C 21 64 6F 63` (`<!doc`): `BAD_FILE`, `postFiles.paths()` no longer holds it, the row is gone;
  - `startAttachment` with `bytes: 2_097_153` is `TOO_LARGE` and writes nothing; an object of 2 097 153 bytes behind a smaller declaration is `TOO_LARGE` at complete and removed;
  - completing another staff member's upload is `FORBIDDEN`; completing twice returns the same answer and adds no audit entry;
  - the 51st start in a day is `RATE_LIMITED`;
  - `withAudit` refuses details with a `title`, `body`, `text` or `link` key;
  - api test (real stack): upload a PNG to the signed URL and complete; a **second** PUT to the same URL fails (no upsert); the bucket refuses `text/html` and 2 097 153 bytes whatever was declared; `recordings` still accepts a re-upload (upsert kept).
- [ ] **Step 2: Run** `npx vitest run packages/server` and `npm run test:db`. Expected: FAIL.
- [ ] **Step 3: Implement.** Read the object only after the size check passes, so the server never downloads more than 2 MB.
- [ ] **Step 4: Run** the gate, `npm run test:db`, `npm run functions:build`, then `npm run test:e2e:backend`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(server): check post attachments by size and magic bytes, never overwritable`

### Task 4: Staff write and read posts

**Files:**

- Create: `packages/server/src/services/community.ts`, `packages/server/src/http/community-routes.ts`
- Modify: `http/router.ts` (spread `COMMUNITY_ROUTES`), `services/audit.ts` (three actions)
- Test: the post-repo contract (service cases), `packages/server/test/http.test.ts`

**Interfaces:**

- Consumes: Tasks 1–3; `staffCaller`, `withAudit`, `OrgRepo.cohorts`.
- Produces:
  - `savePost(deps: CommunityDeps, staff: StaffCaller, body: PostRequest): Promise<string>`; `deletePost(deps, staff, body: { id: string }): Promise<void>`; `listStaffPosts(deps, staff, before: number | null): Promise<StaffPostsPage>`; `staffAttachmentUrl(deps, staff, id: string): Promise<{ url: string }>`;
  - `canEditPost(staff: StaffCaller, post: PostRow): boolean` (the caller is the author, the post is not deleted, and a mentor author still holds its cohort; an admin author always may); `canDeletePost(staff, post): boolean` (`canEditPost` or admin);
  - routes: `GET /v1/staff/community/posts?before=`, `POST /v1/staff/community/post`, `POST /v1/staff/community/delete`, `POST /v1/staff/community/upload`, `POST /v1/staff/community/upload/complete`, `GET /v1/staff/community/attachment-url?id=`;
  - `CommunityDeps = AttachmentDeps & { staff: StaffRepo; org: OrgRepo }`.

- [ ] **Step 1: Write the failing tests:**
  - mentor A posts to cohort A; to cohort B or to everyone → `FORBIDDEN`, nothing saved; an admin posts to everyone and to cohort B;
  - mentor B editing or deleting mentor A's post → `FORBIDDEN`, unchanged; an admin deletes it (`post_deleted`); an admin editing it → `FORBIDDEN`;
  - **revocation:** after mentor A is moved off cohort A, their cohort-A post stays in the feed with their name, and their edit or delete is `FORBIDDEN`; after mentor A is paused, every route is `NOT_STAFF` and the feed shows `authorName: null`;
  - an edit replaces the attachment list: a removed attachment's object and row are gone; an id that is pending, another staff member's, or already on another post is `INVALID_REQUEST`;
  - deleting removes the post's objects at once; `staffAttachmentUrl` for them is then `FORBIDDEN`;
  - each write route writes exactly one audit entry, with no title, body or link anywhere in `details`;
  - HTTP: a learner's token on any `/v1/staff/community/*` route is `NOT_STAFF`; `posts?before=abc` is `INVALID_REQUEST`; the response never contains another cohort's post for a mentor.
- [ ] **Step 2: Run** `npx vitest run packages/server`. Expected: FAIL.
- [ ] **Step 3: Implement.** A failed file removal at delete is logged (`postId` only) and left to retention; it never fails the delete.
- [ ] **Step 4: Run** the gate and `npm run test:db`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(server): mentors and admins write, edit and delete community posts`

### Task 5: Students read the feed

**Files:**

- Create: `packages/server/src/services/community-read.ts`
- Modify: `http/community-routes.ts` (two learner routes)
- Test: the post-repo contract, `packages/server/test/http.test.ts`, `supabase/tests/api.test.ts`

**Interfaces:**

- Consumes: `callerLearner`, `requireFeature` (5a), `OrgRepo.cohortOfLearner`, `PostRepo.feed`, `enforce(…'feed'…)`.
- Produces: `getFeed(deps, authUserId: string): Promise<FeedResponse>`; `feedAttachmentUrl(deps, authUserId: string, id: string): Promise<{ url: string }>`; routes `GET /v1/community/feed`, `GET /v1/community/attachment-url?id=`. Order in both: `callerLearner` → `requireFeature(…, 'community_feed')` → scope.

- [ ] **Step 1: Write the failing tests:**
  - a cohort-A student gets everyone and cohort-A posts, not cohort B's, at most 30, newest first; `toCohort` is true only for cohort posts; a student with no cohort gets only everyone posts;
  - a cohort-B student asking for a cohort-A attachment URL gets `FORBIDDEN`, the same as a random uuid; a pending attachment or one of a deleted post is `FORBIDDEN`; an in-audience one gets a URL with a 300-second TTL (memory URL `?ttl=300`);
  - **un-synced phone:** with `community_feed` off for everyone, or overridden off for student A only, both routes answer `FEATURE_OFF` (the phone was never told); student B still reads;
  - a student on a backup code (provider `email`) reads the feed;
  - a deactivated student gets `DEACTIVATED`;
  - **revocation:** after student A moves to cohort B, the cohort-A post leaves their feed and its attachment is `FORBIDDEN`;
  - api test: the URL downloads the uploaded bytes on the real stack; a URL the adapter signs with a 1-second TTL is refused 2 s later (proves the TTL reaches Storage).
- [ ] **Step 2: Run** `npx vitest run packages/server`. Expected: FAIL.
- [ ] **Step 3: Implement.** Filter `attachments` to `ready` ones.
- [ ] **Step 4: Run** the gate, `npm run test:db`, `npm run functions:build` and `npm run test:e2e:backend`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(server): students read their community feed, switch-checked and cohort-scoped`

### Task 6: Retention of post files

**Files:**

- Modify: `packages/server/src/services/retention.ts`, `tooling/admin/commands.ts` (`makeAdminDeps`, `retention` output and `--dry-run`)
- Test: `packages/server/test/retention.db.test.ts`, `tooling/test/admin-cli.db.test.ts`

**Interfaces:**

- Produces: `RetentionDeps` gains `posts: Pick<PostRepo, 'retentionDue' | 'removeAttachments' | 'purgePosts'>` and `postFiles: RecordingStorage`; `runRetention` returns `postFiles: number` and `posts: number` besides its existing counts. Files first, then rows (as for recordings).

- [ ] **Step 1: Write the failing tests:**
  - a post deleted at T with two files whose removal failed: `runRetention(T + 23 h)` removes both objects and rows; running it again changes nothing;
  - an upload started and never attached is removed at 24 h + 1 min, not at 23 h;
  - a deleted post row is purged at 31 days, not at 29; a live post and its files are never touched;
  - `npm run admin -- retention --dry-run` prints `would delete … post files` and deletes nothing; without it, it prints the counts and no id;
  - the backup workflow still runs `retention` without `CODE_PEPPER` (`workflows.test.ts` unchanged and green).
- [ ] **Step 2: Run** `npm run test:db`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the gate and `npm run test:db`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(server): nightly retention removes deleted posts' files within a day`

### Task 7: The phone's feed cache, countdown, links and calendar

**Files:**

- Create: `apps/learner/src/community/feed-cache.ts`, `community/countdown.ts`, `community/links.ts`, `community/calendar-link.ts`, `community/feed-api.ts`
- Modify: `apps/learner/src/api/api-client.ts` (`ApiClient.call: Call`), `runtime/runtime.ts` (`syncLearner` refreshes the feed through a dynamic import), `apps/learner/test/helpers/fake-backend.ts` (community routes come free through `handle`; add `posts` helpers: `postAs(email, body)`)
- Test: `apps/learner/src/community/community.test.ts`, `apps/learner/src/runtime/http-transport.test.ts`

**Interfaces:**

- Consumes: `feedResponse`, `attachmentUrlResponse`, `FEED_CAP` (Task 1); `linkedApi`, `Runtime.events.getMeta/setMeta`, `runtime.clock`.
- Produces:
  - `feedKey(learnerId: string): string` returning `feed:<learnerId>` (so `removeMetaFor` and a deletion wipe clear it);
  - `loadFeed(runtime: Runtime, learnerId: string): Promise<{ savedAt: string | null; posts: FeedPost[] }>`: an unparsable or older-shaped cache gives `{ savedAt: null, posts: [] }`; attachments whose `mime` is not one of the four are dropped;
  - `refreshFeed(runtime: Runtime, api: ApiClient | null, learnerId: string): Promise<'fresh' | 'kept' | 'cleared'>`: `FEATURE_OFF`, `NOT_LINKED`, `FORBIDDEN` → clear; ok → keep the first 30; anything else → keep;
  - `feedApi(api: ApiClient): { feed(): Promise<ApiResult<FeedResponse>>; attachmentUrl(id: string): Promise<ApiResult<{ url: string }>> }` built on `api.call`, so the feed schemas stay out of the first load;
  - `countdown(startsAt: string, minutes: number, now: Date): { kind: 'days'; n: number } | { kind: 'hours'; h: number; m: number } | { kind: 'live' } | { kind: 'over' }`;
  - `linkSegments(text: string): ({ kind: 'text'; text: string } | { kind: 'link'; href: string })[]`: `https://` runs up to whitespace, trailing `.,;:!?)` left as text, each checked with `new URL(…).protocol === 'https:'`;
  - `calendarLink(post: { title: string; session: { startsAt: string; minutes: number; link: string | null } }): string`.

- [ ] **Step 1: Write the failing tests:**
  - `countdown`: start in 2 days 3 h → `{ days, 2 }`; in 90 min → `{ hours, 1, 30 }`; started 10 min ago with 60 min → `live`; ended 1 min ago → `over`; **a cached post 3 days old** read with today's clock → `over` (derived on read, never stored);
  - `calendarLink` for `2026-11-05T10:30:00+05:30`, 60 min, link `https://meet.google.com/abc-defg-hij`: origin and path `https://calendar.google.com/calendar/render`, `action=TEMPLATE`, `dates=20261105T050000Z/20261105T060000Z`, `details` = the link, `text` = the title (a Hindi title round-trips through `searchParams.get`);
  - `linkSegments('देखें https://meet.google.com/abc-defg-hij.')` → text, link, text `'.'`; `javascript:alert(1)`, `http://x.in` and `<script>alert(1)</script>` → one text segment each;
  - `refreshFeed` (fake backend): a cohort-A phone caches the cohort-A post; after the post is deleted the next sync drops it; after `community_feed` is switched off for that student, the next sync clears the cache **even though the phone's cached switches still say on**; offline keeps the cache; 35 posts cache 30;
  - **old phone:** a `feed:<id>` value written as `{ "posts": [{ "id": "…", "title": "x" }] }` (missing fields) loads as empty and is replaced by the next refresh; the existing `pullCursorKey` test stays green (no event type added); `/v1/me` and `/v1/sync/pull` responses parse with schemas copied from `main` before this plan;
  - deleting the learner on request (`fake.deleteLearner`) and syncing leaves no `feed:` key;
  - a sync never fails because the feed refresh failed (the fake answers `INTERNAL`): `SyncResult` is as before.
- [ ] **Step 2: Run** `npx vitest run apps/learner/src/community apps/learner/src/runtime`. Expected: FAIL.
- [ ] **Step 3: Implement.** In `syncLearner`, after `refreshSwitches` and only when `me?.ok`: `await (await import('../community/feed-cache.js')).refreshFeed(runtime, api, learnerId)` inside `try`/`catch`.
- [ ] **Step 4: Run** the gate and `npm run size -w @shiksha/learner-app`. Expected: PASS; the feed code is not in the first-load list.
- [ ] **Step 5: Commit** `feat(app): cache the community feed on the phone, with countdowns and calendar links`

### Task 8: The student's community screen

**Files:**

- Create: `apps/learner/src/screens/community/CommunityScreen.svelte`, `screens/community/PostCard.svelte`, `screens/community/AttachmentButton.svelte`, `screens/home/CommunityCard.svelte`, `apps/learner/src/i18n/community.ts`
- Modify: `router.svelte.ts` (`{ name: 'community' }`, `#/community`), `App.svelte` (`{#await import('./screens/community/CommunityScreen.svelte')}`), `screens/home/HomeScreen.svelte` (the card when `appState.switches.community_feed`), `i18n/index.ts`
- Test: `apps/learner/src/screens/community/community-screen.test.ts`, `apps/learner/src/router.test.ts`

**Interfaces:**

- Consumes: Task 7's functions; `appState.switches`, `appState.brand` (the platform name for a `null` author).
- Produces: strings `communityTitle` ("समुदाय" / "Community"), `communityCard` ("मेंटर की पोस्ट देखें" / "See posts from mentors"), `forCohort` ("आपके समूह के लिए" / "For your cohort"), `edited` ("बदला गया" / "edited"), `days`, `hoursMinutes`, `live`, `over`, `addToCalendar` ("कैलेंडर में जोड़ें" / "Add to calendar"), `joinLink` ("लिंक खोलें" / "Open the link"), `image` ("चित्र {n}" / "Image {n}"), `pdf` ("PDF {n}"), `needsInternet` ("फ़ाइल देखने के लिए इंटरनेट चाहिए" / "You need internet to open the file"), `noPosts` ("अभी कोई पोस्ट नहीं" / "No posts yet"), `featureOff` ("यह सुविधा अभी बंद है" / "This feature is off for now"), `lastUpdated` ("आख़िरी बार {when}" / "Updated {when}").

- [ ] **Step 1: Write the failing tests:**
  - opening `#/community` shows the cached posts at once, then the refreshed ones (stale-while-revalidate), with "आख़िरी बार …";
  - a session post shows the countdown and "कैलेंडर में जोड़ें" whose `href` is `calendarLink(…)`, `target="_blank"`, `rel="noopener noreferrer"`; an ended session shows "हो चुका" and no calendar button;
  - a body `<b>x</b> javascript:alert(1)` renders literally, with no `<b>` element and no link; an `https://` link renders as an `<a>` with `rel="noopener noreferrer"`;
  - tapping "चित्र 1" fetches the URL (only then), turns it into a `blob:` URL and shows an `<img>`; a PDF opens the signed URL in a new tab; offline both say "फ़ाइल देखने के लिए इंटरनेट चाहिए";
  - an author `null` shows the platform name from branding;
  - the home card shows only when `community_feed` is on; `parseRoute('#/community')` is `{ name: 'community' }`;
  - at 360 px a 300-character unbroken title and a 400-character link wrap (`overflow-wrap: anywhere`) with no sideways scroll; tap targets ≥ 44 px.
- [ ] **Step 2: Run** `npx vitest run apps/learner/src/screens/community apps/learner/src/router.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Text and links are Svelte text nodes and `<a>` elements from `linkSegments`; never `{@html}`. Revoke a `blob:` URL when the card unmounts.
- [ ] **Step 4: Run** the gate and `npm run size -w @shiksha/learner-app`. Expected: PASS, first load within 0.8 KB of the ledger figure and ≤ 120 KB, and `CommunityScreen` in its own chunk.
- [ ] **Step 5: Commit** `feat(app): a community screen for students, loaded only when opened`

### Task 9: The staff posts screens

**Files:**

- Create: `apps/learner/src/staff/screens/community/Posts.svelte`, `community/PostForm.svelte`, `community/AttachmentPicker.svelte`, `apps/learner/src/staff/community-i18n.ts`
- Modify: `staff/staff-api.ts` (six calls), `router.svelte.ts` (`{ name: 'staff'; view: 'posts' }`, `#/staff/posts`), `staff/StaffView.svelte`, `staff/StaffNav.svelte` ("पोस्ट")
- Test: `apps/learner/src/staff/community-screens.test.ts`

**Interfaces:**

- Consumes: the Task 4 routes; `staffState.me` (role and cohorts); `sniffAttachment`, `MAX_ATTACHMENT_BYTES`, `ATTACHMENT_TYPES` from `@shiksha/api-contract/staff`; `linkSegments` (Task 7) for the preview; `idleGuard` (unchanged, already on the staff app).
- Produces: `staffApi.posts(before?: number)`, `savePost(body: PostRequest)`, `deletePost(id: string)`, `startUpload(body: UploadStart)`, `completeUpload(id: string)`, `postAttachmentUrl(id: string)`; strings incl. `contentWarning` ("छात्रों के नाम और फ़ोटो पोस्ट न करें।" / "Do not post students' names or photos."), `badFile` ("यह फ़ाइल नहीं चलेगी। सिर्फ़ PNG, JPEG, WebP चित्र या PDF डालें।" / "This file cannot be used. Only PNG, JPEG or WebP images, or a PDF."), `tooLarge` ("फ़ाइल 2 MB से बड़ी है। छोटी फ़ाइल चुनें।" / "The file is over 2 MB. Choose a smaller one."), `badLink` ("लिंक https:// से शुरू होना चाहिए।" / "The link must start with https://."), `everyone` ("सबके लिए" / "Everyone"), `confirmDelete` ("यह पोस्ट हटाएँ? छात्रों को यह नहीं दिखेगी।" / "Delete this post? Students will no longer see it."), `yesDelete` ("हाँ, हटाएँ" / "Yes, delete").

- [ ] **Step 1: Write the failing tests** (fake backend, two cohorts):
  - the compose form always shows the content warning; audience lists only the mentor's cohorts (no "सबके लिए"); an admin also sees "सबके लिए" and every cohort;
  - picking a 3 MB file shows `tooLarge` without calling the server; a file named `photo.png` whose bytes start `MZ` shows `badFile` without calling the server; a server `BAD_FILE` or `TOO_LARGE` shows the same messages and keeps the form;
  - a session link `http://…` shows `badLink`; saving a valid post lists it at the top;
  - delete asks first (4a style: `confirmDelete`, then `yesDelete`), and the post leaves the list; another mentor's post shows neither edit nor delete; an admin sees delete on every post;
  - after 26 posts, "और देखें" loads the 26th;
  - the idle sign-out (fake timer past `STAFF_IDLE_MS`) leaves no draft in `localStorage` or `sessionStorage`;
  - the page works at 360 px and 1024 px with no sideways scroll.
- [ ] **Step 2: Run** `npx vitest run apps/learner/src/staff`. Expected: FAIL.
- [ ] **Step 3: Implement.** Upload: `startUpload` → `api.uploadTo(uploadUrl, bytes, mime)` → `completeUpload`; the client checks are a convenience, the server decides.
- [ ] **Step 4: Run** the gate and `npm run size -w @shiksha/learner-app` (no `/v1/staff/` in the first load). Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): staff compose, edit and delete community posts with attachment checks`

### Task 10: End-to-end, runbook, decision record, worklog and series close-out

**Files:** `apps/learner/e2e/community.spec.ts`, `apps/learner/e2e/backend-setup.ts` (`postsAs` helper if needed), `apps/learner/playwright.config.ts` (`community` in the `chromium-backend` `testMatch` and the `chromium` `testIgnore`), `docs/runbooks/supabase-setup.md`, `docs/decisions/backend-2026-10-23-community-feed.md`, `docs/decisions/README.md`, `WORKLOG.md`, `docs/superpowers/plans/2026-10-23-series-map-plans-4b-to-6b.md`

- [ ] **Step 1: Write the e2e** (`chromium-backend`; see **Traceability** for each screen):
  1. The owner adds an admin and a mentor of cohort A (`ownerAddsStaff`); a cohort-A student and a cohort-B student join with backup codes.
  2. The mentor opens `#/staff/posts`, sees the content warning, posts "अंग्रेज़ी बातचीत सत्र" to cohort A with a session tomorrow at 17:00 IST, a Meet link and a PNG; a renamed `.html` shows `badFile`.
  3. The cohort-A student syncs, opens the home card, sees the post with "1 दिन बाद" or "… घंटे … मिनट में" and "कैलेंडर में जोड़ें" (its `href` checked, not followed), and opens "चित्र 1".
  4. The cohort-B student syncs and sees "अभी कोई पोस्ट नहीं".
  5. The phone goes offline: the cohort-A student still reads the post; "चित्र 1" says it needs internet.
  6. The mentor deletes the post; after sync the cohort-A student no longer sees it, and the old signed image URL no longer downloads.
  7. The admin posts to everyone, then switches `community_feed` off for everyone; after sync both students have no home card and `#/community` shows "यह सुविधा अभी बंद है".
  8. The audit page shows `post_created`, `post_deleted` and `switch_changed`, and no post title.
     Layout checks at 360 px and 1024 px on `#/community` and `#/staff/posts`.
- [ ] **Step 2: Run** `npm run functions:build`, restart `functions:serve`, then `npm run test:e2e:backend`. Expected: PASS.
- [ ] **Step 3: Update the runbook** (new section "Community feed"): the `post-files` bucket comes with `db push`; who may post where; the content warning; retention and the nightly job; how to turn the feed off; that post files are not in the nightly backup _(builder's call, see Notes)_.
- [ ] **Step 4: Write the decision record** `backend-2026-10-23-community-feed.md` (posts plain text; link policy; magic bytes and no-upsert uploads; 300 s URLs fetched on tap; no file names; the phone cache in `meta` with no attachment bytes; the Google Calendar template link instead of `.ics`; authors who leave; `on delete restrict` for cohorts; retention) and its README row. Update `WORKLOG.md`.
- [ ] **Step 5: Series close-out.** In the series map replace the `**Status:**` line with "**Status:** 4b done (PR #…), 5a done (PR #…), 5b done (PR #…), 6a done (PR #…), 6b done (PR #…).", and add below it a `## Pilot dry-run checklist` section listing what the pilot field dry run (spec §12, §13) still needs from the owner:
  - Google Workspace for Nonprofits approved, the internal OAuth app and the NGO domain in place;
  - the Anthropic account with a monthly spend cap, and the key in the function's env;
  - the safeguarding contact email set, and the distress keyword list and helpline wording written with a mentor;
  - the first admin added; labs, cohorts and mentors invited; backup codes issued;
  - guardians' consent collected at enrolment;
  - every ⚑ value of Plans 4b to 6b confirmed;
  - the AI prompt eval set read by the owner and a mentor;
  - device testing on the cheapest cohort phones (1–2 GB RAM, Android Go) and Chrome slow-3G/offline;
  - R2 backup secrets set and `restore-check.sh` run against production once;
  - the field dry run with 3–5 students and one mentor, observed without help, before the full cohort of ~30.
- [ ] **Step 6: Run** the **Definition of done** list. Expected: PASS. **Commit** `docs: runbook, decisions and e2e for Plan 6b; close the 4b–6b series`

---

## Definition of done

From the repo root, all passing, with the output read: `npx prettier --write apps packages tooling supabase` · `npx vitest run` · `npm run typecheck` · `npm run lint` · `npm run format:check` · `npm run test:cov` (≥ 70%) · `npm run test:db` · `npm run test:e2e` · `npm run functions:build` and restart `functions:serve` · `npm run test:e2e:backend` · `npm run size -w @shiksha/learner-app` · `bash tooling/backup/restore-check.sh`. Then one fresh reviewer on the strongest model reads the whole branch with the Review Focus verbatim, one fix pass (every Critical and Important finding gets a failing test first), and a PR from `.github/pull_request_template.md` with the rulings and deferred minors. The owner merges.

## Traceability

| Screen                      | Route                                                 | Response fields used                                                                   |
| --------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Home card                   | none (`/v1/me` switches already cached)               | `switches.community_feed`                                                              |
| `#/community`               | `GET /v1/community/feed`                              | `posts[].title, body, authorName, toCohort, createdAt, editedAt, session, attachments` |
| Attachment button (student) | `GET /v1/community/attachment-url?id=`                | `url`                                                                                  |
| `#/staff/posts` list        | `GET /v1/staff/community/posts?before=`               | `posts[]` (as above) `+ cohortId, canEdit, canDelete`, `next`                          |
| Compose / edit              | `POST /v1/staff/community/post`                       | `id`                                                                                   |
| Attachment picker           | `POST …/upload`, signed PUT, `POST …/upload/complete` | `id, uploadUrl, token`; `id, mime, bytes`                                              |
| Staff attachment preview    | `GET /v1/staff/community/attachment-url?id=`          | `url`                                                                                  |
| Delete confirmation         | `POST /v1/staff/community/delete`                     | `ok`                                                                                   |
| Admin audit (4a)            | `GET /v1/staff/audit`                                 | `entries[].action, details`                                                            |

| e2e step | Screen(s)                                                              |
| -------- | ---------------------------------------------------------------------- |
| 1        | admin CLI; profiles + code sign-in (existing)                          |
| 2        | `#/staff/posts` compose, attachment picker                             |
| 3        | home card → `#/community`, attachment button                           |
| 4        | `#/community` (empty)                                                  |
| 5        | `#/community` offline                                                  |
| 6        | `#/staff/posts` delete confirmation; `#/community`                     |
| 7        | `#/staff/posts` compose; `#/staff/admin/switches`; home; `#/community` |
| 8        | `#/staff/admin/audit`                                                  |

## Personal data and revocation

- **Personal data:** posts and attachments are staff-authored and must hold no student personal data (the content warning; no file names kept). They name staff only (`author_id`, `deleted_by`, `uploaded_by`, `authorName`). The six steps: **export** none for a learner (nothing of theirs is here; Task 2 proves no learner id appears); **delete cascade** a learner's deletion touches nothing here (Task 2's all-columns search); staff rows are paused, not deleted, and the staff FKs are `on delete set null`; **retention** Task 6; **audit anonymisation** entries hold post and attachment ids only; **RLS** Task 2; **RLS test** Task 2 with student and mentor tokens over 2 cohorts.
- **Revocation:** a mentor moved off a cohort or paused → posts stay (author shown as the organisation once paused), editing is refused (Task 4); a student moved → the old cohort's posts leave their feed and URLs are refused (Task 5, Task 7); `community_feed` off → both learner routes refuse and the cache clears at the next sync (Tasks 5, 7, 10); a post deleted → files removed at once, URLs refused, gone from phones at the next sync (Tasks 4, 6, 7); a student deleted on request → the `feed:` cache goes with their meta (Task 7); a student paused → `DEACTIVATED`, the cache stays readable offline.

## What this plan satisfies

| Spec / rule                                                                                     | Task(s)    |
| ----------------------------------------------------------------------------------------------- | ---------- |
| §10.2 mentors and admins post; students read; no student posts or comments                      | 4, 5, 8, 9 |
| §10.2 title, text, session details (date, time, Meet/YouTube/other link), image/PDF attachments | 1, 2, 3, 9 |
| §10.2 session posts: countdown and "Add to calendar" to the student's own Google Calendar       | 7, 8       |
| §10.2 audience everyone or one cohort; mentors edit/delete own; admins delete any               | 2, 4, 9    |
| §10.2 latest posts cached for offline reading; §10 posting needs internet                       | 7, 8, 10   |
| §10.3 `community_posts`, `post_attachments`; posts visible to their audience (RLS)              | 2          |
| §8.1 / §12 feature switch `community_feed`, refused by the server for an un-synced phone        | 5, 7, 10   |
| §11 all errors in plain Hindi, no technical codes                                               | 1, 8, 9    |
| security: attachments ≤ 2 MB, type and size checked, short-lived signed URLs, upload rate limit | 1, 3, 5    |
| security/database: RLS per role, tested with 2 students, 2 mentors, 2 cohorts                   | 2          |
| privacy: no student data in posts, retention defined, nothing personal in logs or audit         | 2, 4, 6, 9 |
| series map rules 1–11 and the series close-out                                                  | all, 10    |

## Notes for the owner

- **The series map's `**Status:**` line** is updated by each merge; Task 10 marks the series done and adds the pilot dry-run checklist.
- **Post files are not in the nightly backup** _(builder's call)_: they are staff-made and can be uploaded again, and `backup.sh` and `restore-check.sh` cover the `recordings` bucket only. Say if you want `post-files` added (a small change to both scripts).
- **No cohort can be deleted** in the app (Plan 4a). The feed's `on delete restrict` means a future "delete cohort" must first delete that cohort's posts; it can never silently turn them into posts for everyone.
- **PDFs can carry scripts.** They open in the phone's own PDF viewer from the storage domain, never inside the app, and only staff can upload them. If you would rather allow images only, drop `application/pdf` from the ⚑ list.
- **Spec §10.3 RLS wording** says "posts are visible to their audience"; this plan also lets a mentor see their own posts and all posts to everyone, so they can manage them.

## ⚑ Values to confirm

| ⚑                                 | Recommended                                                                          | Where                      |
| --------------------------------- | ------------------------------------------------------------------------------------ | -------------------------- |
| Allowed attachment types and size | PNG, JPEG, WebP, PDF; ≤ 2 MB (security rule); up to 4 per post (builder's call)      | Global Constraints, Task 1 |
| Who may post to everyone          | Admins only; mentors to their own cohorts only                                       | Task 4                     |
| Phone cache size                  | The newest 30 posts; no attachment bytes offline                                     | Task 7                     |
| Retention of deleted posts' files | Removed at delete, and by the nightly job within 24 h; unattached uploads after 24 h | Task 6                     |
| Retention of deleted post rows    | 30 days after deletion (builder's call); live posts kept until deleted               | Task 6                     |
