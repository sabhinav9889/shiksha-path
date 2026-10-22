# Backup codes, recordings, deletion and backups

**Status:** decided · 2026-10-22 · spec §5.3, §5.5 rules 5 and 7, §7.4, §8.1 · plan
`2026-10-22-backend-sync-2.md`

## Context

Plan 3b adds the backend pieces that hold or protect students' personal data: backup login codes
for students without Google, speaking recordings, deletion and export on request, and the NGO's own
backups. The owner confirmed the builder's-call values in the plan on 2026-10-22.

## Decision

- **Backup codes are Supabase Auth users with a made-up email** (`code-<uuid>@codes.invalid`)
  and a password derived from the code: `HMAC-SHA256(CODE_PEPPER, "password:" + code)`. The
  server stores only `HMAC(CODE_PEPPER, "lookup:" + code)`. Sign-in returns a normal session, so
  the rest of `/v1` and the app's session handling are unchanged. A reset makes a new auth user and
  deletes the old one, so old sessions stop at once.
- **Email sign-up stays on, with confirmation required.** Supabase cannot keep email login (which
  code users need) while refusing self sign-up. A stranger who signs up gets no session, and
  `/v1` lets only a Google sign-in create a learner (`app_metadata.provider`, set only by Supabase
  and the admin API).
- **Recordings go straight to a private bucket** through short-lived signed upload URLs. The
  function signs URLs and records metadata, behind a `RecordingStorage` port (S3 or R2 is one
  adapter). The bucket itself enforces 1 MB and audio types. The migration creates the bucket:
  the plan's one Supabase-specific statement.
- **Phones upload recordings only on Wi-Fi or ethernet** by themselves, or when the learner taps
  the button. A browser that cannot say counts as mobile data.
- **Retention:** 30 days after mentor review; 90 days after upload when never reviewed; 7 days for
  an abandoned upload. Runs nightly after the backup.
- **Deletion leaves a tombstone id only.** A public `/v1/learners/deleted` check, rate-limited per
  network, lets a phone wipe its copy after a refused sign-in. A refused sign-in alone never wipes
  anything.
- **Backups:** nightly GitHub Actions, `pg_dump` of `public` and `auth` plus the recordings bucket,
  `age`-encrypted to the NGO's public key, into the NGO's own Cloudflare R2 bucket with a 30-day
  lifecycle. Everything runs in `debian:trixie` pinned by digest; CI restores a local backup on
  every pull request.
- **Rate limits** are fixed windows in Postgres, one atomic upsert per hit. Buckets hold learner
  ids or a 16-character keyed hash of the network address, never an IP or an email.

## Consequences

- `CODE_PEPPER` must never change once codes are issued, or every code stops working.
- Until the admin panel (Plan 4), the owner issues codes, exports, deletes and sets branding with
  `npm run admin` on a trusted computer.
- A code student cannot add Google sign-in yet (one identity per learner); Plan 6 adds it.
- The NGO's private age key, kept offline in two places, is the only way to read a backup.
