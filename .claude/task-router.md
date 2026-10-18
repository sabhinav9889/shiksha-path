# Task router

Run at the start of every non-trivial task. It decides the reviewers and whether the `architect`
agent plans first. Adapted from heidi.microservices, without the code graph (small repo).

## 1. Classify

| Type     | Signal words                                      | First step                         |
| -------- | ------------------------------------------------- | ---------------------------------- |
| feature  | add, build, create, support, allow                | Find the spec section + plan task  |
| fix      | fix, broken, wrong, regression, returns X instead | Write a test that reproduces it    |
| bug-hunt | slow, flaky, intermittent, why does, investigate  | `superpowers:systematic-debugging` |
| refactor | rename, extract, split, move, simplify            | Confirm tests cover the area first |

Two types in one request ("fix X and add Y")? Split into two tasks.

## 2. Load only what the task touches

- The spec section and the plan task (always).
- The `.claude/rules/` files for the areas touched (see the table in `CLAUDE.md`).
- `docs/gotchas/` entries for that area.

## 3. Architect first?

Run the `architect` agent **before** writing code when the task touches any of:

- auth, sessions, roles, backup codes
- row-level security policies or a new table
- the sync protocol or event format
- AI prompts or safeguarding
- more than one package/app, or a public `/v1` API shape

## 4. Reviewers (always, before "done")

`spec-reviewer` → `code-reviewer` → `security-reviewer`, on the task's diff. The reviewers have no
shell: first write the diff to a file (`git diff <base>..HEAD > .superpowers/review/<task>.diff`)
and pass each reviewer that path, the plan task and the spec section. Any FAIL: fix, rerun
that reviewer. Paste the three results into the PR.

## Output

```
## Routing — <task>
Type: feature | fix | bug-hunt | refactor
Spec/plan: <section>, <plan task>
Rules loaded: <files>
Architect first: yes | no (why)
```
