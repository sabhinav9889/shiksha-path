# Git and PRs

## Branches

- Never commit or push to `main`. Git hooks block commits on `main` (pre-commit) and pushes to it
  (pre-push); a Claude hook blocks edits in a checkout on `main`. The repo is a free private repo
  with no server-side protection (see `docs/gotchas/github-free-private-no-branch-protection.md`).
- **Run `npm ci` in every new clone or worktree** before working: git hooks are off until then
  (`docs/gotchas/worktree-hooks-need-npm-ci.md`). The Claude edit hook refuses edits until it's done.
- Branch from `main`: `feature/<slug>`, `fix/<slug>`, `chore/<slug>`, `docs/<slug>`.

## Commits

- Conventional: `<type>(<scope>): <subject>`. Types: feat, fix, docs, style, refactor, perf, test,
  build, ci, chore, revert. Scope in kebab-case.
- Subject ≥ 10 chars, imperative, no trailing period; header ≤ 100 chars.
- Body explains **why**. One logical change per commit.
- Keep the `Co-Authored-By: Claude ...` trailer on AI-assisted commits.
- Commit identity for this repo is set locally (not the global one).

## Pull requests

- Use `.github/pull_request_template.md` and fill in every section, including the impact checklist.
- Link the spec section and plan task.
- Paste the reviewer results (spec, code, security: PASS) and the test command output.
- CI and Security workflows must be green. The owner merges.
