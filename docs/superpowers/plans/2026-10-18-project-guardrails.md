# Project Guardrails Implementation Plan (Plan 0 of 6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Before any product code exists, set up the rules, reviewers, hooks and CI that every later plan runs under: code-size limits, conventional commits, secret scanning, blocked direct work on `main`, read-only spec/code/security reviewer agents, and a CI pipeline that fails on lint, tests, coverage, vulnerable dependencies, leaked secrets or security findings.

**Architecture:** Root npm workspace with shared tooling (ESLint flat config, Prettier, TypeScript base config, Vitest). Husky runs lint-staged, secretlint and commitlint locally. A pre-push hook blocks pushes to `main`. Claude Code reads a short `CLAUDE.md` plus topic rules in `.claude/rules/`, and hooks in `.claude/settings.json` block edits on `main` and writes to secret files. GitHub Actions repeats every local check server-side. All security checks block, none are report-only.

**Tech Stack:** Node 22, npm workspaces, TypeScript (strict), ESLint 9 (flat config) + typescript-eslint, Prettier, Vitest + `@vitest/coverage-v8`, Husky, lint-staged, commitlint, secretlint, GitHub Actions (gitleaks, Trivy, CodeQL, npm audit), Dependabot.

**Spec:** `docs/superpowers/specs/2026-10-15-learning-platform-design.md` (§5.5 portability rules, §7.4 privacy, §9 AI guardrails, §12 testing). Practices adapted from `heidi.microservices` (rules folder, read-only reviewer agents, worklog, decision records, gotchas, commitlint, Prettier, PR template), made stricter where noted.

**Repo:** `github.com/sabhinav9889/shiksha-path` (private). Free plan, so no server-side branch protection: local hooks enforce "no direct work on `main`" until the repo moves to a GitHub for Nonprofits org or Pro.

## Global Constraints

- Line length **100** characters (Prettier `printWidth: 100`, ESLint `max-len` code 100, ignoring URLs, strings and template literals).
- File length **300** lines (`max-lines`, skip blank lines and comments), test files **500**, Svelte components **200**.
- Function length **50** lines (`max-lines-per-function`, skip blanks/comments); tests exempt.
- Cyclomatic complexity **10** (`complexity`); nesting depth **3** (`max-depth`); parameters **4** (`max-params`).
- `@typescript-eslint/no-explicit-any: error`, `@typescript-eslint/no-floating-promises: error`, `@typescript-eslint/explicit-function-return-type: error` (exported functions), `eqeqeq: ['error', 'always', { null: 'ignore' }]`, `no-console: error`, `no-eval: error`, `no-var: error`, `prefer-const: error`, `default-case: error`, `no-magic-numbers: warn` (ignore -1, 0, 1, 2, 10, 100, 1000; tests exempt).
- ESLint runs with `--max-warnings 0` in hooks and CI.
- Commits: conventional (`feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert`), scope kebab-case, header ≤ 100, subject ≥ 10 chars, no trailing period.
- Coverage threshold **70%** lines/functions/branches/statements (heidi parity), applied per package once it has code.
- CI security jobs **block** the PR (`npm audit --audit-level=high`, gitleaks, Trivy `exit-code: 1` on HIGH/CRITICAL, CodeQL). Stricter than heidi's report-only setup.
- Every disable comment must be `// eslint-disable-next-line <rule> -- <reason>`; bare disables fail lint (`eslint-comments/require-description`).

## Review Focus

1. **The main-branch guards must not block legitimate work.** On a detached HEAD (rebase in progress) or a new repo with no commits, the hooks must allow the action. Tested in Task 3 (`allows detached HEAD`).
2. **The secret scanner must not false-positive on lesson content.** Long Devanagari strings or base64-looking audio hashes in `content/` must not fail commits. Tested in Task 2 (`does not flag lesson text`).
3. **commitlint must accept the Claude co-author trailer** (`Co-Authored-By: … <noreply@anthropic.com>`), or every agent commit fails. Tested in Task 2.
4. **Size limits must apply to the right files.** Test files get 500 lines, generated files are ignored, and content Markdown is never linted as code. Tested in Task 1.
5. **Hook scripts must work from a git worktree** and when `CLAUDE_PROJECT_DIR` is unset. Tested in Task 3 (`works without CLAUDE_PROJECT_DIR`).

