---
name: openspec-propose
description: Create or refine a change proposal using the OpenSpec CLI. Use when starting a new feature, bug fix, or improvement. Runs /opsx:propose to generate proposal.md, specs, design.md, and tasks.md in one step.
metadata: { "openclaw": { "emoji": "💡" } }
---

# openspec-propose

Create a well-scoped change proposal via the OpenSpec CLI. The CLI handles artifact generation — your job is to supply the right idea and context, then validate the output.

## Prerequisites

The `openspec` CLI must be installed:

```bash
npm list -g @fission-ai/openspec || npm install -g @fission-ai/openspec
```

OpenSpec must be initialized in the project:

```bash
cd <project-root>
openspec init   # creates openspec/ structure and .claude/skills/ if not present
```

## When to use

- Starting a new feature, bug fix, or improvement
- Translating a vague request into clear requirements and a task list
- Any time you need `proposal.md`, `specs/`, `design.md`, and `tasks.md` created together

## Do not use when

- The proposal already exists and is approved — use openspec-apply skill instead
- You only want to implement existing tasks — use openspec-apply skill directly

## Steps

### 1. Load context

Run the `project-bootstrap` skill first:

- Read `~/coding-projects/project-map.yaml` → resolve project path
- Read `.ai/shared-memory/project-context.md` and `current-focus.md`
- Read `openspec/config.yaml` if present (schema and context settings)

### 2. Clarify the idea

Before running the CLI, gather:

- What is the problem and who faces it?
- What does success look like — specifically and measurably?
- What is out of scope?
- Are there constraints, dependencies, or deadlines?

### 3. Run the OpenSpec CLI

```bash
cd <project-root>
/opsx:propose "<your idea or feature description>"
```

The CLI generates in `openspec/changes/<change-id>/`:

- `proposal.md` — problem, user story, acceptance criteria, scope
- `specs/` — requirements and scenarios
- `design.md` — technical approach
- `tasks.md` — implementation checklist

### 4. Validate the output

Review the generated artifacts against these rules:

- Every acceptance criterion is testable without asking questions
- No vague language: "fast", "smooth", "looks good" → must have measurable outcomes
- Scope boundaries are explicit (in / out of scope)
- Error states and edge cases are covered in specs

If the output is weak, edit the artifacts directly and re-run:

```bash
/opsx:continue   # generate the next artifact if any step was incomplete
```

### 5. Update shared memory

After a successful proposal:

- Update `.ai/shared-memory/current-focus.md` — add the new change-id, owner, phase: proposal
- Update `openspec/changes/<change-id>/handoff.md` — status: proposal ready, next: @dev-manager to plan tasks

## CLI reference

```bash
openspec status --change "<change-id>" --json    # check artifact state
openspec instructions specs --change "<change-id>" --json  # inspect artifact instructions
```

## Done when

- [ ] `proposal.md` exists with clear problem, user story, and acceptance criteria
- [ ] `specs/` contains testable scenarios
- [ ] `tasks.md` has an implementation checklist
- [ ] No open questions remain (or they are listed and acknowledged)
- [ ] `current-focus.md` updated with new change
- [ ] Handoff written to @dev-manager
