# CLAUDE.md

Shiksha Path: an offline-first learning PWA that helps Hindi-speaking students from villages and
small towns become job-ready for tech. NGO project; many students are minors. Backend is Supabase.

## Source of truth (MANDATORY)

- **What to build:** the spec,
  [learning platform design](docs/superpowers/specs/2026-10-15-learning-platform-design.md), and the
  approved plans in `docs/superpowers/plans/`.
- **How to build:** [engineering standards](docs/engineering-standards.md) and `.claude/rules/`.
- **Never invent** APIs, fields, library behaviour or requirements. Check the docs, the code or the
  tool output first; if still unsure, ask. Say "I don't know" rather than guess.
- If a doc is wrong, fix it in the same PR: [self-correction](docs/self-correction.md).

## Session start

1. Read [WORKLOG.md](WORKLOG.md) and print `Active tasks: N — [titles]`.
2. Check the branch: never work on `main` (a hook blocks it). Branch `feature/<slug>` or
   `fix/<slug>` from `main`.
3. Route the task with [the task router](.claude/task-router.md).

## Definition of done

A task is done only when **all** of these are true, with evidence in the session:

- Tests were written first, seen failing, then passing (`npm test`), and the output was read.
- `npm run lint`, `npm run typecheck` and `npm run format:check` pass.
- `spec-reviewer`, `code-reviewer` and `security-reviewer` all report PASS.
- `WORKLOG.md` is updated, and the PR uses the template.

Never claim "works" or "fixed" without the command output that proves it.

## Quick commands

| Command                | Purpose                       |
| ---------------------- | ----------------------------- |
| `npm test`             | Run all tests                 |
| `npm run test:cov`     | Tests with coverage (min 70%) |
| `npm run lint`         | ESLint, zero warnings allowed |
| `npm run lint:fix`     | Auto-fix lint problems        |
| `npm run typecheck`    | TypeScript strict check       |
| `npm run format`       | Prettier write                |
| `npm run format:check` | Prettier check (CI)           |

## Rules (read the ones your task touches)

| Rule file                                       | Covers                                             |
| ----------------------------------------------- | -------------------------------------------------- |
| [coding](.claude/rules/coding.md)               | Size limits, style, errors, logging                |
| [architecture](.claude/rules/architecture.md)   | Layers, ports & adapters, versioned API, patterns  |
| [testing](.claude/rules/testing.md)             | TDD, coverage, isolation tests, offline tests      |
| [security](.claude/rules/security.md)           | Validation, RLS, auth, secrets, rate limits        |
| [privacy](.claude/rules/privacy.md)             | Minors, DPDP, logging, retention, deletion         |
| [ai-guardrails](.claude/rules/ai-guardrails.md) | Prompt injection, PII masking, safeguarding, evals |
| [database](.claude/rules/database.md)           | Migrations, RLS policies, indexes                  |
| [offline-sync](.claude/rules/offline-sync.md)   | Outbox, idempotency, bundles                       |
| [git-and-pr](.claude/rules/git-and-pr.md)       | Branches, commits, PRs                             |

## Agents

| Agent               | Role                                                         | Edits code |
| ------------------- | ------------------------------------------------------------ | ---------- |
| `architect`         | Plans and pressure-tests risky changes before implementation | No         |
| `spec-reviewer`     | Diff vs spec and plan: missing, extra or invented            | No         |
| `code-reviewer`     | Rules, limits, tests that really assert behaviour            | No         |
| `security-reviewer` | Auth, RLS, injection, prompt injection, minors' data         | No         |

Run all three reviewers on every task before calling it done.

## Key references

| What                  | Where                                         |
| --------------------- | --------------------------------------------- |
| Decision records      | [docs/decisions/](docs/decisions/README.md)   |
| Known traps           | [docs/gotchas/](docs/gotchas/README.md)       |
| Worklog detail format | [.claude/worklog/](.claude/worklog/README.md) |
| GitHub (private)      | `github.com/sabhinav9889/shiksha-path`        |
