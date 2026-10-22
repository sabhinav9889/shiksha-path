# The /v1 API: one Edge Function, plain modules, SQL through postgres.js

**Status:** decided · 2026-10-20 · spec §5.4, §5.5 · plan `2026-10-20-backend-sync.md`

## Context

The portability rules ask for our own versioned API, business logic with no Supabase imports, our
own learner ids and SQL migrations. Supabase gives us Postgres, Auth and Edge Functions (Deno).

## Decision

- One Edge Function, `api`, routes every `/v1/...` path. Its base URL is
  `<SUPABASE_URL>/functions/v1/api`; moving the backend changes only that base URL.
- Handlers, services and repositories live in `packages/server` (plain TypeScript). The function is
  a thin wrapper that builds the dependencies and calls `handle(request, deps)`.
- Repositories reach Postgres with parameterised SQL through postgres.js; nothing else has SQL.
- Access tokens are verified by an `Auth` adapter (Supabase Auth); identity comes from the token,
  never from the request body. Supabase Auth is used only for Google sign-in.
- Row-level security is enabled on every table as a second line of defence: signed-in users can
  only read their own rows, and nobody can write through Supabase's REST endpoints.
- The server code is bundled with esbuild for Deno, because our packages import `.ts` files through
  `.js` specifiers, which Node and Vite resolve and Deno does not.

## Consequences

- The same modules can later run on Node (Cloud Run, a VM) with a different wrapper.
- Every request costs one Auth call to verify the token; acceptable at pilot scale.
- The bundle must be rebuilt before serving or deploying the function (`npm run functions:build`).

## Later changes (Plan 3b)

- **Pull visibility:** `seq` is taken at insert, not at commit, so a pull returns only events
  whose transaction is older than every transaction still running
  (`tx_id < pg_snapshot_xmin(pg_current_snapshot())`). A cursor can then never pass an event that
  commits later.
- **Who may create a learner:** only a Google sign-in. Email sign-ins exist for backup codes,
  which the server creates itself. Supabase cannot keep email login while refusing self sign-up,
  so sign-up stays on with confirmation required, and `Auth.verify` reports the provider from
  admin-only `app_metadata`.
- **Grants:** `anon` has none and `authenticated` only `select`; GraphQL is not installed.
