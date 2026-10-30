# Demo video: narration to read

About 640 words, spoken at a calm pace, fits the five-minute limit with a few seconds to spare. The
times match [DEMO-SCRIPT.md](DEMO-SCRIPT.md). Read it once aloud with a timer, and trim a sentence
or two if you run over. Say it in your own words wherever that is easier.

Only say what is true today. The app does not have AI doubts, meetings or the org-wide admin
dashboard yet: they are plans. The community page is built, small: posts and sessions, no files.

## 0:00 to 0:25: the problem

"This is Shiksha Path. It is for young people in villages and small towns in India who speak Hindi,
have weak English, and want an entry-level tech job. A student has a cheap phone, patchy and
expensive internet, and often shares the phone with family. Most learning apps assume fast
internet, English readers and one user per device. I built this for the opposite."

## 0:25 to 1:10: the student, offline

"Here is a student's phone. I open a lesson. Now I turn on airplane mode. The lesson still works:
it is downloaded, and every answer is saved on the phone first. I finish it, turn the network back
on, and tap sync. The progress uploads. Each action is an event with its own id, so a retry can
never count twice. The profile is behind a PIN, because the phone is shared."

## 1:10 to 1:30: a student with no Google account

"Not every student has a Google account. A mentor makes a backup code. Here I restore a profile on a
second window with that code and a new PIN, and the progress comes back."

## 1:30 to 2:00: the mentor

"Now the mentor's side, in English. The cohort page shows who needs attention: away for three days,
stuck on one lesson, or low scores repeatedly. These are demo students, made up for this video. A
student's name is always shown as plain text, never as HTML, so nothing a student types can run."

## 2:00 to 2:30: actions and the audit log

"I play a recording and leave a short comment. I change a student's starting level. As an admin I
can pause a student: their phone says so and keeps working offline. Every change is written to an
audit log, and the log never holds a code or a comment. A mentor cannot reach another mentor's
cohort, and the database enforces that too."

## 2:30 to 2:50: admin

"Admins switch features on or off for everyone or one student, and change the app's name and
colours. If the colours would be hard to read on a cheap screen in sunlight, saving is blocked."

## 2:50 to 3:25: how I used AI to build it

"Now the part about how it was built. I did not start by prompting code. I wrote a spec, then a
plan for each piece with the exact tests and interfaces. This is the project's CLAUDE.md and the
rules folder: the same rules for every AI session, plus decision records and a folder of traps we
hit once so we do not hit them twice. Four review agents are read-only, and hooks block editing on
the main branch and writing secret files."

## 3:25 to 4:00: learning from AI failures

"After each larger piece, a fresh reviewer, with no memory of the work, read the whole branch.
Here is the pull request for the mentor and admin work. It found six important problems. One was a
paging bug that passed every in-memory test and crashed on the real database. Another would have
lost a mentor's level change on an older version of the app. Each one was fixed test first, and the
rule that came out of it went into every later plan."

## 4:00 to 4:30: tests

"The tests run here: about a thousand unit tests, and the same behaviour tests run against both
in-memory fakes and real Postgres, so a fake cannot drift from the real thing. There are also
database tests with two students and two cohorts, end-to-end tests, and security scans on every
change. Coverage is about ninety percent."

## 4:30 to 4:50: honest limits and what next

"What is not done. There are twenty-three lessons, drafted by AI and approved by me, not yet by a
mentor panel. I have not tested on the cheapest phones or with real students. The AI doubt solver,
meetings and the org-wide dashboard are written as plans, not built; the community page has no
file attachments yet. After the hackathon,
the first step is the field test with a few real students. Thank you."

## Tips

- Record the screen first, then the voice, so you can match each part to what is on screen.
- If a part runs long, cut words, not parts. Keep the process section whole: it is where most of the
  score is.
- Do not show keys, the admin shell, or any real student. Check the screen before you press record.
- Say "about a thousand" and "about ninety percent". The exact numbers are in the documents.
