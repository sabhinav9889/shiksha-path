# How AI was used to build Shiksha Path

One developer directed Claude Code (Claude Opus and Sonnet models) from 15 to 26 October 2026:
161 commits, 23 pull requests, about 18,600 lines of application source, and 110 test and end-to-end spec files. This
document says how the work was organised so that the AI was useful, how its output was checked, and
what went wrong along the way. Every claim points at something in the repository.

## 1. The workflow: spec → plan → test-first execution → fresh review

Each piece of the product went through the same loop:

1. **Brainstorm and spec.** The learning platform design
   ([spec](../superpowers/specs/2026-10-15-learning-platform-design.md)) was written first, with
   the owner choosing between options the AI laid out. Decisions the owner must make are marked.
2. **A written plan per piece** ([plans](../superpowers/plans/)). Each plan names the exact files,
   function signatures, Zod shapes, SQL, tests with their assertions, and the commands to run.
   Values the owner must confirm are marked ⚑ with a recommended default, and the owner confirms
   them before work starts.
3. **Execution, test first.** The AI wrote the failing test, watched it fail for the right
   reason, then wrote the minimum code. A ledger (kept outside git while a plan ran) recorded every
   deviation from the plan as a `Ruling: <what> — <why> — <cost if wrong>`.
4. **A gate after every task:** format, the whole unit suite, typecheck, lint, format check, and
   the database suite when a task touched SQL or an adapter.
5. **One fresh-context review of the whole branch** by a separate model run that had not seen the
   code being written, using the plan's _Review Focus_ (input classes the tests did not cover).
6. **One fix pass:** every Critical and Important finding gets a test that fails first. Minor
   findings are listed in the PR instead of being fixed on the spot.
7. **A pull request** with the rulings and the deferred minors listed. The owner merges; the AI
   never merges and never pushes to `main` (a hook and a git hook block it).

Eight plans have been executed and five more are written for the rest of the product; each is
executed one at a time, so each
execution session started from a document, not from a long chat history.

## 2. Context engineering: what the AI is given, and why

The aim was that a new AI session, or a different model, starts from the same facts and rules.

| Context         | Where                                                                                                                                      | What it does                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Entry point     | [`CLAUDE.md`](../../CLAUDE.md), [`AGENTS.md`](../../AGENTS.md), [`GEMINI.md`](../../GEMINI.md)                                             | Source of truth, session start steps, definition of done, links to the rules. Three files so any AI tool lands in the same place. |
| Rules by area   | [`.claude/rules/`](../../.claude/rules/) (coding, architecture, security, privacy, database, testing, offline-sync, AI guardrails, git/PR) | Short rules the AI reads when its task touches that area. Limits are also enforced by ESLint, so a rule is never only advice.     |
| Standards       | [`docs/engineering-standards.md`](../engineering-standards.md)                                                                             | The patterns in use, and the "deliberately not using" list that needs a decision record to change.                                |
| Decisions       | [`docs/decisions/`](../decisions/README.md) (8 records)                                                                                    | Why a thing is the way it is, so the AI does not re-argue it.                                                                     |
| Traps           | [`docs/gotchas/`](../gotchas/README.md) (10 files)                                                                                         | Mistakes that happened once, written so they are not repeated. Several came straight from an AI failure below.                    |
| Self-correction | [`docs/self-correction.md`](../self-correction.md)                                                                                         | A wrong doc is fixed in the same PR as the code that showed it was wrong.                                                         |
| Working memory  | [`WORKLOG.md`](../../WORKLOG.md), the plan ledger, the AI's own memory notes                                                               | What is in progress, what was ruled, what the owner prefers.                                                                      |
| Task routing    | [`.claude/task-router.md`](../../.claude/task-router.md)                                                                                   | Which rule files and agents a kind of task needs.                                                                                 |

Plans are the most useful context of all: each task has an **Interfaces** block (what it consumes
from earlier tasks, what it produces for later ones), because an executor sees only its own task.

## 3. Agents, hooks and guardrails

- **Four review agents** ([`.claude/agents/`](../../.claude/agents/)): `architect`,
  `spec-reviewer`, `code-reviewer` and `security-reviewer`. They are read-only (no edit tools).
  In practice, for the larger plans, one fresh Opus reviewer covered spec, code and security
  together over the whole branch rather than the three running per task; the PR bodies say which.
- **Claude Code hooks** ([`.claude/settings.json`](../../.claude/settings.json)): a hook blocks
  edits while a checkout is on `main`, one blocks writing secret files, and one formats files after
  each edit.
