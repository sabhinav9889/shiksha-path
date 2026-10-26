# Shiksha Path: submission description

## The problem

Young people from villages and small towns in India, often minors, who speak Hindi and have weak
English, are shut out of entry-level tech work. An NGO runs labs and mentors for them, but a student
at home has a cheap phone, an expensive and patchy connection, and often shares that phone with the
family. Most learning apps assume fast internet, an English reader and one user per device.

## The product

**Shiksha Path** is an offline-first learning web app (a PWA) for those students, plus a web section
for the NGO's mentors and admins.

- **Students:** short Hindi-first lessons that work with the network off, a placement test to skip
  ahead, practice with immediate feedback, speaking practice that records a short clip, streaks,
  and progress backed up to a server. A profile is protected by a 4-digit PIN. A student with no
  Google account joins with a backup code that a mentor creates.
- **Mentors:** see their own cohorts and who needs attention (away for 3 days, stuck on one lesson,
  repeated low scores), listen to recordings and leave a short comment, create and reset backup
  codes, change a student's start lesson, mark lab attendance.
- **Admins:** set up labs, cohorts and mentors, manage and pause students, delete a student's data
  on request, switch features on or off for everyone or one student, change the app's name and
  colours (blocked if the text would be hard to read), and read an audit log of every staff change.
- **Privacy built in:** students see only their own data, mentors only their cohorts; export (through the
  admin command-line tool) and deletion on request; nothing personal in logs or URLs; a staff session on a shared phone signs
  itself out after 30 minutes.

## Architecture

```
 Student phone (PWA)                       Mentor / admin (same app, lazy chunk at #/staff)
 Svelte 5, Dexie (IndexedDB),              own Google session, never a student profile
 service worker, outbox of events
        │  HTTPS, one versioned API (/v1)                │
        ▼                                                ▼
   ┌──────────────────────────────────────────────────────────┐
   │ Supabase Edge Function (Deno): handler → service → repo  │  Zod at every boundary
   └───────┬───────────────────────┬──────────────────────────┘
           ▼                       ▼
   Postgres (row-level security   Storage (private bucket,
   on every table, 12 migrations) signed URLs for recordings)
           │
   Supabase Auth: Google sign-in, backup-code accounts

   Nightly (GitHub Actions): pg_dump + recordings → age encryption → owner's Cloudflare R2
   Lessons: plain text files → validated build → small content-addressed packs on the host
```

Key ideas:

- **The phone is the primary store.** Every learner action is an event with a unique id, saved
  locally, then uploaded. The server accepts each id once, so retries cannot double-count. Progress
  is replayed from the event log; events are never edited.
- **Ports and adapters.** Business logic is plain TypeScript with no Supabase import. On the server, only adapters
  touch Supabase or Postgres, and a test fails the build if anything else does; the app uses
  `supabase-js` only for sign-in. Swapping the
  provider means writing an adapter, not editing services.
- **Shared contract tests.** The same behaviour tests run against in-memory repositories and real
  Postgres.
- **Summaries, not raw logs.** Staff screens read a per-student summary refreshed after each upload.
- **Content as files.** Lessons are Markdown and YAML in `content/`; a build validates them and
  leaves out anything not marked approved.

## Technology stack

TypeScript (strict) in an npm workspaces monorepo; Svelte 5, Vite and `vite-plugin-pwa`, Dexie;
Supabase (Postgres, Auth, Storage, Edge Functions on Deno); Zod 4; Vitest, Playwright and
`fake-indexeddb`; ESLint, Prettier, Husky, commitlint, secretlint; GitHub Actions; Cloudflare Pages
for hosting and Cloudflare R2 for encrypted backups (`age`).

## Technical decisions and trade-offs

Each is written up with its reasons in [`docs/decisions/`](../decisions/README.md):

- Supabase as the backend, with portability rules so it can be replaced.
- A PWA, not a native app: no store, instant updates, runs on cheap Androids.
- Offline-first with an outbox and append-only events.
- Svelte and Dexie: small bundles. A first-load budget of 120 KB gzipped is checked in CI on every pull request.
- One versioned `/v1` API; old phones keep working when new event types arrive.
- Backup codes as Supabase Auth users, a keyed hash for lookup, rate limits in Postgres.
- Roles and scope for mentors and admins, with the audit log's contents and anonymisation.
- Deliberately not used: microservices, queues, GraphQL, a custom backend server, Realtime.

## What is built, and what is not

| Built and tested                                                                                 | Planned, written as plans, **not built**                   |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Offline lessons, placement, practice, speaking recording, streaks, sync and restore              | AI doubt solver with safeguarding alerts                   |
| Google and backup-code sign-in, PIN profiles                                                     | Weekly AI summary and the content-drafting tools           |
| Mentor view, admin panel, audit log, feature switches, branding                                  | Org-wide dashboard, CSV export, logo upload                |
| Export and deletion on request, retention job, nightly encrypted backup (needs the owner's keys) | 1-to-1 meetings with Calendar and Meet, the community feed |

The planned work is in [`docs/superpowers/plans/`](../superpowers/plans/) so the build can continue
after this hackathon. It is not part of this submission.

## Limitations

- **Two approved sample lessons** exist (one English, one aptitude), and seven more are drafted and
  awaiting review. The lesson text was drafted by AI and has not been through a mentor review, which
  the pilot process requires. The pilot needs about 20 lessons and 20 puzzles.
- Not yet tested on the cheapest target phones or with real students; no guardian consent process
  is built in, that is the NGO's.
- The nightly backup and the Google Workspace features need the owner's own accounts and keys, and
  are not part of the demo.
- Staff sign-in uses Google only, and a Hindi/English switch covers the staff screens; learner
  screens follow each student's own language setting.
- A few timing-sensitive tests can flake under load.

## Dependencies

Runtime: `svelte` (via the Vite plugin), `dexie`, `zod`, `@supabase/supabase-js`, `postgres` (the database driver, used by the Edge Function and the admin
tool), `workbox-window` and the service-worker code `vite-plugin-pwa` generates, `marked` and
`yaml` (lesson build), `@fontsource/baloo-2` and `@fontsource/mukta` (fonts, bundled, no external
requests). Tooling is listed in `package.json`. All dependencies are open source; `npm audit` runs
in CI.

## Disclosure

- **Built with AI:** Claude Code throughout. See [AI-DEVELOPMENT.md](AI-DEVELOPMENT.md).
- **Work before the hackathon:** the repository's first commit is on 15 October 2026, after the
  hackathon started on 1 October. No code existed before it.
- **Authorship:** one developer, directing the AI tools, plus one automated dependency-update commit
  from Dependabot.
- **Data:** no real student data is in the repository or the demo. Demo students are fake, made by
  `npm run admin -- seed-demo`, and can be removed with `--remove`.
- **Secrets:** none in the repository or the ZIP. Keys live in the hosting and Supabase dashboards.

## Running it

See the [README](../../README.md). Judges who need access to the deployed demo can be given
details through the hackathon's submission process.
