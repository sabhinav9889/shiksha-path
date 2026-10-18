# Free private repo: no branch protection on `main`

**What breaks:** GitHub's free plan can't protect branches of a private repo
(`Upgrade to GitHub Pro or make this repository public`, HTTP 403). Nothing on GitHub stops a direct
push to `main`, a merge with failing CI, or a force push.

**Why:** branch protection and rulesets for private repos need GitHub Pro, Team or Enterprise.

**How we cope:** local guards. The git `pre-push` hook (`tooling/hooks/block-main-push.sh`) refuses
pushes to `main`, and the Claude Code hook blocks edits while on `main`. CI still runs on every PR,
and the owner merges only green PRs.

**Fix for real:** move the repo to an NGO organisation on GitHub for Nonprofits (free Team plan) or
upgrade to Pro, then protect `main`: 1 approval, `CI` and `Security` checks required, no force push,
no deletion.

**Also on the free plan:** CodeQL code scanning needs GitHub Advanced Security for private repos, so
static analysis runs on Semgrep in `.github/workflows/security.yml` instead. Switch to CodeQL if the
repo moves to a plan that includes it.
