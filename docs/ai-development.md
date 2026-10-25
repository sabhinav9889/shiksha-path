# How Shiksha Path was built with AI

Shiksha Path was built with Claude Code as the development partner, from the first design
conversation to the latest merge. This page explains the workflow, the context that makes the AI
effective, the guardrails around it, and where it went wrong. Every claim points at a file in this
repository so it can be checked.

**By the numbers** (from the git history on 2026-10-26)

| Measure                                         | Value                                                      |
| ----------------------------------------------- | ---------------------------------------------------------- |
| Commits                                         | 151, from 2026-10-15 to 2026-10-24                         |
| Commits carrying a `Co-Authored-By: Claude`     | 132                                                        |
| Merged pull requests                            | 19                                                         |
| Written plans (one per slice of work)           | 14 in [docs/superpowers/plans/](superpowers/plans/)        |
| Decision records                                | 8 in [docs/decisions/](decisions/README.md)                |
| Gotcha files (traps found along the way)        | 12 in [docs/gotchas/](gotchas/README.md)                   |
| Rule files and review agents                    | 9 rules in `.claude/rules/`, 4 agents in `.claude/agents/` |
| Plan rulings (a plan step corrected after test) | 12 `Ruling:` lines across the plans                        |

## The workflow

Every piece of work follows the same loop. The loop is written down, so the AI follows it the same
way in every session and the owner can check that it did.

1. **Think and define.** A design conversation (brainstorming) turns the idea into a written
   [spec](superpowers/specs/2026-10-15-learning-platform-design.md): purpose, constraints, learner
   experience, data and sync, privacy, AI features, testing and a pilot plan.
2. **Plan.** The spec is split into small sub-projects. Each gets a plan with exact files,
   signatures, tests and commands. Examples:
   [content system](superpowers/plans/2026-10-17-content-system.md),
   [learner core](superpowers/plans/2026-10-18-learner-core.md),
   [backend and sync](superpowers/plans/2026-10-20-backend-sync.md),
   [mentor and admin](superpowers/plans/2026-10-22-mentor-admin.md).
3. **Route the task.** [The task router](../.claude/task-router.md) classifies it (feature, fix,
   bug-hunt, refactor), decides which rules to load, and decides whether the `architect` agent must
   pressure-test the design first. Auth, row-level security, the sync protocol and AI prompts always
   get an architect review before any code.
4. **Build test-first.** Red, green, refactor. The test is written, run, and seen failing for the
   expected reason before any code ([testing rule](../.claude/rules/testing.md)).
5. **Review with three independent agents.** `spec-reviewer`, `code-reviewer` and
   `security-reviewer` each review the diff. All three must report PASS.
6. **Verify with evidence.** [CLAUDE.md](../CLAUDE.md) defines done: tests, lint, typecheck and
   format output read in the session, reviewers passed, worklog updated. "Works" is never claimed
   without the command output that proves it.
7. **Pull request and CI.** Every PR uses the template, pastes the reviewer verdicts and test
   output, and lists any "Docs corrected". CI re-runs everything. The owner merges.
8. **Learn.** A wrong doc, rule or plan is fixed in the same PR
   ([self-correction](self-correction.md)). A trap becomes a gotcha file. A changed decision becomes
   a new decision record.

## AI across the whole lifecycle

| Stage    | How AI was used                                                                  | Evidence                                                                                       |
| -------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Define   | Brainstorming the problem, learners, constraints and scope into a spec           | [Spec](superpowers/specs/2026-10-15-learning-platform-design.md)                               |
| Design   | Architecture, API shape, portability and sync decisions, with trade-offs         | [Decision records](decisions/README.md), [architecture rule](../.claude/rules/architecture.md) |
| Build    | Test-first implementation of each plan task                                      | Commit history; `feat`, `fix` and `test` commits                                               |
| Test     | Generating tests and edge cases, isolation tests with 2+ students and 2+ cohorts | [QA approach](qa.md), [testing rule](../.claude/rules/testing.md)                              |
| Review   | Three read-only reviewer agents on every task                                    | [Agents](../.claude/agents/), merged PRs                                                       |
| Document | Plans, runbook, decisions, gotchas, worklog and this documentation               | [docs/](.)                                                                                     |

## Context engineering

The AI is only as good as the context it is given, so the context is treated as a product that is
versioned, reviewed and corrected.

| Layer             | What it holds                                                                                     | Where                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Requirements      | Spec, plus plans that name the exact spec section each task implements                            | `docs/superpowers/specs/`, `docs/superpowers/plans/`                                                      |
| Architecture      | Layers, ports and adapters, versioned API, portability rules, patterns used and patterns rejected | [architecture rule](../.claude/rules/architecture.md), [decisions](decisions/README.md)                   |
| Standards         | Size limits enforced by ESLint, style, errors, forbidden constructs                               | [coding rule](../.claude/rules/coding.md), [engineering standards](engineering-standards.md)              |
| Domain guardrails | Security, privacy for minors, database and RLS, offline sync, AI guardrails                       | `.claude/rules/` ([security](../.claude/rules/security.md), [privacy](../.claude/rules/privacy.md), more) |
| Entry points      | One short file the agent reads first, with a mandatory source-of-truth section                    | [CLAUDE.md](../CLAUDE.md), [AGENTS.md](../AGENTS.md), [GEMINI.md](../GEMINI.md)                           |
| Working memory    | Active tasks and next steps, so a new session resumes without re-deriving anything                | [WORKLOG.md](../WORKLOG.md), [.claude/worklog/](../.claude/worklog/README.md)                             |
| Delivery          | Hosted setup, deployment, admin tool, backups and first-admin steps                               | [runbook](runbooks/supabase-setup.md)                                                                     |
| Learning          | Gotchas, decision records, plan rulings, self-correction process                                  | [gotchas](gotchas/README.md), [self-correction](self-correction.md)                                       |

