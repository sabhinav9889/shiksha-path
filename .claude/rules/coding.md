# Coding

Full reasoning: `docs/engineering-standards.md`.

## Limits (ESLint enforces; zero warnings)

- Line ≤ 100 chars · file ≤ 300 lines (tests 500, Svelte 200) · function ≤ 50 lines
- Complexity ≤ 10 · nesting ≤ 3 · parameters ≤ 4 (use an options object)
- Disabling a rule needs a reason: `// eslint-disable-next-line <rule> -- <why>`

## Style

- TypeScript strict. No `any`. Exported functions declare return types.
- Early returns; no `else` after `return`.
- Named constants instead of magic numbers (`MAX_DOUBTS_PER_DAY`, not `10`).
- `const` over `let`; `===` only (except `== null`).
- Always `await` promises; no floating promises.
- Small files with one responsibility. Split before you hit a limit, not after.
- Names say what things are: `effectiveDoubtLimit`, not `lim2`.

## Errors

- Every user-visible error has an `ErrorCode` (`DOUBT_LIMIT_REACHED`). The code picks the Hindi or
  English message. Never show raw errors, stack traces or technical codes to students.
- Errors at boundaries are values (`Result`), not swallowed exceptions.

## Forbidden

`console.*` (use the logger) · `eval` / `new Function` · `var` · `switch` without `default` ·
hard-coded user-facing text (use the i18n catalogue, both `hi` and `en`).

## Scope

- Touch only what the task needs. No drive-by refactors.
- Less code is better. Lines of code are debt.
- Scripts: `--help`, `--dry-run`, never print secrets, prefer `node:*` built-ins.
