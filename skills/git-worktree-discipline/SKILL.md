# git-worktree-discipline

## Purpose

Keep one change per worktree and avoid parallel conflict.

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

Read:

- `~/coding-projects/project-map.yaml`
- `<project>/.ai/shared-memory/project-context.md`
- `<project>/.ai/shared-memory/current-focus.md`
- relevant decision, mistake, and lessons logs
- `openspec/specs/**`
- active `openspec/changes/**` inventory

### Layer 3: Task Context

Read:

- the active change folder
- current `handoff.md`
- relevant code files
- worktree / branch context
- any thread/session notes tied to this task

## Procedure

1. Resolve the project.
2. Resolve the active change.
3. Load all 3 layers.
4. Execute the skill.
5. Update handoff and logs when relevant.

## Output expectations

- Be explicit about assumptions.
- Keep handoffs current.
- Write down decisions and mistakes when they would matter later.
