# Learner App, Part 2 Implementation Plan (Plan 2c)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the learner app for the pilot: the placement test (with skip and the English-only suggestion), speaking practice with microphone recording that never blocks a lesson, the "me" screen (language, sync, storage, switch profile, sign out), tablet and laptop layouts, and the fixes the Plan 2b review deferred.

**Architecture:** Same shape as Plan 2b: a thin Svelte UI over `@shiksha/learner-core`. Placement uses the core's existing `startPlacement` / `finishPlacement` / `skipPlacement`. Recordings are new, app-only data: a `Recorder` wraps `MediaRecorder`, a `RecordingStore` keeps them in IndexedDB (database version 2) until Plan 3 uploads them; no core change is needed except one small option that protects the open lesson's audio during a sync cleanup (Task 9). Wide layouts are CSS only.

**Tech Stack:** unchanged (Svelte 5, Vite, TypeScript, Dexie, Vitest, Playwright); no new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-15-learning-platform-design.md` (§5.3, §6.3, §6.5, §6.7, §7.1, §7.4, §11, §12). Screens follow the design canvas (`https://claude.ai/artifact/RgoKphdAHNyxWk9KoBqVFk`: `Placement`, `Profile`, `TabletHome`, `WebHome`, `WebLessons`, `WebPractice`).

**Requires:** Plans 2a and 2b merged. Branch `feature/learner-app-2` from `main`.

### Plan series

- Plans 2a (core) and 2b (app) are merged. **Plan 2c** (this plan) completes the learner app.
- **Plan 3:** backend and sync (including uploading recordings on wifi). **Plan 4:** mentor view and admin. **Plan 5:** AI. **Plan 6:** mentor connect and community.

**Not in this plan:** uploading recordings or any server call (Plan 3); mentor review of recordings (Plan 4); automatic pronunciation scoring (spec §6.5: none in the pilot); a placement retake screen (the end-of-pilot retake, spec §13, is started by the NGO later); mentor, community and doubt tabs; "download only what I am learning next" (deferred by the product owner).

## Global Constraints

