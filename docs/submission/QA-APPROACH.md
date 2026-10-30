# AI-assisted QA

Testing is where AI helped most, and where it most needed checking. This page says what was
tested, how AI took part, and how its output was validated.

## What exists (all runnable with the commands below)

| Layer                                                                   | What it proves                                                                                                                                                         | Size                                     |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Unit and component tests (Vitest, `npm test`)                           | Learning logic, sync, the server services over in-memory repositories, every Svelte screen in jsdom                                                                    | 1,006 tests (26 Oct run)                 |
| Shared contract tests                                                   | One set of behaviour tests runs against **both** the in-memory repositories and real Postgres, so a fake can never drift from the database                             | part of the above and the database suite |
| Database tests (`npm run test:db`, local Supabase)                      | The same contracts on Postgres, migrations, **row-level security with two students and two cohorts**, the served API                                                   | 157 tests (26 Oct run)                   |
| End-to-end (Playwright, `npm run test:e2e`, `npm run test:e2e:backend`) | A student learning offline, the real Google-style sign-in, recordings, backup codes, and the whole staff story against the local backend                               | 16 + 4 tests                             |
| Layout checks inside the e2e                                            | No sideways scroll and every button at least 44 px at 360 px and 1024 px                                                                                               | in the e2e                               |
| Static guards                                                           | Only adapters import Supabase or Postgres; no `console`; no `sql.unsafe` in adapters; lint limits (function length, complexity, file size); first-load JS under 120 KB | tests and CI                             |
| Security scans in CI                                                    | `gitleaks`, `semgrep`, `trivy`, `npm audit`, on every PR                                                                                                               | CI                                       |
| Content validation                                                      | The lesson build fails on missing Hindi text or missing audio, and leaves out any lesson not marked `review: approved` (with a warning)                                | `npm run content:check`                  |

Coverage from a local `npm run test:cov` run on 26 October: 90.3% of statements, 91.8% of lines,
79.1% of branches and 89.4% of functions (the project minimum is 70%).

```sh
npm ci
npm test                 # unit and component tests
npm run test:cov         # with coverage
npm run db:start && npm run test:db
npm run test:e2e         # student app end to end
```

## How AI took part

1. **Test generation from a written test list.** Every plan task lists its tests by name with the
   exact assertions. The AI wrote those tests first and ran them to see them fail.
2. **Edge cases the author missed.** Each plan has a _Review Focus_: five input classes the tests
   do not cover (for example a staff member reaching a student outside their cohort, an old phone
   receiving a new event type, two requests racing). A fresh reviewer model then probed the finished
   branch with those and found more.
3. **Negative and adversarial testing.** Tests for refused input are written as deliberately as
   tests for success: forged `x-forwarded-for`, a name with a SQL wildcard, a name containing HTML
   (it must render as text), an unknown student id answering the same as an
   out-of-scope one (so ids cannot be probed).
4. **Debugging.** When CI or a full run failed, the AI traced the cause rather than patching the
   symptom. Example: a database test failed in CI with `PROFILE_TAKEN`; the AI showed two requests
   could interleave, wrote a test that forces that exact interleaving, and fixed the check.
5. **Whole-branch code review** (the Plan 3b and 4a branches): 5 Important findings on the first,
   6 on the second, all fixed test-first.

## How AI output was validated

- **A test must fail first.** If a new test passed before the code existed, it was rewritten.
- **Prove the test can fail.** For a test pinning behaviour that already worked, the code was
  broken on purpose, the test was seen failing, and the code restored (the rate-limit address test).
- **Fakes are checked against the real thing.** The memory and Postgres repositories run the same
  contract. This caught a paging bug that only Postgres showed.
- **The reviewer is not the author.** A separate run with no memory of the work reads the diff
  against the plan and the project rules.
- **Findings are re-graded by effect**, not by label: what would a real student or mentor get?
- **A human merged every change** and ran the real deployment on a real phone.

## Honest limits

- No testing on the cheapest target phones (1 to 2 GB RAM) yet; the spec calls for it before a full
  cohort.
- 27 lessons exist, drafted by AI and approved by the developer (a Hindi reader). They have not been
  through a mentor review, which the pilot process requires.
- The end-to-end tests use a stand-in for Google (a local user whose session is placed where the
  app keeps it). Real Google sign-in was checked by hand on the deployed app.
- A few timing-sensitive tests can flake under full-suite load; known examples are listed in the
  PRs, and they pass alone.
