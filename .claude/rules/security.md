# Security

Target: OWASP ASVS Level 2. The `security-reviewer` agent checks every task against this file.

## Input

- Validate every boundary with Zod: API requests, files, environment, AI output.
- Parameterised queries only. Never build SQL from strings.
- Escape or sanitise anything rendered as HTML (lesson Markdown is rendered at build time only).

## Access control (defence in depth)

- Every API handler checks who is calling and what they may do (student / mentor / admin).
- **Every table has row-level security**, plus a test proving isolation (`testing.md`).
- Students see only their own data; mentors only their cohorts; admins everything.
- Take identity and role from the verified session, never from the request body.

## Auth

- Google sign-in; backup codes are hashed, rate-limited and resettable by mentors.
- Minimal OAuth scopes: students `email profile`; mentors add Calendar for their own calendar only.

## Secrets

- Only in environment settings. Never in code, logs, tests or the app bundle.
- The phone never holds API keys (AI, Google, service role).

## Abuse and limits

- Rate-limit sign-in, doubts, bookings and uploads. Enforce limits on the server, not the app.
- Upload limits: recordings ≤ 1 MB, attachments ≤ 2 MB, logo ≤ 500 KB; check type and size.
- Recordings and attachments use short-lived signed URLs.

## Errors and dependencies

- Never return stack traces, SQL errors or file paths to clients.
- New dependencies need a reason in the PR; `npm audit` high/critical blocks CI.
