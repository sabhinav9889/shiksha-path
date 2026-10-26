# Shiksha Path

An offline-first learning app for Hindi-speaking students from villages and small towns, with a
web section for the NGO mentors and admins who look after them. Many of the students are minors,
so privacy and safety are built in from the start.

Built with Claude Code for the AI Product Hackathon 2026. Start with
[the submission description](docs/submission/SUBMISSION.md); how the AI was used is in
[AI-DEVELOPMENT.md](docs/submission/AI-DEVELOPMENT.md) and how it was tested in
[QA-APPROACH.md](docs/submission/QA-APPROACH.md).

## What it does

- **Students:** Hindi-first lessons that work with no network, a placement test, practice with
  feedback, speaking recordings, streaks, and progress backed up when online. PIN-protected
  profiles on shared phones; a backup code for students without Google.
- **Mentors and admins:** cohorts and who needs attention, recording review, backup codes, levels,
  attendance, setup, feature switches, branding and an audit log.

## Run it

Needs Node 22 (see `.nvmrc`) and, for the backend, Docker.

```sh
npm ci

# The app alone (works phone-only, no backend)
npm run app:content                      # build the lesson packs into the app
npm run dev -w @shiksha/learner-app      # http://localhost:5173

# The tests
npm test                                 # unit and component tests
npm run typecheck && npm run lint

# With the local backend (Supabase in Docker)
npm run db:start                         # starts Supabase locally and builds the API bundle
npm run test:db                          # database, row-level security and API tests
npm run test:e2e                         # student app end to end (Playwright)
npm run test:e2e:backend                 # the whole staff story against the local backend
```

For a deployed copy, follow the [owner runbook](docs/runbooks/supabase-setup.md): Supabase project,
Google sign-in, hosting and the first admin.

## Demo data

`npm run admin -- seed-demo` creates twelve made-up students with varied progress, so the mentor
screens show every attention flag. `npm run admin -- seed-demo --remove` deletes them. See the
runbook for the keys the admin tool needs; they are read from the environment and never stored.

## Layout

| Path                    | What                                                                            |
| ----------------------- | ------------------------------------------------------------------------------- |
| `apps/learner`          | The Svelte PWA: student screens and the staff section (a lazily loaded chunk)   |
| `packages/content`      | Lesson files to validated, downloadable packs                                   |
| `packages/learner-core` | Learning logic with no UI: events, progress, scoring, sync                      |
| `packages/api-contract` | The `/v1` API's Zod shapes, shared by the app and the server                    |
| `packages/server`       | Services, repositories and the HTTP handler (a Supabase Edge Function wraps it) |
| `supabase`              | Migrations with rollbacks, the function entry, database tests                   |
| `content`               | The lessons themselves, as plain text                                           |
| `docs`                  | Spec, plans, decision records, gotchas, runbooks, submission documents          |
| `tooling`               | The admin command, build scripts and tooling tests                              |

## Rules the project follows

The AI and the humans work from the same rules: [`CLAUDE.md`](CLAUDE.md),
[`.claude/rules/`](.claude/rules/) and [`docs/engineering-standards.md`](docs/engineering-standards.md).
Secrets live only in environment settings. Report a vulnerability as described in
[`SECURITY.md`](SECURITY.md); never include real student data.
