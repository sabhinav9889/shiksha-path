# Learner Core Implementation Plan (Plan 2a)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A headless TypeScript library, `@shiksha/learner-core`, that holds everything the learner app does except the screens: verified offline content download, item scoring, quiz runs, an event-sourced progress model (lessons, test-out, placement, review queue, streak), local profiles with PIN, and an outbox for sync. It also adds the browser-safe bundle contract that the content builder and the app share.

**Architecture:** Pure functions and small classes over ports (interfaces) for everything with a second implementation: `Clock`, `Ids`, `Fetcher`, `BundleStorage`, `PartialStore`, `StorageEstimator`, `EventStore`, `ProfileStore`, `SyncTransport`. In-memory versions live in `src/testing/` (exported as `@shiksha/learner-core/testing`) along with contract test suites that Plan 2b's IndexedDB adapters must also pass. Progress is **derived by replaying the append-only event log**, so restoring on a new device, retries and duplicates all reduce to "replay the events". The core has no DOM, no IndexedDB and no network code: those arrive through ports (spec §5.5).

**Tech Stack:** TypeScript strict (ESM, no DOM lib), Zod 4, Web Crypto (`crypto.subtle`, present in Node 22 and every target browser), Vitest. No new dependencies beyond `zod` and the workspace package `@shiksha/content`.

**Spec:** `docs/superpowers/specs/2026-10-15-learning-platform-design.md` (§5.1–5.3, §6.1–6.5, §6.7, §7.1, §7.3, §9.2, §11, §12)

**Requires:** PR #5 (content hardening) merged to `main` first; task 1 edits the same package. Branch `feature/learner-core` from `main`.

### Plan series

Each plan produces working, testable software on its own. Plans after this one are written when the previous one is done, so they build on what was actually built.

