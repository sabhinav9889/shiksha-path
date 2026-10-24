# Playwright: put the file filter before `--project`

**What breaks:** `npx playwright test --project chromium-backend staff.spec` fails with
`Project(s) "staff.spec" not found`.

**Why:** `--project` takes several values, so it swallows the word after it.

**How to avoid:** `E2E_BACKEND=1 node tooling/with-local-supabase.mjs npx playwright test -c apps/learner staff.spec --project chromium-backend`.
Rebuild the app (`npm run build -w @shiksha/learner-app`) after changing app code: the e2e serves the
built files, not the source. A new spec file must be added to a project's `testMatch` (and to the
other projects' `testIgnore`) in `apps/learner/playwright.config.ts`.
