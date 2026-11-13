# Students see their recordings and the mentor's comment

**Status:** decided · 2026-11-14 · spec §6.5 and §8 (recordings with short mentor comments)

## Context

A student records speaking practice and a mentor can review it with a comment of at most 280
characters. Until now the student never saw that comment, nor could they hear their own recording
again. The hackathon submission named this as a limit. The owner asked for it as the first piece of
work after the win.

## Decision

- **Two read routes for the student**, no migration (the table, the comment column and the
  owner-only read policy already exist):
  - `GET /v1/me/recordings`: the caller's own uploaded recordings, newest first, at most 50, each
    with `reviewedAt` and `comment` (both null until a mentor reviews it; a review may have no
    comment).
  - `GET /v1/me/recording-url?id=`: a 5-minute signed link to the caller's own uploaded recording.
- **Who reviewed it is not sent.** The student sees "seen by a mentor" and the comment, not a
  name, id or email. Less personal data on a minor's phone, and the mentor's identity stays in the
  audit log. This can be revisited if the NGO wants names shown.
- **Someone else's recording and an unknown id answer the same (`FORBIDDEN`)**, so a student
  cannot probe for ids. A classmate in the same cohort is refused too.
- **Playing is rate limited** (`playback`: 120 an hour per student) because every play makes a
  signed link.
- **Offline:** the list is cached on the phone per profile (`feedback:<profileId>`), so it shows
  offline and goes with the profile when it is removed. Playing needs the internet and says so.
- **The comment is plain text**, rendered as text, never markup.
- **The card is a lazy chunk on the My details screen**, hidden in the app while speaking practice
  is off. The routes themselves do not check that switch: they only ever return the student's own
  data, so there is nothing to protect, and a student whose switch is turned off can still read old
  feedback if they call the API directly.
  The client gets a generic `call(path, schema)`, so the card brings its own schemas and the first
  load does not grow by more than 0.2 KB (119.7 of 120 KB).

## Consequences

- The first-load budget has 0.3 KB left. The next student-facing feature must also be lazy or the
  budget must be reviewed on purpose.
- The card says a recording is removed 30 days after review. That number is written in the text;
  if the retention rule changes, change the text (`feedback-i18n.ts`).
- The offline copy of the list, comment included, stays on the phone until the next online refresh
  replaces it, so the 30-day text can be out of date for a student who stays offline. Playing
  such a recording needs the internet and fails with a message.
- The signed link is made for any row still marked uploaded. During the nightly clean-up, files are
  removed before rows, so a link requested in that gap points to a missing file; the player then
  shows "could not play".
- The comment is cached unencrypted in the phone's IndexedDB, like the rest of a profile. The PIN
  guards the app, not the storage.
- Not built: notifying the student when a mentor reviews (waits for notifications), deleting a
  recording by the student, showing the lesson title (only the date and length are shown).
