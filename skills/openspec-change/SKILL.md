---
name: openspec-change
description: Full OpenSpec change lifecycle from idea through deployment using the OpenSpec CLI. Orchestrates /opsx:propose → /opsx:apply → /opsx:archive across all team roles. Use when starting a new feature end-to-end.
metadata: { "openclaw": { "emoji": "🔄" } }
---

# openspec-change

Orchestrate the complete OpenSpec change lifecycle from a raw idea through production deployment using the `openspec` CLI. Coordinates all team agents in sequence.

## Prerequisites

```bash
npm list -g @fission-ai/openspec || npm install -g @fission-ai/openspec
cd <project-root>
openspec init   # first time only
```

## When to use

- Starting a completely new feature or significant change end-to-end
- Coordinating a complex change across multiple agents
- You want the full guided pipeline: propose → implement → archive

## Do not use when

- The change is already in progress — pick up at the current phase instead
- You only need one phase — invoke the specific skill directly

## Before starting — mandatory gate

**If `project-map.yaml` has no entry for this project, STOP.** Do not create the project directory, scaffold code, install packages, or run any commands. Ask the human to add the project to `project-map.yaml` first.

**If the project directory has no git repo, initialize one before creating any change:**

```
openspec_projects({ action: "git_init", projectCode: "<project-code>" })
```

This creates the repo on `main`, adds a `.gitignore`, and makes an initial commit so worktrees have a valid base. It is idempotent — safe to call even if the repo already exists.

**If the project exists but has no active change, STOP.** Call `openspec_change(create)` to register the change at phase `"idea"`, then wait for human confirmation before proceeding to any phase work. Do not infer what to build and start coding.

## Change size routing

Before entering the lifecycle, the PO must classify the change. The lifecycle adapts based on size:

| Size    | Criteria                         | Phases required                                                                |
| ------- | -------------------------------- | ------------------------------------------------------------------------------ |
| trivial | 1 task, no API/schema changes    | idea → implementation → done (skip proposal, plan, design, verification)       |
| small   | 2–5 tasks, no schema changes     | idea → proposal → plan → implementation → verification → done (skip design)    |
| medium  | 5–15 tasks, API/schema changes   | Full lifecycle                                                                 |
| epic    | >15 tasks or multiple subsystems | **STOP. Do not start.** PO must decompose into multiple smaller changes first. |

**Never enter the lifecycle with an epic-sized change. Decompose first.**

## The OpenSpec Lifecycle

```
[Idea]          → create change (phase: idea)
                → PO classifies size: trivial | small | medium | epic
                → epic → STOP, decompose
  ↓
[Proposal]      → product-owner writes proposal.md (skip for trivial)
                → transition to "plan" only after proposal.md has content
  ↓
[Plan]          → dev-manager writes tasks.md, handoff.md
                → validates every task has: objective, includes, excludes, done-when, dependencies
                → transition to "design" only after tasks.md has content
  ↓
[Design]        → tech-lead writes design.md (skip for trivial and small)
                → transition to "implementation" only after design.md AND tasks.md have content
  ↓
[Implementation]→ sr-fullstack writes code + tests + handoff.md
                → transition to "verification" only after handoff.md has content
  ↓
[Verification]  → qa-engineer writes verification.md with "Signoff: YES" (skip for trivial)
                → transition to "deployment" only after "Signoff: YES" in verification.md
  ↓
[Deployment]    → devops deploys, writes release.md
  ↓
[Done]          → /opsx:archive
```

**Each phase gate is enforced by `openspec_change(transition)`. The tool will reject any transition that skips a phase or lacks the required artifact. Agents must not bypass this by writing code or files before the tool permits the transition.**

## Hard rules — no exceptions

- **No code before `implementation` phase.** Writing source files, running `npm init`, scaffolding frameworks, or installing packages before `status.yaml` shows `phase: implementation` is a workflow violation.
- **No self-delegation.** If sub-agent spawning fails, the orchestrator must report the failure and stop — not execute the missing agent's role itself.
- **No phase skipping.** Every phase must be entered via `openspec_change(transition)` in order. The tool enforces this; do not work around it.
- **One role per phase.** The agent assigned to a phase owns only that phase. Do not produce artifacts for a phase you are not assigned to.