Everything marked _(builder's call)_ is a product decision the spec leaves open.

- **Plan 2b constraints still apply** (offline first; Hindi first with every string in `hi` and `en`; tokens in `tokens.css`; taps ≥ 44 × 44 px; no `console.*`; Svelte files ≤ 200 lines; coverage ≥ 70%; first-load JavaScript ≤ 120 KB gzipped; lesson packs never cached by the service worker).
- **Speaking (spec §6.5, §11):** record and compare with a model recording; no automatic scoring (the answer stays `{ kind: 'spoken' }`, outcome `unscored`). If the microphone is denied, missing or fails, show a Hindi explanation and let the learner skip; **a speaking item never blocks a lesson**.
- **Recording limits (security rule):** a recording is at most **1 MiB** (`1_048_576` bytes). _(builder's call)_ it is also stopped at **30 s** (`30_000` ms) at **32 kbit/s** (`32_000`), which is about 120 KB. Retrying replaces the earlier recording of the same item, so one item keeps one recording. Format is chosen by `MediaRecorder.isTypeSupported` from, in order, `audio/webm;codecs=opus`, `audio/ogg;codecs=opus`, `audio/mp4` (spec §5.4 leaves the format to be tested on the cheapest cohort phones; that device test is part of the field dry run).
- **Privacy (spec §7.4, privacy rule):** recordings are visible only to the learner and their mentors; here they stay on the phone, keyed by learner id, and are never uploaded or logged. The first time a learner records, a one-line Hindi/English notice says who can hear it. Switching or signing out must leave nothing of the previous learner on screen.
- **Placement (spec §6.3):** fixed form; only the first placement sets start lessons; it can be skipped; "English only" is suggested when the English score is high and the learner (or a mentor) may change it any time (spec §6.7).
- **Wide screens (design canvas):** phone layout below 768 px; from 768 px a 96 px icon sidebar; from 1024 px a 220 px labelled sidebar; content column at most 1100 px; practice, lesson and finish screens stay at most 640 px wide so lines stay readable.
- **Security hardening:** a Content-Security-Policy on `index.html` as a second guard for the one `{@html}` (Task 9).

## Review Focus

1. **Microphone denied, absent or interrupted.** Permission denied, no microphone, an old browser without `MediaRecorder`, or a call that interrupts recording must end with a plain Hindi message and a working skip, never a stuck screen. Tasks 2, 3, 10.
2. **Recording size, time and survival.** A recording never exceeds 30 s or 1 MiB; a retry keeps one per item; it is saved before the learner moves on and is still there after a reload; recordings of two learners never mix. Tasks 1–3.
3. **Placement interrupted or repeated.** Skipping, reloading in the middle of the test, and doing it twice must not corrupt progress: only the first complete placement sets start lessons, a skipped one is remembered, and accepting "English only" switches the interface at once. Tasks 4, 5.
4. **Shared phone.** After "switch profile" or "sign out" nothing of the previous learner (name, language, progress, recordings, an open run) is visible or reachable by Back. Task 6.
5. **Wide screens.** At 768, 1024 and 1280 px there is no sideways scrolling, the navigation is usable, and practice lines are not stretched across the whole screen. Tasks 7, 10.

---

### Task 1: Recording store and database version 2

**Files:**

- Create: `apps/learner/src/storage/idb-recording-store.ts`, `apps/learner/src/storage/recording-store.ts` (types and the in-memory test fake)
- Modify: `apps/learner/src/storage/db.ts` (version 2)
- Test: `apps/learner/src/storage/recording-store.test.ts`

**Interfaces:**

- Produces:
  - `MAX_RECORDING_BYTES = 1_048_576`
  - `interface Recording { id: string; learnerId: string; lessonId: string; itemId: string; mime: string; bytes: Uint8Array; durationMs: number; at: string }`
  - `interface RecordingStore { put(recording: Recording): Promise<void>; latest(learnerId: string, lessonId: string, itemId: string): Promise<Recording | null>; summary(learnerId: string): Promise<{ count: number; bytes: number }>; delete(id: string): Promise<void> }`
  - `put` rejects a recording over `MAX_RECORDING_BYTES` (`Error('recording too large')`) and replaces any earlier recording with the same learner, lesson and item
  - `class IdbRecordingStore implements RecordingStore` (`constructor(db: ShikshaDb)`); `ShikshaDb` gains `declare recordings: Table<Recording, string>` and `db.version(2).stores({ recordings: 'id, learnerId, [learnerId+lessonId+itemId]' })` keeping every version-1 table
  - `Runtime` gains `recordings: RecordingStore`

- [ ] **Step 1: Write the failing tests.** Contract-style suite run against `IdbRecordingStore` (fresh database per test): `put` then `latest` round-trips bytes and metadata; a second `put` for the same learner, lesson and item replaces the first (`summary.count` stays 1); two learners with the same lesson and item keep separate recordings and separate `summary` totals (**isolation, 2+ learners**); `delete` removes one; a recording of 1,048,577 bytes is rejected and nothing is stored while exactly 1,048,576 is accepted; **a version-1 database with a stored profile and an event, reopened with the version-2 class, still has them and has a working `recordings` table**.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** the adapter; replacement is one transaction (find by the compound index, delete, add).
- [ ] **Step 4: Run** all checks (`npm test`, `lint`, `typecheck`, `format:check`). Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): add on-device recording storage`

---

### Task 2: Recorder service

**Files:**

- Create: `apps/learner/src/audio/recorder.ts`
- Test: `apps/learner/src/audio/recorder.test.ts`

**Interfaces:**

- Consumes: `MAX_RECORDING_BYTES` (Task 1).
- Produces:
  - `MAX_RECORDING_MS = 30_000`, `AUDIO_BITS_PER_SECOND = 32_000`, `MIME_PREFERENCE: readonly string[]`
  - `pickMimeType(isSupported: (mime: string) => boolean): string` (first supported, or `''`)
  - `type RecorderFailure = 'denied' | 'unsupported' | 'failed' | 'too_large'`; `class RecorderError extends Error { constructor(readonly kind: RecorderFailure) }`
  - `interface RecordingResult { mime: string; bytes: Uint8Array; durationMs: number }`
  - `interface Recorder { isSupported(): boolean; start(): Promise<void>; stop(): Promise<RecordingResult>; cancel(): void }`
  - `createRecorder(deps?: { mediaDevices?: Pick<MediaDevices, 'getUserMedia'>; recorderCtor?: typeof MediaRecorder; setTimer?: typeof setTimeout; now?: () => number }): Recorder`

Behaviour: `start()` asks for the microphone and begins a `MediaRecorder` with `audioBitsPerSecond: AUDIO_BITS_PER_SECOND` and the picked mime type; it stops itself after `MAX_RECORDING_MS`; `stop()` resolves with the finished recording (also after the automatic stop) and always stops every media track (the microphone light goes off); `cancel()` discards everything. Errors are `RecorderError`: `NotAllowedError` / `SecurityError` → `denied`; no `MediaRecorder` or no `mediaDevices` → `unsupported`; `NotFoundError`, a recorder `error` event or a `stop()` with no data → `failed`; a result over `MAX_RECORDING_BYTES` → `too_large`.

- [ ] **Step 1: Write the failing tests** with fake `mediaDevices` and a fake `MediaRecorder` class: `pickMimeType` honours the preference order and returns `''` when none; `start` then `stop` returns the chunks joined with the picked mime and a duration from `now`; a `NotAllowedError` becomes `denied`; no `mediaDevices` or no recorder constructor is `unsupported` and `isSupported()` is false; the recorder stops itself at 30 s (fake timer) and a later `stop()` still returns that recording; every track's `stop()` is called after `stop` and after `cancel` and after a failed start; a second `start` while recording does not open a second stream; a recording over the byte limit is `too_large`; `cancel` then `stop` is `failed`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** all checks. Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): add the microphone recorder`

---

### Task 3: Speaking items with recording

**Files:**

- Create: `apps/learner/src/screens/practice/items/SpeakView.svelte` (rewrite), `apps/learner/src/audio/recording-source.ts`, `apps/learner/src/i18n/speaking.ts`
- Modify: `apps/learner/src/screens/practice/items/types.ts` (optional `recorder?: Recorder` and `onrecord?: (recording: RecordingResult) => Promise<void>` on `ViewProps`), `PracticeScreen.svelte` (supplies `onrecord`, saving to `Runtime.recordings` with the signed-in learner, the item's lesson id and item id)
- Test: `apps/learner/src/screens/practice/items/speak.test.ts`, `apps/learner/src/screens/practice/practice.test.ts` (extend)

**Interfaces:**

- Consumes: `Recorder`, `RecorderError` (Task 2), `RecordingStore` (Task 1), `AudioButton` (Plan 2b).
- Produces: `recordingObjectUrl(recording: { mime: string; bytes: Uint8Array }): { url: string; revoke(): void }`; `SpeakView` states `idle → recording → recorded` plus the fallbacks `denied`, `unsupported`, `failed`.

`SpeakView`: shows the text and the model-audio button, then a record button. While recording it shows a stop button and the seconds left. After stopping it calls `onrecord`, shows "saved" and offers `मेरी रिकॉर्डिंग सुनें` (plays the recording), `फिर से रिकॉर्ड करें` (replaces it) and `आगे` (answers `{ kind: 'spoken' }`). In `denied`, `unsupported` and `failed` it shows a plain explanation and `आगे` stays enabled; `आगे` is always enabled so recording is optional. The first recording shows the privacy notice. Strings are draft Hindi to be read by a mentor: `denied`: `माइक्रोफ़ोन की अनुमति नहीं मिली। आप इसे छोड़कर आगे बढ़ सकते हैं।` / `Microphone permission was not given. You can skip this and carry on.`; `unsupported`: `इस फ़ोन पर रिकॉर्डिंग नहीं चल सकती। आगे बढ़ें।` / `Recording does not work on this phone. Carry on.`; `failed`: `रिकॉर्डिंग नहीं हो पाई। फिर कोशिश करें या आगे बढ़ें।` / `The recording did not work. Try again or carry on.`; notice: `आपकी रिकॉर्डिंग सिर्फ़ आपको और आपके मेंटर को सुनाई देगी।` / `Only you and your mentors can hear your recording.`

- [ ] **Step 1: Write the failing tests** (injected fake `Recorder`): the record, stop, saved flow calls `onrecord` once with the result; retrying calls it again and the screen test shows the store still holds one recording for the item; `denied`, `unsupported` and `failed` each show their message and `आगे` still answers `{ kind: 'spoken' }` (**Review Focus 1**); a recording that fails to save shows `failed` and keeps `आगे` working; the recording auto-stopped at the limit still saves; the playback URL is revoked when it ends and when the view is destroyed; locking disables record and `आगे`; in `PracticeScreen` a recorded speaking item stores the recording under the signed-in learner, the lesson id and the item id, **before** the learner can move on, and a second learner on the same phone has none (**Review Focus 2**).
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** all checks. Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): record speaking practice with a skip that never blocks`

---

### Task 4: Placement test run and skip

**Files:**

- Create: `apps/learner/src/screens/placement/{PlacementScreen.svelte,placement-flow.ts}`, `apps/learner/src/i18n/placement.ts`
- Modify: `router.svelte.ts` (routes `placement` and `placement-result`), `activity.svelte.ts` (`Activity` gains `{ kind: 'placement'; run: QuizRun }`; state gains `placementResult: PlacementRecord | null`), `screens/home/{home-data.ts,HomeScreen.svelte}` (`needsPlacement` and a placement card), `App.svelte` (route table and the run-screen list)
- Test: `apps/learner/src/screens/placement/placement.test.ts`, `apps/learner/src/router.test.ts` (extend), `home.test.ts` (extend)

**Interfaces:**

- Consumes: `session.startPlacement(): Promise<QuizRun | null>`, `session.answer`, `session.finishPlacement(run): Promise<PlacementRecord>`, `session.skipPlacement()`, `session.needsPlacement()`, `ITEM_VIEWS` (Plan 2b).
- Produces: `startPlacementRun(): Promise<boolean>` in `placement-flow.ts` (opens the run, stores the `Activity`, navigates to `placement`; false when the phone has no placement test); `finishPlacementRun(): Promise<void>` (calls `finishPlacement`, stores `activity.placementResult`, navigates to `placement-result`). `Route` gains `{ name: 'placement' } | { name: 'placement-result' }`.

`PlacementScreen` follows the canvas: header `शुरुआती टेस्ट · {track}` with a section progress bar (one segment per track, in order), the item view, and a small `छोड़ें, शुरू से पढ़ूँगा` link that asks to confirm, then calls `skipPlacement()` and goes home. **No right/wrong feedback** is shown (it is not an exam: `यह परीक्षा नहीं है – इससे पता चलता है कि आप कहाँ से शुरू करें।`); after each answer an `आगे` button moves on. Reload or Back mid-test ends the run without recording a result (answers already given stay as events, which is fine); the placement card stays on Home. Home shows the card `शुरुआती टेस्ट दें` (about 10 minutes) while `needsPlacement()` is true and a placement test is installed.

- [ ] **Step 1: Write the failing tests.** Home shows the placement card for a new learner and not after `placement_skipped` or a completed placement, and not when no placement is installed; the card starts the run (route `placement`, activity kind `placement`); answering every item shows no feedback sheet and ends on `placement-result` with a `placement_completed` event; the progress segments match the number of tracks; skip asks first, then records `placement_skipped`, clears the run and goes home with `todayLesson` still the first lesson (**Review Focus 3**); reload (no activity) goes home without a `placement_completed`; double-tapping `आगे` on the last item records one `placement_completed`; a failed save shows the plain message and retries (same pattern as practice); `router` round-trips the two new routes.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** all checks. Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): add the placement test with skip`

---

### Task 5: Placement result and the English-only suggestion

**Files:**

- Create: `apps/learner/src/screens/placement/PlacementResult.svelte`
- Modify: `apps/learner/src/app-state.svelte.ts` (`setLanguagePreference`), `App.svelte`, `i18n/placement.ts`
- Test: `apps/learner/src/screens/placement/placement-result.test.ts`, `app-state.test.ts` (extend)

**Interfaces:**

- Produces: `setLanguagePreference(preference: LanguagePreference): Promise<void>` in `app-state.svelte.ts`: records a `language_changed` event (through the session when there is one, otherwise by appending the event for the signed-in learner), then updates `appState.lang` (`uiLang`) at once.

`PlacementResult`: for each track, the learner's score as a percentage and `आप {lesson title} से शुरू करेंगे` using the start lesson from `activity.placementResult` and the manifest titles; when the record says `englishOnlySuggested` **and** `session.progress.suggestEnglishOnly` is true (only a first placement can suggest), a card asks `आपकी English अच्छी है। क्या सब कुछ English में पढ़ना चाहेंगे?` with `हाँ, सिर्फ़ English` (calls `setLanguagePreference('en_only')`, the interface changes at once) and `नहीं, हिंदी + English`; a `शुरू करें` button goes home, where today's lesson reflects the start lessons. The screen clears `activity` when left (as the finish screen does). With no result it goes home.

- [ ] **Step 1: Write the failing tests:** start lessons and percentages render from a fixture result; the suggestion card appears only for a first placement with a high English score, never after a language change, and never for a second placement (**Review Focus 3**); accepting writes `language_changed: en_only` and the visible text switches to English immediately; declining keeps Hindi and removes the card; `setLanguagePreference` works with no session (content not installed) and with one; going home shows today's lesson at the placement's start lesson; leaving clears `activity`; no result redirects home.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** all checks. Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): show placement results and suggest English only`

---

### Task 6: The "me" screen, profile switching and sign out

**Files:**

- Create: `apps/learner/src/screens/me/{MeScreen.svelte,StorageCard.svelte,me-data.ts}`, `apps/learner/src/runtime/install-prompt.ts`, `apps/learner/src/i18n/me.ts`
- Modify: `router.svelte.ts` (route `me`), `ui/NavBar.svelte` (third tab `मैं`), `App.svelte`, `main.ts` (start capturing the install prompt)
- Test: `apps/learner/src/screens/me/me.test.ts`, `apps/learner/src/runtime/install-prompt.test.ts`

**Interfaces:**

- Consumes: `setLanguagePreference` (Task 5), `Runtime.syncStatus/flush/content/recordings/storage`, `signOut`, `browserStorageEstimator` data.
- Produces: `loadMe(runtime, learnerId, session): Promise<MeData>` with `MeData = { language: LanguagePreference; sync: { lastSyncedAt: string | null; pending: number }; storage: { used: number; quota: number | null }; modules: { id: string; title: Localized; bytes: number; state: ModuleState }[]; recordings: { count: number; bytes: number } }`; `captureInstallPrompt(target: Pick<EventTarget, 'addEventListener'>): { available(): boolean; prompt(): Promise<'accepted' | 'dismissed'> }` (keeps the `beforeinstallprompt` event; available only after it fired and until used).

`MeScreen` follows the canvas: avatar initial and name; **Language** (two choices, calls `setLanguagePreference`); **Sync** (state line, last synced time, `अभी sync करें` button that runs `content.sync()` then `flush`, with the plain result below); **Storage** (a bar of used space against quota when the browser tells, the list of modules with size and a ✓ / removed / not downloaded mark, and `{count} रिकॉर्डिंग · {size}` for recordings); the install button `फ़ोन पर इंस्टॉल करें` only when the browser offered it; then `प्रोफ़ाइल बदलें` (`signOut()` and go to `profiles`) and `साइन आउट` (same effect, with an extra line that progress stays on the phone). Neither can be undone by Back. No email or cohort line (those arrive with Google sign-in in Plan 3).

- [ ] **Step 1: Write the failing tests:** language buttons switch the stored preference and the interface; `अभी sync करें` shows a plain result for success and for `MANIFEST_UNAVAILABLE`; storage lists both fixture modules with sizes from the manifest and marks a removed one; the recordings line counts only the signed-in learner's recordings (**2+ learners**); the install button is hidden until the event fires, calls `prompt()` once and hides afterwards; **after `प्रोफ़ाइल बदलें` or `साइन आउट`, `appState.profile`, `session` and `activity` are empty, the picker shows, and the browser Back button does not return to a signed-in screen** (a second learner then signs in and sees none of the first learner's name, language or recordings) (**Review Focus 4**); the `मैं` tab is highlighted on the route; loading failures show nothing broken.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Back after sign-out works because the route guard already sends a signed-out learner to the picker.
- [ ] **Step 4: Run** all checks. Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): add the me screen with switch profile and sign out`

