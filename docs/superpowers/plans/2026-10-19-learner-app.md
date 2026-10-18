# Learner App Implementation Plan (Plan 2b)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An installable, offline-first PWA (`apps/learner`) in which a learner picks or creates a profile with a PIN, gets the lesson packs onto the phone, and completes the daily loop (home → lesson text and audio → practice with feedback → finish), plus review sessions and module test-outs, with every action saved on the phone as events.

**Architecture:** A thin Svelte 5 UI over `@shiksha/learner-core`. All logic (scoring, progress, sync, PIN, outbox) already lives in the core; this plan adds the browser adapters for its ports (IndexedDB via Dexie, `fetch`, `navigator.storage`), a small runtime that wires them together, a hash router, and the screens. The service worker precaches the app shell only; lesson packs live in IndexedDB through the core's verified installer, so they are never cached twice. There is no server yet: the outbox transport reports "will upload later" until Plan 3.

**Tech Stack:** Svelte 5 + Vite + TypeScript, Dexie, `vite-plugin-pwa`, Vitest + `@testing-library/svelte` + jsdom + `fake-indexeddb` for tests, Playwright for the offline scenario, self-hosted fonts (`@fontsource/mukta`, `@fontsource/baloo-2`).

**Spec:** `docs/superpowers/specs/2026-10-15-learning-platform-design.md` (§4, §5.2, §5.3, §5.4, §6.1, §6.2, §6.7, §7.1, §7.3, §11, §12). Screens follow the approved design canvas (home, lessons, learn, practice, finish, profiles).

**Requires:** PR #7 (Plan 2a) merged. Branch `feature/learner-app` from `main`.

### Plan series

- **Plan 2a: learner core** (merged).
- **Plan 2b: learner app** (this plan): app shell, adapters, profiles and PIN, home, lessons list and downloads, lesson, practice, review, test-out, finish, PWA, offline end-to-end test.
- **Plan 2c: learner app, part 2:** placement test screens, speaking recording capture, the "me" screen (language preference, storage and removed modules, switch profile), tablet and desktop layouts, installable-app nudges.
- **Plan 3:** backend and sync. **Plan 4:** mentor view and admin. **Plan 5:** AI. **Plan 6:** mentor connect and community.

**Not in this plan:** placement screens, microphone capture (speak-and-compare items show the model audio and a "next" button that records an `unscored` answer), doubts and helplines (Plan 5), Google sign-in and the real sync transport (Plan 3), mentor and community tabs (Plans 4 and 6), a locked-lesson state (the core never locks lessons).

## Global Constraints

