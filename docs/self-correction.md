# Self-correction

When a doc, rule or plan turns out to be wrong, fix it in the same PR so the next person (or agent)
doesn't hit the same mistake. Adapted from heidi.microservices.

1. **Find the reference.** Before a task, note which docs inform it: `CLAUDE.md`, `.claude/rules/`,
   the spec, the plan, `docs/`.
2. **Do it as documented.** Follow the doc exactly and capture the real output.
3. **Compare.** If reality differs, find the source of truth (config, code, tool output). Never
   guess.
4. **Fix the reference.** Correct the most specific file:
   - a plan step → the plan, plus a `Ruling:` line in the plan's ledger
   - a project rule → `.claude/rules/<topic>.md`
   - a trap others will hit → a new `docs/gotchas/` file
   - a decision that changed → a new `docs/decisions/` record that supersedes the old one
5. **Say so.** List the corrected docs in the PR description under "Docs corrected".
