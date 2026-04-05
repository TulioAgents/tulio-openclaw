---
name: openspec-handoff
description: Create or update the handoff.md when ownership of a change moves between agents. Use whenever you finish your part of a change and need to pass it to the next person.
metadata: { "openclaw": { "emoji": "🤝" } }
---

# openspec-handoff

Write or update `handoff.md` when ownership moves between agents. A good handoff means the next agent starts immediately without asking questions.

## When to use

- Finishing your task and passing to the next agent
- Escalating a blocker
- Resuming a change after a gap (update to reflect actual state)

## Steps

### 1. Check change state

```bash
cd <project-root>
openspec status --change "<change-id>" --json
```

Understand which artifacts exist and what phase the change is in.

### 2. Be honest about actual state

Before writing, answer:

- What is **actually done**? (not what was planned)
- What is **actually blocked**? (not what might be blocked)
- What does the next person need to start immediately?

### 3. Write or update handoff.md

```markdown
# Handoff: <change-id>

## Metadata

- **Project:** <project-code>
- **Change ID:** <change-id>
- **Branch:** <branch-name>
- **Worktree:** <path if applicable>
- **Last updated:** <date>

## Current Owner

**<agent-role>** — <one sentence: what they should do next>

## Status

<What is done so far, in plain language>

## What was done this session

- <specific thing completed>
- <specific thing completed>

## Blocked on

<What is preventing progress, or "nothing">

## Files changed

- `path/to/file.ts` — <why it was changed>

## Decisions made

- <decision and brief rationale>

## OpenSpec artifact state

Run `openspec status --change "<change-id>" --json` to see current artifact status.

## Next step

<Clear, specific instruction for the next agent — not "continue implementation">

## Verification status

pending | in-progress | passed | failed

## Related artifacts

- Proposal: `openspec/changes/<change-id>/proposal.md`
- Design: `openspec/changes/<change-id>/design.md`
- Tasks: `openspec/changes/<change-id>/tasks.md`
```

### 4. Update task files

Use `openspec_task(task_update)` to mark completed tasks as `done` and to add your assignee/reviewer:

```
openspec_task({ action: "task_update", changeId: "<change-id>", id: "T2.1", status: "done" })
```

Add a handoff activity log entry to each task you completed:

```
openspec_task({ action: "task_comment", changeId: "<change-id>", id: "T2.1",
  role: "<your-role>", content: "Implementation complete. <summary of what was done>" })
```

This updates both the task file and `tasks-tracker.yaml` automatically. Also update the index table in `tasks.md`.

### 5. Update handoff-index

Update `.ai/shared-memory/handoff-index.md` with the new entry.

## Handoff routing

| You are        | Work complete                 | Hand to                    |
| -------------- | ----------------------------- | -------------------------- |
| @product-owner | Proposal written              | @dev-manager               |
| @dev-manager   | Tasks planned                 | First task owner           |
| @tech-lead     | Design written                | @dev-manager or impl owner |
| @sr-fullstack  | Implementation done           | @qa-engineer               |
| @mobile-dev    | Flutter changes done          | @qa-engineer               |
| @qa-engineer   | Verification passed           | @devops                    |
| @devops        | Deployed, `/opsx:archive` run | @dev-manager (close loop)  |

## Done when

- [ ] Status reflects actual state (not aspirational)
- [ ] Next step is specific and actionable
- [ ] Files changed are listed
- [ ] Decisions recorded
- [ ] Next owner is named
- [ ] Task files updated via `openspec_task(task_update)` with current status
- [ ] Activity log entries added to completed tasks
- [ ] `tasks-tracker.yaml` reflects current status
- [ ] `handoff-index.md` updated

## Rules

| Rule                       | Why                                   |
| -------------------------- | ------------------------------------- |
| Be honest about blockers   | A hidden blocker stays blocked longer |
| Next step must be specific | "Continue" is not a next step         |
| Record decisions           | Future agents need the rationale      |
