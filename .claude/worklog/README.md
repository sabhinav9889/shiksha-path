# Worklog detail files

One file per task that needs more context than its `WORKLOG.md` row: `.claude/worklog/<slug>.md`.

```markdown
# <Title>

**Status**: in-progress | blocked | shipped | on-hold
**Assignee**: <name> | **Branch**: <branch> | **Started**: YYYY-MM-DD | **Updated**: YYYY-MM-DD
**Goal**: what done looks like, in one sentence
**Next**: one concrete next action

## Notes

- Context, blockers, decisions (bullets)
```

| Action          | What to do                                                |
| --------------- | --------------------------------------------------------- |
| Starting a task | Add or update the `WORKLOG.md` row: `in-progress`, branch |
| Picking one up  | Read its detail file before touching code                 |
| Blocked         | Status `blocked`; write the blocker in the detail file    |
| Done            | Status `shipped`; move the row to Archive after merge     |
