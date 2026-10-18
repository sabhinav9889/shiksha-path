# Security policy

Shiksha Path holds learning data about students, many of them minors. We take reports seriously.

## Reporting a vulnerability

- **Do not open a public issue.** Use GitHub's private vulnerability reporting
  (Security → Report a vulnerability) or contact the repository owner directly.
- Describe the problem, how to reproduce it and the impact. **Never include real student data**;
  use made-up examples.
- We acknowledge reports within 7 days and fix critical issues first.

## In scope

The learner app, mentor and admin panels, the sync API and Edge Functions, database policies, the
content build, and CI configuration.

## How we prevent issues

Read-only security review on every change, row-level security with isolation tests, blocking CI
scans (npm audit, gitleaks, Trivy, Semgrep), Dependabot, and secret scanning on every commit. See
`.claude/rules/security.md` and `docs/engineering-standards.md`.