Everything marked _(builder's call)_ is a product decision the spec leaves open; the owner can overrule it before building starts.

- **Stack (spec §5.4):** Svelte + Vite + TypeScript; IndexedDB via Dexie; service worker via `vite-plugin-pwa` (Workbox). New dependencies each need a reason in the PR: `svelte`, `vite`, `@sveltejs/vite-plugin-svelte` (framework); `dexie` (IndexedDB); `vite-plugin-pwa` (service worker and manifest); `@fontsource/mukta`, `@fontsource/baloo-2` (self-hosted Hindi-capable fonts, SIL OFL); dev only: `svelte-check`, `eslint-plugin-svelte`, `jsdom`, `@testing-library/svelte`, `fake-indexeddb`, `@playwright/test`. Install the versions `npm view` reports at build time; if a peer range conflicts (for example the PWA plugin and Vite) rule on the smallest fix and ledger it.
- **Core boundary:** the app talks to the core only through its public exports and ports; it never reimplements scoring, progress, review or sync logic. The core stays DOM-free.
- **Offline first (spec §5.2, §11, offline-sync rule):** every screen works with the network off once content is installed; nothing blocks on the network; no screen shows a raw error, stack trace or technical code, only a message from the strings catalogue; sync failure shows "saved on phone, will upload later" (`फ़ोन में सेव · इंटरनेट मिलते ही अपलोड`, copy from the design).
- **Hindi first (spec §6.2, §6.7):** interface language is `hi` for `hi_en` learners and `en` for `en_only` learners (`uiLang`). Lesson text language follows the core's `languageView`. Every string exists in `hi` and `en`; a test fails when either is empty. The Hindi copy in this plan is a draft: a mentor reads all strings before the field dry run (spec §12).
- **Fonts and tokens (design canvas):** Baloo 2 700 for headings, Mukta 400/500/600 for body, loaded from the package, never from Google at runtime. Colours: primary `#2F3AB2`, ink `#1B1F3B`, muted `#5B6175`, background `#F4F5FA`, card `#FFFFFF`, line `#E3E5EE`, correct `#146C35` on `#E7F5EC`, wrong `#B42318` on `#FDECEA`, streak `#E8890C`. Radii 12–20 px. Tokens live once, as CSS variables in `src/styles/tokens.css`.
- **Touch and access:** every tappable element ≥ 44 × 44 px; real `<button>` and `<a>`, never `role` on a div; icon-only buttons have `aria-label` (Hindi); text contrast ≥ 4.5:1; no horizontal scrolling at 360 px width.
- **Size budget** _(builder's call, spec §5.4 "small bundles for 1–2 GB RAM phones")_: the JavaScript needed on first load ≤ **120 KB gzipped**, checked by a script after the build.
- **Content hosting (spec §5.4):** lesson packs are static files at `VITE_CONTENT_BASE_URL` (default `/content`), served beside the app (Cloudflare Pages in production). The service worker must never cache or answer `/content/` requests.
- **Privacy (privacy rule):** the only personal data the app stores is the learner's first name and PIN hash, on the phone. Nothing personal goes in URLs, logs or events beyond the profile id. No `console.*`.
- **Storage:** request persistent storage once, when the first profile is created; nudge sync after each lesson.
- **Limits:** Plan 0 limits apply; Svelte files ≤ 200 lines; strings files ≤ 300 lines; coverage ≥ 70%.

## Review Focus

1. **Cold start offline and reload mid-lesson.** After one online visit, opening the app with the network off (new tab, reload, mid-lesson reload) must show the PIN screen and the installed lessons. Task 14 and Task 15.
2. **Damaged or cleared IndexedDB.** A stored manifest or bundle that fails its schema, or audio the browser removed, must read as "not installed" (the learner sees a download button), never a blank screen or exception. Task 3, Task 9.
3. **Double taps and Back mid-run.** Tapping an answer twice, tapping "next" twice, or pressing Back during a run must record each item once and never lose or duplicate a completion. Task 12.
4. **Hindi at 360 px.** A 40-character Devanagari name, long lesson titles and the largest strings must not overflow or hide a button. Task 6 and Task 15 (viewport check on every screen).
5. **Content updated under an open session.** A sync that replaces a module while a lesson is open must not break the run in progress; the next screen sees the new content. Task 5 and Task 12.

---

### Task 1: App workspace, tooling and test setup

**Files:**

- Create: `apps/learner/package.json` (`@shiksha/learner-app`, private, type module; scripts `dev`, `build`, `preview`, `typecheck` = `svelte-check --tsconfig ./tsconfig.json`), `apps/learner/{vite.config.ts,svelte.config.js,tsconfig.json,index.html}`, `apps/learner/src/{main.ts,App.svelte}`, `apps/learner/src/styles/tokens.css`, `docs/decisions/app-2026-10-19-svelte-dexie.md`
- Modify: root `vitest.config.ts` (compile `.svelte` and `.svelte.ts`, browser export conditions, `include` already covers `apps/**/*.test.ts`), `eslint.config.js` (Svelte flat config; `**/*.svelte` file limit 200 lines; ignore `apps/*/dist`, `apps/*/public/content`), `packages/learner-core/package.json` (add the `exports` `./test-helpers/content-fixture`, `./test-helpers/serve-build`, `./test-helpers/session-env` pointing at `test/helpers/*.ts`, so app tests reuse the core's fixtures), `.gitignore` (`apps/learner/dist`, `apps/learner/public/content`), root `package.json` (`"app:content": "tsx packages/content/src/cli.ts --out apps/learner/public/content"`)
- Test: `apps/learner/src/App.test.ts`, `tooling/test/eslint-limits.test.ts` (extend)

**Interfaces:**

- Produces: a workspace the other tasks add files to; `App.svelte` default export mounted by `main.ts` into `#app`; tests may start with `// @vitest-environment jsdom`.

- [ ] **Step 1: Write the failing tests.** `App.test.ts` mounts `App` with `@testing-library/svelte` and finds an element with `data-testid="app-root"`. The ESLint test asserts `calculateConfigForFile('apps/learner/src/A.svelte')` has `max-lines` 200 and that `a.ts` in the same folder keeps 300.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** the scaffold. `index.html` has `lang="hi"`, `<meta name="viewport" content="width=device-width, initial-scale=1">`, `<div id="app">`. `tsconfig.json` extends the base with `lib: ["ES2023", "DOM", "DOM.Iterable"]`. Write the decision record (Svelte and Dexie chosen per spec §5.4; Realtime and SSR not used).
- [ ] **Step 4: Run** `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check`, and `npm run build -w @shiksha/learner-app`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): scaffold the Svelte learner app`

---

### Task 2: Strings catalogue and error messages

**Files:**

- Create: `apps/learner/src/i18n/{index.ts,common.ts,errors.ts}`
- Test: `apps/learner/src/i18n/i18n.test.ts`

**Interfaces:**

- Consumes: `ErrorCode`, `ERROR_CODES`, `LanguagePreference` from `@shiksha/learner-core`; `Localized` from `@shiksha/content/schema`.
- Produces:
  - `type Lang = 'hi' | 'en'`; `uiLang(pref: LanguagePreference): Lang` (`en_only` → `en`, else `hi`)
  - Each screen file exports `const <screen>Strings = { key: { hi, en } } satisfies Record<string, Localized>`; `index.ts` spreads them into `STRINGS`, exports `type StringKey = keyof typeof STRINGS`
  - `t(key: StringKey, lang: Lang, params?: Record<string, string | number>): string` replaces `{name}` placeholders; an unknown placeholder stays as written
  - `errorMessage(code: ErrorCode, lang: Lang, details?: Record<string, unknown>): string`

Later tasks add their keys in their own `i18n/<screen>.ts` file and spread it in `index.ts`; the catalogue test covers them automatically.

Error copy (draft, mentor to review):

| Code                   | hi                                                                               | en                                                                      |
| ---------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `LOW_STORAGE`          | फ़ोन में जगह कम है। कुछ पूरे हो चुके पाठ हटाकर फिर कोशिश करें।                   | Not enough space on this phone. Remove finished lessons and try again.  |
| `DOWNLOAD_FAILED`      | डाउनलोड पूरा नहीं हुआ। इंटरनेट मिलने पर फिर कोशिश करें – जितना हुआ है वह बचा है। | The download did not finish. Try again with internet; progress is kept. |
| `BUNDLE_CORRUPT`       | यह पाठ ठीक से डाउनलोड नहीं हुआ। फिर से डाउनलोड करें।                             | This lesson did not download correctly. Download it again.              |
| `BUNDLE_TOO_LARGE`     | यह फ़ाइल उम्मीद से बड़ी है, इसलिए रोक दी गई। फिर कोशिश करें।                     | This file is larger than expected, so it was stopped. Try again.        |
| `MANIFEST_UNAVAILABLE` | पाठों की सूची अभी नहीं मिली। इंटरनेट से जुड़कर फिर कोशिश करें।                   | Could not get the lesson list. Connect to the internet and try again.   |
| `MODULE_NOT_READY`     | यह पाठ अभी इस फ़ोन में नहीं है। पहले डाउनलोड करें।                               | This lesson is not on this phone yet. Download it first.                |
| `PIN_INVALID`          | PIN में ठीक 4 अंक होने चाहिए।                                                    | The PIN must be exactly 4 digits.                                       |
| `PIN_WRONG`            | PIN गलत है। {attemptsLeft} कोशिशें बाकी हैं।                                     | Wrong PIN. {attemptsLeft} tries left.                                   |
| `PIN_LOCKED`           | बहुत बार गलत PIN डाला। {retryAfterSec} सेकंड बाद फिर कोशिश करें।                 | Too many wrong PINs. Try again in {retryAfterSec} seconds.              |
| `NAME_INVALID`         | नाम 1 से 40 अक्षरों का होना चाहिए।                                               | The name must be 1 to 40 characters.                                    |
| `PROFILE_NOT_FOUND`    | यह प्रोफ़ाइल इस फ़ोन में नहीं मिली।                                              | This profile was not found on this phone.                               |

- [ ] **Step 1: Write the failing tests.** Every `STRINGS` entry has non-empty `hi` and `en` (iterate all keys); every `ERROR_CODES` member has a message in both languages; `errorMessage('PIN_LOCKED', 'hi', { retryAfterSec: 30 })` contains `30`; `t` fills `{name}`, leaves `{unknown}`; `uiLang('en_only')` is `en`, `uiLang('hi_en')` is `hi`; a Devanagari string survives unchanged (NFC compare).
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** the files above; `common.ts` holds `app.name` (`शिक्षा पथ` / `Shiksha Path`), `action.next`, `action.back`, `action.start`, `action.download`, `status.saved`, `status.savedLater`.
- [ ] **Step 4: Run** all checks. Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): add the Hindi and English strings catalogue`

---

### Task 3: IndexedDB adapters for lesson packs

**Files:**

- Create: `apps/learner/src/storage/{db.ts,idb-bundle-storage.ts,idb-partial-store.ts,estimator.ts}`
- Test: `apps/learner/src/storage/bundle-storage.test.ts`

**Interfaces:**

- Consumes: `BundleStorage`, `PartialStore`, `StorageEstimator`, `describeBundleStorage` (`@shiksha/learner-core`, `/testing`); `manifestSchema`, `moduleBundleSchema`, `placementBundleSchema` (`@shiksha/content/schema`); `fake-indexeddb/auto` in tests.
- Produces:
  - `class ShikshaDb extends Dexie` (`constructor(name = 'shiksha')`) with tables `manifest`, `modules`, `placement`, `audio`, `partials`, `events`, `sent`, `meta`, `profiles` (Task 4 uses the last four; schema versioned with `db.version(1)`)
  - `class IdbBundleStorage implements BundleStorage` (`constructor(db: ShikshaDb)`), `class IdbPartialStore implements PartialStore`
  - `browserStorageEstimator(api?: Pick<StorageManager, 'estimate'> | undefined): StorageEstimator` (`null` when the API or its numbers are missing, or it throws)

Reads of manifest, module and placement parse the stored value with the shared schemas and return `null` when it fails to parse (damaged record = not installed). Audio is stored as `Uint8Array`.

- [ ] **Step 1: Write the failing tests.** `describeBundleStorage('IdbBundleStorage', …)` with a fresh `new ShikshaDb(uniqueName)` per test; a `PartialStore` round trip; **a manifest, a module and a placement record written directly into the table with a wrong shape read back as `null`** (Review Focus 2); `browserStorageEstimator` returns `{ quota, usage }`, and `null` for `undefined`, for a missing `quota`, and for an `estimate()` that rejects.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** all checks. Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): add IndexedDB storage for lesson packs`

---

### Task 4: IndexedDB adapters for events and profiles

**Files:**

- Create: `apps/learner/src/storage/{idb-event-store.ts,idb-profile-store.ts}`
- Test: `apps/learner/src/storage/event-profile-store.test.ts`

**Interfaces:**

- Consumes: `EventStore`, `ProfileStore`, `describeEventStore`, `describeProfileStore`, `LearnerEvent`, `Profile`; `ShikshaDb` (Task 3).
- Produces: `class IdbEventStore implements EventStore` (`constructor(db: ShikshaDb)`; `events` table keyed by `id` with an auto-increment `seq` index for append order; `sent` table of acknowledged ids; `meta` table for `getMeta`/`setMeta`), `class IdbProfileStore implements ProfileStore`.

- [ ] **Step 1: Write the failing tests.** Both contract suites pass; appending the same id from two concurrent calls stores one event; events survive closing and reopening the database (`db.close()`, new `ShikshaDb` with the same name); `pending` stays in append order after a reopen.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Make `append` one transaction (`add`, ignoring Dexie's `ConstraintError`).
- [ ] **Step 4: Run** all checks. Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): add IndexedDB storage for events and profiles`

---

### Task 5: Browser fetcher, content service and runtime

**Files:**

- Create: `apps/learner/src/runtime/{fetcher.ts,prefs.ts,content-service.ts,persistence.ts,auto-sync.ts,transport.ts,runtime.ts}`
- Test: `apps/learner/src/runtime/runtime.test.ts`

**Interfaces:**

- Consumes: core ports and functions (`Fetcher`, `syncContent`, `fetchMissingAudio`, `removeModuleContent`, `flushOutbox`, `LearnerSession`, `systemClock`, `cryptoIds`, `CoreError`, `ErrorCode`); Task 3 and 4 adapters.
- Produces:
  - `createFetcher(fetchFn?: typeof fetch, opts?: { timeoutMs?: number }): Fetcher` (default 30_000 ms; sends `Range: bytes=from-to`; returns `{ status, bytes }`; rejects on network error or timeout; passes other statuses through)
  - `class Prefs` (`constructor(db: ShikshaDb)`): `removedModules(): Promise<Set<string>>`, `markRemoved(id)`, `clearRemoved(id)` (stored in `meta`)
  - `type ContentResult<T> = { ok: true; value: T } | { ok: false; error: ErrorCode }`
  - `class ContentService`: `sync(): Promise<ContentResult<SyncReport>>`, `fetchAudio(moduleId): Promise<ContentResult<{ fetched: number }>>`, `remove(moduleId): Promise<ContentResult<{ removedAudio: number }>>` (marks the module removed), `restore(moduleId): Promise<ContentResult<SyncReport>>` (clears the mark, then syncs), `busy: boolean`, `subscribe(listener: () => void): () => void`. **Operations run one at a time** (a second call waits for the first) so a sync can never overlap a removal (closes deferred review finding I6). `sync` passes `skipModules` from `Prefs`; a `CoreError` becomes `{ ok: false, error: code }`.
  - `requestPersistence(api?: Pick<StorageManager, 'persist'>): Promise<boolean>` (false when unsupported)
  - `startAutoSync(deps: { content: ContentService; flush: () => Promise<unknown>; target: Pick<EventTarget, 'addEventListener' | 'removeEventListener'> }): () => void` (syncs and flushes once on start and on every `online` event; the returned function removes the listener)
  - `noServerTransport: SyncTransport` (every `push` rejects; Plan 3 replaces it)
  - `createRuntime(opts?: { dbName?: string; contentBaseUrl?: string; fetchFn?: typeof fetch }): Runtime` with `Runtime = { storage; events; profiles; partials; clock; ids; prefs; content; openSession(profileId: string): Promise<LearnerSession>; syncStatus(learnerId: string): Promise<{ lastSyncedAt: string | null; pending: number }>; flush(learnerId: string): Promise<FlushResult> }`. `contentBaseUrl` defaults to `import.meta.env.VITE_CONTENT_BASE_URL ?? '/content'`.

- [ ] **Step 1: Write the failing tests.** Fetcher: sends the Range header, maps 206 and 200, returns a 404 status as is, rejects when `fetchFn` throws, aborts and rejects after `timeoutMs` (fake timers). `ContentService`: two overlapping calls run in order (the second starts only after the first resolves); `sync` skips modules in `Prefs`; `remove` then `sync` leaves the module removed, `restore` brings it back; a `MANIFEST_UNAVAILABLE` becomes `{ ok: false, error }`; `subscribe` fires when `busy` changes. `startAutoSync` runs once at start and again on a dispatched `online` event, and stops after the returned function is called. `requestPersistence` returns false for `undefined`. `syncStatus` reports pending event count and `lastSyncedAt`. **An open session keeps working while a sync replaces a module** (Review Focus 5): open a session, run `sync` against a rebuilt fixture, the old session's current run still answers; a new `openSession` sees the new version. (Use `@shiksha/learner-core/test-helpers/*`.)
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** all checks. Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): add the browser runtime, content service and auto-sync`

---

### Task 6: Router, app state, shell and styles

**Files:**

- Create: `apps/learner/src/{router.svelte.ts,app-state.svelte.ts,activity.svelte.ts}`, `apps/learner/src/ui/{Shell.svelte,NavBar.svelte,Icon.svelte}`, `apps/learner/src/i18n/shell.ts`; modify `App.svelte`, `main.ts`, `styles/tokens.css`
- Test: `apps/learner/src/router.test.ts`, `apps/learner/src/app-state.test.ts`

**Interfaces:**

- Consumes: `Runtime` (Task 5), `LearnerSession`, `t`, `uiLang`.
- Produces:
  - `type Route = { name: 'profiles' } | { name: 'home' } | { name: 'lessons' } | { name: 'learn'; lessonId: string } | { name: 'practice' } | { name: 'finish' }`; `parseRoute(hash: string): Route` (unknown or empty → `home`; `learn` ids must match `/^[a-z0-9-]+$/`, else `home`); `routeHref(route: Route): string` (`#/…`); `navigate(route: Route): void`; reactive `router.current: Route`
  - `appState` (rune state): `{ runtime: Runtime | null; profile: { id: string; name: string } | null; session: LearnerSession | null; lang: Lang }`; `signIn(profileId: string, pin: string): Promise<void>` (calls core `verifyPin`, opens the session, sets `lang` from the log's language preference; rejects with the `CoreError`), `signOut(): void` (clears profile, session and activity), `refreshSession(): Promise<void>` (reopens the session only when no activity is running)
  - `Activity = { kind: 'lesson'; lesson: BundleLesson; run: QuizRun; view: LanguageView } | { kind: 'review'; run: QuizRun } | { kind: 'test_out'; moduleId: string; passMark: number; run: QuizRun }`; `activity.current: Activity | null`, `activity.finish: FinishInfo | null` where `FinishInfo = { kind: Activity['kind']; summary: QuizSummary; streak: { current: number; activeToday: boolean }; testOut?: { score: number; passed: boolean }; lessonTitle?: Localized }`
  - `Shell.svelte` (page frame with bottom `NavBar`: होम / पाठ, only when signed in), `Icon.svelte` (`name: 'home' | 'book' | 'flame' | 'check' | 'close' | 'speaker' | 'arrow' | 'back'`, decorative `aria-hidden`)

`App.svelte` renders the route; with no `appState.profile` any route except `profiles` redirects to `profiles`. After a restart the app always asks for a PIN (the signed-in profile is held in memory only).

- [ ] **Step 1: Write the failing tests.** `parseRoute('#/learn/ef1-01')`, `'#/practice'`, `''`, `'#/nonsense'`, `'#/learn/../../x'` (→ home); `routeHref` round trips every route; `signIn` with the right PIN opens a session and sets the name; a wrong PIN rejects with `PIN_WRONG` and leaves `profile` null; two profiles signed in one after the other never share `session` or `activity` (**shared phone**); `signOut` clears activity; unauthenticated navigation to `home` renders the profiles route.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Import `@fontsource/mukta` (400, 500, 600) and `@fontsource/baloo-2` (600, 700) from `main.ts`, keeping only the `latin` and `devanagari` subsets that the packages offer; tokens from the Global Constraints.
- [ ] **Step 4: Run** all checks. Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): add routing, app state and the shell`

---

### Task 7: Profiles and PIN screens

**Files:**

- Create: `apps/learner/src/screens/profiles/{ProfilesScreen.svelte,PinPad.svelte,CreateProfile.svelte}`, `apps/learner/src/i18n/profiles.ts`
- Test: `apps/learner/src/screens/profiles/profiles.test.ts`

**Interfaces:**

- Consumes: `appState`, `signIn`, `createProfile`, `ProfileStore` via `Runtime`, `errorMessage`, `t`, `navigate`.
- Produces:
  - `PinPad.svelte`: props `{ lang: Lang; onsubmit: (pin: string) => void; disabled?: boolean; error?: string }`; 4 dots, keypad 1–9, 0 and ⌫ (labels in Hindi via `aria-label`), submits automatically on the 4th digit
  - `ProfilesScreen.svelte`: lists profiles (initial in a coloured circle, first name), "नया जोड़ें", PIN pad for the selected profile; with no profiles it shows `CreateProfile` directly. A locked profile shows the `PIN_LOCKED` message with a live countdown (seconds, updated each second) and disables the pad until it ends.
  - `CreateProfile.svelte`: name field (`maxlength` 40), PIN pad twice (enter, confirm), a language choice (`हिंदी + English` default / `English only`), then calls core `createProfile`, records the choice with a `language_changed` event, requests persistent storage once, signs in and navigates to `home`.

Strings draft: title `कौन पढ़ रहा है?` / `Who is learning?`; PIN prompt `{name}, अपना 4 अंकों का PIN डालें` / `{name}, enter your 4-digit PIN`; footnote `PIN सिर्फ़ इस फ़ोन पर है – भाई-बहन एक-दूसरे की प्रोग्रेस नहीं बदल सकते` / `The PIN stays on this phone and keeps each person's progress separate`.