- **Plan 2a: learner core** (this plan): no screens.
- **Plan 2b: learner app:** PWA shell (Svelte + Vite), service worker, interface strings (hi/en), IndexedDB adapters (pass this plan's contract suites), profile and PIN screens, home, lessons and downloads, lesson, practice, review, test-out, offline Playwright tests (`2026-10-19-learner-app.md`).
- **Plan 2c: learner app, part 2:** placement screens, speaking-recording capture, the "me" screen, tablet and desktop layouts.
- **Plan 3:** backend and sync (Supabase, `/v1/sync` push and pull, Google sign-in, ID mapping, feature switches, recordings upload, backups).
- **Plan 4:** mentor view and admin panel. **Plan 5:** AI features and content pipeline. **Plan 6:** mentor connect and community.

## Global Constraints

Everything marked _(builder's call)_ is a product decision the spec leaves open; the owner can overrule any of them before building starts.

- **India time.** All "days" are Asia/Kolkata calendar days (UTC+05:30, no daylight saving), computed from the event timestamp, never from the device's own time zone. Day string format `YYYY-MM-DD`.
- **Language (spec §6.2, §6.7).** Preference `hi_en` (default) or `en_only`. `en_only` shows English everywhere with no Hindi toggle. Otherwise a module's or lesson's `hi_ratio` > 0.5 means Hindi is primary with an English toggle; `hi_ratio` ≤ 0.5 means English is primary with a Hindi toggle _(builder's call for the 0.5 boundary, matching "middle modules ~50/50, simple English with a Hindi toggle")_. The event log, not the profile, is the source of truth for the preference: the app records the learner's first choice as a `language_changed` event.
- **Scoring (spec §6.4, §6.5, §9.2).** One attempt per item per run. Speaking items are never scored (`unscored`). A wrong answer carries its `why_wrong` when the content has one; otherwise the result still carries the correct answer so the app can show it. Fill-in-the-blank compares after NFC, trim, collapsing inner spaces and lower-casing _(builder's call)_.
- **Lessons are not exams.** Finishing every item completes a lesson regardless of score _(builder's call)_. Test-out passes at `score ≥ pass_mark` from the bundle (content default 0.8).
- **Review queue (spec §6.1: "over the next few days").** Leitner boxes with intervals `[1, 2, 4]` days; a wrong answer (lesson or review) puts the item in box 0, due the next day; a correct review answer moves it up one box and it leaves the queue after a correct answer in the last box; at most **5** items per review session _(builder's call)_.
- **Streak.** A day is active if the learner answered at least one item that day. The streak is the run of consecutive active days ending today, or ending yesterday if today has no activity yet _(builder's call)_. Days after "today" are ignored.
- **Placement (spec §6.3).** Fixed form. Per section: the start lesson is the rule with the highest `min_score` ≤ the section score. Only the **first** placement sets start lessons; a later retake is recorded but changes nothing about progress (it exists to measure learning, spec §13). Skipping placement is recorded (`placement_skipped`) and starts the learner at the beginning (spec §6.3).
- **Events (spec §7.3).** Every learner action is an event `{ id (UUID v4), learnerId, type, at (ISO-8601 UTC), data }`. Replays and duplicates (same `id`) count once. Unknown event types from a newer app version are ignored, never an error; known types are parsed loosely, so extra fields added by a newer app are kept and the event is not dropped (required fields are still enforced). `learnerId` is the local profile's `id`.
- **Downloads (spec §5.1, §11).** SHA-256 verified against the manifest before anything is marked ready; chunk size **256 KiB** (`262_144`) using HTTP Range requests; keep **5 MiB** (`5_242_880`) free after a download _(builder's call)_. URLs are built only from manifest paths that pass the strict patterns in `manifestSchema`.
- **Ready vs playable (spec §11).** A module is _ready_ when its stored bundle matches the manifest and all its audio is present (sync's criterion). It is _playable_ whenever a verified bundle is stored, even if its audio was cleared or an update failed, so lessons keep working from the old bundle ("versioned bundles keep old phones working"). Audio can be installed later, and finished modules can be removed to free space, without breaking the rest.
- **PIN (spec §5.3).** Exactly 4 digits; PBKDF2-SHA256, **100,000** iterations, 16-byte random salt; after **5** consecutive wrong PINs the profile locks for 30 s, doubling with each further wrong PIN up to 900 s; success resets _(builder's call)_. The PIN only separates profiles on a shared phone; it is not protection against someone with the device.
- **Outbox (spec §7.3).** Batches of **50** events; retry delay `5 s × 2^(failures − 1)`, capped at 900 s; a sync failure never throws and never blocks learning.
- **Errors (spec §11).** User-visible failures are `CoreError` with an `ErrorCode`; the app maps the code to Hindi/English text. The core never produces user-facing text.
- **Boundaries.** Core source (`src/**`, tests excepted) must not reference `window`, `document`, `navigator`, `indexedDB`, `localStorage`, `sessionStorage`, `fetch` or `XMLHttpRequest`, and must import `@shiksha/content` only through the `@shiksha/content/schema` subpath. `tsconfig.json` uses `lib: ["ES2023"]`, which blocks `document` and `window`; `@types/node` still declares `fetch` and `navigator`, so the source scan (comments ignored) is the real guard.
- **Constants** are single literals (`262_144`, not `256 * 1024`) because `no-magic-numbers` flags arithmetic, even in a `const`. Value tables (`REVIEW_INTERVAL_DAYS`, `ERROR_CODES`) take a one-line `// eslint-disable-next-line no-magic-numbers -- <why>`. Test helpers and `src/testing/**` get the same relaxations as `*.test.ts` (Task 2).
- Plan 0 limits apply: lines ≤ 100, files ≤ 300, functions ≤ 50 lines, complexity ≤ 10, depth ≤ 3, parameters ≤ 4, no `any`, coverage ≥ 70%.

## Review Focus

The inputs the spec implies but no task's own happy-path tests would exercise. Each line has its test in the named task.

1. **India day boundary and a wrong device clock.** `18:29:59Z` and `18:30:00Z` fall on different India days; a phone set to a wrong future date must not inflate the streak. Task 2 (`istDay`) and Task 6 (`streak` ignores future days).
2. **Replayed and duplicate events.** A restore from the server plus the local log, or a retried push, repeats event IDs. Replaying must not advance a review box twice or duplicate a completion. Task 5 and Task 6 (`duplicate review answer counts once`).
3. **Hostile, corrupt or oversized downloads.** A wrong hash, a server that ignores Range, extra bytes, empty chunks and a stale partial file must end in a clear error, never a hang, never a "ready" module. Task 8.
4. **Browser-cleared storage.** The browser can delete audio after a module was marked ready; "ready" must be re-derived from what is actually present, and repair must fetch only what is missing. Task 9 and Task 10 (`isModuleReady` re-checks audio; `fetchMissingAudio` repairs only what is missing).
5. **Content that changed under the learner.** A completed lesson or review item that no longer exists in the manifest or bundle, and event types from a newer app, must be tolerated. Task 5 (unknown events, removed lessons) and Task 13 (review entry whose item was removed; a module that stays playable from an old bundle).

## What this plan satisfies

| Spec                                                                                                                                                 | Task(s)          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| §5.1 bundles verified and versioned                                                                                                                  | 1, 8, 9          |
| §5.2 player logic, progress store, sync outbox                                                                                                       | 4–7, 12          |
| §5.3 profiles per device, 4-digit PIN                                                                                                                | 11               |
| §6.1 today's lesson, streak, review queue                                                                                                            | 5, 6             |
| §6.2, §6.7 language mix and preference                                                                                                               | 2, 5             |
| §6.3 placement (and skipping it), test-out                                                                                                           | 5, 7             |
| §6.4, §6.5 aptitude scoring, speaking unscored                                                                                                       | 3                |
| §7.1 local data, §7.3 events/outbox/replay                                                                                                           | 5, 12            |
| §9.2 `why_wrong` or the correct answer                                                                                                               | 3                |
| §11 low storage (check, delete finished modules, audio separately), resumable verified download, old bundles keep working, sync failure never blocks | 8, 9, 10, 12, 13 |

**Not in this plan:** screens, PWA shell, service worker, interface strings, IndexedDB adapters, recording capture (Plan 2b); Google sign-in, the sync endpoint and pull, feature switches (Plan 3); doubts, distress keywords and helplines, AI (Plan 5). `speak_compare` items are scored `unscored` here; recording storage arrives with the app. Remembering which modules the learner removed is an app preference (Plan 2b); the core takes it as `skipModules`.

---

## File structure

```
packages/content/src/schema/bundle.ts       NEW  zod schemas + types: Manifest, ModuleBundle, PlacementBundle
packages/content/src/schema-entry.ts        NEW  browser-safe entry for "@shiksha/content/schema"
packages/learner-core/
  package.json, tsconfig.json
  src/index.ts          public API (re-exports; no testing code)
  src/ports.ts          Clock, Ids, systemClock, cryptoIds
  src/errors.ts         ErrorCode, CoreError
  src/time.ts           India-time days
  src/language.ts       language preference → view, pickText
  src/scoring.ts        scoreItem registry, normalizeAnswer
  src/shuffle.ts        seeded word shuffle
  src/quiz.ts           QuizRun and summary
  src/evaluate.ts       placement and test-out evaluation
  src/events.ts         event schema, createEvent, parseEvents
  src/progress.ts       deriveProgress, todayLesson, trackProgress
  src/review.ts         review queue (Leitner)
  src/streak.ts         streak
  src/download.ts       sha256Hex, downloadFile (resumable, verified)
  src/install.ts        syncContent, isModuleReady, isModulePlayable, BundleStorage
  src/storage-management.ts  missingAudio, fetchMissingAudio, removeModuleContent
  src/profiles.ts       profiles and PIN
  src/outbox.ts         EventStore, flushOutbox
  src/session.ts        LearnerSession (split if > 300 lines)
  src/testing/          fakes, in-memory adapters, contract suites  (export "./testing")
  typecheck/no-dom.ts   proves DOM types are absent (not a test file; only this package's tsconfig compiles it)
  test/                 one test file per source file, plus contract.test.ts and scenario.test.ts
  test/helpers/         content-fixture.ts (builds a small content tree with fake audio), serve-build.ts, manifest.ts
```

Every task that adds a helper under `src/testing/` also exports it from `src/testing/index.ts`; the main `src/index.ts` never imports from `testing/` (it pulls in Vitest).

---

### Task 1: Browser-safe bundle contract and the learner-core package

**Files:**

- Create: `packages/content/src/schema/bundle.ts`, `packages/content/src/schema-entry.ts`
- Modify: `packages/content/package.json` (add `"./schema": "./src/schema-entry.ts"` to `exports`), `packages/content/src/bundle.ts` (the interfaces `AudioEntry`, `BundleLesson`, `ModuleBundle`, `PlacementBundle`, `ManifestPlacement`, `ManifestModule`, `Manifest` become `z.infer` types imported from `./schema/bundle.js` and re-exported; fix the resulting type errors, e.g. under `exactOptionalPropertyTypes` build the optional `audio` object explicitly). `SCHEMA_VERSION` moves into `schema/bundle.ts` (it lives in `bundle.ts` today, which imports `node:crypto` and `marked`, and the schema entry must reach neither) and is re-exported from `bundle.ts`. `build.ts`'s `pathFor` throws on an unknown audio reference instead of returning it unchanged.
- Create: `packages/learner-core/package.json` (name `@shiksha/learner-core`, `"type": "module"`, `exports` `"."` → `./src/index.ts` and `"./testing"` → `./src/testing/index.ts`, dependencies `zod` and `@shiksha/content: "*"`), `packages/learner-core/tsconfig.json` (extends `../../tsconfig.base.json`, `"lib": ["ES2023"]`, include `src`, `test` and `typecheck`), scripts `"typecheck": "tsc --noEmit -p tsconfig.json"`
- Create: `packages/learner-core/test/helpers/content-fixture.ts`: `makeContentFixture(): Promise<{ outDir: string; rebuild(change?: (files: Record<string, string | Uint8Array>) => void): Promise<void> }>` writes a small content tree to a temp dir and builds it with `@shiksha/content`. The tree has tracks `english` and `aptitude`; an English module with 3 lessons (`ef1-01`, `ef1-02`, `ef1-03`) and an aptitude module with 2 (`apt-01`, `apt-02`); a test-out for each; a placement test with English start rules `0 → ef1-01`, `0.6 → ef1-02`, `0.9 → ef1-03` (and `suggest_english_only_at: 0.9`) and one aptitude rule; and **fake audio**: a lesson-level audio file, a `listen_choose` item, and one audio file used by both modules so deduplication shows. The repo's sample `content/` has no audio, so it cannot test audio paths.
- Test: `packages/content/test/schema-entry.test.ts`, `packages/learner-core/test/contract.test.ts`

**Interfaces:**

- Produces, from `@shiksha/content/schema`: `manifestSchema`, `moduleBundleSchema`, `placementBundleSchema`, `bundleLessonSchema`, `audioEntrySchema`, the types `Manifest`, `ManifestModule`, `ManifestPlacement`, `ModuleBundle`, `PlacementBundle`, `BundleLesson`, `AudioEntry`, and re-exports of `practiceItem`, `PracticeItem`, `ChoiceOption`, `ITEM_TYPES`, `localized`, `Localized`, `contentId`, `placementSection`, `PlacementSection`, `Track`.
- Strict patterns (these protect URL building in the app): `version` `^[0-9a-f]{12}$`; `sha256` `^[0-9a-f]{64}$`; manifest module `file` `^modules/[a-z0-9]+(-[a-z0-9]+)*\.[0-9a-f]{12}\.json$`; placement `file` `^placement\.[0-9a-f]{12}\.json$`; audio `path` `^audio/[0-9a-f]{16}\.(mp3|m4a|ogg|opus|webm)$`; `schema_version` literal `1`; `built_at` an ISO-8601 UTC timestamp; all objects strict; `bytes`, `audio_bytes` non-negative integers.
- Audio references must agree with the bundle's audio list: in a module bundle every audio reference used by lessons (`audio.hi`, `audio.en`) and items (`listen_choose.audio`, `speak_compare.model_audio`, including those in `test_out`) must match the audio path pattern **and** appear in `audio[].path`. The same holds for placement sections. Enforce with a `superRefine` on `moduleBundleSchema` and `placementBundleSchema`, so a bundle cannot be "ready" with audio it cannot play.

- [ ] **Step 1: Add the learner-core package skeleton** (package.json, tsconfig.json only) and run `npm install` at the repo root so the workspace links resolve.

- [ ] **Step 2: Write the failing tests.**
  - `schema-entry.test.ts` (content package):
    - `schema entry reaches no node: module and no bundler dependency`: starting at `src/schema-entry.ts`, follow every relative `import`/`export … from` recursively (regex over the source text); assert no specifier starts with `node:` and every non-relative specifier is exactly `zod`.
    - `rejects schema_version 2`, `rejects a module file path with ..` (`modules/../x.12345678abcd.json`), `rejects an audio path outside audio/`, `rejects a 13-character version`, `rejects an unknown key` (strictness), `rejects an item that breaks the practiceItem rules` (two correct options), `accepts the empty modules list`, `rejects a lesson audio reference that is not listed in audio[]`, `rejects an item audio reference outside audio/`, `rejects a test_out audio reference that is not listed`, `parses a bundle whose references are all listed`.
  - `contract.test.ts` (learner-core, the producer/consumer test): for **two** builds, the repo's real sample `content/` (checks the shape, though it has no audio) and `makeContentFixture()` (checks audio), parse `manifest.json` with `manifestSchema`, every module file with `moduleBundleSchema` and the placement file with `placementBundleSchema`; assert each manifest entry's `version`, `bytes` and `sha256` match the parsed file and its bytes, and, for the fixture, that each audio entry's `bytes` and `sha256` match the file under `audio/`.

- [ ] **Step 3: Run** `npx vitest run packages/content/test/schema-entry.test.ts packages/learner-core/test/contract.test.ts`. Expected: FAIL (schemas not defined).

- [ ] **Step 4: Implement** `schema/bundle.ts` and `schema-entry.ts` as specified, and switch `bundle.ts` to the inferred types.

- [ ] **Step 5: Prove the cross-package import under every tool.** Run `npx vitest run`, `npm run typecheck`, `npm run lint`, `npm run format:check`. Expected: all pass, including all existing content tests. If TypeScript, Vitest or ESLint cannot resolve `@shiksha/content/schema` from `packages/learner-core`, fix the package exports or tsconfig now; this must be settled before any later task.

- [ ] **Step 6: Commit** `feat(content): add browser-safe bundle schemas and the learner-core package`

---

### Task 2: Ports, errors, India time, language

**Files:**

- Create: `src/ports.ts`, `src/errors.ts`, `src/time.ts`, `src/language.ts`, `src/testing/fakes.ts`, `src/testing/index.ts`, `src/index.ts`, `typecheck/no-dom.ts`
- Modify: `eslint.config.js` so the relaxations for `*.test.ts` (file limit 500, no function-length limit, no magic numbers) also apply to `**/test/**/*.ts` and `**/testing/**/*.ts`; contract-suite callbacks and helpers are naturally long
- Modify: root `package.json` so `typecheck` also runs every workspace's own typecheck (`tsc -p tsconfig.json --noEmit && npm run typecheck --workspaces --if-present`); CI only runs the root script, and the root config allows DOM types, so without this the package's `lib: ["ES2023"]` would never be checked. `packages/learner-core/package.json` gets `"typecheck": "tsc --noEmit -p tsconfig.json"` (add it in Task 1 with the skeleton).
- Test: `test/foundations.test.ts`, `test/boundaries.test.ts`, and `tooling/test/eslint-limits.test.ts` (extend)

**Interfaces:**

- Produces:
  - `interface Clock { now(): Date }`, `interface Ids { uuid(): string }`, `systemClock: Clock`, `cryptoIds: Ids` (uses `crypto.randomUUID()`)
  - `ERROR_CODES` (readonly tuple) and `type ErrorCode` with exactly: `LOW_STORAGE`, `DOWNLOAD_FAILED`, `BUNDLE_CORRUPT`, `BUNDLE_TOO_LARGE`, `MANIFEST_UNAVAILABLE`, `MODULE_NOT_READY`, `PIN_INVALID`, `PIN_WRONG`, `PIN_LOCKED`, `NAME_INVALID`, `PROFILE_NOT_FOUND`
  - `class CoreError extends Error { constructor(readonly code: ErrorCode, message: string, readonly details?: Record<string, unknown>) }`
  - `istDay(at: Date | string): string`, `addDays(day: string, n: number): string`, `daysBetween(from: string, to: string): number` (signed)
  - `type LanguagePreference = 'hi_en' | 'en_only'`, `type Lang = 'hi' | 'en'`, `interface LanguageView { primary: Lang; toggle: Lang | null }`, `languageView(hiRatio: number, pref: LanguagePreference): LanguageView`, `pickText(text: Localized, lang: Lang): string`
  - testing: `fixedClock(iso: string): Clock & { set(iso: string): void; advanceMs(ms: number): void }`, `sequentialIds(): Ids` (valid UUID shape `00000000-0000-4000-8000-000000000001`, incrementing)

- [ ] **Step 1: Write the failing tests.**
  - time: `istDay(new Date('2026-10-18T18:29:59Z')) === '2026-10-18'`; `istDay(new Date('2026-10-18T18:30:00Z')) === '2026-10-19'`; `istDay(new Date('2026-12-31T20:00:00Z')) === '2027-01-01'`; `istDay('2026-10-18T18:30:00Z') === '2026-10-19'` (an ISO string works too); `addDays('2026-10-31', 1) === '2026-11-01'`; `addDays('2028-03-01', -1) === '2028-02-29'`; `daysBetween('2026-10-18', '2026-10-21') === 3` and `-3` reversed.
  - language: `languageView(0.8, 'hi_en')` is `{ primary: 'hi', toggle: 'en' }`; `(0.5, 'hi_en')` and `(0.2, 'hi_en')` are `{ primary: 'en', toggle: 'hi' }`; `(0.8, 'en_only')` is `{ primary: 'en', toggle: null }`; `pickText` returns the requested language.
  - errors: `CoreError` is an `Error`, keeps `code` and `details`, and has `name === 'CoreError'`.
  - ports and fakes: `cryptoIds.uuid()` matches the UUID v4 pattern and two calls differ; `fixedClock` set/advance work; `sequentialIds().uuid()` values are unique and UUID-shaped.
  - `boundaries.test.ts`: read every `.ts` file under `src/`, strip block and line comments, and assert none matches `\b(window|document|navigator|indexedDB|localStorage|sessionStorage|XMLHttpRequest)\b` or `\bfetch\s*\(`, and that no import specifier is exactly `@shiksha/content`; assert `tsconfig.json` has `lib` equal to `["ES2023"]`.
  - `typecheck/no-dom.ts` (not a `*.test.ts`, so Vitest ignores it, and outside the root tsconfig's `include`, so only this package's `typecheck` compiles it) holds `// @ts-expect-error DOM types must stay absent` above `export const probe = (): unknown => document;`. `npm run typecheck` fails with an unused-directive error if DOM types ever return.
  - `tooling/test/eslint-limits.test.ts`: `new ESLint().calculateConfigForFile(...)` (no parsing) for `packages/learner-core/src/testing/a.ts` and `packages/learner-core/test/helpers/a.ts` has `max-lines-per-function` and `no-magic-numbers` off and `max-lines` 500; for `packages/learner-core/src/a.ts` they stay on (300 lines, function length 50, magic numbers warn).

- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** `istDay` adds `IST_OFFSET_MS = 19_800_000` (5.5 hours, one literal) to the UTC time and takes the ISO date part; `addDays` works on UTC dates built from the day string; the language boundary is `HINDI_PRIMARY_ABOVE = 0.5`; `ERROR_CODES` carries the described disable comment.
- [ ] **Step 4: Run** all checks (`npm test`, `lint`, `typecheck`, `format:check`). Expected: PASS.
- [ ] **Step 5: Commit** `feat(learner-core): add ports, error codes, India time and language view`

---

### Task 3: Item scoring and word shuffle

**Files:**

- Create: `src/scoring.ts`, `src/shuffle.ts`
- Test: `test/scoring.test.ts`, `test/shuffle.test.ts`

**Interfaces:**

- Consumes: `PracticeItem`, `Localized` (Task 1)
- Produces:
  - `type Answer = { kind: 'choice'; optionId: string } | { kind: 'text'; value: string } | { kind: 'order'; words: string[] } | { kind: 'spoken' }`
  - `type Outcome = 'correct' | 'wrong' | 'unscored'`
  - `type CorrectAnswer = { kind: 'option'; optionId: string } | { kind: 'text'; value: string } | { kind: 'order'; words: string[] }`
  - `interface ItemResult { itemId: string; outcome: Outcome; whyWrong: Localized | null; explanation: Localized | null; correctAnswer: CorrectAnswer | null }`
  - `normalizeAnswer(s: string): string`, `scoreItem(item: PracticeItem, answer: Answer): ItemResult`
  - `shuffleWords(words: readonly string[], seed: string): string[]`

Rules: choice types (`mcq_meaning`, `listen_choose`, `aptitude`): correct → `whyWrong` and `correctAnswer` null; wrong → `whyWrong` from the chosen option, `correctAnswer` the correct option id. `aptitude` returns its `explanation` (or null) for any outcome. `fill_blank`: correct when `normalizeAnswer(value)` equals a normalised entry of `answers`; wrong → `whyWrong` from a matching `common_wrong` entry (normalised) or null, `correctAnswer` `{ kind: 'text', value: answers[0] }`; empty input is wrong. `word_order`: correct only for the exact sequence; wrong → `whyWrong` from the item (or null), `correctAnswer` the order. `speak_compare` → `unscored`, everything else null. An answer kind that does not fit the item type, or an unknown option id, throws a plain `Error` (a programming error, never produced by the UI). The scorer table is typed `{ [K in PracticeItem['type']]: … }` so a new item type without a scorer is a compile error (spec §14).

- [ ] **Step 1: Write the failing tests.**
  - choice: right option → `correct`; wrong option → `wrong` with that option's `why_wrong` and `correctAnswer` `{ kind: 'option', optionId: 'a' }`; unknown option id throws; same for `listen_choose`; `aptitude` returns `explanation` for both outcomes and null when absent.
  - `fill_blank`: `' AM '` matches `am`; NFD and NFC Devanagari answers match each other (build with `String.fromCodePoint`); `''` and `'   '` are wrong; `'naam'` returns the `common_wrong` reason; an unlisted wrong answer has `whyWrong` null and `correctAnswer` set.
  - `word_order`: exact order correct; any other order wrong with the item's `why_wrong`.
  - `speak_compare` with `{ kind: 'spoken' }` is `unscored`.
  - `scoreItem` throws `answer kind "text" does not fit item type "mcq_meaning"`.
  - `normalizeAnswer`: trims, collapses `'a   b'` to `'a b'`, lower-cases, NFC.
  - `shuffleWords`: deterministic for the same seed; a permutation of the input; for `['I', 'am', 'Priya']` never equal to the original across 200 different seeds; all-identical words return the input unchanged; the input array is not mutated.

- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** with a seeded PRNG (hash the seed string to a 32-bit state, then a small generator such as mulberry32) and Fisher–Yates; if the result equals the input and at least two distinct words exist, rotate it by one position.
- [ ] **Step 4: Run** all checks. Expected: PASS.
- [ ] **Step 5: Commit** `feat(learner-core): score the six item types and shuffle words`

---

### Task 4: Quiz runner

**Files:**

- Create: `src/quiz.ts`
- Test: `test/quiz.test.ts`

**Interfaces:**

- Consumes: `PracticeItem`, `Answer`, `ItemResult`, `scoreItem` (Tasks 1, 3)
- Produces:
  - `type ItemSource = { kind: 'lesson'; lessonId: string } | { kind: 'review'; lessonId: string } | { kind: 'test_out'; moduleId: string } | { kind: 'placement'; track: string }`
  - `interface QuizEntry { source: ItemSource; item: PracticeItem }`, `interface AnsweredEntry { entry: QuizEntry; result: ItemResult }`, `interface QuizRun { readonly entries: readonly QuizEntry[]; readonly answered: readonly AnsweredEntry[] }`
  - `startQuiz(entries: readonly QuizEntry[]): QuizRun` (throws on an empty list), `currentEntry(run): QuizEntry | null`, `answerCurrent(run: QuizRun, answer: Answer): { run: QuizRun; entry: QuizEntry; result: ItemResult }` (throws when finished), `isFinished(run): boolean`
  - `interface QuizSummary { total: number; scored: number; correct: number; wrong: number; unscored: number; score: number; mistakes: AnsweredEntry[] }`, `summarize(answered: readonly AnsweredEntry[]): QuizSummary` where `score` is `correct / scored`, or `1` when nothing was scored

- [ ] **Step 1: Write the failing tests.** Progression through 3 items (`currentEntry` advances, `isFinished` flips after the last); the run passed in is not mutated; answering a finished run throws; `summarize` for mixed outcomes (2 correct, 1 wrong, 1 unscored → `total 4`, `scored 3`, `score 2/3`, `mistakes` has only the wrong one, in answered order); an all-unscored run has `score 1`; `startQuiz([])` throws.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** immutably (return new run objects).
- [ ] **Step 4: Run** all checks. Expected: PASS.
- [ ] **Step 5: Commit** `feat(learner-core): add the quiz runner`

---

### Task 5: Events and progress derivation

**Files:**

- Create: `src/events.ts`, `src/progress.ts`
- Test: `test/events.test.ts`, `test/progress.test.ts`, `test/helpers/manifest.ts` (a small hand-written `Manifest` fixture: track `english` with module `english-foundation-1` lessons `ef1-01`, `ef1-02`, `ef1-03`; track `aptitude` with module `aptitude-1` lessons `apt-01`, `apt-02`)

**Interfaces:**

- Consumes: `Clock`, `Ids`, `ItemSource`, `Outcome`, `LanguagePreference`, `Manifest`, `istDay`
- Produces:
  - Event data by type: `lesson_started { lessonId, moduleVersion }`; `item_answered { source: ItemSource, itemId, outcome: Outcome }`; `lesson_completed { lessonId, correct, scored }`; `test_out_completed { moduleId, score, passed }`; `placement_completed { sections: { track, score, startLesson }[], englishOnlySuggested }`; `placement_skipped {}`; `language_changed { preference }`
  - `type EventType`, `type LearnerEvent` (`{ id, learnerId, type, at, data }`), `learnerEventSchema` (Zod; `id` a UUID, `at` an ISO UTC string; the envelope and each `data` object are loose, so extra fields are kept and only required fields are enforced), `createEvent<T extends EventType>(deps: { clock: Clock; ids: Ids }, learnerId: string, type: T, data: EventData[T]): LearnerEvent`, `parseEvents(raw: readonly unknown[]): { events: LearnerEvent[]; ignored: number }`
  - `interface PlacementRecord { at: string; sections: { track: string; score: number; startLesson: string }[]; englishOnlySuggested: boolean }`
  - `interface ProgressState { completedLessons: ReadonlySet<string>; testedOutModules: ReadonlySet<string>; placements: readonly PlacementRecord[]; startLessonByTrack: Readonly<Record<string, string>>; language: LanguagePreference; suggestEnglishOnly: boolean; placementSkipped: boolean; activeDays: ReadonlySet<string> }` (Task 6 adds `reviewQueue`), and `needsPlacement(state: ProgressState): boolean` (no placement recorded and not skipped)
  - `deriveProgress(events: readonly LearnerEvent[]): ProgressState`: drops events with a repeated `id` (first wins), orders by `at` then `id`
  - `interface LessonRef { moduleId: string; lessonId: string; track: string }`, `lessonOrder(manifest: Manifest, track: string): LessonRef[]`, `isLessonDone(manifest: Manifest, state: ProgressState, lessonId: string): boolean`, `todayLesson(manifest: Manifest, state: ProgressState): LessonRef | null`, `trackProgress(manifest: Manifest, state: ProgressState, track: string): { done: number; total: number }`

A lesson is done when it was completed, or its module was tested out, or it comes before the track's start lesson. `todayLesson` walks `manifest.tracks` by `order` and returns the first not-done lesson, so a strong-English student lands on aptitude (spec §6.3). `suggestEnglishOnly` is true when the first placement suggested it and `language_changed` never happened.

- [ ] **Step 1: Write the failing tests.**
  - events: `createEvent` produces a valid event (UUID id, `at` from the clock); `parseEvents` keeps valid events and counts `ignored` for unknown types and malformed objects; an event with a non-UUID `id` is ignored; **an event with an extra unknown field is kept** (`ignored 0`).
  - progress: empty log → `language 'hi_en'`, empty sets, `placements` empty; `lesson_completed` marks a lesson done; the same event twice (same `id`) gives the same state as once; events handed over out of order are ordered by `at` (the later `language_changed` wins); an unknown-type event never reaches `deriveProgress` (via `parseEvents`) and a completed lesson absent from the manifest does not throw and counts nowhere in `trackProgress`; `test_out_completed` with `passed: true` marks the module (and so its lessons) done, `passed: false` does not; first placement sets `startLessonByTrack`, a second placement is listed in `placements` but changes nothing; `suggestEnglishOnly` true, then false after any `language_changed`; `placement_skipped` sets `placementSkipped`, `needsPlacement` turns false and no start lessons are set; `needsPlacement` is true for a new learner and false after a placement.
  - `todayLesson`: new learner → `ef1-01`; after `ef1-01` and `ef1-02` done → `ef1-03`; English tested out → `apt-01`; placement with English start `ef1-03` → `ef1-03` (`ef1-01`, `ef1-02` skipped); everything done → `null`; `trackProgress` for `english` counts skipped lessons as done (`{ done: 2, total: 3 }`).
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** all checks. Expected: PASS.
- [ ] **Step 5: Commit** `feat(learner-core): add learner events and progress derivation`

---

### Task 6: Review queue and streak

**Files:**

- Create: `src/review.ts`, `src/streak.ts`; Modify: `src/progress.ts` (fold the review queue into `deriveProgress`)
- Test: `test/review.test.ts`, `test/streak.test.ts`

**Interfaces:**

- Consumes: `istDay`, `addDays`, `ItemSource`, `Outcome`, `LearnerEvent`
- Produces:
  - `REVIEW_INTERVAL_DAYS = [1, 2, 4] as const`, `REVIEW_SESSION_SIZE = 5`
  - `interface ReviewEntry { lessonId: string; itemId: string; box: number; dueDay: string }`
  - `applyReviewAnswer(queue: readonly ReviewEntry[], answer: { lessonId: string; itemId: string; outcome: Outcome; fromReview: boolean; day: string }): ReviewEntry[]`: `wrong` → box 0, `dueDay = day + 1` (insert or reset); `correct` with `fromReview` and an existing entry → box + 1 with `dueDay = day + REVIEW_INTERVAL_DAYS[box + 1]`, or removed when already in the last box; `correct` outside review, and `unscored`, change nothing
  - `dueReviews(queue: readonly ReviewEntry[], today: string): ReviewEntry[]`: entries with `dueDay ≤ today`, sorted by `dueDay`, then `lessonId`, then `itemId`, at most `REVIEW_SESSION_SIZE`
  - `streak(activeDays: ReadonlySet<string>, today: string): { current: number; activeToday: boolean }`
  - `ProgressState` gains `reviewQueue: readonly ReviewEntry[]`, and `deriveProgress` fills it by folding `item_answered` events whose `source.kind` is `lesson` or `review`; `test_out` and `placement` sources never enter the queue

- [ ] **Step 1: Write the failing tests.**
  - review: wrong in a lesson on `2026-10-18` → entry box 0, `dueDay 2026-10-19`; correct in review on 10-19 → box 1, `dueDay 2026-10-21`; correct on 10-21 → box 2, `dueDay 2026-10-25`; correct on 10-25 → removed; wrong at any box → back to box 0, next day; correct in a lesson (not review) for an item in the queue changes nothing; `unscored` ignored; `dueReviews` returns only due items, sorted, capped at 5 of 7 due; **IST boundary:** a wrong answer at `2026-10-18T18:29:59Z` is due `2026-10-19`, at `18:30:00Z` due `2026-10-20`.
  - `duplicate review answer counts once` (Review Focus 2): `deriveProgress` with the same correct-review event repeated advances the box once.
  - streak: days `{10-16, 10-17, 10-18}` with today `10-18` → `{ current: 3, activeToday: true }`; same days, today `10-19` → `{ current: 3, activeToday: false }`; today `10-20` → `0`; a gap resets (`{10-14, 10-16, 10-17}` with today `10-17` → 2); **a future-dated active day (`2026-10-25` with today `2026-10-18`) is ignored** (Review Focus 1); `deriveProgress` marks a day active for any `item_answered` event, including `unscored` ones.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** all checks, including `test/progress.test.ts` from Task 5. Expected: PASS.
- [ ] **Step 5: Commit** `feat(learner-core): add the review queue and streak`

---

### Task 7: Placement and test-out evaluation

**Files:**

- Create: `src/evaluate.ts`
- Test: `test/evaluate.test.ts`

**Interfaces:**

- Consumes: `PlacementSection` (Task 1), `QuizSummary` (Task 4)
- Produces: `interface SectionResult { track: string; score: number; startLesson: string; englishOnlySuggested: boolean }`, `evaluatePlacementSection(section: PlacementSection, summary: QuizSummary): SectionResult`, `evaluateTestOut(passMark: number, summary: QuizSummary): { score: number; passed: boolean }`

`startLesson` is the `start_lesson` of the rule with the highest `min_score` ≤ the score; a score exactly equal to a `min_score` qualifies; if no rule qualifies, the rule with the lowest `min_score` is used. `englishOnlySuggested` is true only when the section sets `suggest_english_only_at` and `score ≥` it. `passed` is `score + 1e-9 ≥ passMark`.

- [ ] **Step 1: Write the failing tests.** With rules `[{0 → a}, {0.6 → b}, {0.9 → c}]`: scores `0` → `a`, `0.59` → `a`, `0.6` → `b`, `0.89` → `b`, `0.9` → `c`, `1` → `c`; a section with `suggest_english_only_at: 0.9` suggests at `0.9`, not at `0.89`; a section without it never suggests; test-out `4/5` with pass mark `0.8` passes, `3/5` fails, and `8/10` passes.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** all checks. Expected: PASS.
- [ ] **Step 5: Commit** `feat(learner-core): evaluate placement and test-out results`

---

### Task 8: Verified, resumable download

**Files:**

- Create: `src/download.ts`, `src/testing/memory-partials.ts`, `src/testing/scripted-fetcher.ts`
- Test: `test/download.test.ts`

**Interfaces:**

- Consumes: `CoreError` (Task 2)
- Produces:
  - `DOWNLOAD_CHUNK_BYTES = 262_144`
  - `interface FetchResult { status: number; bytes: Uint8Array }`, `interface Fetcher { get(url: string, range?: { from: number; to: number }): Promise<FetchResult> }` (`to` inclusive; status `206` for a range, `200` for a full body)
  - `interface PartialStore { get(key: string): Promise<Uint8Array | null>; put(key: string, bytes: Uint8Array): Promise<void>; delete(key: string): Promise<void> }`
  - `interface FileSpec { url: string; sha256: string; bytes: number }`
  - `sha256Hex(bytes: Uint8Array): Promise<string>`, `downloadFile(spec: FileSpec, deps: { fetcher: Fetcher; partials: PartialStore; chunkBytes?: number }): Promise<Uint8Array>`
  - testing: `MemoryPartialStore`, `scriptedFetcher(files: Record<string, Uint8Array>, opts?: { failOnRequest?: number; ignoreRange?: boolean; extraBytes?: number; corrupt?: boolean; emptyChunks?: boolean }): Fetcher & { requests: { url: string; range?: { from: number; to: number } }[] }`

`downloadFile` keeps a partial under the key `spec.sha256` (content-addressed, so it can never mix files). It resumes from the partial's length, requests the next range, appends and persists each chunk, and finally verifies the SHA-256. Errors are `CoreError`s: a rejected `get`, a non-200/206 status, an empty chunk before completion, or a 200 whose body is shorter than `spec.bytes` → `DOWNLOAD_FAILED` (partial kept, except for the bad-200 case); a 206 chunk longer than requested, or any body longer than `spec.bytes` (a 200 included) → `BUNDLE_TOO_LARGE` (partial dropped); a hash mismatch → `BUNDLE_CORRUPT` and the partial is deleted. A stale partial longer than `spec.bytes` is discarded. On success the partial is deleted.

- [ ] **Step 1: Write the failing tests.**
  - `sha256Hex('abc')` is `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad`.
  - A 600,000-byte file with the default chunk size makes exactly 3 range requests (`0–262143`, `262144–524287`, `524288–599999`), returns the exact bytes, and leaves no partial.
  - **Resume:** the second request fails; the call rejects with `DOWNLOAD_FAILED`; the partial holds the first chunk; a second call requests only `262144–524287` and `524288–599999` and succeeds.
  - The server ignores Range and answers 200 with the full body: accepted when its length and hash match, in one request; a 200 shorter than expected → `DOWNLOAD_FAILED`; a 200 longer than expected → `BUNDLE_TOO_LARGE`.
  - Corrupted bytes → `BUNDLE_CORRUPT`, partial deleted, and the next attempt starts from byte 0.
  - A 206 carrying more bytes than requested → `BUNDLE_TOO_LARGE`; a server that always returns empty chunks → `DOWNLOAD_FAILED` (no infinite loop); a stale partial longer than `spec.bytes` is discarded and the download restarts; a zero-byte file with the empty-input hash succeeds.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** all checks. Expected: PASS.
- [ ] **Step 5: Commit** `feat(learner-core): add verified resumable downloads`

---

### Task 9: Install and sync content

**Files:**

- Create: `src/install.ts`, `src/testing/memory-bundle-storage.ts`, `src/testing/contracts.ts` (start with `describeBundleStorage`)
- Test: `test/install.test.ts`, `test/helpers/serve-build.ts` (turns the fixture's `outDir` from Task 1 into `{ fetcher, requests }`: a `Fetcher` with Range support and a request log that reads the files fresh on every request, so `rebuild()` is visible)

**Interfaces:**

- Consumes: `Fetcher`, `PartialStore`, `downloadFile`, `sha256Hex` (Task 8); `manifestSchema`, `moduleBundleSchema`, `placementBundleSchema`, `Manifest`, `ModuleBundle`, `PlacementBundle` (Task 1); `CoreError`
- Produces:
  - `STORAGE_SAFETY_MARGIN_BYTES = 5_242_880`
  - `interface StorageEstimator { estimate(): Promise<{ quota: number; usage: number } | null> }`
  - `interface BundleStorage { getManifest(): Promise<Manifest | null>; putManifest(m: Manifest): Promise<void>; getModule(id: string): Promise<{ version: string; bundle: ModuleBundle } | null>; putModule(id: string, version: string, bundle: ModuleBundle): Promise<void>; removeModule(id: string): Promise<void>; getPlacement(): Promise<{ version: string; bundle: PlacementBundle } | null>; putPlacement(version: string, bundle: PlacementBundle): Promise<void>; removePlacement(): Promise<void>; hasAudio(path: string): Promise<boolean>; getAudio(path: string): Promise<Uint8Array | null>; putAudio(path: string, bytes: Uint8Array): Promise<void>; removeAudio(path: string): Promise<void>; listAudio(): Promise<string[]> }`
  - `isModuleReady(id: string, manifest: Manifest, storage: BundleStorage, opts?: { audio?: boolean }): Promise<boolean>`: the stored version equals the manifest's and, unless `opts.audio === false`, every audio path in the stored bundle is present
  - `isModulePlayable(id: string, storage: BundleStorage): Promise<boolean>`: a verified bundle is stored (any version); audio is not required
  - `interface ContentReport { id: string; status: 'ready' | 'installed' | 'skipped' | 'failed'; error?: ErrorCode; details?: Record<string, unknown> }`, `interface SyncReport { source: 'network' | 'cache'; modules: ContentReport[]; placement: ContentReport | null; removedAudio: number }`
  - `syncContent(deps: { baseUrl: string; fetcher: Fetcher; storage: BundleStorage; partials: PartialStore; estimator: StorageEstimator; audio?: 'with' | 'skip'; skipModules?: ReadonlySet<string> }): Promise<SyncReport>`
  - testing: `MemoryBundleStorage`, `describeBundleStorage(name: string, factory: () => BundleStorage | Promise<BundleStorage>)` (a Vitest suite for adapters: round trips, `hasAudio`, `removeAudio`, `listAudio`, replacing a module version)

Behaviour of `syncContent`: fetch `${baseUrl}/manifest.json` and parse with `manifestSchema`; on a network failure or a failed parse fall back to the cached manifest (`source: 'cache'`), and if there is none throw `CoreError('MANIFEST_UNAVAILABLE')`; a manifest that was fetched and parsed is stored. For each module in the manifest: in `skipModules` → `skipped`, nothing fetched, any stored bundle kept; otherwise already `isModuleReady(…, { audio: audio !== 'skip' })` → `ready`; otherwise work out what is needed: the module JSON only when the stored version differs from the manifest's, and audio only in `'with'` mode (the default), and only the files not already stored. Check free space (`quota − usage ≥ needed + STORAGE_SAFETY_MARGIN_BYTES`; skip the check when the estimator returns null): on a shortage the module is `failed` with `error: 'LOW_STORAGE'` and `details: { neededBytes, freeBytes }`, nothing is written for it, and the other modules continue. Download and verify the module JSON when needed, parse it, require its `id` and `version` to equal the manifest's, download the missing audio, and **only then** `putModule`. Any other failure marks that module `failed` (`BUNDLE_CORRUPT`, `DOWNLOAD_FAILED`, …) and continues, leaving a previously stored bundle untouched and still playable. Placement is handled the same way. Afterwards remove module records absent from the manifest, and remove audio that no stored bundle references. URLs are `${baseUrl}/${file}` and `${baseUrl}/${audio.path}`, built only from values that passed the schemas.

- [ ] **Step 1: Write the failing tests** (serve `makeContentFixture()`):
  - first sync installs every module and the placement test: all `isModuleReady`, audio present, manifest cached, `source 'network'`.
  - second sync with an unchanged manifest requests only `manifest.json`.
  - after `rebuild()` with one changed lesson and one replaced audio file, only that module's JSON is re-requested and no unchanged audio is re-requested; the old audio file is removed (`removedAudio` counts it).
  - offline (the manifest request rejects) with a cache → `source: 'cache'`; with no cache → `MANIFEST_UNAVAILABLE`.
  - a hostile manifest (a module `file` of `../x.json`) is rejected by the schema and the cached manifest is used.
  - a wrong hash on one module file → that module `failed` with `BUNDLE_CORRUPT`, the others `ready`; **a previously installed version of the failed module stays stored and `isModulePlayable`, while `isModuleReady` is false** (it is not up to date).
  - a module whose bundle `id` or `version` differs from the manifest → `BUNDLE_CORRUPT`.
  - low storage (`quota 10 MiB`, `usage 9 MiB`): the module that does not fit is `failed` with `LOW_STORAGE` and `details.neededBytes`, nothing is written for it, a smaller module still installs; an estimator returning `null` proceeds.
  - **`isModuleReady` re-checks audio:** after `removeAudio` of one of a ready module's files it is false while `isModulePlayable` stays true, and the next `syncContent` re-requests only that audio file (not the module JSON), after which the module is ready again (Review Focus 4). A stored version that differs from the manifest is not ready.
  - `skipModules`: a module in the set is not requested or installed; one already stored stays.
  - `audio: 'skip'`: module JSON installed, no audio requested, `isModulePlayable` true, report `installed`; an immediate second `'skip'` sync reports `ready` and requests only the manifest.
  - `describeBundleStorage` passes for `MemoryBundleStorage`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** (split `install.ts` into `install.ts` and `install-module.ts` if it nears 300 lines).
- [ ] **Step 4: Run** all checks. Expected: PASS.
- [ ] **Step 5: Commit** `feat(learner-core): install and sync verified content`

---

### Task 10: Repair and storage management

**Files:**

- Create: `src/storage-management.ts`
- Test: `test/storage-management.test.ts`

**Interfaces:**

- Consumes: `BundleStorage`, `StorageEstimator`, `Fetcher`, `PartialStore`, `downloadFile` (Tasks 8–9), `CoreError`
- Produces:
  - `missingAudio(id: string, storage: BundleStorage): Promise<string[]>`: audio paths of the stored bundle that are not present (`CoreError('MODULE_NOT_READY')` when no bundle is stored)
  - `fetchMissingAudio(id: string, deps: { baseUrl: string; fetcher: Fetcher; storage: BundleStorage; partials: PartialStore; estimator: StorageEstimator }): Promise<{ fetched: number }>`: downloads and verifies only those files, after the same free-space check as sync (`LOW_STORAGE` with `details`, nothing written); a hash mismatch is `BUNDLE_CORRUPT` and keeps the files already fetched
  - `removeModuleContent(id: string, storage: BundleStorage): Promise<{ removedAudio: number }>`: removes the module record and every audio file that no remaining stored bundle (module or placement) references; unknown ids remove nothing and do not throw

This is spec §11: "audio downloadable separately" (sync with `audio: 'skip'`, then `fetchMissingAudio`) and "offer to delete finished modules" (`removeModuleContent`; the app remembers the removal and passes `skipModules` to sync).

- [ ] **Step 1: Write the failing tests** (serve `makeContentFixture()`):
  - `missingAudio` lists exactly the files removed from storage, is empty when complete, and throws `MODULE_NOT_READY` for an unknown module.
  - after an `audio: 'skip'` sync, `fetchMissingAudio` requests exactly the module's audio files, `isModuleReady` becomes true, and a second call fetches 0.
  - a hash mismatch on one file → `BUNDLE_CORRUPT`; the files before it stay stored and that file is not stored.
  - low storage → `LOW_STORAGE`, nothing written.
  - `removeModuleContent` removes the record and its own audio but keeps the audio file shared with the other module; `isModulePlayable` is false afterwards; a following `syncContent` reinstalls the module, but with `skipModules: new Set([id])` it does not; an unknown id returns `{ removedAudio: 0 }`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** (reuse the download and space-check helpers from `install.ts`; export them from there rather than copying).
- [ ] **Step 4: Run** all checks. Expected: PASS.
- [ ] **Step 5: Commit** `feat(learner-core): repair missing audio and remove finished modules`

---

### Task 11: Profiles and PIN

**Files:**

- Create: `src/profiles.ts`, `src/testing/memory-profile-store.ts`; Modify: `src/testing/contracts.ts` (add `describeProfileStore`)
- Test: `test/profiles.test.ts`

**Interfaces:**

- Consumes: `Clock`, `Ids`, `CoreError`
- Produces:
  - `PIN_PBKDF2_ITERATIONS = 100_000`
  - `interface Profile { id: string; name: string; pin: { salt: string; hash: string; iterations: number }; failedAttempts: number; lockedUntil: string | null; createdAt: string }` (salt and hash are base64; `id` is the `learnerId` used in events; the language preference lives in the event log, not here)
  - `interface ProfileStore { list(): Promise<Profile[]>; get(id: string): Promise<Profile | null>; put(profile: Profile): Promise<void>; delete(id: string): Promise<void> }`
  - `createProfile(input: { name: string; pin: string }, deps: { store: ProfileStore; ids: Ids; clock: Clock; iterations?: number }): Promise<Profile>` (`NAME_INVALID` for an empty name after NFC and trim, over 40 characters, or containing control characters; `PIN_INVALID` unless exactly four digits)
  - `verifyPin(profileId: string, pin: string, deps: { store: ProfileStore; clock: Clock }): Promise<Profile>` (`PROFILE_NOT_FOUND`; `PIN_LOCKED` with `details.retryAfterSec`; `PIN_WRONG` with `details.attemptsLeft`)
  - testing: `MemoryProfileStore`, `describeProfileStore`

Lock policy: the 5th consecutive wrong PIN locks for 30 s; each further wrong PIN doubles it (60, 120, …) up to 900 s; a correct PIN resets `failedAttempts` and `lockedUntil`. While locked, even the correct PIN is rejected without being checked. The hash comparison is constant-time. State is stored in the profile so it survives an app restart.

- [ ] **Step 1: Write the failing tests.** Create with a valid name and PIN; the stored profile contains neither the PIN text nor a recognisable form of it; two profiles with the same PIN get different salts and hashes; `NAME_INVALID` for `''`, a 41-character name and `'a\u0007b'` (build with `String.fromCodePoint`); `PIN_INVALID` for `'123'`, `'12345'`, `'abcd'`, `'12 4'`; a correct PIN returns the profile; four wrong PINs give `PIN_WRONG` with `attemptsLeft` 4 down to 1; the 5th gives `PIN_LOCKED` with `retryAfterSec 30`; the correct PIN during the lock is still `PIN_LOCKED`; after 30 s the correct PIN works and resets the counter; a further wrong PIN after the first lock expired locks for 60 s; the lock is capped at 900 s; the lock survives a new `verifyPin` call built from the same store (persisted state, not memory); unknown id → `PROFILE_NOT_FOUND`; `PIN_PBKDF2_ITERATIONS` is `100000` while tests inject a smaller `iterations` for speed; `describeProfileStore` passes for `MemoryProfileStore`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** with `crypto.subtle` PBKDF2 and `crypto.getRandomValues`.
- [ ] **Step 4: Run** all checks. Expected: PASS.
- [ ] **Step 5: Commit** `feat(learner-core): add local profiles with PIN and lockout`

---

### Task 12: Outbox

**Files:**

- Create: `src/outbox.ts`, `src/testing/memory-event-store.ts`; Modify: `src/testing/contracts.ts` (add `describeEventStore`)
- Test: `test/outbox.test.ts`

**Interfaces:**

- Consumes: `LearnerEvent`, `Clock`, `deriveProgress`
- Produces:
  - `OUTBOX_BATCH_SIZE = 50`
  - `interface EventStore { append(event: LearnerEvent): Promise<void>; all(learnerId: string): Promise<LearnerEvent[]>; pending(learnerId: string, limit: number): Promise<LearnerEvent[]>; markSent(ids: string[]): Promise<void>; getMeta(key: string): Promise<string | null>; setMeta(key: string, value: string): Promise<void> }` (`append` is idempotent on `id`; `all` and `pending` are in append order, `pending` excludes acknowledged events)
  - `interface SyncTransport { push(learnerId: string, events: LearnerEvent[]): Promise<{ accepted: string[] }> }` (Plan 3 provides the real one)
  - `retryDelayMs(failures: number): number` (`0` for 0; `5000 × 2^(failures − 1)` capped at `900000`)
  - `interface FlushResult { ok: boolean; sent: number; remaining: number; nextAttemptInMs: number | null }`
  - `flushOutbox(learnerId: string, deps: { store: EventStore; transport: SyncTransport; clock: Clock }): Promise<FlushResult>`: never throws; sends batches until nothing is pending; marks only `accepted` ids as sent; on a thrown error stores a per-learner failure count and returns `ok: false` with `nextAttemptInMs`; stops (as a failure) when a non-empty batch gets an empty `accepted`; after a clean drain stores `lastSyncedAt:<learnerId>` (ISO) and resets the failure count; concurrent calls for the same learner share one run
  - testing: `MemoryEventStore`, `describeEventStore`

- [ ] **Step 1: Write the failing tests.** `append` twice with one id stores one event; `pending` order and `limit`; 120 events → pushes of 50, 50, 20, all marked sent, `lastSyncedAt` set to the clock; the transport throws on the second batch → `ok: false`, `sent 50`, `remaining 70`, `nextAttemptInMs 5000`, then 10000 after a second failure, and the delay is capped at 900000 from the 9th failure; a later success drains the rest and no event is ever marked sent without being accepted; a transport that accepts only some ids leaves the others pending; a transport that accepts none stops after one push (`ok: false`); two simultaneous `flushOutbox` calls cause a single sequence of pushes; learner A's flush never sends learner B's events; `retryDelayMs(0..)` values; **restore:** appending the events a fake server returns (same ids as local ones) to a fresh store, then `deriveProgress`, equals the original progress; `describeEventStore` passes for `MemoryEventStore`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** all checks. Expected: PASS.
- [ ] **Step 5: Commit** `feat(learner-core): add the sync outbox`

---

### Task 13: Learner session and end-to-end scenario

**Files:**

- Create: `src/session.ts` (split into `session.ts` and `session-quiz.ts` if it nears 300 lines), update `src/index.ts` to export the public API
- Test: `test/session.test.ts`, `test/scenario.test.ts` (use `test/helpers/content-fixture.ts` from Task 1 and `test/helpers/serve-build.ts` from Task 9)

**Interfaces:**

- Consumes: everything above.
- Produces:
  - `interface SessionDeps { learnerId: string; storage: BundleStorage; events: EventStore; clock: Clock; ids: Ids }`
  - `class LearnerSession` with `static open(deps: SessionDeps): Promise<LearnerSession>` (loads the cached manifest and the event log; `CoreError('MANIFEST_UNAVAILABLE')` when there is no manifest), `get progress(): ProgressState`, and
    - `todayLesson(): LessonRef | null`, `trackProgress(track: string): { done: number; total: number }`, `streak(): { current: number; activeToday: boolean }`, `reviewDue(): ReviewEntry[]`
    - `startLesson(lessonId: string): Promise<{ lesson: BundleLesson; run: QuizRun; view: LanguageView }>` (appends `lesson_started`; `CoreError('MODULE_NOT_READY')` when the module is not playable or the stored bundle has no such lesson; a module that is playable but not ready, for example after a failed update, still plays from its old bundle)
    - `answer(run: QuizRun, answer: Answer): Promise<{ run: QuizRun; result: ItemResult }>` (appends `item_answered`)
    - `finishLesson(run: QuizRun): Promise<QuizSummary>` (appends `lesson_completed`; only for a lesson run)
    - `startReview(): Promise<QuizRun | null>` (null when nothing is due; entries whose lesson or item no longer exists in the installed bundles are skipped)
    - `startTestOut(moduleId: string): Promise<{ run: QuizRun; passMark: number }>`, `finishTestOut(moduleId: string, run: QuizRun): Promise<{ score: number; passed: boolean }>` (appends `test_out_completed`)
    - `startPlacement(): Promise<QuizRun | null>` (null when there is no placement test installed), `finishPlacement(run: QuizRun): Promise<PlacementRecord>` (appends `placement_completed`)
    - `skipPlacement(): Promise<void>` (appends `placement_skipped`), `needsPlacement(): boolean`
    - `setLanguage(preference: LanguagePreference): Promise<void>` (appends `language_changed`; the app calls it with the learner's first choice so the event log holds it)
  - Every method that changes state appends its event through `events.append` first, then recomputes `progress`; none of them touches the network.

- [ ] **Step 1: Write the failing tests.**
  - `session.test.ts`: `open` without a manifest throws `MANIFEST_UNAVAILABLE`; `startLesson` for a module with no stored bundle, or a lesson id missing from the stored bundle, throws `MODULE_NOT_READY`; `startLesson` still works from an old stored bundle after a failed update (playable, not ready); `finishLesson` on a review run throws; a review entry whose item was removed from the bundle is skipped; `startReview` returns `null` when nothing is due; `startPlacement` returns `null` without a placement bundle; `skipPlacement` makes `needsPlacement()` false and leaves `todayLesson` at the first lesson, and `needsPlacement()` is true for a new learner; `view` is `{ primary: 'en', toggle: null }` after `setLanguage('en_only')`.
  - `scenario.test.ts` (build `makeContentFixture()`, serve it with `serve-build.ts`, `syncContent`, then use only the session; no network after the sync): (1) `todayLesson` is the first English lesson; (2) answer its items with one wrong answer, `finishLesson`: the log holds `lesson_started`, `item_answered` × n and `lesson_completed`, all with unique UUIDs; (3) `reviewDue()` is empty today; advance the clock one India day: the wrong item is due, `startReview()` returns a run whose entries have source `review`, a correct answer moves it to box 1; (4) streak is 1, then 2 after activity on the next day; (5) placement: `startPlacement`, answer so that the English section scores `0.6`, `finishPlacement` sets `startLessonByTrack.english` to `ef1-02` and `suggestEnglishOnly` stays false (a separate run scoring `0.9` suggests it); (6) with English lessons still open, a passed English test-out marks the module and `todayLesson` moves to the first aptitude lesson; (7) `flushOutbox` with a transport that fails twice then succeeds, against a fake server that de-duplicates by event id: the server ends with each event exactly once and `lastSyncedAt` set; (8) a brand-new store filled from the server's events gives an identical `progress` (restore on a new device).
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** `LearnerSession` as a thin coordinator over the earlier modules.
- [ ] **Step 4: Run** `npm test`, `npm run test:cov`, `npm run lint`, `npm run typecheck`, `npm run format:check`; run `npm run content:build` once more. Expected: all pass, coverage ≥ 70%, and `content:build` still succeeds on the sample content.
- [ ] **Step 5: Commit** `feat(learner-core): add the learner session and offline scenario test`
