# Run Vitest from the repo root, not from `apps/learner`

**What breaks:** `cd apps/learner && npx vitest run` fails every Svelte test with
`rune_outside_svelte: The $state rune is only available inside .svelte files`.

**Why:** the Svelte plugin and the jsdom setup live in the root `vitest.config.ts`. Run from a
subfolder, Vitest finds no config and compiles `.svelte.ts` files as plain TypeScript.

**How to avoid:** always run from the root: `npx vitest run apps/learner/src/staff` (a path filter
is fine). Playwright and `npm run -w` scripts are the exceptions: they set their own working
directory.