---

### Task 1: Tooling baseline with size limits

**Files:**

- Create: `package.json` (root, `"private": true`, `"type": "module"`, `"workspaces": ["packages/*", "apps/*"]`, scripts below), `.nvmrc` (`22`), `.editorconfig`, `.gitignore` (`node_modules`, `dist`, `coverage`, `.env*` except `.env.example`), `.prettierrc`, `.prettierignore`, `tsconfig.base.json` (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `module: NodeNext`), `eslint.config.js`, `vitest.config.ts` (root, `coverage.thresholds` all 70)
- Create: `tooling/lint-fixtures/` (fixture sources used only by tests; ignored by the main lint run)
- Test: `tooling/test/eslint-limits.test.ts`

**Interfaces:**

- Produces: root scripts `lint` (`eslint . --max-warnings 0`), `lint:fix`, `format` (`prettier --write .`), `format:check`, `typecheck` (`tsc -b`), `test` (`vitest run`), `test:cov` (`vitest run --coverage`). Later plans add packages under `packages/` and `apps/` that inherit these configs.

`.prettierrc`: `{ "singleQuote": true, "trailingComma": "all", "tabWidth": 2, "semi": true, "printWidth": 100, "bracketSpacing": true, "arrowParens": "always", "endOfLine": "lf" }`.

- [ ] **Step 1: Write the failing test** `tooling/test/eslint-limits.test.ts`. It uses the ESLint Node API (`new ESLint({ cwd: repoRoot })`, `lintText(code, { filePath })`), with a `ruleIds(code, filePath)` helper returning the set of `ruleId`s:
  - `flags a 101-character line` → contains `max-len`
  - `allows a long URL in a comment` → no `max-len`
  - `flags a 301-line source file` → contains `max-lines`
  - `allows a 400-line test file` (`x.test.ts`) → no `max-lines`
  - `flags a 51-line function` → contains `max-lines-per-function`
  - `flags complexity 11` → contains `complexity`
  - `flags nesting depth 4` → contains `max-depth`
  - `flags 5 parameters` → contains `max-params`
  - `flags any` → contains `@typescript-eslint/no-explicit-any`
  - `flags console.log` → contains `no-console`
  - `flags a bare eslint-disable` → contains `eslint-comments/require-description`
  - `ignores Markdown under content/` → `lintText` on `content/x.md` returns no messages (the file is ignored)

- [ ] **Step 2: Run** `npx vitest run tooling/test/eslint-limits.test.ts`. Expected: FAIL (no config).

- [ ] **Step 3: Install and configure.** Dev dependencies: `typescript eslint @eslint/js typescript-eslint eslint-plugin-eslint-comments eslint-config-prettier prettier vitest @vitest/coverage-v8 @types/node tsx`. Write `eslint.config.js` with the Global Constraints rules, a test-file override (`**/*.test.ts`, `**/*.spec.ts`: `max-lines` 500, `max-lines-per-function` off, `no-magic-numbers` off), a Svelte override placeholder (`**/*.svelte`: `max-lines` 200, active once Plan 2 adds the Svelte parser), and ignores (`dist`, `coverage`, `content/**`, `tooling/lint-fixtures/**`, `**/*.generated.*`).

- [ ] **Step 4: Run** `npx vitest run tooling/test/eslint-limits.test.ts && npm run lint && npm run format:check`. Expected: all PASS, and lint reports 0 problems.

- [ ] **Step 5: Commit** `build(tooling): add eslint size limits, prettier and vitest baseline`

---

### Task 2: Git hooks: lint-staged, secret scan, commitlint, no push to main

**Files:**

