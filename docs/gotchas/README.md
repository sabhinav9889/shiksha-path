# Gotchas

Traps we hit, so nobody hits them twice. One file per trap: **what breaks, why, how to avoid it.**
Read the relevant one before touching that area.

| File                                                                                       | Trap                                                                           |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| [github-free-private-no-branch-protection.md](github-free-private-no-branch-protection.md) | Free private repos can't require reviews or CI on `main`; local hooks guard it |
| [secret-fixtures-trip-gitleaks.md](secret-fixtures-trip-gitleaks.md)                       | Fake keys in tests are flagged by gitleaks in CI; build them at runtime        |
| [worktree-hooks-need-npm-ci.md](worktree-hooks-need-npm-ci.md)                             | Git hooks don't run in a new worktree/clone until `npm ci`                     |