- **Git hooks** (Husky): commit-message lint, lint-staged with a secret scan before each commit,
  and a push guard. Git hooks only exist after `npm ci`, which is itself a recorded gotcha.
- **CI** on every PR: unit and type checks, a database job against a real local Supabase, an
  end-to-end job, `gitleaks`, `semgrep`, `trivy` and `npm audit`.
- **Guardrails inside the product design** for the AI features that are planned but not built
  (prompt-injection handling, masking personal data, safeguarding for minors):
  [`ai-guardrails.md`](../../.claude/rules/ai-guardrails.md).

## 4. Human validation

AI output was never accepted on trust:

- **The owner made the product decisions** (the ⚑ values, scope, what to defer) and merged every
  PR. The AI could not merge.
- **Tests had to be seen failing first.** A test that passed before the code existed was treated
  as broken. One fix was proved by breaking the code on purpose and watching the new test fail
  (the `x-forwarded-for` rate-limit test).
- **A fresh reviewer, not the author, judged each branch.** Its severity labels were re-graded by
  what a real student, mentor or admin would experience, not by whether the spec mentioned the
  input.
- **The owner ran the real thing.** Setting up the real Supabase project, Google sign-in and
  hosting found problems no test had: the deployed site had no lesson packs (the host's build
  never ran the content build), and the setup guide had no hosting step. Both are now documented.
- **Security and privacy are checked as rules**, not left to the AI's judgement: row-level
  security on every table with an isolation test over two cohorts, parameterised SQL only (a test
  fails the build if an adapter builds SQL from a string), Zod at every boundary.

## 5. Learning from AI failures

These are real, and each changed a rule or a test.

| What went wrong                                                                                                                        | How it was found                              | What changed                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| A paging cursor joined two fields with a NUL character. It passed every in-memory test and crashed on page 2 in Postgres.              | Plan 4a final review                          | Contract tests now run on both repositories with more rows than one page; the rule is in every later plan.       |
| An older app version dropped a mentor's new `level_set` event but still moved its pull cursor past it, so the change was lost forever. | Plan 4a final review                          | The pull cursor key now fingerprints the event types the app knows; learning a new type re-pulls from the start. |
| A staff sign-in stayed open indefinitely on a shared student phone.                                                                    | Plan 4a final review                          | A 30-minute idle sign-out, and a rule that every signed-in surface has one.                                      |
| Streak and "this week" were frozen at the last upload, so a long-gone student showed a live streak.                                    | Plan 4a final review                          | Derived data is corrected on read (`asOfToday`) and the rule is in the series plans.                             |
| The export a guardian can request left out the new attendance data.                                                                    | Plan 4a final review                          | Every new personal-data table now has six explicit steps (export, delete, retention, audit, RLS, RLS test).      |
| Two link requests for one sign-in could race and one answered "profile taken" for its own learner.                                     | CI on `main`                                  | A deterministic test forces the interleaving; the check re-reads the identity.                                   |
| Plan 4a's plan missed two screens (adding a student, pausing staff). They were found while executing.                                  | Execution                                     | Plans now trace every screen to its route and every end-to-end step to its screen.                               |
| The runbook said to turn the email sign-in off. That breaks backup-code students.                                                      | Found while building backup codes (Plan 3b)   | Corrected in the runbook and noted in it.                                                                        |
| A "gotcha" the AI wrote said a build file was committed when it is git-ignored.                                                        | Checking the claim before relying on it       | Fixed; claims about the repo are checked against the repo.                                                       |
| The AI started a multi-agent workflow tool the developer had not asked for.                                                            | Noticed by the AI against the tool's own rule | Stopped before it wrote anything; recorded as a standing rule.                                                   |

## 6. Efficiency choices

- **Execute inline, review once at the end.** Running a fresh implementer and reviewer for every
  task costs a fresh context each. One strong reviewer over the whole branch caught the serious
  problems at a fraction of the cost.
- **Write plans a weaker model can execute.** The remaining plans (4b to 6b) are written with exact
  files, signatures and tests, so a cheaper model can run them and the strongest model is kept for
  review. A series map fixes which plan builds each shared piece, so plans written in parallel agree.
- **A consistency pass across plans.** After five plans were drafted in parallel, a separate
  reviewer cross-checked every shared name, route and migration and found real mismatches (a job
  schedule that would have used four times the free CI minutes, a duplicate storage factory).

## 7. What the AI did not do

It did not create accounts or keys, set secrets, run the owner's runbook steps, merge, deploy to
production, or test on real phones. Those are the owner's. It also did not decide the product: it
proposed options and recommended defaults, and the owner chose.