- Create: `.husky/pre-commit` (`npx lint-staged && npx secretlint --maskSecrets "**/*"` on staged files via lint-staged), `.husky/commit-msg` (`npx --no -- commitlint --edit "$1"`), `.husky/pre-push` (calls `tooling/hooks/block-main-push.sh`)
- Create: `.lintstagedrc.json`: `{ "*.{ts,js,svelte}": ["eslint --fix --max-warnings 0", "prettier --write"], "*.{json,md,yml,yaml}": ["prettier --write"], "*": ["secretlint --maskSecrets"] }`
- Create: `commitlint.config.js` (rules from Global Constraints; `footer-max-line-length` 100, `body-max-line-length` 300), `.secretlintrc.json` (`@secretlint/secretlint-rule-preset-recommend`), `.secretlintignore` (`content/**/audio/**`, `dist/**`)
- Create: `tooling/hooks/block-main-push.sh`: reads git pre-push stdin lines `<local ref> <local sha> <remote ref> <remote sha>` and exits 1 with `Direct push to main is blocked – open a PR from a feature branch.` when any remote ref is `refs/heads/main`; otherwise exits 0
- Test: `tooling/test/git-hooks.test.ts`

**Interfaces:**

- Consumes: Task 1 scripts.
- Produces: `npm run prepare` → `husky`. Hooks are active after `npm install`.

- [ ] **Step 1: Write the failing tests** (spawn the tools with `node:child_process` `spawnSync`):
  - `commitlint rejects "updated stuff"` → exit code ≠ 0
  - `commitlint accepts "feat(content): add lesson schema"` → exit 0
  - `commitlint accepts a body + Co-Authored-By trailer` → message `"fix(sync): retry failed batches\n\nWhy it matters.\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"` → exit 0
  - `secretlint flags a fake AWS key` (fixture `AKIAIOSFODNN7EXAMPLE`-style plus secret) → exit ≠ 0
  - `secretlint flags a private key block` → exit ≠ 0
  - `does not flag lesson text` (a Markdown fixture with long Devanagari text and a 64-hex audio hash) → exit 0
  - `block-main-push blocks refs/heads/main` → exit 1, stderr contains `Direct push to main is blocked`
  - `block-main-push allows refs/heads/feature/x` → exit 0

- [ ] **Step 2: Run.** Expected: FAIL.

- [ ] **Step 3: Install** `husky lint-staged @commitlint/cli @commitlint/config-conventional secretlint @secretlint/secretlint-rule-preset-recommend`, add the `prepare` script, then write the files above (`chmod +x` on the hook scripts).

- [ ] **Step 4: Run** `npx vitest run tooling/test/git-hooks.test.ts`, then make a throwaway commit with message `bad` on a scratch branch. Expected: tests PASS, and the scratch commit is rejected by commitlint (delete the scratch branch afterwards).

- [ ] **Step 5: Commit** `build(hooks): add lint-staged, secretlint, commitlint and main push guard`

---

### Task 3: Claude Code configuration: CLAUDE.md, rules, hooks

**Files:**

- Create: `CLAUDE.md` (≤ 120 lines): what the product is (2 lines); **source of truth = the spec + approved plans; never invent APIs, library behaviour or requirements: check docs/code or ask**; session start = read `WORKLOG.md` and print active tasks; task routing (see `.claude/task-router.md`); quick commands table; rules index (links to `.claude/rules/*`); reviewer agents table; "done" = tests shown passing + reviewers passed + `WORKLOG.md` updated; the self-correction rule (a wrong doc gets fixed in the same PR).
- Create: `.claude/rules/` with one short file each (≤ 80 lines, bullet form, heidi style):
  - `coding.md`: limits from Global Constraints, early returns, named constants, error codes (`ErrorCode` drives Hindi/English messages; never show raw errors), logger not console, minimal changes, "less code is better"
  - `architecture.md`: ports & adapters (`Storage`, `Auth`, `AIProvider`, `Calendar`, `Email` interfaces), repository layer only touches the DB, handlers → services → repositories, versioned `/v1` API through one app API module (§5.5), no Supabase imports outside adapters, patterns list and the "deliberately not using" list from `docs/engineering-standards.md`
  - `testing.md`: TDD red → green → refactor, 70% coverage, mock factories `makeX(overrides)`, **always test data isolation with 2+ students and 2+ cohorts**, offline/sync scenarios in Playwright
  - `security.md`: validate every boundary with Zod, RLS on every table + API-level checks (defence in depth), least-privilege OAuth scopes, secrets only in env, rate limits, no stack traces to clients, signed URLs for recordings
  - `privacy.md`: India DPDP + minors: collect only §7.4 data, never log personal data (IDs only), retention table (recordings 30 days after review, logs 90 days), export + cascade delete on request, anonymised audit entries after deletion, nothing identifying sent to AI providers
  - `ai-guardrails.md`: student text is data never instructions (delimited in prompts), topic limits, answer length caps, PII masking before send, safeguarding path (§9.1), prompt changes require the fixed eval set to pass, log every AI call (feature, tokens, cohort)
  - `database.md`: SQL migrations in git (timestamped, idempotent, up + down), soft deletes, indexes on FK and filter columns, RLS policy per table with a test
  - `offline-sync.md`: outbox events with unique IDs, idempotent server ingest, never block a lesson on network, bundle verification before use
  - `git-and-pr.md`: branch `feature/<slug>` | `fix/<slug>` from `main`, conventional commits, one logical change per commit, PR template, never push to `main`
