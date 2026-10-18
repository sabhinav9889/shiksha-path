# Supabase as the backend

**Status:** decided · 2026-10-18 · spec §5.4

## Context

One builder, an NGO budget near zero, a 30-student pilot. We need a database, Google sign-in, file
storage for speaking recordings, scheduled jobs and small server functions (sync ingest, AI calls,
calendar bookings).

## Decision

Use Supabase: Postgres with row-level security, Supabase Auth (Google), Storage, Edge Functions and
`pg_cron`. No custom backend server. Free tier for the pilot, Pro (~$25/month) before ad-driven
intake.

## Consequences

- Fast to build; standard Postgres underneath, so data is never locked in.
- Lock-in risk sits in Auth, Storage and Edge Functions; [portability rules](backend-2026-10-18-portability-rules.md) contain it.
- Free projects pause after inactivity and have no backups: never run real students on Free beyond the pilot.

Alternatives rejected: Firebase (proprietary data model), own Node server (more to run and secure),
fully managed AWS stack (cost and complexity).
