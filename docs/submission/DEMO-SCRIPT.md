# Five-minute demo video: script

The hackathon scores how AI was used (35%) and engineering quality (30%) more than the screens, so
about half the video is the process. Keep the app part tight and real.

## Before recording

- [ ] The deployed app is up on the demo phone (installed as an app) with a student profile that
      has finished one lesson, plus the staff section signed in on a laptop in English.
- [ ] `npm run admin -- seed-demo` has been run, so the cohort page shows flagged students. Fake
      students only, never real names.
- [ ] A fallback: the same flow recorded once in full, in case the network fails.
- [ ] A terminal with `npm test` already warmed up, and the repo open on the files named below.

## Timeline

| Time | Show                                                                                       | Say                                                                                                                                                              |
| ---- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00 | Title card, one phone                                                                      | The problem in two sentences: Hindi-speaking students, cheap shared phones, patchy internet.                                                                     |
| 0:25 | Student phone: open a lesson, switch on airplane mode, finish it, switch it back, tap sync | It works with no network, saves on the phone, and uploads when it can. The profile is behind a PIN because phones are shared.                                    |
| 1:10 | Student: restore on a second window with a backup code                                     | A student with no Google account still keeps their progress.                                                                                                     |
| 1:30 | Laptop, staff section: cohort page with flagged students, open one                         | Mentors see who needs attention: away, stuck, low scores. Names are plain text, nothing from a student is trusted as HTML.                                       |
| 2:00 | Play a recording, leave a comment, change a level, pause a student                         | Every staff action is audited. A mentor cannot reach another cohort.                                                                                             |
| 2:30 | Admin: switches, branding contrast block, audit log (no codes or comments in it)           | Privacy rules are enforced by tests, not just by care.                                                                                                           |
| 2:50 | The repo: `CLAUDE.md`, `.claude/rules/`, one plan file                                     | How I gave the AI context: rules, plans with exact tests, decision records and gotchas.                                                                          |
| 3:25 | A plan's Review Focus, then PR #17's description (the review findings)                     | A fresh reviewer, not the author, found six important bugs; each was fixed test first. Show the paging bug that passed every memory test and failed on Postgres. |
| 4:00 | Terminal: `npm test`, then the database tests                                              | Contract tests run against both fakes and real Postgres. About 1,000 unit tests, 157 database tests, end to end tests, 90% coverage.                             |
| 4:30 | The limitations slide                                                                      | Two sample lessons, no real-device testing yet, AI features planned but not built. What comes next.                                                              |
| 4:50 | End card                                                                                   | One sentence: what I would build next.                                                                                                                           |

## Rules for the recording

- Do not show keys, the admin shell with exports, or any real student.
- Say plainly what is not built. The judges see the repository.
- Under 5:00. Cut the airplane-mode demo before cutting the process section.
