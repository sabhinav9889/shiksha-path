# Submission form: answers to paste

Short versions of the longer documents, so the form can be filled in one sitting. Nothing here goes
beyond what [SUBMISSION.md](SUBMISSION.md), [AI-DEVELOPMENT.md](AI-DEVELOPMENT.md) and
[QA-APPROACH.md](QA-APPROACH.md) already say. Check the numbers against `npm run package:submission`
and a fresh test run before pasting.

## Product name and one line

**Shiksha Path.** An offline-first learning app for Hindi-speaking students, with a web section for
the mentors and admins who look after them.

## Problem statement (about 70 words)

Young people from villages and small towns in India, often minors, speak Hindi and have weak
English, which shuts them out of entry-level tech work. An NGO runs labs and mentors, but a student
at home has a cheap phone, patchy and expensive internet, and often shares the phone with family.
Most learning apps assume fast internet, an English reader and one user per device.

## Product description (about 150 words)

Shiksha Path is a progressive web app. Students learn from short Hindi-first lessons that work with
no network: a placement test, practice with immediate feedback, speaking recordings, streaks, and
progress backed up when they are online. Profiles are protected by a PIN because phones are shared,
and a student without a Google account joins with a backup code. Mentors see their own cohorts and
who needs attention, listen to recordings, create backup codes, change levels and mark attendance.
Admins set up labs, cohorts and mentors, manage and pause students, switch features on or off,
change the branding (blocked if the text would be hard to read), delete a student's data on
request, and read an audit log. The app has 22 lessons (14 English, 8 aptitude). It is built to
protect minors: students see only their own data, mentors only their cohorts, and nothing personal
goes in logs or URLs.

## Demo link

`https://shiksha-path.pages.dev` (the student app; the staff section is at `/#/staff`). If judges
need a login for the staff section, share it through the organisers' process, never in the
repository.

## Architecture (3 sentences)

The phone is the primary store: every action is an event saved locally and uploaded later, and the
server accepts each event id once. A single versioned `/v1` API runs as a Supabase Edge Function
(handler, service, repository), with Postgres row-level security on every table. Business logic has
no provider imports; only adapters touch Supabase, so the backend can be swapped.

## Technology stack

TypeScript (strict) in an npm workspaces monorepo; Svelte 5, Vite and `vite-plugin-pwa`, Dexie
(IndexedDB); Supabase (Postgres, Auth, Storage, Edge Functions on Deno); Zod 4; Vitest, Playwright;
GitHub Actions; Cloudflare Pages.

## How AI was used (5 bullets)

- **Spec, then plan, then test-first execution.** Each piece has a written plan with exact tests and
  interfaces, executed by Claude Code, one task at a time.
- **Context engineering.** `CLAUDE.md`, `AGENTS.md` and `GEMINI.md`, nine rule files, decision
  records and a gotchas folder give every AI session the same rules and traps.
- **Agents, hooks and guardrails.** Four read-only review agents, hooks that block editing on `main`
  and writing secret files, git hooks, and CI scans (`gitleaks`, `semgrep`, `trivy`, `npm audit`).
- **A fresh reviewer per branch.** A separate model run, with no memory of the work, reviewed the
  larger branches; every Critical and Important finding was fixed test-first. The paging, old-phone,
  shared-phone and stale-data findings are written up with their fixes.
- **Human ownership.** The owner made the product decisions and merged every pull request.

## How AI was used for testing

AI wrote the tests from each plan's written test list and ran them red first, probed each branch
with the plan's "Review Focus" of untested input classes, wrote negative and adversarial tests,
traced failures to causes (for example a race found by CI), and reviewed the code. The same
behaviour tests run on both in-memory repositories and real Postgres, so a fake cannot drift.
Details and the honest limits are in [QA-APPROACH.md](QA-APPROACH.md).

## Limitations

- 22 lessons, drafted by AI and approved by the developer, not yet by a mentor panel; the pilot
  needs more.
- Not yet tested on the cheapest target phones or with real students.
- AI doubt solver, meetings, community feed and the admin dashboard are written as plans and not
  built.
- The nightly encrypted backup and the Google Workspace features need the owner's own accounts and
  keys and are not part of the demo.

## Disclosure

Built with Claude Code throughout. The repository's first commit is 15 October 2026, after the
hackathon started. One developer, directing the AI tools (plus one automated dependency-update
commit). No real student data is in the repository or the demo; demo students are fake. No secrets
are in the repository or the ZIP.
