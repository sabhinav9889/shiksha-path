# The database tests need `supabase/functions/.env.local`

**What breaks:** in a fresh clone or worktree, `npm run test:db` fails one test in
`supabase/tests/api.test.ts` ("a code signs in, the session reaches /v1/me, and a wrong code is
BAD_CODE") with `ENOENT: no such file or directory, open 'supabase/functions/.env.local'`. The other
database tests pass, so the failure looks like a real bug in backup-code sign-in.

**Why:** the test reads the local backup-code pepper from `supabase/functions/.env.local`. That file
is git-ignored (`supabase/functions/.env*`), so it does not exist in a new checkout. Only
`supabase/functions/.env.local.example` is committed.

**How to avoid:** copy the example before running the database tests or `npm run functions:serve`:

```bash
cp supabase/functions/.env.local.example supabase/functions/.env.local
```

The example holds placeholder values for local use only. Production gets its own secrets through the
host's environment settings, never through this file.
