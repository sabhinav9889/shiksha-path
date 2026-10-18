# Database

Supabase Postgres. Spec §5.4, §5.5, §7.2.

## Migrations

- SQL files in git via the Supabase CLI. Nothing is created by hand in the dashboard.
- Name: `<timestamp>_<snake_case_description>.sql`.
- Idempotent (`IF NOT EXISTS`, `IF EXISTS`), with a matching down migration.
- Standard Postgres only (portability rule).

## Tables

- Primary keys are our own UUIDs (`learners.id`). The auth provider's user ID appears only in the
  identity mapping table.
- Soft delete (`deleted_at`) for user content; hard delete for erasure requests.
- Indexes on foreign keys and on columns used in filters and sorting.
- `created_at` / `updated_at` on every table.

## Row-level security

- RLS **enabled on every table**, with a policy per role (student, mentor, admin).
- Each policy has a test with 2+ students and 2+ cohorts (`testing.md`).
- Policies stay simple; the API layer does the main permission checks (defence in depth).

## Events and dashboards

- The progress event log is append-only, de-duplicated by event ID.
- Dashboards read summary tables, refreshed on a schedule, never the raw log per request.
