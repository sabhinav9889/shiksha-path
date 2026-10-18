# Backend portability rules

**Status:** decided · 2026-10-18 · spec §5.5

## Context

We may outgrow Supabase (cost at scale, a government data-hosting requirement, heavy background
processing). Moving should be a planned migration, not a rewrite.

## Decision

1. The app calls only our versioned API (`/v1/...`) through one API module, never tables directly.
2. Business logic is plain TypeScript with no Supabase imports; Edge Functions are thin wrappers.
3. The schema is SQL migrations in git, standard Postgres only.
4. Our own `learners.id` is the key everywhere; the auth provider's ID appears in one mapping table.
5. One S3-style storage interface for files.
6. No Supabase-only extras (e.g. Realtime) without a decision record.
7. NGO-owned backups (`pg_dump` + storage export), Mumbai region.

## Consequences

A little more upfront code (API layer, adapters). Migration order if needed: database → functions →
files → auth, each step invisible to students.