- [ ] **Step 1: Write the failing tests.** Correct PIN signs in and navigates home; wrong PIN shows the Hindi `PIN_WRONG` text with attempts left and clears the dots; five wrong PINs show the lock message with the seconds, the pad is disabled, and after the (fake) timer elapses it is enabled again; creating a profile with an empty name or a 41-character name shows the `NAME_INVALID` text; non-matching confirm PIN shows a mismatch message and restarts the confirm step; creating with `English only` writes a `language_changed` event and the interface switches to English; **a 40-character Devanagari name** renders in the picker inside a truncating container (`min-width: 0`, `text-overflow: ellipsis`; the real overflow check is the viewport test in Task 15); with no profiles the create form is shown first.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** with a single shared "which step" state per screen; no PIN is written to the DOM except as dot count.
- [ ] **Step 4: Run** all checks. Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): add profile picker, PIN pad and profile creation`

---

### Task 8: Home screen

**Files:**

- Create: `apps/learner/src/screens/home/{HomeScreen.svelte,SyncChip.svelte,TodayCard.svelte}`, `apps/learner/src/i18n/home.ts`
- Test: `apps/learner/src/screens/home/home.test.ts`

**Interfaces:**

- Consumes: `appState.session` (`todayLesson`, `streak`, `trackProgress`, `reviewDue`), `Runtime.syncStatus`, `Runtime.content`, `activity`, `navigate`.
- Produces: `HomeScreen.svelte` with: greeting `नमस्ते, {name}` / `Hello, {name}`; `SyncChip` (props `{ lastSyncedAt: string | null; pending: number; now: Date; lang }`: all saved shows `सब सेव है · {minutes} मिनट पहले`, otherwise `फ़ोन में सेव · इंटरनेट मिलते ही अपलोड`); streak card (`{n} दिन`, seven day dots); progress card per track with `done / total`; "आज का पाठ" card (lesson title in the learner's language, "शुरू करें" starts the lesson via `session.startLesson`, stores the `Activity`, navigates to `learn`); a review card `दोहराने के लिए {n} सवाल` when `reviewDue().length > 0`, which calls `session.startReview()` and navigates to `practice`; when no lesson is playable yet, a "पाठ डाउनलोड करें" card that calls `content.sync()`, with the mapped error text below it on failure; when everything is done, a "सब पाठ पूरे" card.

- [ ] **Step 1: Write the failing tests** (installed fixture, real session): shows today's lesson title and starts it (activity set, route `learn`); with no content installed shows the download card and, when `sync` fails with `MANIFEST_UNAVAILABLE`, the Hindi message; a due review shows its count and starts a review run, and no card when none is due; sync chip text for synced, never synced and pending cases; streak and progress numbers match the session; all lessons done shows the completion card; **a stored module that fails validation (Task 3) shows the download card, not an error** (Review Focus 2).
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** all checks. Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): add the home screen`

