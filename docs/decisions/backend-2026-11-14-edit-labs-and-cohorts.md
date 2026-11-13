# Admins rename labs and cohorts, and move a cohort between labs

**Status:** decided · 2026-11-14 · spec §8.1 (admin setup)

## Context

An admin could create and delete (when empty) labs and cohorts, but not fix a typo or move a cohort
to another lab. The API already accepted an `id` on `POST /v1/staff/admin/lab` and `/cohort`, but
in Postgres that was an upsert: an unknown id created a new row with an id the client chose, and a
cohort in a lab that no longer existed failed with a database error (a 500).

## Decision

- **An `id` means edit, and an edit never creates.** New repository methods `updateLab` and
  `updateCohort` use an `update … where id = …`; they return false when the row is not there, and
  the service answers `INVALID_REQUEST`. `saveLab` and `saveCohort` now only create, so the id
  always comes from the database.
- **A cohort may only be put in a lab that exists** (new or edited), checked in the service:
  `INVALID_REQUEST` otherwise. A lab deleted at the very moment another admin saves a cohort into it
  can still fail on the foreign key and answer 500; the data stays correct. Accepted for now.
- **Students and mentors keep their cohort** when it is renamed or moved; only the cohort's name and
  its lab change. A cohort can also leave its lab (`labId: null`).
- **Admin only**, like create and delete. Audit action stays `lab_saved` / `cohort_saved`; an edit
  now records `{ id, name }` (and `labId` for a cohort), group names being organisation data rather
  than personal data. A create records what it did before.
- **Screen:** an Edit button on each lab and cohort opens one inline form (one at a time); a failed
  save says so and keeps the form open.
- `admin.ts` went over the file-length limit, so the lab and cohort functions moved to
  `admin-groups.ts` (re-exported from `admin.ts`), and `requireAdmin` to `require-admin.ts`.

## Consequences

- The behaviour is one contract test file (`group-edit-contract.ts`) run on in-memory repositories and
  on Postgres, plus a route test and screen tests.
- Not built: editing staff or students here (they have their own screens), a rename history, and
  refusing two labs or cohorts with the same name (names are not unique today).
