# Rebuild the function bundle and restart `functions:serve` before the backend e2e

**What breaks:** `npm run test:e2e:backend` passes or fails against yesterday's server code. A new
route answers 404, or a fixed bug is still there.

**Why:** the Edge Function runs from the generated bundle `supabase/functions/api/server.bundle.js`. It is
git-ignored (not in the repo), and only `npm run functions:build` regenerates it. `functions:serve` loads it once and keeps
serving it. `db reset` can also kill the served function.

**How to avoid:** after any change in `packages/server`, run `npm run functions:build`, stop the
served function, start `npm run functions:serve` again, and wait until
`/functions/v1/api/v1/branding` answers 200. Don't commit it: it is git-ignored. CI builds it
before `supabase start`, and you build it before every deploy.