---

### Task 9: Lessons list and module downloads

**Files:**

- Create: `apps/learner/src/screens/lessons/{LessonsScreen.svelte,ModuleCard.svelte}`, `apps/learner/src/i18n/lessons.ts`
- Test: `apps/learner/src/screens/lessons/lessons.test.ts`

**Interfaces:**

- Consumes: `session` (`progress`, `trackProgress`, `startLesson`, `startTestOut`), `Runtime.storage` + core `isModuleReady`/`isModulePlayable`, `Runtime.content`, `appState.lang`.
- Produces: `LessonsScreen.svelte` with track tabs (English / Aptitude; titles from the manifest), a module card (name, `done / total`, progress bar), and rows per lesson with state **done** (✓), **today** (▶, highlighted) or **open**, and a final "Test-out quiz" row (`पास करें तो module पूरा`). Tapping a lesson starts it (`startLesson`) and goes to `learn`; the test-out row calls `startTestOut` and goes to `practice`. A module that is not playable shows a download button instead (calls `content.sync()`; spinner while `content.busy`; failures show the mapped message, `LOW_STORAGE` mentions the free space). A ready module with all lessons done offers `जगह खाली करें` with a confirmation (calls `content.remove`); a removed module shows `फिर से डाउनलोड करें` (calls `content.restore`). A playable module whose audio is missing shows a small `ऑडियो डाउनलोड करें` link (calls `content.fetchAudio`).

