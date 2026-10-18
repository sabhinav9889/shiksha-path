# Engineering Standards

How Shiksha Path is built. `CLAUDE.md` and `.claude/rules/` are the short, enforced version; this is
the reasoning behind them. The spec
([learning platform design](superpowers/specs/2026-10-15-learning-platform-design.md)) is the source
of truth for _what_ we build; this file is _how_.

## Design patterns we use

Use a pattern only when it solves a problem this product has. Every pattern is code someone
maintains.

| Pattern                                         | Where                                                                      | Problem it solves                               |
| ----------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------- |
| Offline-first + outbox                          | Phone saves every action locally, syncs later                              | Patchy internet; no lost progress               |
| Append-only event log + idempotency keys        | Progress events, doubts, bookings                                          | Retries never double-count; easy audit          |
| Ports & adapters (hexagonal)                    | Core logic depends on `Storage`, `Auth`, `AIProvider`, `Calendar`, `Email` | Swap Supabase/Anthropic/Google without rewrites |
| Repository                                      | One data-access module per table group                                     | No SQL in business logic; easy to test          |
| Versioned API (`/v1`)                           | Every app ↔ server call, through one app API module                        | Old phones keep working after updates           |
| Strategy + registry                             | One renderer + scorer per practice-item type                               | New item types without touching the player      |
| Feature flags                                   | Admin feature switches (all students + individual override)                | Turn features on/off without a release          |
| Retry with backoff + circuit breaker            | Claude API, Google Calendar, email                                         | A slow outside service doesn't break the app    |
| Rate limiting (token bucket)                    | Doubt limits, sign-in, bookings                                            | Cost control and abuse protection               |
| Read models / summary tables (CQRS-lite)        | Mentor and admin dashboards                                                | Fast dashboards without slowing sync            |
| Immutable, content-addressed assets             | Lesson bundles and audio                                                   | Cache forever, no re-downloads                  |
| Anti-corruption layer                           | Wrappers around Google and Anthropic APIs                                  | Their API changes stay in one file              |
| Defence in depth / least privilege              | API permission checks + row-level security + minimal OAuth scopes          | One mistake doesn't expose student data         |
| Graceful degradation                            | AI down, offline, low storage                                              | Learning always works; extras degrade           |
| Error codes (`ErrorCode` → translated messages) | Every error the user can see                                               | Plain Hindi/English errors, no technical codes  |

## Deliberately not using

Microservices, Kubernetes, message queues (Kafka/NATS), GraphQL, a custom backend server, ORMs that
hide SQL. At this size they add cost and complexity for nothing. Revisit only with a written
decision record (`docs/decisions/`).

## Size and complexity limits

| Rule                         | Limit                                   | Enforced by                                               |
| ---------------------------- | --------------------------------------- | --------------------------------------------------------- |
| Line length                  | 100 characters                          | Prettier `printWidth`, ESLint `max-len`                   |
| File length                  | 300 lines (tests 500, Svelte 200)       | ESLint `max-lines` (Svelte override added in Plan 2)      |
| Function length              | 50 lines (tests exempt)                 | ESLint `max-lines-per-function`                           |
| Cyclomatic complexity        | 10                                      | ESLint `complexity`                                       |
| Nesting depth                | 3                                       | ESLint `max-depth`                                        |
| Parameters                   | 4 (use an options object beyond)        | ESLint `max-params`                                       |
| Disabling a rule             | Only with `-- <reason>`                 | ESLint `eslint-comments/require-description`, code review |
| Lint warnings                | 0                                       | `--max-warnings 0` in pre-commit and CI                   |
| Test coverage                | 70% lines/functions/branches/statements | Vitest thresholds in CI                                   |
| App JavaScript               | ≤ 150 KB gzipped                        | Bundle-size check in CI (Plan 2)                          |
| First screen on slow 3G      | < 3 s                                   | Playwright throttled test (Plan 2)                        |
| Lesson bundle (JSON + audio) | ≤ 5 MiB                                 | Content build warning (Plan 1)                            |

## Practices

- **Code:** TypeScript strict, no `any`. Zod validation at every boundary (API input, files, AI
  output). Early returns, named constants, one responsibility per file. Errors are values at
  boundaries, never swallowed. Logger, never `console`.
- **Testing:** test first (red → green → refactor). Unit tests for logic, integration tests for API
  and database, Playwright for offline and sync. Data isolation is always tested with 2+ students and
  2+ cohorts.
- **Git:** `feature/<slug>` or `fix/<slug>` from `main`, conventional commits, one logical change per
  commit, PR with the template, CI green, owner approval. Never push to `main`.
- **Decisions:** big decisions get a decision record in `docs/decisions/`. Traps we hit go in
  `docs/gotchas/`.
- **Observability:** structured logs (IDs only, never personal data), error tracking (Sentry free
  tier), uptime check with alerts.
- **Security target:** OWASP ASVS Level 2. Secrets only in environment settings. Dependencies scanned
  in CI. Backups are test-restored, not just taken.
- **Accessibility and language:** touch targets ≥ 44 px, text contrast ≥ 4.5 : 1, every string in
  Hindi and English, never hard-coded.
- **Config:** same code for dev, staging and production; only settings differ.
- **AI-assisted work:** the spec and approved plans are the source of truth. No invented APIs, fields
  or behaviour. Every task passes the spec, code and security reviewers before it counts as done.
