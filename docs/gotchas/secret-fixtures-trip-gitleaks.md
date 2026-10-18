# Fake secrets in tests trip gitleaks

**What breaks:** a test that proves the secret scanner works needs a fake key. Written as a literal
(even split in two, `'AKIA' + '…'`), gitleaks' `generic-api-key` rule flags it in CI as a leak:
high-entropy text near a word like `secret`/`key`.

**Why:** gitleaks scans source and history with entropy + keyword rules; it can't know the value is
fake. secretlint (pre-commit) and gitleaks (CI) use different rules, so passing one doesn't mean
passing the other.

**How to avoid:** build fake secrets at runtime from harmless pieces (see
`tooling/test/git-hooks.test.ts`), and don't name the variable `secret`/`token`/`key`. Check locally
with `gitleaks detect --no-git --source <dir>` before pushing.

**If one is already in history:** add only that finding's fingerprint to `.gitleaksignore` with a
comment saying it's a fake. Never ignore a real secret: rotate it.
