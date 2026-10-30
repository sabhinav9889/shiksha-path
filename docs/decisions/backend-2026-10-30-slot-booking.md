# One-to-one slot booking: Plan 6a built in a reduced form

**Status:** decided · 2026-10-30 · spec §10.1 · plan `2026-10-23-meetings.md` (reduced)

## Context

The spec has one-to-one meetings: mentors publish slots, students book them. Plan 6a wrote it with
Google Calendar events and Meet links, an encrypted refresh token per mentor, a jobs table and
`org_settings`, and it depends on Plans 5a and 4b, which are not built. The owner asked for slot
booking on the last day of the hackathon, so it is built small and without those dependencies.

## Decision

- **Built:** any active staff member publishes slots (a time in India time, 15 to 120 minutes in
  steps of 15, and an optional `https:` link they paste). A student sees the open slots of active
  mentors who teach their cohort, books one with a topic and a note of at most 280 characters,
  sees their bookings with the link, and cancels. The mentor sees who booked, with the topic and
  note, and can remove a slot.
- **Not built (cut from the plan):** Google Calendar and Meet, the mentor's calendar connection,
  weekly repeating slots, overlap checks, done and no-show outcomes, private meeting notes, mentor
  cancel reasons, `org_settings` and jobs. Booking needs the internet, so there is no offline copy.
- **Rules, fixed in code** (the plan made them settings): a slot can be booked from 24 hours to 14
  days ahead, both ends included; a student holds at most 2 bookings that have not started; a
  booking can be cancelled up to 2 hours before the start, inclusive.
- **One live booking per slot is the database's rule**, a partial unique index, so it holds when
  two students book the same moment. The two-booking limit is counted under a lock on the
  student's row. Both have tests on real Postgres that run the bookings at the same time.
- **The meeting link goes only to the student who booked.** Students have no direct read of a slot
  row. The open list leaves the link out, and the link is copied onto the booking when it is made.
- **A note is a minor's own words:** it is plain text, kept out of logs and audit entries, included
  in the student's data export, and removed when the student is deleted (the foreign key cascades).
  The staff audit entries (`slot_published`, `slot_removed`) hold ids and the length only.
- **Row-level security:** a student reads only their own bookings, and not while paused; a mentor
  reads their own slots and the bookings on them, even after the student moves cohort, but not
  another mentor's, even in the same cohort; an admin reads all. Nobody writes through the database API.
- **Who is removed when:** deleting a mentor removes their slots and the bookings on them; deleting
  a cohort leaves slots alone (a slot belongs to a mentor); a student who moves cohort no longer
  sees the old cohort's mentors' slots, but keeps a booking already made.
- **Mentors need a cohort.** Students see a slot only through its mentor's cohort links, so a
  mentor or admin with none publishes slots nobody sees.
- **Switch:** the existing `mentor_booking` feature switch is checked on the server.

## Consequences

- Calendar and Meet, repeating slots, outcomes and notes can be built later on these two tables.
- A student's phone with no internet cannot see or book slots.
- A paused mentor's slots stay in the table but are hidden; a deleted mentor's go.
- Known limit, shared with every audited action: the audit entry is written just after the change,
  not in the same transaction.