- [ ] **Step 1: Write the failing tests:** rows reflect done/today/open from the log; tapping an open lesson starts it; the test-out row starts a test-out activity; an uninstalled module shows the download button and a successful `sync` replaces it with rows; `LOW_STORAGE` shows its message; removing a finished module asks for confirmation, then shows the restore button, and `restore` brings the rows back; missing audio shows the audio link and `fetchAudio` removes it; a damaged module record shows the download button.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** all checks. Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): add the lessons list with downloads and removal`

---

### Task 10: Lesson screen and audio

**Files:**

- Create: `apps/learner/src/screens/learn/{LearnScreen.svelte,AudioButton.svelte}`, `apps/learner/src/audio/audio-source.ts`, `apps/learner/src/i18n/learn.ts`
- Test: `apps/learner/src/screens/learn/learn.test.ts`

**Interfaces:**

- Consumes: `activity.current` (`kind: 'lesson'`), `Runtime.storage.getAudio`, `Runtime.content.fetchAudio`, `languageView`/`LanguageView` (the activity carries `view`).
- Produces:
  - `audioObjectUrl(storage: BundleStorage, path: string): Promise<{ url: string; revoke(): void } | null>` (`null` when the file is not stored; wraps the bytes in a `Blob` typed from the extension: mp3 → `audio/mpeg`, m4a → `audio/mp4`, ogg and opus → `audio/ogg`, webm → `audio/webm`)
  - `AudioButton.svelte` props `{ storage: BundleStorage; path: string | undefined; label: string; onmissing?: () => void }`: a 52 px button with `aria-label`; plays on tap and revokes the URL when playback ends or the component is destroyed; with no `path` it renders nothing; with a missing file it shows `ऑडियो डाउनलोड करें`
  - `LearnScreen.svelte`: the lesson `title` and `html` in the primary language, a toggle button for the other language when `view.toggle` is not null (`English में देखें` / `हिंदी में देखें`), the lesson's audio for the shown language, and a `practice` button (`अभ्यास करें`) that navigates to `practice`; a back button returns to `lessons`. The HTML comes from a hash-verified bundle built by our own pipeline, so it is rendered with `{@html}` behind one documented `eslint-disable-next-line svelte/no-at-html-tags -- <reason>`.

- [ ] **Step 1: Write the failing tests.** `audioObjectUrl` returns `null` for a missing path and a Blob URL typed `audio/mpeg` for an `.mp3` (stub `URL.createObjectURL`); toggling language swaps the shown HTML; `en_only` view shows no toggle; the audio button plays (stub `HTMLMediaElement.prototype.play`) and revokes the URL on `ended`; missing audio shows the download link and calls `fetchAudio`; **no activity (page reload) redirects to `lessons`** instead of rendering nothing.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** all checks. Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): add the lesson screen with audio`

