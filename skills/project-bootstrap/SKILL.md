---
name: project-bootstrap
description: Load the correct project and change context before planning or coding. Mandatory before any OpenSpec work. Reads project-map.yaml, shared memory, and the active change folder including OpenSpec artifact state.
metadata: { "openclaw": { "emoji": "🔑" } }
---

# project-bootstrap

Load all project and change context before taking any action. No planning, coding, or verification before this completes.

## Mandatory 3-layer context protocol

### Layer 1: Role Context

Read the agent workspace files:

- `IDENTITY.md`
- `SOUL.md`
- `USER.md`
- `TOOLS.md`
- `HEARTBEAT.md`
- `BOOTSTRAP.md`

### Layer 2: Project Context

```bash
# 1. Resolve project location
cat ~/coding-projects/project-map.yaml
# Find the entry matching your projectCode → get absolute location

# 2. Change into the project
cd <resolved-location>

# 3. Read shared memory
cat .ai/shared-memory/project-context.md
cat .ai/shared-memory/current-focus.md
cat .ai/shared-memory/decision-log.md
cat .ai/shared-memory/mistake-log.md
cat .ai/shared-memory/lessons-learned.md

# 4. Check OpenSpec state
openspec status --json                  # all changes overview
```

### Layer 3: Task / Change Context

```bash
# 5. Identify the active change from current-focus.md
# 6. Load the change folder
openspec status --change "<change-id>" --json    # artifact state
cat openspec/changes/<change-id>/handoff.md       # where we left off
cat openspec/changes/<change-id>/proposal.md      # what we're building
cat openspec/changes/<change-id>/design.md        # how we're building it (if exists)
cat openspec/changes/<change-id>/tasks.md         # task assignments

# 7. Confirm branch and worktree
git branch --show-current
git worktree list
```

## Fail conditions (stop and surface before acting)

- `project-map.yaml` is missing or the `projectCode` cannot be resolved → **STOP**
- `.ai/shared-memory/current-focus.md` is missing for an in-progress change → **STOP**
- `handoff.md` is missing for a change marked active in `current-focus.md` → **STOP**
- Branch/worktree does not match the assignment in `current-focus.md` → **STOP and confirm**

## Sub-agent recovery

Spawned sub-agents receive no parent session state. Run this full sequence from scratch. Do not assume any context from the parent prompt summary — read the files.

## Procedure

1. Complete all three layers
2. State the active change, current phase, and your assigned task explicitly
3. Surface any blockers or inconsistencies before acting
4. Only then: plan or act

## Output expectations

- Be explicit about what you loaded and what you found
- If shared-memory files are stale or inconsistent, say so before proceeding
- Keep `handoff.md` and `current-focus.md` current when your work is done
