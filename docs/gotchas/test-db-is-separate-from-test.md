# `npm test` does not run the database tests

**What breaks:** a change to a repository, migration or RLS policy shows green in `npm test` and
is broken against Postgres. Plan 4a's admin list paging passed every in-memory test and crashed on
the second page in Postgres.

**Why:** `npm test` runs the in-memory repositories only. `npm run test:db` runs the same shared
contract tests, plus the RLS and migration tests, against the local Supabase stack.

**How to avoid:** for any task that touches `packages/server/src/adapters`, `supabase/` or a
contract test, run `npm run test:db` before committing. Write new contract tests with more rows
than one page, and run them on both repositories.
