# AGENTS.md

Instructions for any AI coding agent working in this repository (Gemini, Codex, Claude or other).
`CLAUDE.md` holds the same rules for Claude Code; where they differ, `CLAUDE.md` and
`.claude/rules/` win.

Shiksha Path is an offline-first learning PWA for Hindi-speaking students from villages and small
towns. It is an NGO project and **many students are minors**: treat their data (names, progress,
voice recordings) as sensitive at all times.

## Before you start

1. Read `WORKLOG.md`, then the plan you were given in `docs/superpowers/plans/`, then the spec it
   names (`docs/superpowers/specs/2026-10-15-learning-platform-design.md`).
2. Read the rule files your work touches: `.claude/rules/coding.md`, `testing.md`, `security.md`,
   `privacy.md`, `architecture.md`, `offline-sync.md`, `database.md`, `git-and-pr.md`.
3. Work in a git worktree or branch named `feature/<slug>` or `fix/<slug>`, cut from `main`.
   **Never commit or push to `main`.**
4. Run `npm ci` once in every new clone or worktree. It installs the git hooks that block commits on
   `main`, run lint and Prettier on staged files, scan for secrets and check commit messages.

## How to execute a plan

- Do the tasks **in order**, one at a time, exactly as written. The plan holds the decisions; do not
  redesign. If a step is impossible or contradicts the spec, make the smallest change that satisfies
  the spec and write it down (see "Deviations" below).
- **Tests first, always.** Write the test the step names, run it, and confirm it **fails for the
  reason expected** (a test that passes before the code exists proves nothing). Then write the
  smallest code that passes, then run it again.
- After each task run **all** of these and read the output; every one must pass:

  ```bash
  npm test               # Vitest (unit and integration)
  npm run lint           # ESLint, zero warnings
  npm run typecheck      # TypeScript strict + svelte-check
  npm run format:check   # Prettier
  ```

  Plans may add more (for example `npm run test:db`, `npm run test:e2e`, the size check).

- Commit once per task with the commit message the plan gives (Conventional Commits, imperative,
  header ≤ 100 characters, body lines ≤ 100 characters, a body that says why).
- Never claim something works without the command output that shows it.

## Hard rules (CI and review will reject the work otherwise)

- **Limits:** lines ≤ 100 characters; files ≤ 300 lines (tests 500, Svelte 200); functions ≤ 50
  lines; complexity ≤ 10; nesting ≤ 3; parameters ≤ 4. TypeScript strict, no `any`, no `console.*`.
- **No user-facing text in code:** every string goes in the i18n catalogue
  (`apps/learner/src/i18n/`) with both `hi` and `en`. Students never see technical error codes.
- **Privacy:** never log, put in URLs, or send to any third party a name, email, phone number,
  recording or doubt text. Logs carry ids only.
- **Secrets:** never in code, tests, fixtures, commits or the app bundle. Use environment settings.
- **Security:** validate every boundary with Zod; parameterised SQL only; every table has row-level
  security with a test proving two students cannot see each other's data.
- **Offline:** learning must work with the network off; sync failures never block a lesson.
- **Scope:** touch only what the task needs. No new dependencies unless the plan names them.

## Commands

| Command                                   | Purpose                           |
| ----------------------------------------- | --------------------------------- |
| `npm test`                                | All unit and integration tests    |
| `npm run test:cov`                        | Tests with coverage (minimum 70%) |
| `npm run lint` / `npm run lint:fix`       | ESLint                            |
| `npm run typecheck`                       | TypeScript and svelte-check       |
| `npm run format` / `npm run format:check` | Prettier                          |
| `npm run test:e2e`                        | Build the app and run Playwright  |
| `npm run dev -w @shiksha/learner-app`     | Run the app locally               |

Note: Prettier does not format `.svelte` files here; keep their lines within the limits by hand.

## Deviations and the hand-off

When the plan is done, open a pull request using `.github/pull_request_template.md`. In it, list:

- every place you deviated from the plan, why, and what it costs if wrong;
- every test you could not make fail first, and why;
- anything you left unfinished.

The product owner merges. A separate independent review (by Claude) checks the whole branch before
merge, so be precise and honest in that list.
