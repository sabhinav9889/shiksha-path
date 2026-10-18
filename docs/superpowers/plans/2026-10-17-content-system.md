# Content System Implementation Plan (Plan 1 of 6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A content toolchain that reads lesson files from `content/`, validates them, and builds versioned, verifiable module bundles that the learner app (Plan 2) downloads and the AI service (Plan 5) reads.

**Architecture:** One npm workspace package, `packages/content`. It holds Zod schemas (the content format, shared later with the app and Edge Functions), a filesystem loader, a cross-file validator, a pure bundle builder and a CLI. Authors edit Markdown + YAML in `content/`. The CLI writes `dist/content/` (manifest, per-module JSON bundles, content-addressed audio) for static hosting.

**Tech Stack:** Node 22 LTS, TypeScript (strict, ESM), npm workspaces, Zod, `yaml`, `gray-matter`, `marked`, Vitest, `tsx`.

**Spec:** `docs/superpowers/specs/2026-10-15-learning-platform-design.md` (§5.1, §6.2, §6.3, §6.6, §6.7, §9.2, §9.4, §12, §14)

### Plan series

Each plan produces working, testable software on its own. Plans 2–6 are written when the previous one is done, so they can use what was actually built.

1. **Content system** (this plan): format, validation, bundles.
2. **Learner app, offline core:** PWA shell, hi/en interface, local profiles and PIN, bundle download and verify, player for all item types, `why_wrong`, review queue, streak, test-out, placement, language preference, local outbox. No backend.
3. **Backend and sync:** Supabase migrations, `packages/core` API modules (§5.5), `/v1/sync` push and pull, Google sign-in and backup codes, ID mapping, feature switches (resolve and enforce), recordings upload, backups.
4. **Mentor view and admin panel** (§8, §8.1).
5. **AI features:** doubt solver with limits and safeguarding, weekly summaries, cost log, and the content pipeline (drafting, TTS, preview build).
6. **Mentor connect and community** (§10). Needs Google Workspace for Nonprofits to be approved.

## Global Constraints