---

### Task 7: Tablet and laptop layouts

**Files:**

- Modify: `apps/learner/src/ui/Shell.svelte`, `ui/NavBar.svelte`, `styles/tokens.css`, `screens/home/HomeScreen.svelte` (stat grid), `screens/lessons/LessonsScreen.svelte` (module grid), `screens/{practice,learn,finish,placement}/*Screen.svelte` (readable width)
- Test: `apps/learner/src/ui/shell.test.ts` (source-level breakpoint checks), covered visually by Task 10

**Interfaces:**

- Produces: CSS custom properties in `tokens.css`: `--bp-tablet: 768px`, `--bp-laptop: 1024px` documented in a comment (media queries cannot read variables, so the literal values are used and one test pins them); the shell renders the navigation as a bottom bar below 768 px, a 96 px left icon rail from 768 px, and a 220 px labelled sidebar from 1024 px.

Layout rules: the content column is at most 1100 px; Home shows the stat cards in a row from 768 px; Lessons shows module cards in two columns from 1024 px; the practice, lesson, finish and placement screens, and the feedback sheet and leave dialog, are centred at most 640 px wide and the feedback sheet no longer sticks to the screen edge; the bottom nav never appears from 768 px; the sidebar shows the sync chip and, from 1024 px, the app name.

