# Shiksha Path

An offline-first learning app (PWA) that helps Hindi-speaking students from villages and small
towns become job-ready for tech. It is built for an NGO. Many of its learners are minors, so privacy
and safety shape every part of the design.

> **Status: pilot MVP, under active development.** This README describes what exists today, what
> does not exist yet, and how to run it. Planned work is listed honestly under
> [Roadmap](#roadmap-not-built-yet).

## The problem

Students from villages and tier-3 cities have weak English, little money, low-end Android phones and
patchy, expensive internet. Most learning apps assume fast data, English fluency and a good device.
These students need a way to learn a little every day, keep their progress, and be supported by a
mentor, without depending on a connection.

**Who it is for:**

- **Learners:** Hindi speakers on low-end phones, learning English and aptitude on the way to
  entry-level IT, tech-support and BPO roles.
- **Mentors and admins at the NGO:** who enrol students, see progress, review speaking recordings
  and manage the programme.

## What it does today

**Learner app (works offline once a module is cached)**

- Placement test on first launch, to start at the right level or skip ahead.
- Daily lessons in Hindi with a gradual bridge to English; practice items, speaking practice with
  recordings, and module test-out quizzes.
- Streaks and weekly progress.
- Several learner profiles per phone (for shared family phones), each with a PIN.
- Google sign-in, or a mentor-issued backup code for students who cannot have a Google account yet.
- Progress is stored on the device first and synced when a connection is available (an outbox with
  idempotent events, so nothing is lost or double-counted).

**Mentor and admin tools**

- Mentors: enrol students, issue and reset backup codes, see cohort progress, attendance, and
  review speaking recordings.
- Admins: set up the organisation, manage students and staff (roles, cohorts, pause), feature
  switches, branding, and an audit log of staff actions.
- Student data export and deletion, nightly backups and a recording retention job.

**Content system**

- Lessons are plain Markdown and YAML files in `content/`, validated and built into small versioned
  bundles per module. The pilot content set has two modules (English Foundation 1 and Aptitude 1,
  two lessons in total) plus the placement test.

## Architecture

```
 Phone / lab laptop (PWA)                      Supabase (Mumbai region)
 ┌────────────────────────────┐   /v1 API     ┌─────────────────────────────┐
 │ Svelte UI                  │ ────────────► │ Edge Function (thin wrapper)│
 │ learner-core (pure logic)  │               │   │                         │
 │ IndexedDB (Dexie) + outbox │ ◄──────────── │   ▼                         │
 │ Service worker (offline)   │   sync        │ packages/server services    │
 └────────────────────────────┘               │   │ (plain TypeScript)      │
        ▲                                     │   ▼                         │
        │ versioned module bundles            │ Postgres + RLS · Storage    │
 Content build (packages/content)             └─────────────────────────────┘
```

- **The app never talks to tables directly.** It calls our own versioned API (`/v1/...`) through one
  module. Business logic lives in plain TypeScript services with no Supabase imports; the Edge
  Function is a thin wrapper. This keeps a later move off Supabase a step-by-step migration, not a
  rewrite ([decision](docs/decisions/backend-2026-10-18-portability-rules.md)).
- **Offline-first.** Every action is an event in a local outbox, retried until the server confirms
  it ([decision](docs/decisions/sync-2026-10-18-offline-first-outbox.md)).
- **Security in two layers.** The services check the caller's role and cohort; Postgres
  row-level security is the second line of defence.
- Full design: [the spec](docs/superpowers/specs/2026-10-15-learning-platform-design.md).

### Repository layout

| Path                    | What it is                                                         |
| ----------------------- | ------------------------------------------------------------------ |
| `apps/learner`          | The PWA: learner screens, staff and admin screens, e2e tests       |
| `packages/learner-core` | Pure learner logic: progress, placement, streaks, practice scoring |
| `packages/content`      | Content parser, validator and bundle builder                       |
| `packages/api-contract` | The shared request and response types for the `/v1` API            |
| `packages/server`       | Backend services, repository ports and Postgres adapters           |
| `supabase/`             | SQL migrations (with rollbacks), seed, Edge Function, DB tests     |
| `content/`              | Lessons, module quizzes and the placement test                     |
| `tooling/`              | Admin CLI, backups, bundle-size check, build scripts, hook tests   |
| `docs/`                 | Spec, plans, decisions, gotchas, runbook and engineering standards |

## Tech stack

| Layer      | Choice                                                   |
| ---------- | -------------------------------------------------------- |
| App        | Svelte, Vite, TypeScript, PWA with a service worker      |
| On-device  | IndexedDB through Dexie                                  |
| Backend    | Supabase: Postgres with RLS, Auth (Google), Storage      |
| Server     | TypeScript services behind one Supabase Edge Function    |
| Tests      | Vitest (unit, integration, DB), Playwright (offline/e2e) |
| Quality    | ESLint (zero warnings), Prettier, `svelte-check`, `tsc`  |
| Repo gates | Husky, lint-staged, commitlint, gitleaks, secretlint, CI |

Why these were chosen, and what was rejected, is recorded in [docs/decisions/](docs/decisions/).

## Running it

**Requirements:** Node 22 or newer. The backend tests and the full local stack also need Docker and
the Supabase CLI (installed as a dev dependency).

```bash
npm ci                    # install; also installs the git hooks
npm run app:content       # build the lesson bundles into the app
npm test                  # unit and integration tests (in memory, no database)
npm run lint              # ESLint, zero warnings
npm run typecheck         # TypeScript and svelte-check
npm run test:cov          # tests with coverage (minimum 70%)
npm run test:e2e          # offline and layout end-to-end tests (Playwright)
npm run size -w @shiksha/learner-app   # first-load size budget (120 KB gzipped)
```

To run against a real local backend:

```bash
cp supabase/functions/.env.local.example supabase/functions/.env.local   # once per checkout
npm run db:start          # builds the function and starts local Supabase
npm run test:db           # database tests (RLS, repositories, migrations)
npm run test:e2e:backend  # end-to-end tests against the local backend
```

Setting up a hosted Supabase project, Google sign-in, deployment, the admin tool, backups and the
first admin account is in the [owner runbook](docs/runbooks/supabase-setup.md). Configuration
comes from environment files; see the `.env.example` files. **No secrets are committed.**

## How this was built with AI

This project was built with Claude Code as the development partner across the whole lifecycle:
specs, plans, test-first implementation, three independent AI reviewers on every task, and a living
set of rules, gotchas and decision records. Read the full story, including where the AI got things
wrong and what changed afterwards, in **[docs/ai-development.md](docs/ai-development.md)**.

## Quality and testing

Summary: 993 unit and integration tests with 90% statement coverage, 153 database tests against a
real Postgres (including the row-level-security policies), lint, typecheck and format checks at
zero warnings, and offline end-to-end tests in a real browser that run in CI. Details, numbers and what is not covered are in
**[docs/qa.md](docs/qa.md)**.

## Security and privacy

- Students are often minors. Names, progress and voice recordings are treated as sensitive.
- Every endpoint checks identity, role and cohort; RLS enforces isolation in the database, and
  tests prove one student or cohort cannot read another's data.
- Input validation at the edge, rate limits, no secrets in the repo (secret scanning in the commit
  hook and in CI), staff sessions expire after 30 minutes unused.
- Staff actions are written to an audit log. Students' data can be exported and deleted. Recordings
  are deleted after their retention period.
- Rules: [security](.claude/rules/security.md) and [privacy](.claude/rules/privacy.md).

## Known limitations

Be aware of these when judging or building on this MVP:

- **Pilot content is very small.** The content check reports 2 modules and 2 lessons, plus the
  placement test. It proves the content pipeline, not a full curriculum.
- **No AI features in the product yet.** AI doubt-solving, "why was I wrong?" and weekly mentor
  summaries are designed in the spec but not built. (AI was used heavily to _build_ the product.)
- **No meetings or community yet.** Mentor 1-to-1 booking and the community space are planned only.
- **Admin dashboard (usage charts) is not built yet.**
- **Backend adapters are covered by database tests, not unit tests.** The in-memory unit run shows
  0% for the Postgres adapters; they are exercised by `npm run test:db`, which needs Docker.
- **Content authoring and review** by NGO mentors is a manual process.
- **Only tested on Chromium** in automated tests; real low-end Android phones are checked by hand.

## Roadmap (not built yet)

Written as detailed plans in [docs/superpowers/plans/](docs/superpowers/plans/); start with the
[series map](docs/superpowers/plans/2026-10-23-series-map-plans-4b-to-6b.md):

1. Admin dashboard
2. AI doubt-solver, with cost limits and safeguarding
3. AI summaries and the content drafting pipeline
4. Community
5. Mentor meetings with calendar integration

The spec also describes a Developer track and job pipeline for after the pilot.

## Contributing

Read [CLAUDE.md](CLAUDE.md) (or [AGENTS.md](AGENTS.md) for other agents) first. Work on a
`feature/<slug>` branch, never on `main`; follow the plan, write the test first, and keep the
definition of done in `CLAUDE.md`. See [WORKLOG.md](WORKLOG.md) for current tasks.

## Third-party content and licences

The content system is designed to use open learning material only where its licence allows. Check a
resource's licence before adding it to `content/`. This repository's own licence has not been
chosen yet; until it is, all rights are reserved by the owner.