- All learner-facing text exists in both `hi` and `en`, non-empty (§6.7: "the build checks both are present").
- One bundle per module, each with a version (§5.1). Size target "≤ a few MB": warn above **5 MiB** (5 × 1024 × 1024 bytes) of JSON plus audio _(builder's call)_.
- The build excludes any lesson that is not `review: approved` (§9.4). The `--preview` flag includes `pending` content for the mentor preview build.
- Validation covers: required fields, Hindi text present, referenced audio exists, `review: approved`, `why_wrong` present for wrong options (§12).
- Tracks are a list in the content (`content/tracks.yaml`), never hard-coded in code (§14).
- Practice item types: `mcq_meaning`, `fill_blank`, `word_order`, `listen_choose`, `speak_compare`, `aptitude` (§5.1). New types are added as new schemas in one union (§14).
- Allowed audio extensions: `.mp3`, `.m4a`, `.ogg`, `.opus`, `.webm` (audio format still open, §5.4).
- Default test-out pass mark: `0.8` _(builder's call)_.
- All text is Unicode NFC-normalised on load. Files may have a BOM and CRLF line endings.
- TypeScript `strict: true`, ESM only, Node 22. Runtime dependencies are limited to `zod`, `yaml`, `gray-matter` and `marked`.

## Review Focus

1. **Mentor-edited files with Windows line endings or a BOM.** A lesson saved with CRLF or a BOM must parse the same as an LF file. Tested in Task 2 (`parses CRLF + BOM like LF`).
2. **Devanagari in decomposed (NFD) form,** e.g. pasted `क़`. It must compare equal and bundle identically to the NFC form. Tested in Task 2 (`normalises text to NFC`).
3. **Audio paths that escape the module folder or differ only in case** (`../x.mp3`, `Audio/x.mp3`) must be errors, not silent successes on one OS. Tested in Task 4.
4. **Rebuilding unchanged content must not change versions,** or every phone re-downloads every module. Tested in Task 5 (`version is stable across builds`).
5. **Placement pointing at a lesson that the build excludes** (pending in a normal build) would send students to a missing lesson. It must be a build error. Tested in Task 4.

---

## Content format (reference for all tasks)

```
content/
  tracks.yaml                         # [{ id, title: {hi,en}, order }]
  placement/placement.yaml            # see Task 3
  placement/audio/*
  modules/<module-id>/module.yaml     # { id, track, title: {hi,en}, order, hi_ratio }
  modules/<module-id>/test-out.yaml   # { review, pass_mark?, items: [...] }
  modules/<module-id>/lessons/*.md    # front-matter + body
  modules/<module-id>/audio/*
```

Lesson file:

```markdown
---
id: ef1-01-greetings
track: english
module: english-foundation-1
topic: greetings
level: 1
order: 1
review: approved
title: { hi: 'नमस्ते कहना', en: 'Saying hello' }
audio: { hi: audio/ef1-01-hi.mp3 } # optional; paths relative to the module folder
items:
  - id: q1
    type: mcq_meaning
    prompt: { hi: "'Hello' का मतलब?", en: "What does 'Hello' mean?" }
    options:
      - { id: a, text: { hi: 'नमस्ते', en: 'A greeting' }, correct: true }
      - { id: b, text: { hi: 'अलविदा', en: 'Goodbye' }, why_wrong: { hi: '...', en: '...' } }
---

<!-- lang:hi -->

Hindi-first lesson text (Markdown) …
<!-- lang:en -->

English-only version …
```

`hi_ratio` is set on the module (§6.2 default). A lesson may override it with an optional `hi_ratio`.

---

### Task 1: Workspace scaffold and practice-item schemas

**Files:**

- Requires: Plan 0 merged (root workspace, lint/format/test tooling, hooks)
- Create: `packages/content/package.json` (name `@shiksha/content`, `"type": "module"`, scripts `test: vitest run`, `typecheck: tsc --noEmit`), `packages/content/tsconfig.json`
- Create: `packages/content/src/schema/localized.ts`, `packages/content/src/schema/items.ts`
- Test: `packages/content/test/items.test.ts`

**Interfaces:**

- Produces:
  - `localized: ZodType<Localized>`, `type Localized = { hi: string; en: string }` (both trimmed, non-empty, strict object)
  - `contentId: ZodString`, matching `/^[a-z0-9]+(-[a-z0-9]+)*$/`
  - `ITEM_TYPES` (readonly tuple of the six type names)
  - `practiceItem: ZodType<PracticeItem>`, `type PracticeItem` (discriminated union on `type`)
  - `type ChoiceOption = { id: string; text: Localized; correct?: boolean; why_wrong?: Localized }`

Item shapes (every item has `id: contentId`, `type`, `prompt: Localized`):

| type            | extra fields                                                                                              | rules                                                                              |
| --------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `mcq_meaning`   | `options: ChoiceOption[]` (2–6)                                                                           | exactly one `correct: true`; every other option has `why_wrong`; option ids unique |
| `listen_choose` | `audio: string`, `options`                                                                                | same as `mcq_meaning`                                                              |
| `aptitude`      | `options`, `explanation?: Localized`                                                                      | same as `mcq_meaning`                                                              |
| `fill_blank`    | `sentence: string`, `answers: string[]` (≥1), `common_wrong?: { answer: string; why_wrong: Localized }[]` | `sentence` contains `___` exactly once                                             |
| `word_order`    | `words: string[]` (≥2, correct order), `why_wrong?: Localized`                                            | —                                                                                  |
| `speak_compare` | `text: string`, `model_audio: string`                                                                     | —                                                                                  |

- [ ] **Step 1: Add the package.** The root workspace, TypeScript, ESLint, Prettier, Vitest and hooks already exist from Plan 0 (`2026-10-18-project-guardrails.md`), so don't recreate them. Create `packages/content` extending `tsconfig.base.json` and install `zod yaml gray-matter marked` in `@shiksha/content`.

- [ ] **Step 2: Write the failing tests** in `test/items.test.ts`:

```ts
const ok = (o: object) => practiceItem.safeParse(o);
const L = (s: string) => ({ hi: s, en: s });
const mcq = { id: 'q1', type: 'mcq_meaning', prompt: L('p'),
  options: [{ id: 'a', text: L('A'), correct: true }, { id: 'b', text: L('B'), why_wrong: L('w') }] };

test('accepts a valid mcq_meaning', () => expect(ok(mcq).success).toBe(true));
test('rejects mcq with no correct option', () => {
  const r = ok({ ...mcq, options: mcq.options.map(o => ({ ...o, correct: false })) });
  expect(r.success).toBe(false);
  expect(JSON.stringify(r.error!.issues)).toContain('exactly one correct');
});
test('rejects mcq with two correct options', ...);              // same message
test('rejects a wrong option without why_wrong', () => {
  const r = ok({ ...mcq, options: [mcq.options[0], { id: 'b', text: L('B') }] });
  expect(JSON.stringify(r.error!.issues)).toMatch(/why_wrong.*\bb\b/);
});
test('rejects empty en text', () => {
  const r = ok({ ...mcq, prompt: { hi: 'p', en: '  ' } });
  expect(r.error!.issues[0].path).toEqual(['prompt', 'en']);
});
test('fill_blank needs exactly one ___', ...);                  // 0 and 2 blanks both fail
test('word_order needs at least 2 words', ...);
test('rejects unknown type typing_test', ...);
test('rejects uppercase id', ...);                              // id: 'Q1'
```

- [ ] **Step 3: Run** `npm test -w @shiksha/content`. Expected: FAIL (modules not found).

- [ ] **Step 4: Implement** `localized`, `contentId`, `ITEM_TYPES`, `practiceItem` with the shapes and rules in the table. Choice rules go in one shared `superRefine` helper used by the three option-based types.

- [ ] **Step 5: Run** `npm test -w @shiksha/content && npm run typecheck`. Expected: all PASS, no type errors.

- [ ] **Step 6: Commit** `feat(content): add package and practice-item schemas`

---

### Task 2: Lesson file parsing

**Files:**

- Create: `packages/content/src/issues.ts`, `packages/content/src/schema/lesson.ts`, `packages/content/src/parse-lesson.ts`
- Test: `packages/content/test/parse-lesson.test.ts`

**Interfaces:**

- Consumes: `localized`, `contentId`, `practiceItem` (Task 1)
- Produces:
  - `type ContentIssue = { file: string; path?: string; message: string; severity: 'error' | 'warning' }`
  - `type ParseResult<T> = { ok: true; value: T } | { ok: false; issues: ContentIssue[] }`
  - `lessonMeta` schema / `type LessonMeta = { id; track; module; topic: string; level: number (int ≥1); order: number (int ≥1); hi_ratio?: number (0–1); review: 'pending' | 'approved'; title: Localized; audio?: { hi?: string; en?: string }; items: PracticeItem[] (≥1) }`
  - `type Lesson = { file: string; meta: LessonMeta; body: { hi: string; en: string } }` (body is Markdown)
  - `parseLessonFile(source: string, file: string): ParseResult<Lesson>`
  - `nfc<T>(value: T): T`: deep NFC normalisation of every string

- [ ] **Step 1: Write the failing tests.** Build sources with a small `lessonSource(overrides)` helper in the test file.
  - `parses a valid lesson`: `meta.id === 'ef1-01-greetings'`, `body.hi` contains `नमस्ते`, `body.en` contains `Hello`
  - `parses CRLF + BOM like LF`: `'﻿' + src.replace(/\n/g, '\r\n')` gives a deep-equal `value` to the LF parse
  - `normalises text to NFC`: a title containing `'क़'` (NFD क़) equals `'क़'` after parse
  - `reports a missing en section`: one issue, severity `error`, message contains `missing <!-- lang:en -->`
  - `reports an empty hi section`: the section is whitespace only, message contains `empty`
  - `reports a duplicated language marker`
  - `reports text before the first marker`
  - `reports invalid review value`: `review: done` gives an issue with `path === 'review'`
  - `reports duplicate item ids within a lesson`

- [ ] **Step 2: Run.** Expected: FAIL.

- [ ] **Step 3: Implement** `parseLessonFile`. Strip the BOM, convert CRLF to LF, parse with `gray-matter`, `nfc()` the result, validate with `lessonMeta.safeParse` (map Zod issues to `ContentIssue` with dotted `path`), then split the body on `<!-- lang:(hi|en) -->` markers and trim each section.

- [ ] **Step 4: Run.** Expected: PASS.

- [ ] **Step 5: Commit** `feat(content): parse lesson files`

---

### Task 3: Structure schemas and content loader

**Files:**

- Create: `packages/content/src/schema/structure.ts`, `packages/content/src/load.ts`
- Create: `packages/content/test/helpers/content-dir.ts`, `packages/content/test/helpers/fixture.ts`
- Test: `packages/content/test/load.test.ts`

**Interfaces:**

- Consumes: `parseLessonFile`, `ContentIssue`, `practiceItem`, `localized` (Tasks 1–2)
- Produces:
  - `type Track = { id: string; title: Localized; order: number }`
  - `type ModuleMeta = { id: string; track: string; title: Localized; order: number; hi_ratio: number }`
  - `type TestOut = { review: 'pending' | 'approved'; pass_mark: number /* default 0.8 */; items: PracticeItem[] }`
  - `type Placement = { review: 'pending' | 'approved'; sections: PlacementSection[] }`
  - `type PlacementSection = { track: string; items: PracticeItem[]; start_rules: { min_score: number; start_lesson: string }[]; suggest_english_only_at?: number }`
  - `type LoadedModule = { dir: string; meta: ModuleMeta; lessons: Lesson[] /* sorted by meta.order */; testOut: TestOut | null }`
  - `type Content = { root: string; tracks: Track[]; modules: LoadedModule[]; placement: Placement | null; placementDir: string }`
  - `loadContent(root: string): Promise<{ content: Content; issues: ContentIssue[] }>`
  - Test helpers: `makeContentDir(files: Record<string, string | Buffer>): Promise<string>` (writes into a fresh `mkdtemp` dir), `validFixture(): Record<string, string | Buffer>` (two tracks `english`, `aptitude`; modules `english-foundation-1` with 2 approved lessons and `aptitude-1` with 1 approved lesson; approved test-outs; approved placement; one small audio file used by a `listen_choose` item). Tasks 4–6 reuse these.

- [ ] **Step 1: Write the failing tests:**
  - `loads the valid fixture with no issues`: 2 tracks, 2 modules, lessons sorted by `order`, placement present
  - `module.yaml id must match folder name`: error on `modules/x/module.yaml`
  - `lesson module field must match its folder`
  - `missing test-out.yaml is an error`: message contains `test-out.yaml`
  - `missing placement.yaml is an error`
  - `missing tracks.yaml is an error`
  - `a broken lesson does not stop other lessons loading`: one issue, and the other lessons are still present
  - `test-out pass_mark defaults to 0.8`

- [ ] **Step 2: Run.** Expected: FAIL.

- [ ] **Step 3: Implement** the schemas and `loadContent`. Parse YAML with `yaml`, `nfc()` all text, collect issues and keep going (never throw on bad content).

- [ ] **Step 4: Run.** Expected: PASS.

- [ ] **Step 5: Commit** `feat(content): load content tree`

---

### Task 4: Cross-file validation

**Files:**

- Create: `packages/content/src/validate.ts`
- Test: `packages/content/test/validate.test.ts`

**Interfaces:**

- Consumes: `Content`, `ContentIssue` (Task 3)
- Produces: `validateContent(content: Content, opts: { preview: boolean }): Promise<ContentIssue[]>`

Rules (error unless marked warning):

1. Lesson ids are unique across all modules. Report both files.
2. Module ids are unique. Each module's `track` exists in `tracks.yaml`. Each lesson's `track` equals its module's `track`.
3. Lesson `order` values are unique within a module.
4. Every audio reference (`meta.audio.*`, `listen_choose.audio`, `speak_compare.model_audio`, and placement item audio relative to `placement/`) is relative, has no `..` segment, has an allowed extension, and exists with **exact** case (check against `readdir` of its folder).
5. Placement: each section's `track` exists; `start_rules` is non-empty and contains `min_score: 0`; each `start_lesson` exists and belongs to a module of that section's track. When `!preview`, each `start_lesson` must be `approved`. Message: `placement starts at <id>, which is not approved`.
6. When `!preview`: each `pending` lesson gives a **warning** `excluded from build (review: pending)`.
7. **Warning:** a lesson with fewer than 5 or more than 10 items (§6.1).

- [ ] **Step 1: Write the failing tests,** one per rule, each starting from `validFixture()` with one change:
  - `valid fixture has no errors` (both `preview` values)
  - `duplicate lesson id across modules`
  - `module track not in tracks.yaml`
  - `lesson track differs from module track`
  - `duplicate lesson order in module`
  - `audio path with .. is rejected`
  - `audio file missing`
  - `audio case mismatch is rejected` (file `Hello.mp3`, referenced as `hello.mp3`)
  - `audio with .wav extension is rejected`
  - `placement start_lesson unknown`
  - `placement without a min_score 0 rule`
  - `placement start_lesson pending: error normally, no error with preview`
  - `pending lesson warns when not preview`
  - `lesson with 3 items warns`

- [ ] **Step 2: Run.** Expected: FAIL.

- [ ] **Step 3: Implement** `validateContent`, with each rule as a small function returning `ContentIssue[]`.

- [ ] **Step 4: Run.** Expected: PASS.

- [ ] **Step 5: Commit** `feat(content): cross-file validation`

---

### Task 5: Bundle builder

**Files:**

- Create: `packages/content/src/bundle.ts`, `packages/content/src/build.ts`
- Test: `packages/content/test/build.test.ts`

**Interfaces:**

- Consumes: `Content`, `LoadedModule` (Task 3)
- Produces:
  - `selectForBuild(content: Content, opts: { preview: boolean }): Content`. Drops pending lessons, sets `testOut` and `placement` to `null` if pending, and drops modules left with no lessons. With `preview` it returns everything.
  - `bundleVersion(json: string): string`: the first 12 hex characters of the SHA-256
  - `writeBuild(content: Content, outDir: string, opts: { preview: boolean; now: Date }): Promise<{ manifest: Manifest; issues: ContentIssue[] }>`
  - `type ModuleBundle = { schema_version: 1; id; version; track; title: Localized; hi_ratio: number; lessons: BundleLesson[]; test_out: { pass_mark: number; items: PracticeItem[] } | null; audio: { path: string; sha256: string; bytes: number }[] }`
  - `type BundleLesson = { id; order; topic; level; hi_ratio: number /* lesson override or module */; title: Localized; html: { hi: string; en: string }; audio: { hi?: string; en?: string } | null; items: PracticeItem[] }`
  - `type Manifest = { schema_version: 1; built_at: string; preview: boolean; tracks: Track[]; modules: { id; track; title: Localized; order; version; file: string; sha256: string; bytes: number; audio_bytes: number; lessons: { id; order; title: Localized }[] }[]; placement: { file: string; version: string; sha256: string } | null }`

Output layout:

- `<out>/manifest.json`
- `<out>/modules/<id>.<version>.json`
- `<out>/placement.<version>.json`
- `<out>/audio/<sha256 first 16 hex>.<ext>`, content-addressed. Every audio reference in bundles is rewritten to `audio/<name>`.

`version` is computed over the bundle JSON with `version: ""`, so it depends only on content. `built_at` appears only in the manifest. Markdown bodies are rendered to HTML with `marked` at build time. Issue a **warning** when a module's `bytes + audio_bytes` exceeds 5 MiB.

- [ ] **Step 1: Write the failing tests** (build `validFixture()` into a temp out dir):
  - `writes manifest with both modules and placement`
  - `excludes a pending lesson normally and includes it with preview`
  - `omits a module whose lessons are all pending`
  - `test_out is null when test-out is pending`
  - `version is stable across builds`: two builds into different dirs give equal versions and byte-identical module files
  - `version changes when lesson text changes`
  - `manifest sha256 and bytes match the written file`
  - `audio is content-addressed and deduplicated`: two references to identical audio produce one file, and the bundle references `audio/<16hex>.mp3`
  - `lesson html is rendered`: `html.hi` contains `<p>`
  - `warns above 5 MiB`: a 6 MiB audio buffer in the fixture gives one warning naming the module

- [ ] **Step 2: Run.** Expected: FAIL.

- [ ] **Step 3: Implement** `selectForBuild`, `bundleVersion` and `writeBuild`. Use `node:crypto` for SHA-256 and build objects in a fixed key order so the JSON is deterministic.

- [ ] **Step 4: Run.** Expected: PASS.

- [ ] **Step 5: Commit** `feat(content): versioned module bundles`

---

### Task 6: CLI, sample content and author guide

**Files:**

- Create: `packages/content/src/cli.ts`, `packages/content/src/index.ts` (re-exports schemas, types, `loadContent`, `validateContent`, `selectForBuild`, `writeBuild`)
- Create: `content/` sample tree. It must pass validation: tracks `english` and `aptitude`; module `english-foundation-1` with 1 approved lesson (greetings) of 5 items and a test-out; module `aptitude-1` with 1 approved lesson of 5 puzzles and a test-out; placement with one section per track. No audio files yet; TTS arrives in Plan 5.
- Create: `content/README.md`, the author guide: the folder layout, the lesson format above, the item table, review status, and how to run the build
- Modify: root `package.json`, adding the scripts `content:check` and `content:build`
- Test: `packages/content/test/cli.test.ts`

**Interfaces:**

- Consumes: `loadContent`, `validateContent`, `selectForBuild`, `writeBuild`
- Produces: `runCli(argv: string[], io: { log(msg: string): void; error(msg: string): void }): Promise<number>`. Flags: `--content <dir>` (default `content`), `--out <dir>` (default `dist/content`), `--preview`, `--check` (validate only, write nothing).

Behaviour: load, then validate. Print each issue as `<severity> <file>[ <path>]: <message>`. On any error, return `1` and write nothing. Otherwise empty `--out`, build, print warnings, print `Built <n> modules, <m> lessons → <out>`, and return `0`.

- [ ] **Step 1: Write the failing tests:**
  - `returns 1 and prints file: message for invalid content`, with no out dir created
  - `returns 0 and writes manifest.json for the valid fixture`
  - `--check writes nothing`
  - `removes stale files from the out dir`
  - `--preview includes pending lessons`

- [ ] **Step 2: Run.** Expected: FAIL.

- [ ] **Step 3: Implement** `runCli` and a `main` guard calling `process.exit(await runCli(process.argv.slice(2), console))`. Root scripts: `"content:check": "tsx packages/content/src/cli.ts --check"` and `"content:build": "tsx packages/content/src/cli.ts"`.

- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: all PASS.

- [ ] **Step 5: Write the sample `content/` and `content/README.md`**, then run `npm run content:build`. Expected: exit 0, `Built 2 modules, 2 lessons → dist/content`, with no errors and no warnings.

- [ ] **Step 6: Commit** `feat(content): CLI, sample content and author guide`

---

## Deviations recorded during execution

The plan above is kept as approved; these are the decisions made while building it.

- **gray-matter dropped.** It's unmaintained, pulls a `js-yaml` with a known advisory, and supports
  `---js` front-matter that executes code. Front-matter is split by a small function and parsed
  with `yaml`. Runtime dependencies: `zod` (v4), `yaml`, `marked`.
- **NFC test.** Nukta letters (क़, फ़…) are Unicode composition exclusions, so NFC keeps them
  decomposed. The test now checks that precomposed and decomposed input parse to the same string.
  `\u` escapes are written with `String.fromCodePoint` (see `docs/gotchas/unicode-escapes-become-literal.md`).
- **Safer Markdown.** Lesson HTML escapes raw HTML and drops `javascript:`/`data:` links and images.
- **Safer CLI.** It refuses an `--out` folder that contains the content folder; it has `--help` and
  rejects unknown flags.
- **Prettier** ignores `/content/` (anchored: an unanchored `content/` also matched
  `packages/content/`). This resolves a deferred Plan 0 minor.
- **Root `typecheck`** now covers `packages/*`, so CI type-checks product code.
- **Extra tests** beyond the plan: option bounds and duplicates, absolute audio paths, test-out and
  placement audio, placement track checks, lesson-level audio, pending placement, CLI safety.

### Follow-up after the final review (merged early as PR #3; fixes in a follow-up PR)

- **Critical:** the `javascript:` filter could be bypassed with HTML entities
  (`java&#115;cript:`). Links now use an allowlist (`http`, `https`, `mailto`, relative, `#`),
  checked after decoding entities and removing control characters. Images must be local.
- BOM/CRLF is now handled in every YAML file, not just lessons.
- Audio paths: `\` is rejected, each path segment's case is checked (macOS/Windows), the target
  must be a regular file, and validation and build share one path resolver.
- The placement bundle lists its audio (`path`, `sha256`, `bytes`); the manifest's placement
  entry has `bytes` and `audio_bytes`, so the app can verify it like a module.
- Item ids must be unique within each test-out and across the placement test. Track ids and
  module order values must be unique.
- A pending placement test or test-out now gives a warning instead of disappearing silently.
- The CLI builds into a temporary folder and swaps it in only when the build succeeds. It refuses
  to replace a non-empty folder that isn't a previous build (`--out docs` is refused).
