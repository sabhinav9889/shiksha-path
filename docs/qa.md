# Quality assurance

How Shiksha Path is tested, how AI helped, how its output was validated, and what is not covered.
Numbers below were produced by running the commands shown, on 2026-10-26.

## Test layers

| Layer                   | Tool                                    | Command                                      | Result on 2026-10-26                                                               |
| ----------------------- | --------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------- |
| Unit and integration    | Vitest, in memory                       | `npm test`                                   | 993 tests in 90 files, all passing                                                 |
| Coverage                | Vitest with V8                          | `npm run test:cov`                           | 90.1% statements, 79.0% branches, 89.2% functions, 91.7% lines (CI minimum is 70%) |
| Database                | Vitest, local Postgres                  | `npm run test:db` (needs `npm run db:start`) | 153 tests in 9 files, all passing (see note)                                       |
| End to end              | Playwright, Chromium                    | `npm run test:e2e`                           | 9 spec files; run in CI on every pull request                                      |
| End to end with backend | Playwright                              | `npm run test:e2e:backend`                   | Runs against the local Supabase stack                                              |
| Static analysis         | ESLint, `tsc`, `svelte-check`, Prettier | `npm run lint`, `typecheck`, `format:check`  | 0 warnings, 0 errors                                                               |
| Content checks          | `content:check`                         | `npm run content:check`                      | Validates every lesson and quiz                                                    |
| Size budget             | `check-bundle-size`                     | `npm run size -w @shiksha/learner-app`       | First load must stay under 120 KB gzipped                                          |

**Note on the database run:** the first attempt had one failure, because the git-ignored file
`supabase/functions/.env.local` did not exist in this checkout. It is created by copying
`supabase/functions/.env.local.example` (placeholder values only). With the file in place the
affected file passed, 12 of 12. This is recorded as a
[gotcha](gotchas/db-tests-need-functions-env-local.md).

The end-to-end tests were not re-run for this document; CI runs them on every pull request.

## What is tested

- **Behaviour, not implementation.** Tests assert outputs and effects, and mocks are used only at
  the edges (AI, calendar, email, clock) ([testing rule](../.claude/rules/testing.md)).
- **Data isolation.** Every repository and every row-level-security policy is tested with at least
  two students and two cohorts, proving one cannot read or change the other's data.
- **Offline behaviour.** Lessons work with the network off; a failed sync retries; duplicate events
  do not double-count; a second device restores progress; an old bundle version keeps working.
- **Same behaviour in memory and in Postgres.** Shared contract suites in
  `packages/server/src/testing/` run against the in-memory repositories and against Postgres, so the
  fast tests and the real database cannot drift apart.
- **Migrations and RLS.** Migration and policy tests run against a real local Supabase stack.
- **Admin tooling.** The admin CLI, workflow definitions and git hooks have their own tests under
  `tooling/test/`.
- **Safety nets in the repository itself.** Commit hooks block commits to `main`, run lint and
  Prettier on staged files, scan for secrets and check commit messages. CI repeats them.

## How AI was used for QA

- **Tests first.** For each plan task, the AI writes the test the plan names, runs it, and confirms
  it fails for the expected reason before writing code. A test that passes before the code exists
  proves nothing, so that case is treated as a defect in the test.
- **Test generation and edge cases.** The AI proposes extra cases for each task: boundary values,
  failure paths, duplicate and out-of-order events, and the two-students-two-cohorts isolation
  cases.
- **Negative testing.** The `security-reviewer` agent works through a written checklist (access
  control, RLS, injection, prompt injection, secrets, minors' data) and tries to find ways the
  change could be abused.
- **Independent review.** `spec-reviewer` finds missing, extra or invented behaviour against the
  spec and plan; `code-reviewer` checks that tests assert behaviour and that size limits hold.
- **Debugging.** Failures go through a root-cause process before any fix, and every bug fix starts
  with a test that reproduces it.

## How AI output was validated

- Test output is read, not assumed. The definition of done requires the command output as
  evidence ([CLAUDE.md](../CLAUDE.md)).
- Generated tests are checked by watching them fail first and by running the contract suites against
  Postgres as well as memory.
- Reviewer verdicts are pasted into each pull request, and the owner makes the final call.
- When validation caught a problem, the cause was recorded so it would not recur. One example:
  admin list paging passed all in-memory tests and crashed on page two against Postgres, which led to
  the rule that contract tests use more rows than one page and run on both repositories
  ([gotcha](gotchas/test-db-is-separate-from-test.md)).
- Other lessons are in [docs/gotchas/](gotchas/README.md) and summarised in
  [ai-development.md](ai-development.md).

## What is not covered

Stating this plainly so nobody over-trusts the coverage number.

- **The in-memory coverage run shows 0% for the Postgres adapters** (for example
  `supabase-auth.ts` and `supabase-recording-storage.ts`) and low numbers for `retention.ts` (25%)
  and `learner-data.ts` (39%). Those paths are exercised by the database tests
  (`retention.db.test.ts`, `learner-data.db.test.ts`, `pg-repos.db.test.ts`), which need Docker and
  are not part of `npm test`. A combined coverage figure is not produced yet.
- **Browser coverage:** automated end-to-end tests run in Chromium only. Real low-end Android phones
  are checked by hand, and no device lab is used.
- **No load or performance tests** beyond the first-load size budget.
- **No automated accessibility audit** yet.
- **Content quality** (is a lesson clear and correct in Hindi?) is a human review by NGO mentors, not
  an automated test.
- **Features not built yet** (AI doubts, community, meetings, admin dashboard) have plans but no
  tests, because they have no code.