## Steps

### Phase 0: Bootstrap and initialize

```bash
# Run project-bootstrap skill first
cd <project-root>
openspec init   # if not already initialized
openspec schemas   # confirm which schema is active (default: spec-driven)
```

### Phase 1: Propose

Invoke the `openspec-propose` skill or run directly:

```bash
/opsx:propose "<feature description>"
```

Exit criteria:

- `openspec/changes/<change-id>/proposal.md` exists
- `specs/`, `design.md`, `tasks.md` generated
- Acceptance criteria are testable
- Hand off to @dev-manager

### Phase 2: Plan tasks (if not generated by propose)

Use the `openspec-plan-change` skill to create individual task files:

```
# Create one task file per task using the openspec_task tool
openspec_task({ action: "task_create", changeId: "...", id: "T1.1", title: "...",
  phase: "Phase 1: ...", role: "devops", owner: "dev-manager", reviewer: "tech-lead",
  priority: "high", dependsOn: [], estimatedEffort: "30m" })
```

Each task gets its own file at `tasks/Phase{X}-T{X}.{Y}.md` containing full details, acceptance criteria, and space for activity log comments and bug reports. `tasks-tracker.yaml` is updated automatically for fast dashboard access.

Exit criteria:

- Individual task files exist under `tasks/` (one per task)
- `tasks-tracker.yaml` populated with all tasks
- `tasks.md` updated as index table with links to task files
- `current-focus.md` updated with branch/worktree assignment
- `handoff.md` initialized

### Phase 3: Design (if complex)

**Skip if:** bug fix, small UI change, no API/schema changes.
**Run if:** new API surface, DB migrations, new service, cross-package impact.

```bash
/opsx:explore "<specific technical question>"   # explore before designing
```

Then use the `openspec-design-arch` skill to produce `design.md`.

Exit criteria:

- `design.md` with API contracts, schema, component architecture, rollback plan
- `decision-log.md` updated

### Phase 4: Implement

**STOP if `design.md` or `tasks.md` are missing or empty.** Do not begin implementation. Return to the design/plan phase owner.

Spawn `@sr-fullstack` agent via `sessions_spawn`. Do not run `/opsx:apply` yourself from the orchestrator session if sub-agent spawning fails — report the failure instead.

Exit criteria:

- All task files in `tasks/` marked `done` via `openspec_task(task_update, status: "done")`
- Activity log entries added to each completed task via `openspec_task(task_comment, ...)`
- `tasks-tracker.yaml` reflects all tasks as `done`
- Tests written and passing
- `handoff.md` updated pointing to @qa-engineer

### Phase 5: Verify

```bash
/opsx:verify   # expanded profile only
```

Or use the `openspec-test-verify` skill to trace acceptance criteria manually.

Exit criteria:

- All acceptance criteria traced to tests or evidence
- Deployment signoff: YES or NO
- **STOP if signoff is NO** — return to Phase 4

### Phase 6: Deploy

Use the `openspec-deploy-gcp` skill:

- Terraform apply (if any infra changes)
- Staging deploy and smoke test
- Production deploy
- 15-min monitoring window
- `handoff.md` updated with deploy status

### Phase 7: Archive

```bash
/opsx:archive
```

Then:

- Update `.ai/shared-memory/current-focus.md` — remove from active changes
- Write retrospective in `.ai/shared-memory/lessons-learned.md` if there are learnings

## Checking status at any time

```bash
openspec status --change "<change-id>" --json
openspec instructions specs --change "<change-id>" --json
```

## Escalation

| Issue                                   | Escalate to                        |
| --------------------------------------- | ---------------------------------- |
| Requirements unclear mid-implementation | @product-owner                     |
| Architecture decision needed            | @tech-lead                         |
| Blocker unresolvable at team level      | @cto                               |
| QA fails repeatedly                     | @staff-fullstack for design review |
| Deployment fails repeatedly             | @tech-lead + @devops joint review  |

## Done when

- [ ] All acceptance criteria implemented and verified
- [ ] Change deployed to production and monitored
- [ ] `/opsx:archive` run — change folder moved to archive
- [ ] `current-focus.md` updated
- [ ] Lessons documented if any