---

### Task 11: Practice item views

**Files:**

- Create: `apps/learner/src/screens/practice/items/{registry.ts,ChoiceView.svelte,FillBlankView.svelte,WordOrderView.svelte,SpeakView.svelte}`, `apps/learner/src/i18n/practice.ts`
- Test: `apps/learner/src/screens/practice/items/items.test.ts`

**Interfaces:**

- Consumes: `PracticeItem`, `Answer` (core), `shuffleWords`, `AudioButton` (Task 10), `pickText`.
- Produces:
  - Every view takes props `{ item: <its item type>; lang: Lang; storage: BundleStorage; seed: string; locked: boolean; onanswer: (answer: Answer) => void }`. `locked` disables input after the answer.
  - `registry.ts`: `const ITEM_VIEWS: { [K in PracticeItem['type']]: Component<…> }` typed so a new item type without a view fails to compile (spec §14)
  - `ChoiceView` (types `mcq_meaning`, `listen_choose`, `aptitude`): prompt, optional audio button for `listen_choose`, option buttons lettered A–D (≥ 56 px high), tapping calls `onanswer({ kind: 'choice', optionId })` once
  - `FillBlankView`: the sentence with an input in place of `___`, a check button; `onanswer({ kind: 'text', value })`; empty input keeps the button disabled
  - `WordOrderView`: the shuffled word bank (`shuffleWords(item.words, seed)`), tapping a word moves it to the sentence tray, tapping it in the tray returns it, a check button enabled when all words are placed; `onanswer({ kind: 'order', words })`
  - `SpeakView`: the text, the model audio button and a `आगे` button; `onanswer({ kind: 'spoken' })` (no recording in this plan; Plan 2c adds capture)

