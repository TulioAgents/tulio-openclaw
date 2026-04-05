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

## Fail conditions — HARD STOP, do not proceed

These are not warnings. If any condition is true, **stop immediately, report the condition, and wait for a human to resolve it. Do not attempt to fix the condition yourself, do not fall back to doing the work inline, do not execute any other role's responsibilities.**

- `project-map.yaml` is missing or the `projectCode` cannot be resolved → **STOP**
- `project-map.yaml` exists but `projects:` list is empty or has no matching entry → **STOP. Do not create the project, scaffold code, or initialize anything. Ask the human to add the project to project-map.yaml first.**
- `project-map.yaml` has a project entry but it has no active OpenSpec change → **STOP. Do not write any code or files. Use `openspec_change(create)` to register the change first, then wait for the human to confirm before proceeding.**
- `.ai/shared-memory/current-focus.md` is missing for an in-progress change → **STOP**
- `handoff.md` is missing for a change marked active in `current-focus.md` → **STOP**
- Branch/worktree does not match the assignment in `current-focus.md` → **STOP and confirm**
- Gateway sub-agent spawning fails → **STOP. Do not execute other roles' work yourself. Report the failure and wait.**

## What "no active change" means

If `openspec/changes/` is empty or contains no `status.yaml` with a phase other than `done`, there is no active work. The correct response is:

1. Report: "No active OpenSpec change found for project `<projectCode>`."
2. Ask the human: "Should I create a new change? If yes, provide the change title and I will call `openspec_change(create)` to register it."
3. **Do not write any code, install any packages, scaffold any directories, or run any commands until a change exists and is in the correct phase.**

## Phase enforcement — never skip, never self-delegate

Each role owns exactly one phase. You must not execute another role's phase even if that role's agent is unavailable.

| Current phase  | Who acts      | What they produce          |
| -------------- | ------------- | -------------------------- |
| idea           | product-owner | proposal.md                |
| proposal       | product-owner | proposal.md (refined)      |
| plan           | dev-manager   | tasks.md, handoff.md       |
| design         | tech-lead     | design.md, decision-log.md |
| implementation | sr-fullstack  | code, tests, handoff.md    |
| verification   | qa-engineer   | verification.md            |
| deployment     | devops        | release.md                 |

If you are acting as a role and the required input artifact for that phase does not exist, **STOP** — do not create it yourself. The prior phase has not completed.

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