- Create: `.claude/settings.json` hooks: `PreToolUse` on `Edit|Write` → `.claude/hooks/block-main-edit.sh` and `.claude/hooks/block-secret-files.sh`; `PostToolUse` on `Edit|Write` → `.claude/hooks/auto-format.sh` (async, runs `npx prettier --write` on the edited file if it matches the Prettier globs).
- Create: the three hook scripts. Each reads the hook JSON from stdin and uses `${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}`.
  - `block-main-edit.sh`: exit 2 with message `Editing on main is blocked – create a feature branch.` when the current branch is `main`; allow a detached HEAD or a repo with no commits
  - `block-secret-files.sh`: exit 2 when `tool_input.file_path` basename matches `.env`, `.env.*` (except `.env.example`), `*.pem`, `*.key`, or `credentials*.json`
- Test: `tooling/test/claude-hooks.test.ts`

- [ ] **Step 1: Write the failing tests.** Each runs a hook script in a temp git repo created with `git init`, with JSON on stdin:
  - `blocks edit on main` → exit 2
  - `allows edit on feature branch` → exit 0
  - `allows detached HEAD`
  - `allows repo with no commits`
  - `works without CLAUDE_PROJECT_DIR` (env unset, cwd inside the repo)
  - `blocks writing .env` / `blocks .env.production` / `allows .env.example` / `blocks key.pem`
  - `CLAUDE.md is at most 120 lines` and `every rules file is at most 80 lines` (read the files)
  - `CLAUDE.md links resolve` (every relative link target exists)

- [ ] **Step 2: Run.** Expected: FAIL.

- [ ] **Step 3: Write** `CLAUDE.md`, the rules, the settings and the hook scripts (`chmod +x`).

- [ ] **Step 4: Run** `npx vitest run tooling/test/claude-hooks.test.ts && npm run format:check`. Expected: PASS.

- [ ] **Step 5: Commit** `chore(claude): add CLAUDE.md, project rules and safety hooks`

---

### Task 4: Reviewer and planner agents, task router

**Files:**

- Create: `.claude/agents/spec-reviewer.md`, `.claude/agents/code-reviewer.md`, `.claude/agents/security-reviewer.md`. All three are read-only (`tools: [Read, Grep, Glob]`, `model: opus`). Each has: purpose, when to run, a checklist, and an **output format** of `PASS` or `FAIL` plus findings `{file:line, severity: critical|high|medium|low, issue, fix}`, stating that it never edits code.
  - spec-reviewer: compares the diff with the task's plan section and the spec. Flags anything **missing, extra or invented** (APIs, fields, behaviour not in the spec or plan)
  - code-reviewer: `.claude/rules/coding.md`, `architecture.md`, `testing.md` checklists; size limits; justified disables only; tests actually assert behaviour
  - security-reviewer: checklist covering auth/session, RLS on every new table + its isolation test, API permission checks, Zod validation, secrets, SQL/HTML injection, **prompt injection via student text**, personal data sent to AI/logs, recordings access (signed URLs, minors), rate/doubt limits, OAuth scopes, error leakage, new dependencies (`npm audit`)