- [ ] **Step 1: Write the failing tests** per view: choice calls `onanswer` once with the tapped option id and ignores a second tap; options are lettered; fill-blank trims nothing (the core normalises), disables on empty input, replaces `___`; word order builds and edits the tray, the bank order is deterministic for a seed and never equals the original; speak calls `{ kind: 'spoken' }`; `locked` disables every input; all buttons are ≥ 44 px (assert the CSS `min-height` rule in the component's style block).
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** all checks. Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): add the practice item views`

---

### Task 12: Practice run, feedback and flow

**Files:**

- Create: `apps/learner/src/screens/practice/{PracticeScreen.svelte,FeedbackSheet.svelte,flow.ts}`
- Test: `apps/learner/src/screens/practice/practice.test.ts`

**Interfaces:**

- Consumes: `activity.current`, `appState.session` (`answer`, `finishLesson`, `finishTestOut`), `ITEM_VIEWS`, `ItemResult`, `CorrectAnswer`, `summarize`, `startAutoSync`'s `flush` via `Runtime`.
- Produces:
  - `finishActivity(): Promise<void>` in `flow.ts`: for a lesson run calls `session.finishLesson`, for a review run only summarises (review answers are already events), for a test-out run calls `session.finishTestOut(moduleId, run)`; stores `activity.finish` (with the streak and, for test-outs, the result) and navigates to `finish`; then asks the runtime to `flush` in the background without awaiting
  - `FeedbackSheet.svelte` props `{ result: ItemResult; lang: Lang; onnext: () => void }`: correct shows `बहुत बढ़िया! सही जवाब`; wrong shows `गलत क्यों है?` with `whyWrong` in the learner's language and the correct answer rendered from `CorrectAnswer` (option text, the word order, or the text); `unscored` shows nothing and moves on; the `आगे` button
  - `PracticeScreen.svelte`: header with a close button (asks `पाठ बीच में छोड़ें?` with `छोड़ें` / `जारी रखें`), progress bar and `3 / 7`; renders the current item with its view, calls `session.answer`, shows the `FeedbackSheet`, and on `आगे` moves on; after the last item calls `finishActivity`. With no activity it redirects to `lessons`.

- [ ] **Step 1: Write the failing tests.** A full lesson run through the screen produces `item_answered` events (one per item) and one `lesson_completed`; a wrong answer shows `whyWrong` and the correct answer; **double-tapping an option or `आगे` records one answer and advances one item** (Review Focus 3); **browser Back or the close button mid-run asks for confirmation; confirming leaves no `lesson_completed`, and re-entering the lesson later starts a fresh run** (answered items stay as events, which is fine); a review run ends without `lesson_completed`; a test-out run records `test_out_completed` with `passed` from the pass mark; finishing navigates to `finish` and the outbox flush is requested once; an answer event is saved before the feedback sheet appears (the log has it when the sheet renders); with no activity the screen redirects to `lessons`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Guard double taps by ignoring input while a result is displayed (the `locked` prop) and while an `answer` call is in flight.
- [ ] **Step 4: Run** all checks. Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): add the practice run with feedback`

---

### Task 13: Finish screen

**Files:**

- Create: `apps/learner/src/screens/finish/FinishScreen.svelte`, `apps/learner/src/i18n/finish.ts`
- Test: `apps/learner/src/screens/finish/finish.test.ts`

**Interfaces:**

