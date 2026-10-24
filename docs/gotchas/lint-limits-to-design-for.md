# Lint limits that bite late

**What breaks:** the work passes its tests, then lint fails at commit time and the fix is a
refactor, not a tweak.

**The limits (ESLint, zero warnings):** line ≤ 100 characters; function ≤ 50 lines; complexity ≤ 10;
nesting ≤ 3; parameters ≤ 4 (use an options object); file ≤ 300 lines, **Svelte ≤ 200**, **tests ≤
500** (shared contract files count: Plan 4a's staff contract passed 500 and was split); no magic
numbers outside tests; exported functions declare return types; Svelte `let` that is never
reassigned must be `const`.

**How to avoid:** split before you hit a limit. Put shared form styles in the parent, a long
contract into two files with a shared helper (`staffWorld`). Run `npm run lint` after each task,
not at the end.
