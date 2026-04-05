---
name: openspec-design-arch
description: Produce an architecture design document for a complex change using the OpenSpec CLI /opsx:explore and /opsx:continue commands. Covers API contracts, DB schema, component architecture, security, and rollback plan.
metadata: { "openclaw": { "emoji": "🏗️" } }
---

# openspec-design-arch

Produce `design.md` for a complex change before any implementation begins. Uses `/opsx:explore` to investigate and `/opsx:continue` to generate the artifact.

## Prerequisites

```bash
npm list -g @fission-ai/openspec || npm install -g @fission-ai/openspec
```

`proposal.md` must exist.

## When to use

- New or changed API surface
- Database schema changes
- New service or significant refactor
- Cross-package or cross-team impact

## Skip when

- Small UI tweak with no API or schema changes
- Bug fix with no new surface area
- `design.md` already exists and is approved

## Steps

### 1. Bootstrap

Run the `project-bootstrap` skill:

- Read `proposal.md` for requirements
- Read `.ai/shared-memory/project-context.md` and `decision-log.md`
- Explore the relevant codebase: API routes, DB schema, component structure

### 2. Investigate with the CLI

Use `/opsx:explore` to think through technical questions before designing:

```bash
/opsx:explore "What is the best approach for <technical question>?"
/opsx:explore "What are the tradeoffs between X and Y for this change?"
```

This produces a research artifact and helps the CLI generate better `design.md` content.

### 3. Check artifact state

```bash
openspec status --change "<change-id>" --json
```

Confirm `proposal` is `DONE` and `design` is `READY`.

### 4. Generate design.md

```bash
/opsx:continue   # generates design.md (next artifact after proposal)
```

Or with the expanded profile:

```bash
/opsx:ff         # fast-forward all remaining planning artifacts
```

### 5. Validate the generated design

Review `openspec/changes/<change-id>/design.md` against these requirements:

- [ ] API contracts explicit: methods, paths, request/response shapes, status codes, auth
- [ ] DB migrations written (even if not yet applied)
- [ ] Component architecture described
- [ ] Security considerations addressed (auth, validation, sensitive data)
- [ ] Rollback plan exists
- [ ] Risks listed with mitigations

Edit the file directly if the generated content is incomplete or incorrect.

### 6. Update decision-log

Add cross-cutting architectural decisions to `.ai/shared-memory/decision-log.md`:

```markdown
## YYYY-MM-DD: <decision title>

**Change:** <change-id>
**Decision:** <what was decided>
**Rationale:** <why>
**Alternatives considered:** <what else was evaluated>
```

### 7. Hand off

Update `handoff.md`:

- Owner: @dev-manager or first implementation owner
- Status: design approved
- Next step: implementation via `openspec-implement` skill

## Done when

- [ ] `design.md` generated and validated
- [ ] API contracts complete
- [ ] DB migrations written
- [ ] Rollback plan exists
- [ ] `decision-log.md` updated for cross-cutting decisions
- [ ] Handoff written to implementer

## Rules

| Rule                                        | Why                                    |
| ------------------------------------------- | -------------------------------------- |
| No implementation before design is approved | Prevents rework and architecture drift |
| Rollback plan required                      | Every deploy must be reversible        |
| Cross-cutting decisions in decision-log     | Future agents need the rationale       |
