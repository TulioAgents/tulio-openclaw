---
name: openspec-implement
description: Implement a feature using the OpenSpec CLI /opsx:apply command. Reads the change spec before writing any code. Covers backend and frontend implementation with tests.
metadata: { "openclaw": { "emoji": "🔨" } }
---

# openspec-implement

Implement a feature end-to-end using the `openspec` CLI. The CLI drives task execution from `tasks.md` — always read the spec first.

## Prerequisites

```bash
npm list -g @fission-ai/openspec || npm install -g @fission-ai/openspec
```

`proposal.md` and (for complex changes) `design.md` must exist before running.

## When to use

- Your task in `tasks.md` is assigned to you and ready to implement
- Resuming implementation after a handoff

## Do not use when — HARD STOP

These are hard stops. If any condition is true, **stop immediately. Do not write any code. Do not create any files. Report the missing artifact and wait.**

- `proposal.md` is missing or empty → **STOP. The proposal phase has not completed.**
- `design.md` is missing or empty → **STOP. The design phase has not completed.**
- `tasks.md` is missing or empty → **STOP. The plan phase has not completed.**
- `status.yaml` phase is not `"implementation"` → **STOP. The change has not been transitioned to implementation. Do not begin coding.**
- Gateway sub-agent spawning failed → **STOP. Do not execute this role's work from a parent/orchestrator session.**

## Steps

### 1. Bootstrap and verify phase gate

Run the `project-bootstrap` skill, then **verify all of the following before touching any code**:

```bash
cd <project-root>
cat openspec/changes/<change-id>/status.yaml     # phase MUST be "implementation"
cat openspec/changes/<change-id>/proposal.md     # MUST exist and have content
cat openspec/changes/<change-id>/design.md       # MUST exist and have content
cat openspec/changes/<change-id>/tasks.md        # MUST exist and have content
openspec status --change "<change-id>" --json    # confirm all artifacts ready
```

**If `status.yaml` phase is not `"implementation"`, stop here.** Use `openspec_change(transition)` only after the prior phase owner has completed their artifact — do not self-transition.

Read:

- `openspec/changes/<change-id>/proposal.md` — what to build
- `openspec/changes/<change-id>/design.md` — how to build it
- `openspec/changes/<change-id>/tasks-tracker.yaml` — quick task status overview
- `openspec/changes/<change-id>/tasks/Phase{X}-T{X}.{Y}.md` — your specific task file(s) with full details, acceptance criteria, and activity log
- `openspec/changes/<change-id>/handoff.md` — current state

Use `openspec_task(task_list)` to see all tasks and their current status at a glance.

### 2. Confirm scope and worktree

- Confirm your branch/worktree from `current-focus.md`
- Verify no other agent is working on the same files
- Read `lessons-learned.md` for any gotchas relevant to this area

### 3. Implement via the CLI

```bash
/opsx:apply
```

The CLI reads `tasks.md` and implements each task in sequence. Monitor progress — intervene if:

- A task requires a decision not covered by the spec
- An external dependency is unavailable
- A contract in `design.md` needs clarification

To update artifacts mid-implementation (if scope changes):

```bash
/opsx:apply   # re-run after updating tasks.md
```

### 4. Validate implementation

After the CLI completes:

- Run the test suite: `npm test` (or equivalent)
- Verify acceptance criteria from `proposal.md` are all covered
- Check that API contracts match `design.md` exactly

```bash
npm test
npm run lint
```

### 5. Update handoff

Write `openspec/changes/<change-id>/handoff.md`:

- Owner: @qa-engineer
- Status: implementation complete
- Files changed (key files)
- Any API or schema contract changes (notify @qa-engineer and @tech-lead)
- Next step: verification

## Done when

- [ ] All assigned task files in `tasks/` marked `done` via `openspec_task(task_update, status: "done")`
- [ ] `tasks-tracker.yaml` reflects current status for all tasks
- [ ] Tests written and passing
- [ ] No silent API or schema changes without team notification
- [ ] Handoff updated pointing to @qa-engineer

## Rules

| Rule                                 | Why                                              |
| ------------------------------------ | ------------------------------------------------ |
| Read spec before running /opsx:apply | The CLI uses your spec — garbage in, garbage out |
| Notify on contract changes           | QA and frontend depend on exact contracts        |
| One concern per commit               | Makes rollback and review tractable              |
| Run tests before handoff             | Don't pass broken code to QA                     |
