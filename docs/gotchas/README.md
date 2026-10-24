# Gotchas

Traps we hit, so nobody hits them twice. One file per trap: **what breaks, why, how to avoid it.**
Read the relevant one before touching that area.

| File                                                                                       | Trap                                                                                   |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| [github-free-private-no-branch-protection.md](github-free-private-no-branch-protection.md) | Free private repos can't require reviews or CI on `main`; local hooks guard it         |
| [secret-fixtures-trip-gitleaks.md](secret-fixtures-trip-gitleaks.md)                       | Fake keys in tests are flagged by gitleaks in CI; build them at runtime                |
| [worktree-hooks-need-npm-ci.md](worktree-hooks-need-npm-ci.md)                             | Git hooks don't run in a new worktree/clone until `npm ci`                             |
| [unicode-escapes-become-literal.md](unicode-escapes-become-literal.md)                     | `\u` escapes can land as invisible characters; nukta letters stay decomposed in NFC    |
| [run-vitest-from-the-repo-root.md](run-vitest-from-the-repo-root.md)                       | Vitest from `apps/learner` fails every Svelte test; run it from the root               |
| [rebuild-the-function-before-e2e.md](rebuild-the-function-before-e2e.md)                   | The backend e2e serves the committed bundle: rebuild it and restart the function first |
| [test-db-is-separate-from-test.md](test-db-is-separate-from-test.md)                       | `npm test` skips Postgres; run `npm run test:db` for adapters, migrations and RLS      |
| [commit-body-lines-read-as-footers.md](commit-body-lines-read-as-footers.md)               | A body line like `word: text` fails commitlint as a footer                             |
| [lint-limits-to-design-for.md](lint-limits-to-design-for.md)                               | Line, function, complexity and file-size limits that force late refactors              |
| [playwright-project-flag-after-the-filter.md](playwright-project-flag-after-the-filter.md) | `--project` swallows the file filter; rebuild the app; register new specs              |