- Consumes: `activity.finish` (`FinishInfo`), `Runtime.syncStatus`, `navigate`.
- Produces: `FinishScreen.svelte`. Lesson: `{title} पूरा!`, `{correct} में से {scored} सही · {n} दिन की streak`, three stat tiles (correct, wrong, streak; the design's time tile is dropped because the core does not track time), the mistakes note `{n} गलतियाँ अगले कुछ दिनों में दोहराने में आएँगी` when there were wrong answers, and the status line `फ़ोन में सेव · इंटरनेट मिलते ही अपलोड`; a primary `होम पर जाएँ` button. Review: `दोहराना पूरा!` with the same tiles. Test-out: `पास हुए – module पूरा!` or `अभी पास नहीं हुए – पाठ जारी रखें`, with the score as a percentage. Clears `activity` when leaving. With no `finish` info it redirects to `home`.

- [ ] **Step 1: Write the failing tests:** each variant's text and numbers from a fixture `FinishInfo`; mistakes note only when `summary.wrong > 0`; streak number shown; leaving clears `activity` and goes home; no info redirects home; passed and not-passed test-out text.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** all checks. Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): add the finish screen`

---

### Task 14: Service worker, manifest and size budget

**Files:**

- Create: `apps/learner/src/pwa.config.ts`, `apps/learner/public/icons/{icon-192.png,icon-512.png,icon-maskable-512.png}`, `tooling/make-icons.mjs` (no dependencies: writes solid-colour PNGs with `node:zlib`; `--help`, `--dry-run`), `tooling/check-bundle-size.mjs` (`--help`; reads `apps/learner/dist`, gzips the JS needed for first load, fails above 120 KB)
- Modify: `apps/learner/vite.config.ts` (plugin from `pwa.config.ts`), `apps/learner/src/main.ts` (register with auto update), `apps/learner/package.json` (`"size": "node ../../tooling/check-bundle-size.mjs"`)
- Test: `apps/learner/src/pwa.config.test.ts`

**Interfaces:**

- Produces: `pwaOptions: Partial<VitePWAOptions>` with `registerType: 'autoUpdate'`; manifest `name` `शिक्षा पथ`, `short_name` `शिक्षा पथ`, `lang` `hi`, `display` `standalone`, `start_url` `/`, `theme_color` `#2F3AB2`, `background_color` `#F4F5FA`, the three icons; Workbox `navigateFallback: 'index.html'`, `navigateFallbackDenylist: [/^\/content\//]`, `globPatterns` for `js,css,html,woff2,svg,png`, no runtime caching route that matches `/content/`.

Placeholder icons: real branding arrives with the admin panel (Plan 4); installed name and icon changes can lag on Android (decision record `app-2026-10-18-pwa`).

- [ ] **Step 1: Write the failing tests.** The config's manifest has the fields above and three icons whose files exist and are valid PNGs of the stated sizes (read the IHDR); `navigateFallbackDenylist` matches `/content/manifest.json` and `/content/audio/x.mp3` and does not match `/` or `/index.html`; no `runtimeCaching` entry's `urlPattern` matches a `/content/` URL; `registerType` is `autoUpdate`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement**, generate the icons with `node tooling/make-icons.mjs`, then run `npm run build -w @shiksha/learner-app` and `npm run size -w @shiksha/learner-app`. Expected: build succeeds, `dist/sw.js` and `dist/manifest.webmanifest` exist, size script passes (if it fails, split routes with dynamic imports before raising the budget).
- [ ] **Step 4: Run** all checks. Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): add the service worker, manifest and size budget`

---

### Task 15: Offline end-to-end tests

**Files:**

- Create: `apps/learner/playwright.config.ts`, `apps/learner/e2e/{global-setup.ts,offline.spec.ts,layout.spec.ts}`; modify the CI workflow (a new `e2e` job that builds the app, runs `npx playwright install --with-deps chromium` and the specs; **pin every `uses:` to a commit SHA exactly like the existing jobs**); root `package.json` (`"test:e2e": "npm run build -w @shiksha/learner-app && playwright test -c apps/learner"`)
- Test: the specs themselves (not matched by the root `vitest` include, which is `*.test.ts`)

**Interfaces:**

- Consumes: the built app (`vite preview`), the content fixture from `@shiksha/learner-core/test-helpers/content-fixture` (`makeContentFixture()` → `outDir`), which `global-setup.ts` copies to `apps/learner/dist/content` after the build.
- Produces: `playwright.config.ts` (Chromium only; `webServer` `vite preview` on a fixed port; viewport 360 × 640; `serviceWorkers: 'allow'`).

- [ ] **Step 1: Write the failing specs.**
  - `offline.spec.ts` (Review Focus 1): online first visit creates profile `प्रिया` with PIN `1234`, language Hindi + English; home shows the download completing (today's lesson card appears); then `context.setOffline(true)`; reload; the PIN screen appears (service worker served the shell); sign in; start today's lesson, open practice, answer every item (one wrong on purpose, via the visible option buttons), finish; the finish screen shows the streak and the `फ़ोन में सेव` line; reload offline again, sign in, home shows the lesson as done and the streak; a second profile `रोहित` created offline sees no progress from `प्रिया`; wrong PIN five times shows the lock message.
  - `layout.spec.ts` (Review Focus 4): at 360 × 640, for the profiles, home, lessons, learn, practice and finish screens (a profile named with 40 Devanagari characters), `document.documentElement.scrollWidth <= clientWidth` and every `button` and `a` that is visible measures ≥ 44 px in both directions.
- [ ] **Step 2: Run** `npm run test:e2e`. Expected: FAIL (specs written before the setup is complete) then fix the setup, not the specs.
- [ ] **Step 3: Implement** `playwright.config.ts`, `global-setup.ts` and the CI job; add `@playwright/test`. If a spec exposes a real defect in an earlier task, fix it test-first in that task's files and ledger it.
- [ ] **Step 4: Run** `npm run test:e2e`, then `npm test`, `npm run test:cov`, `npm run lint`, `npm run typecheck`, `npm run format:check`. Expected: all pass; coverage ≥ 70%.
- [ ] **Step 5: Commit** `test(app): add offline and layout end-to-end tests`

---

## What this plan satisfies

| Spec                                                          | Task(s)        |
| ------------------------------------------------------------- | -------------- |
| §4, §5.4 PWA, Svelte, Vite, Dexie, service worker             | 1, 3, 4, 14    |
| §5.2 player, progress store, outbox on the phone              | 5, 8, 12, 13   |
| §5.3 profiles per device, 4-digit PIN                         | 6, 7           |
| §6.1 daily loop: today's lesson, practice, finish, review     | 8, 10, 12, 13  |
| §6.2, §6.7 language mix and preference                        | 2, 7, 10       |
| §6.3 test-out                                                 | 9, 12, 13      |
| §7.1, §7.3 local data, sync status                            | 3, 4, 5, 8, 13 |
| §9.2 "why was I wrong?"                                       | 12             |
| §11 low storage, resumable download, persistent storage, sync | 5, 9           |
| §11 all errors in plain Hindi, no codes                       | 2              |
| §12 offline test, device (360 px) checks                      | 15             |

Deferred to Plan 2c: §6.3 placement screens, §6.5 speaking capture, §11 mic permission handling, tablet and desktop layouts, the "me" screen.