- Create: `.claude/agents/architect.md` (`model: opus`, read-only): plans and pressure-tests risky changes before implementation
- Create: `.claude/task-router.md`, a short version of heidi's: classify feature | fix | bug-hunt | refactor. **Always** run spec, code and security reviewers before a task is done. Run `architect` first when the task touches auth, RLS/policies, sync protocol, AI prompts, safeguarding, payments, or more than one package.
- Test: `tooling/test/agents.test.ts`

- [ ] **Step 1: Write the failing tests:** parse each agent's YAML front-matter (use the `yaml` package):
  - `every reviewer is read-only` → `tools` ⊆ `[Read, Grep, Glob]` for spec-, code- and security-reviewer and architect
  - `every agent has name, description, model`
  - `security-reviewer checklist mentions prompt injection, RLS, secrets, minors` (string contains)
  - `every agent defines PASS/FAIL output`

- [ ] **Step 2: Run.** Expected: FAIL.

- [ ] **Step 3: Write** the four agents and the task router.

- [ ] **Step 4: Run** `npx vitest run tooling/test/agents.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit** `chore(claude): add spec, code and security reviewers and task router`

---

### Task 5: Engineering docs, decision records, worklog

**Files:**

- Create: `docs/engineering-standards.md`: the design-pattern table (what, where, why) and the "deliberately not using" list agreed in conversation; practices (code, testing, git, ADRs, performance budgets: app JS ≤ 150 KB gzip, first screen < 3 s on slow 3G, bundle ≤ 5 MiB; observability; OWASP ASVS L2 as the security target; accessibility; config); the size-limit table; "where enforced" for each rule
- Create: `docs/decisions/README.md` (format: Context → Decision → Consequences; filenames `<topic>-<YYYY-MM-DD>-<slug>.md`) and four ADRs dated 2026-10-18: `backend-…-supabase.md`, `app-…-pwa.md`, `sync-…-offline-first-outbox.md`, `backend-…-portability-rules.md`, each summarising the spec's reasoning and alternatives rejected
- Create: `docs/gotchas/README.md` (format: what breaks, why, fix; first entry: `github-free-private-no-branch-protection.md`)
- Create: `WORKLOG.md` (index table: task, status, assignee, branch, next step, detail link; statuses `in-progress | blocked | shipped | on-hold`) and `.claude/worklog/README.md` (detail-file template from heidi)
- Create: `docs/self-correction.md` (heidi's 5 phases, condensed to ≤ 40 lines)
- Test: `tooling/test/docs-links.test.ts`

- [ ] **Step 1: Write the failing test** `every relative Markdown link under docs/, CLAUDE.md, WORKLOG.md and .claude/ resolves to an existing file` (walk the files, regex `\]\((?!https?:|#)([^)]+)\)`).
- [ ] **Step 2: Run.** Expected: FAIL (the files don't exist yet).
- [ ] **Step 3: Write** the docs and add a `WORKLOG.md` entry for Plan 0 (status `in-progress`).
- [ ] **Step 4: Run** `npx vitest run tooling/test/docs-links.test.ts && npm run format:check`. Expected: PASS.
- [ ] **Step 5: Commit** `docs: add engineering standards, ADRs, gotchas and worklog`

---

### Task 6: GitHub: CI, security scanning, PR template, Dependabot

**Files:**

- Create: `.github/workflows/ci.yml`. On `pull_request` and `push` to `main`, runs on `ubuntu-latest` with Node from `.nvmrc`, `npm ci`, then: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test:cov` (fails under 70%), `npx commitlint --from origin/main --to HEAD` on PRs.
- Create: `.github/workflows/security.yml`. On `pull_request`, `push` to `main` and weekly (Monday 06:00 UTC); `permissions: contents: read, security-events: write`. Jobs: `npm audit --audit-level=high` (**blocking**), `gitleaks/gitleaks-action` (full history), `aquasecurity/trivy-action` fs scan HIGH/CRITICAL `exit-code: '1'`, `github/codeql-action` (javascript-typescript). Pin actions to the current major version tags at implementation time and record them in the PR.
- Create: `.github/pull_request_template.md`: Summary; Spec/plan section; Changes; **Impact checklist** (DB migration · RLS policy changed · new table has isolation test · AI prompt changed + eval set run · feature switch added · offline/sync behaviour changed · safeguarding touched · new dependency · personal data collected/sent); Reviewers (spec / code / security: PASS with link to report); Testing (commands + output); Screenshots (UI).
- Create: `.github/dependabot.yml` (npm + github-actions, weekly, grouped minor/patch), `SECURITY.md` (how to report a vulnerability privately; scope; no student data in issues).
- Create: `docs/gotchas/github-free-private-no-branch-protection.md`: free private repos can't require reviews/CI server-side. Local guards (Task 2, Task 3) cover it until the repo moves to a GitHub for Nonprofits org or Pro; then enable branch protection on `main` (1 approval, CI + Security required, no force push).

- [ ] **Step 1: Validate the workflow syntax locally:** `npx --yes @action-validator/cli .github/workflows/ci.yml` and the same for `security.yml`. Expected: no errors.
- [ ] **Step 2: Push the branch and open a PR** to `main` with the template filled in. Expected: CI and Security workflows run. All jobs green, or a real finding is fixed in this task.
- [ ] **Step 3: Prove a blocking check blocks:** push a throwaway commit to the PR branch adding a fake secret fixture outside the allowlist. Expected: gitleaks fails the Security workflow. Then remove the commit (`git reset --hard HEAD~1` + `git push --force-with-lease`, on this feature branch only).
- [ ] **Step 4: Commit** `ci: add ci and security workflows, pr template and dependabot`
- [ ] **Step 5: Final review:** run the spec-, code- and security-reviewer agents on the whole branch, fix any FAIL, set the Plan 0 `WORKLOG.md` entry to `shipped` after the PR is merged by the owner.

---

## Deviations recorded during execution

The plan above is kept as approved. These are the decisions made while building it (the full
ledger lives in the git-ignored `.superpowers/` workspace; this section is the durable record).

- **Task order** 1, 2, 5, 3, 4, 6: `CLAUDE.md`'s link test needs Task 5's docs. The task router
  and the branch-protection gotcha were created earlier than listed for the same reason.
- **ESLint 10** was installed (plan: 9), so the maintained
  `@eslint-community/eslint-plugin-eslint-comments` replaces `eslint-plugin-eslint-comments`.
  `explicit-module-boundary-types` replaces `explicit-function-return-type`. Type-aware rules apply
  to real files in `packages/`, `apps/`, `tooling/`.
- **Svelte:** the 200-line override and `*.svelte` in lint-staged wait for Plan 2's Svelte parser.
- **typecheck** is `tsc -p tsconfig.json --noEmit` (plan: `tsc -b`); there are no project
  references yet.
- **Hooks:** auto-format is synchronous (plan: async) so the next read sees formatted code; hook
  JSON is parsed with `node`. Pre-commit runs secretlint through lint-staged on staged files.
- **CI:** commitlint checks `base.sha..HEAD` (plan: `origin/main`). CodeQL is replaced by Semgrep
  and there is no `security-events: write`: CodeQL needs GitHub Advanced Security on private repos.
  Actions are pinned to commit SHAs and Dependabot has a 7-day cooldown (Semgrep findings).
  gitleaks needs `pull-requests: read`.
- **Blocking proven on real PR runs** (PR #2): run 1, Semgrep blocked on 11 real findings and
  gitleaks failed on a missing permission; run 2, gitleaks blocked on the fake key in a test
  fixture (fixed, its historical fingerprint allowlisted in `.gitleaksignore`); run 3, all green.
- **Final review fixes:** the edit guard now checks the edited file's checkout (worktrees) and
  refuses checkouts without installed hooks; a pre-commit guard blocks commits on `main`;
  lint-staged passes `--no-warn-ignored` so ESLint-ignored files can be committed; reviewer agents
  take a diff file because they have no shell.