`CLAUDE.md`, `AGENTS.md` and `GEMINI.md` exist so that any capable coding agent can work in the repo
under the same rules. The plans are written precisely enough (files, signatures, tests, commands)
that a different model can execute them, which is also a test of how complete the context is.

## Agents, hooks and automated guardrails

**Agents** (all read-only; they report and never edit code):

- `architect`: plans and pressure-tests risky changes before implementation.
- `spec-reviewer`: compares the diff with the spec and plan and finds what is missing, extra or
  invented.
- `code-reviewer`: checks the rules, the size limits and that tests really assert behaviour.
- `security-reviewer`: checks auth, RLS, injection, prompt injection, secrets and protection of
  minors' data. It has no shell, so the caller writes the diff to a file for it to review.

**Hooks** ([settings](../.claude/settings.json)):

- `block-main-edit.sh`: refuses edits when the checkout is on `main`, and in a fresh worktree where
  the git hooks are not installed yet.
- `block-secret-files.sh`: refuses edits to secret files such as `.env`.
- `auto-format.sh`: formats edited files.

**Git and CI gates:** Husky runs lint-staged, commitlint and a secret scan on commit, and blocks
commits and pushes to `main`. CI runs format, zero-warning lint, typecheck, tests with coverage,
commit-message checks, Playwright end-to-end tests and a first-load size budget.

**Rules the AI is held to** (from [CLAUDE.md](../CLAUDE.md)):

- Never invent APIs, fields, library behaviour or requirements; check the docs, code or tool output,
  and say "I don't know" rather than guess.
- Never claim success without the command output that proves it.
- Touch only what the task needs; no drive-by refactors.

## Human validation

AI output is treated as a draft, never as a fact.

- A human owns every decision that matters: the spec, each plan, the choice of what to build and
  what to cut, and every merge.
- The reviewer agents are a second and third opinion. They do not replace the owner's review, they
  make it faster and better informed.
- Behaviour is checked by tests that were seen failing first, by the database tests against a real
  Postgres, and by end-to-end tests in a real browser, not by trusting generated code.
- Every task goes through the `security-reviewer`, and changes to auth, row-level security, new
  tables, the sync protocol or AI prompts go through the `architect` before any code is written
  ([task router](../.claude/task-router.md)).

## Learning from AI failures

Each of these was found while building, recorded so it is not repeated, and in several cases turned
into a rule or a hook. Full text is in [docs/gotchas/](gotchas/README.md).

| What went wrong                                                                                                                                                                                  | What changed                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| **In-memory tests passed, Postgres failed.** Admin list paging passed every in-memory test and crashed on the second page against Postgres ([gotcha](gotchas/test-db-is-separate-from-test.md)). | Shared contract tests now run on both repositories, with more rows than one page; `npm run test:db` is part of the rules. |
| **Work passed tests but failed lint at commit time**, so the fix was a refactor, not a tweak ([gotcha](gotchas/lint-limits-to-design-for.md)).                                                   | The limits (line, function, complexity, nesting) are stated up front so plans and code are designed to fit them.          |
| **Git hooks silently off in a new worktree**, so bad commits and unscanned secrets could pass ([gotcha](gotchas/worktree-hooks-need-npm-ci.md)).                                                 | A Claude hook now refuses edits in such a checkout until `npm ci` is run.                                                 |
| **Fake secrets in a test tripped the secret scanner** in CI ([gotcha](gotchas/secret-fixtures-trip-gitleaks.md)).                                                                                | Documented how to write such fixtures; `.gitleaksignore` records the exceptions with reasons.                             |
| **Unicode escapes turned into invisible literal characters**, so Devanagari tests compared the wrong thing ([gotcha](gotchas/unicode-escapes-become-literal.md)).                                | Documented; ESLint's irregular-whitespace rule catches the invisible form.                                                |
| **Stale server bundle in end-to-end runs**, so a test hit yesterday's code ([gotcha](gotchas/rebuild-the-function-before-e2e.md)).                                                               | Rebuild-and-restart step written into the workflow.                                                                       |
| **Plan steps that did not survive contact with the code.**                                                                                                                                       | Fixed in the plan itself with a `Ruling:` line (12 so far), per the [self-correction](self-correction.md) process.        |

## What AI did not replace

- Choosing the problem and the learners to serve, and cutting scope to what a pilot needs.
- Content judgement: lessons are drafted with AI but reviewed by NGO mentors before they are marked
  approved ([spec §9.4](superpowers/specs/2026-10-15-learning-platform-design.md)).
- Operating decisions that belong to people: who is the first admin, who owns the backups, and what
  data the NGO may keep.

## Using this for the next stage

The process is the reusable part. To continue the project:

1. Read [WORKLOG.md](../WORKLOG.md), then the next plan in
   [docs/superpowers/plans/](superpowers/plans/) (start with its series map).
2. Branch from `main`, run `npm ci`, and follow the loop above.
3. When something in the docs turns out wrong, fix it in the same PR.