- [ ] **Step 1: Write the failing tests.** `tokens.css` and the shell contain exactly the breakpoints 768 and 1024 and the 96, 220 and 1100 px values (read the source files and assert the media-query literals, so a drive-by edit is caught); the bottom nav is hidden by a media query at 768; practice, lesson, finish and placement screens set `max-width: 640px`. (Real rendering is checked in Task 10.)
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** with CSS only; keep Svelte files under 200 lines (move shared layout rules into `tokens.css` utility classes where a screen nears the limit).
- [ ] **Step 4: Run** all checks and `npm run build -w @shiksha/learner-app`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): add tablet and laptop layouts`

---

### Task 8: Hardening the screens (Plan 2b review minors)

**Files:**

- Modify: `screens/learn/AudioButton.svelte`, `screens/profiles/{CreateProfile,ProfilesScreen}.svelte`, `screens/lessons/LessonsScreen.svelte`, `screens/home/HomeScreen.svelte`, `activity.svelte.ts`, `screens/practice/PracticeScreen.svelte`, `i18n/*`
- Test: extend the existing screen tests

Each item below gets its own failing test first:

- [ ] **AudioButton object-URL leak:** two quick taps on play, or the component being destroyed while the audio is loading, must revoke every URL it created (assert `revokeObjectURL` is called once per `createObjectURL`).
- [ ] **Duplicate profile on retry:** if `createProfile` succeeds but saving the language event or signing in fails, the retry reuses the profile that was created (assert one profile after a failed and a successful attempt).
- [ ] **Silent failures:** a failed `remove`, a failed audio fetch and a review that has nothing left to show each display a plain message from the catalogue instead of nothing (strings added to `lessons.ts` and `home.ts`).
- [ ] **Stale lock time:** after `PIN_LOCKED` the picker reloads the profile list so switching profiles and back keeps the pad disabled until the lock ends.
- [ ] **Activity is not a deep proxy:** `activity` becomes two plain (non-proxied) reactive values behind the same `activity.current` / `activity.finish` accessors, so runs never reach IndexedDB or the core as Svelte proxies; the `as never` cast in `PracticeScreen` is removed. Assert that the objects stored in `activity.current` are not proxies (`structuredClone` of the run succeeds).
- [ ] **Step 2: Run.** Expected: FAIL for each. **Step 3: Implement.** **Step 4: Run** all checks. Expected: PASS.
- [ ] **Step 5: Commit** `fix(app): close the minor findings from the Plan 2b review`

---

### Task 9: Content security policy, audio kept for the open lesson, fewer session reopens

**Files:**

- Create: `apps/learner/src/csp.ts` (the policy builder), `apps/learner/src/csp.test.ts`
- Modify: `apps/learner/vite.config.ts` (injects the policy into `index.html`), `packages/learner-core/src/install.ts` and `install-unit.ts` (`SyncDeps.keepAudio?: ReadonlySet<string>`), `packages/learner-core/test/install.test.ts`, `apps/learner/src/runtime/content-service.ts` and `runtime.ts` (a `keepAudio` provider and a `version` counter), `app-state.svelte.ts`, `screens/home/HomeScreen.svelte`, `screens/lessons/LessonsScreen.svelte`
- Test: `csp.test.ts`, `content-service.test.ts` (extend), `app-state.test.ts` (extend), core `install.test.ts` (extend)

**Interfaces:**

- Produces: `contentSecurityPolicy(contentBaseUrl: string): string`: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'; connect-src 'self' <the origin of contentBaseUrl when it is not the app's own>; object-src 'none'; base-uri 'self'; form-action 'none'` (no inline scripts); core `SyncDeps.keepAudio` (audio paths the sync cleanup must not delete); `ContentService` option `keepAudio: () => ReadonlySet<string>` (the audio of the lesson in progress, read from `activity`) and `readonly version: number` (increases each time an operation changes stored content); `appState.contentVersion`.

- [ ] **Step 1: Write the failing tests.** CSP: the policy has no `unsafe-inline` for scripts, allows the content origin only when it differs from `'self'`, rejects a `contentBaseUrl` that is not an http(s) URL or a root-relative path, and `index.html` after the build carries it (read `dist/index.html`). Core: a sync that replaces a module's audio keeps the paths listed in `keepAudio`, and removes them on the next sync without it (real fixture rebuild). App: a sync during an open lesson does not delete that lesson's audio, so its listening item still plays (**Review Focus** carry-over); `refreshSession` skips reopening when `ContentService.version` has not changed since the last open and the session exists (assert `openSession` is called once across two Home mounts), and opens again after a sync changed content.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** `npm run test:e2e` (Task 10 adds more) must still pass under the policy: nothing the app does may need an inline script.
- [ ] **Step 4: Run** all checks and the existing end-to-end tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): add a content security policy and protect the open lesson's audio`

---

### Task 10: End-to-end tests for placement, speaking, me and wide screens

**Files:**

- Create: `apps/learner/e2e/{placement.spec.ts,speaking.spec.ts,me.spec.ts,wide.spec.ts}`; modify `e2e/global-setup.ts` (adds a speaking item and a small audio file to English lesson 2 of the fixture through `fixture.rebuild`), `playwright.config.ts` (a second project with Chromium flags `--use-fake-device-for-media-stream` and `--use-fake-ui-for-media-stream` and the `microphone` permission for the speaking spec; the default project has no microphone permission)
- Test: the specs

**Interfaces:**

- Consumes: the helpers from Plan 2b (`createProfile`, `signIn`, `enterPin`, `playLesson`, `waitForOfflineReady`).

- [ ] **Step 1: Write the failing specs.**
  - `placement.spec.ts` (**Review Focus 3**): a new learner sees the placement card; takes the test (no feedback after answers), reaches the result with start lessons; **reload in the middle** returns to the picker, then Home still offers the test; skipping records the skip and the first lesson stays today's; with a high English score the English-only card appears and accepting switches the visible text to English.
  - `speaking.spec.ts` (**Review Focus 1 and 2**): with the fake microphone, a learner records about two seconds in lesson 2, hears it back, retries, moves on, and after a reload the recording count on the me screen is 1; in a context **without** the microphone permission the same item shows the Hindi explanation and `आगे` still works; in a context with no `MediaRecorder` (`addInitScript` deletes it) it shows the unsupported message and carries on.
  - `me.spec.ts` (**Review Focus 4**): language switch works; storage lists modules; sync button reports plainly while offline; `प्रोफ़ाइल बदलें` leads to the picker and browser Back stays on it; a second learner sees none of the first learner's data; sign out likewise.
  - `wide.spec.ts` (**Review Focus 5**): at 768 × 1024 and 1280 × 800, for home, lessons, practice, me and the placement result: no sideways scrolling, the icon rail (768) and labelled sidebar (1280) are visible and navigable, there is no bottom bar, the practice column is at most 640 px wide, and every visible button and link is at least 44 × 44 px.
- [ ] **Step 2: Run** `npm run test:e2e`. Expected: FAIL (fix the setup, not the specs).
- [ ] **Step 3: Implement** the config and setup changes. A real defect found by a spec is fixed test-first in the owning task's files and ledgered.
- [ ] **Step 4: Run** `npm run test:e2e`, `npm test`, `npm run test:cov`, `lint`, `typecheck`, `format:check`, and the size check. Expected: PASS; coverage ≥ 70%; first-load JavaScript ≤ 120 KB gzipped.
- [ ] **Step 5: Commit** `test(app): add end-to-end tests for placement, speaking, me and wide screens`

---

## What this plan satisfies

| Spec                                                         | Task(s)        |
| ------------------------------------------------------------ | -------------- |
| §6.3 placement test, skip, start lesson                      | 4, 5, 10       |
| §6.5 speak and compare, no automatic scoring                 | 1, 2, 3, 10    |
| §6.7 English-only suggestion, change any time                | 5, 6           |
| §7.1 recordings on the phone until synced                    | 1, 3           |
| §7.4 recordings visible only to learner and mentors; privacy | 1, 3, 6        |
| §11 mic denied: Hindi message, skippable, never blocks       | 2, 3, 10       |
| §5.3 profiles on a shared phone (switch, sign out)           | 6              |
| §5.4 recording format tested on cheap phones                 | 2 (field test) |
| Design canvas tablet and laptop layouts                      | 7, 10          |
| Plan 2b review minors and hardening                          | 8, 9           |

Deferred to later plans: uploading recordings and mentor review (Plans 3, 4), the placement retake at the end of the pilot, mentor, community and doubt tabs, "download only the next module".
