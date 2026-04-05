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

## Do not use when

- `proposal.md` is missing — use `openspec-propose` first
- `design.md` is required but missing — use `openspec-design-arch` first
- Acceptance criteria are unclear — return to @product-owner

## Steps

### 1. Bootstrap and load spec

Run the `project-bootstrap` skill, then read:

```bash
cd <project-root>
openspec status --change "<change-id>" --json   # confirm artifacts are ready
openspec instructions specs --change "<change-id>" --json  # review spec instructions
```

Read:

- `openspec/changes/<change-id>/proposal.md` — what to build
- `openspec/changes/<change-id>/design.md` — how to build it (if exists)
- `openspec/changes/<change-id>/tasks.md` — your specific task(s)
- `openspec/changes/<change-id>/handoff.md` — current state

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

- [ ] All assigned tasks in `tasks.md` marked `done`
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
