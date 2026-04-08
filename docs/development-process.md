# OpenSpec Development Process

Complete reference for the multi-agent development workflow. Covers every agent, role, skill, command, artifact, and phase gate used to take work from idea to production.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Agent Roles](#agent-roles)
3. [Agent Bootstrap Sequence](#agent-bootstrap-sequence)
4. [Shared Memory](#shared-memory)
5. [Change Artifacts](#change-artifacts)
6. [Development Lifecycle](#development-lifecycle)
7. [Change Size Routing](#change-size-routing)
8. [Phase Reference](#phase-reference)
9. [Skills Reference](#skills-reference)
10. [CLI Commands Reference](#cli-commands-reference)
11. [Tool API Reference](#tool-api-reference)
12. [Task Management](#task-management)
13. [Workflow Enforcement Rules](#workflow-enforcement-rules)
14. [Escalation Matrix](#escalation-matrix)
15. [Heartbeat and Automation](#heartbeat-and-automation)
16. [File Inventory](#file-inventory)

---

## System Overview

OpenSpec is a role-based multi-agent software development workflow. Every piece of work flows through a structured lifecycle where each phase is owned by a specific agent role. The system of record is the filesystem -- not chat history.

```
Human provides idea
    |
    v
Project Registry (~/coding-projects/project-map.yaml)
    |
    v
Shared Memory (.ai/shared-memory/)
    |
    v
OpenSpec Lifecycle (openspec/changes/<change-id>/)
    |
    v
Phase gates enforced by openspec_change(transition)
    |
    v
Production deployment + archive
```

### Core Principles

- **Files are truth.** Shared memory and change artifacts are the system of record. Agents recover state from files, not from chat history.
- **Phases are gates.** No agent may produce artifacts for a phase they do not own. Transitions are enforced by tooling.
- **One role per phase.** The agent assigned to a phase owns only that phase.
- **No code before implementation.** Writing source files, scaffolding, or installing packages before `status.yaml` shows `phase: implementation` is a violation.
- **Spawning failure = stop.** If sub-agent spawning fails, the only response is: report the error, stop. No workarounds.

---

## Agent Roles

Nine agents operate across the workflow. Each agent runs in its own OpenClaw workspace under `~/.openclaw/workspaces/<role>/`.

### CTO (Guaripolo)

| Field     | Value                                                                             |
| --------- | --------------------------------------------------------------------------------- |
| Workspace | `~/.openclaw/workspaces/cto/`                                                     |
| Emoji     | `owl`                                                                             |
| Mission   | Technical strategy, team orchestration, delivery quality, cross-project oversight |
| Owns      | `decision-log.md`, architectural guidance, escalation resolution                  |
| Skills    | `project-bootstrap`, `openspec-change`                                            |

**Responsibilities:**

- Identify feature/fix needs across projects and create parent issues
- Assign parent issues to Dev Manager with priority and context
- Resolve cross-team escalations and unblock stalled work
- Set technical direction and approve significant architecture decisions
- Review delivery health: are changes flowing or stuck?
- Maintain project portfolio view and strategic priorities
- Approve or reject scope changes that affect timeline or resources

**Delegation guide:**

| Need                                      | Delegate to                      |
| ----------------------------------------- | -------------------------------- |
| New feature/fix need                      | dev-team-manager                 |
| Requirements unclear                      | product-owner                    |
| Architecture risk or cross-project impact | tech-lead                        |
| Deployment or infrastructure concern      | devops-engineer                  |
| Quality or release confidence             | qa-engineer                      |
| Strategic technical decision              | Own it, document in decision-log |

**Unique SOUL rules:**

- Never delegate work without clear context, acceptance criteria, and a named owner
- Own escalation resolution -- do not let blocked work stay blocked

---

### Dev Manager

| Field     | Value                                                                              |
| --------- | ---------------------------------------------------------------------------------- |
| Workspace | `~/.openclaw/workspaces/manager/`                                                  |
| Emoji     | `compass`                                                                          |
| Mission   | Coordinate delivery flow across projects, agents, and changes                      |
| Owns      | `current-focus.md`, `handoff-index.md`, `status.yaml`, `tasks-tracker.yaml`        |
| Skills    | `openspec-change`, `openspec-plan-change`, `openspec-handoff`, `project-bootstrap` |

**Responsibilities:**

- Own intake and project routing from CTO assignments
- Create change folders: `openspec/changes/<change-id>/`
- Enforce the 3-layer context protocol before delegation
- Break down proposals into individual task files using `openspec_task`
- Ensure every active change has a named owner
- Close loops: plan -> implement -> verify -> deploy -> archive -> retrospective
- Coordinate deployment handoffs between QA and DevOps

**Task Breakdown Protocol** (added to SOUL.md):

A task is **too large** if it:

- Changes multiple subsystems at once without a clear single outcome
- Mixes infrastructure, backend, and UI changes in one unit
- Cannot be reviewed in one pass by a single reviewer
- Has estimated effort > 4 hours
- Has more than 3 dependencies on unresolved tasks

A task is **too vague** if it lacks:

- **Objective**: one sentence -- what is the outcome
- **Includes**: explicit list of what is in scope
- **Excludes**: explicit list of what is out of scope
- **Done when**: observable, testable condition
- **Dependencies**: task IDs this blocks on (empty list is valid)

**Delegation routing:**

| Situation                           | Assign to                         |
| ----------------------------------- | --------------------------------- |
| New idea / weak requirements        | @product-owner                    |
| Architecture uncertainty            | @tech-lead                        |
| Web/backend implementation          | @staff-fullstack or @sr-fullstack |
| Flutter/mobile implementation       | @mobile-dev                       |
| Verification and release confidence | @qa-engineer                      |
| Infrastructure/deployment           | @devops-engineer                  |

---

### Product Owner (PO)

| Field     | Value                                                             |
| --------- | ----------------------------------------------------------------- |
| Workspace | `~/.openclaw/workspaces/po/`                                      |
| Emoji     | `pushpin`                                                         |
| Mission   | Requirements clarity, scope, acceptance criteria, backlog quality |
| Owns      | `proposal.md`, `project-context.md`                               |
| Skills    | `openspec-propose`, `project-bootstrap`                           |

**Responsibilities:**

- Produce or refine proposals
- Clarify scope and business value
- Write acceptance criteria that QA can verify
- Keep features sliced small enough for clean handoff

**Requirement Analysis Protocol** (added to SOUL.md):

**Step 1 -- Separate what is known from what is assumed:**

| Category       | What to capture                          |
| -------------- | ---------------------------------------- |
| Explicit       | What the user stated directly            |
| Inferred       | What you believe is implied              |
| Open questions | What you cannot determine without asking |

**Step 2 -- Identify actors, flows, constraints:**

- User actors: who interacts with the system
- System actors: services, agents, external integrations
- Primary flow: happy path step by step
- Edge cases: empty states, errors, concurrent actions
- Constraints: technical limits, deadlines, non-negotiables

**Step 3 -- Classify scope before writing:**

| Size    | Criteria                         | Action                                      |
| ------- | -------------------------------- | ------------------------------------------- |
| trivial | 1 task, no design needed, no QA  | Proceed to implementation directly          |
| small   | 2-5 tasks, light design          | Skip design phase, write proposal + tasks   |
| medium  | 5-15 tasks, API/schema changes   | Full lifecycle                              |
| epic    | >15 tasks or multiple subsystems | STOP. Decompose into multiple changes first |

**Step 4 -- Acceptance criteria rules:**

- Observable without asking questions ("the user sees X" not "the experience feels smooth")
- Testable by QA without developer explanation
- Scoped to this change only (no "future improvements" in AC)

**Escalate when:**

- Business ambiguity remains unresolved
- There is no acceptance-testable outcome
- Scope is too large for one change

---

### Tech Lead

| Field     | Value                                                                   |
| --------- | ----------------------------------------------------------------------- |
| Workspace | `~/.openclaw/workspaces/tech-lead/`                                     |
| Emoji     | `building_construction`                                                 |
| Mission   | Architecture, contracts, package boundaries, technical decision quality |
| Owns      | `design.md`, `decision-log.md`, `project-risks.md`                      |
| Skills    | `openspec-design-arch`, `openspec-review-code`, `project-bootstrap`     |

**Responsibilities:**

- Define package boundaries
- Review API and data contracts
- Decide migration and compatibility strategy
- Keep architecture notes and decision logs current
- Produce `design.md` when Dev Manager flags a complex change

**Technical Shaping Protocol** (added to SOUL.md):

**Step 1 -- Assess impact per layer:**

| Layer                 | Impact (none/light/heavy) | Notes |
| --------------------- | ------------------------- | ----- |
| Frontend              |                           |       |
| Backend / API         |                           |       |
| Data / Schema         |                           |       |
| Infra / Config        |                           |       |
| External integrations |                           |       |

**Step 2 -- Make decisions explicit:**

- Decision: what you chose
- Rationale: why
- Tradeoff: what you give up
- Alternatives considered: at least one rejected option and why

**Step 3 -- Identify risks:**

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
|      |            |        |            |

A `design.md` with no risks section is incomplete.

**Step 4 -- Define module boundaries:**

- What modules/packages are touched
- What new modules are created (if any)
- What the public API surface of each new module is
- What stays internal

**Review lenses:** correctness, simplicity, isolation, rollback safety, package ownership, GCP deployment compatibility

---

### Staff Fullstack Developer

| Field     | Value                                                                                |
| --------- | ------------------------------------------------------------------------------------ |
| Workspace | `~/.openclaw/workspaces/staff-fullstack/`                                            |
| Emoji     | `building_construction`                                                              |
| Mission   | Architecture ownership, code review, mentoring, end-to-end technical decision-making |
| Owns      | Review feedback, architectural guidance, ADRs                                        |
| Skills    | `openspec-review-code`, `openspec-implement`, `project-bootstrap`                    |

**Responsibilities:**

- Own architecture decisions end-to-end: API contracts, DB schemas, UI component architecture
- Design and enforce technical standards across frontend and backend
- Review and approve changes from Sr. Fullstack before merge
- Identify performance bottlenecks, security risks, scalability concerns proactively
- Unblock other engineers with technical guidance and design clarity
- Write and maintain ADRs
- Drive cross-cutting concerns: auth, caching, error handling, observability

**Staff-level principles:**

- Architecture first, code second
- Every technical decision must be documented and justified
- Security and performance are design constraints, not afterthoughts
- Unblock others before optimizing your own throughput
- Prefer reversible decisions; when irreversible, get explicit alignment from Tech Lead
- Teach through code review -- every review is a mentoring opportunity

**Code review standards:**

- Clear scope/description/linked change ID
- Review for correctness/security/performance/readability/test coverage
- Block merges with silent contract changes or missing migrations
- Constructive, actionable feedback
- Communicate API/schema changes to QA and Tech Lead

---

### Sr. Fullstack Developer

| Field     | Value                                                                |
| --------- | -------------------------------------------------------------------- |
| Workspace | `~/.openclaw/workspaces/sr-fullstack/`                               |
| Emoji     | `zap`                                                                |
| Mission   | Autonomously implement features across the full stack                |
| Owns      | Code, tests, `handoff.md`, `mistake-log.md`, task file activity logs |
| Skills    | `openspec-implement`, `coding-agent`, `project-bootstrap`            |

**Responsibilities:**

- Implement features end-to-end: API endpoints, database queries, service logic, React components, state management, styling
- Write comprehensive tests: unit, integration, component
- Follow architecture patterns from Staff/Tech Lead
- Produce clean, PR-ready code with clear commit messages
- Keep migrations, contracts, and tests coherent across the full stack
- Flag technical risks or ambiguities early

**Developer principles:**

- Ship working, tested code
- Own the full stack for assigned features
- Follow the architecture; raise deviations with Staff before diverging
- One concern per commit, one feature per PR when possible
- Test unhappy paths: errors, empty states, edge cases, concurrent access
- Document non-obvious decisions inline

**Before coding checklist:**

1. Confirm project/worktree
2. Confirm change ID
3. Read tasks/handoff
4. Read design document
5. Review existing patterns

**After coding checklist:**

1. Run all relevant tests
2. Update handoff
3. Note verification status
4. Log mistakes/discoveries
5. Prepare PR-ready commits

---

### Mobile Flutter Developer

| Field     | Value                                                          |
| --------- | -------------------------------------------------------------- |
| Workspace | `~/.openclaw/workspaces/mobile/`                               |
| Emoji     | `mobile_phone`                                                 |
| Mission   | Flutter/mobile implementation, build health, release readiness |
| Owns      | Mobile code, build configs                                     |
| Skills    | `openspec-implement`, `project-bootstrap`                      |

**Responsibilities:**

- Implement Flutter/mobile changes
- Maintain platform configs and build health
- Coordinate shared package changes with Tech Lead and Fullstack
- Keep mobile release checks visible

**Mobile lenses:** package compatibility, platform permissions/config, state management consistency, release readiness

---

### QA Engineer

| Field     | Value                                                                 |
| --------- | --------------------------------------------------------------------- |
| Workspace | `~/.openclaw/workspaces/qa/`                                          |
| Emoji     | `white_check_mark`                                                    |
| Mission   | Verification, acceptance criteria tracing, release readiness, signoff |
| Owns      | `verification.md`, `lessons-learned.md`                               |
| Skills    | `openspec-test-verify`, `project-bootstrap`                           |

**Responsibilities:**

- Convert acceptance criteria into verification evidence
- Build regression and integration coverage
- Record escaped defects and prevention lessons
- Provide release signoff to DevOps
- Support archive decisions with verification confidence

**Evidence model:**

- Requirement traced
- Test coverage documented
- Observed result recorded
- Gaps or risks stated

**Unique SOUL rules:**

- Do not mark a change done without evidence or clearly stated gaps
- Every escaped defect should teach the team something

---

### DevOps Engineer

| Field     | Value                                                                |
| --------- | -------------------------------------------------------------------- |
| Workspace | `~/.openclaw/workspaces/devops/`                                     |
| Emoji     | `rocket`                                                             |
| Mission   | Infrastructure, CI/CD, deployment automation, production reliability |
| Owns      | `release.md`, Terraform, Cloud Run config                            |
| Skills    | `openspec-deploy-gcp`, `project-bootstrap`                           |

**Responsibilities:**

- Own GCP infrastructure as code via Terraform
- Maintain CI/CD pipelines
- Deploy to Cloud Run and Cloud Functions
- Monitor production health and alert on anomalies
- Maintain environment parity (dev, staging, prod)
- Execute rollbacks when deployments fail
- Coordinate with QA for release signoff before deployment
- Document runbooks for common operational procedures

**Deployment workflow:**

1. QA provides verification signoff in `handoff.md`
2. DevOps reviews change scope and infrastructure impact
3. Terraform plan for any infrastructure changes
4. CI/CD pipeline triggers build and test
5. Deploy to staging and verify
6. Deploy to production
7. Monitor for 15 minutes post-deploy
8. Update handoff with deployment status

**GCP resources managed:** Cloud Run, Cloud Functions, Cloud SQL / Firestore, Cloud Storage, Cloud Build / GitHub Actions, Secret Manager, Cloud Monitoring + Logging

**Unique SOUL rules:**

- Do not deploy without QA signoff or explicit override from CTO
- Every infrastructure change must be codified in Terraform

---

## Agent Bootstrap Sequence

Every agent -- regardless of role -- runs this exact sequence before taking any action:

```
Step 1:  Read ~/coding-projects/project-map.yaml
         -> resolve projectCode to absolute path
         -> if missing or empty: STOP

Step 2:  Read .ai/shared-memory/project-context.md

Step 3:  Read .ai/shared-memory/current-focus.md

Step 4:  Read decision-log.md, mistake-log.md, lessons-learned.md

Step 5:  Read openspec/specs/ and openspec/changes/ inventory

Step 6:  Read the active change's status.yaml (authoritative phase)

Step 7:  Read the active change's handoff.md (current baton)

Step 8:  Read tasks-tracker.yaml (task status at a glance)

Step 9:  Confirm branch and worktree

         -> Only now: plan or act
```

### 3-Layer Context Protocol

| Layer            | What to read                                                        | Purpose                     |
| ---------------- | ------------------------------------------------------------------- | --------------------------- |
| Layer 1: Role    | IDENTITY.md, SOUL.md, USER.md, TOOLS.md, HEARTBEAT.md, BOOTSTRAP.md | Who am I, what are my rules |
| Layer 2: Project | project-map.yaml, .ai/shared-memory/\*                              | What project, what state    |
| Layer 3: Task    | status.yaml, handoff.md, tasks-tracker.yaml, proposal.md, design.md | What work, what phase       |

### Hard Stops (all agents)

- `project-map.yaml` is missing -> **STOP**
- `projects:` list is empty or no matching entry -> **STOP**
- Project exists but no active OpenSpec change -> **STOP**, create one with `openspec_change(create)`
- Sub-agent spawning fails -> **STOP**, one sentence report only
- Infrastructure broken -> **STOP**, one sentence report only

---

## Shared Memory

Located at `.ai/shared-memory/` in each project root. Persistent, agent-shared state.

| File                 | Purpose                                                                  | Primary writers        |
| -------------------- | ------------------------------------------------------------------------ | ---------------------- |
| `project-context.md` | Static truth: product purpose, architecture, constraints, open questions | PO, Tech Lead          |
| `current-focus.md`   | Dynamic state: active changes, owners, branches, worktrees, blockers     | Dev Manager            |
| `decision-log.md`    | Architectural decisions with date, rationale, alternatives considered    | Tech Lead, CTO         |
| `mistake-log.md`     | What went wrong, root cause, fix applied, prevention guidance            | Sr. Fullstack, QA      |
| `lessons-learned.md` | Reusable guidance distilled from mistake-log entries                     | QA, self-learning-loop |
| `handoff-index.md`   | Quick index of active handoffs and freshness                             | Dev Manager            |
| `project-risks.md`   | Known risks, likelihood, owner, mitigation status                        | Tech Lead              |

### current-focus.md entry format

```yaml
- change-id: 0001-feature-name
  owner: sr-fullstack
  status: in-progress
  phase: implementation
  branch: feat/0001-feature-name
  worktree: <project-root>/.worktrees/0001-feature-name
  thread: <discord-thread-id>
```

### decision-log.md entry format

```markdown
## YYYY-MM-DD: <decision title>

**Change:** <change-id>
**Decision:** <what was decided>
**Rationale:** <why>
**Alternatives considered:** <what else was evaluated>
**Decided by:** <role>
```

### mistake-log.md entry format

```markdown
## YYYY-MM-DD: <what went wrong>

**Change:** <change-id>
**What happened:** <description>
**Root cause:** <why it happened>
**Fix applied:** <what was done>
**Prevention:** <how to avoid next time>
**Logged by:** <role>
```

---

## Change Artifacts

Every change lives under `openspec/changes/<change-id>/`:

```
openspec/
  specs/                          # long-lived project specifications
  changes/
    <change-id>/
      status.yaml                 # machine-readable phase state (authoritative)
      proposal.md                 # problem, user story, acceptance criteria
      design.md                   # API contracts, schema, component architecture
      tasks.md                    # index table linking to individual task files
      tasks-tracker.yaml          # fast status index for dashboard
      tasks/                      # one file per task
        Phase1-T1.1.md
        Phase2-T2.1.md
        TEMPLATE.md
      handoff.md                  # current baton between agents
      verification.md             # acceptance criteria trace + QA signoff
      release.md                  # deployment summary and monitoring results
    archive/                      # completed changes
  _template/                      # scaffold for new changes
```

### status.yaml

```yaml
changeId: "0001-feature-name"
title: "Feature Name"
phase: "implementation" # idea|proposal|plan|design|implementation|verification|deployment|done|blocked
owner: "dev-manager"
assignees:
  sr-fullstack: "claudecoder"
  qa-engineer: ""
blockers: []
branch: "feat/0001-feature-name"
createdAt: 1743840000000
updatedAt: 1743854400000
flowId: "flow-0001-feature-name"
projectCode: "my-project"
```

### tasks-tracker.yaml

```yaml
changeId: "0001-feature-name"
updatedAt: "2026-04-05T12:00:00Z"
tasks:
  - id: T1.1
    title: Initialize project scaffold
    status: done # todo|in_progress|blocked|in_review|done
    assignee: claudecoder
    role: devops
    owner: dev-manager
    reviewer: tech-lead
    priority: high # low|medium|high|critical
    dependsOn: []
```

### Individual task file (tasks/Phase{X}-T{X}.{Y}.md)

```markdown
---
id: "T2.1"
title: "Implement src/App.tsx"
phase: "Phase 2: Application Code"
status: todo
priority: medium
assignee: ""
role: "sr-fullstack"
owner: "dev-manager"
reviewer: ""
depends_on: ["T1.1"]
blocked_by: []
created_at: "2026-04-05T10:00:00Z"
updated_at: "2026-04-05T10:00:00Z"
started_at: ""
completed_at: ""
estimated_effort: "1h"
---

# T2.1 -- Implement src/App.tsx

## Description

## Acceptance Criteria

## Technical Notes

## Files

| File | Action | Notes |
| ---- | ------ | ----- |

## Activity Log

## Bugs
```

### Task Granularity Rules (enforced in tasks.md template)

Every task must satisfy ALL of the following:

- **Objective**: one sentence describing the single outcome
- **Includes**: explicit list of what is in scope
- **Excludes**: explicit list of what is out of scope
- **Done when**: observable, testable condition
- **Dependencies**: task IDs required (empty list is valid and explicit)
- **Estimated effort**: must be 4 hours or less -- split if larger

---

## Development Lifecycle

```
[Idea]           -> create change (phase: idea)
                 -> PO classifies size: trivial | small | medium | epic
                 -> epic -> STOP, decompose
  |
  v
[Proposal]       -> PO writes proposal.md (skip for trivial)
                 -> transition to "plan" only after proposal.md has content
  |
  v
[Plan]           -> Dev Manager writes tasks.md, creates task files, handoff.md
                 -> validates every task has: objective, includes, excludes, done-when
                 -> transition to "design" only after tasks.md has content
  |
  v
[Design]         -> Tech Lead writes design.md (skip for trivial and small)
                 -> transition to "implementation" only after design.md AND tasks.md
  |
  v
[Implementation] -> Sr. Fullstack writes code + tests + handoff.md
                 -> transition to "verification" only after handoff.md has content
  |
  v
[Verification]   -> QA writes verification.md with "Signoff: YES" (skip for trivial)
                 -> transition to "deployment" only after "Signoff: YES"
  |
  v
[Deployment]     -> DevOps deploys, writes release.md
  |
  v
[Done]           -> /opsx:archive
```

---

## Change Size Routing

Before entering the lifecycle, the PO classifies the change. The lifecycle adapts:

| Size    | Criteria                         | Phases required                                                                  | Max tasks |
| ------- | -------------------------------- | -------------------------------------------------------------------------------- | --------- |
| trivial | 1 task, no API/schema changes    | idea -> implementation -> done                                                   | 1         |
| small   | 2-5 tasks, no schema changes     | idea -> proposal -> plan -> implementation -> verification -> done (skip design) | 5         |
| medium  | 5-15 tasks, API/schema changes   | Full lifecycle                                                                   | 15        |
| epic    | >15 tasks or multiple subsystems | **STOP. Decompose first.**                                                       | N/A       |

**Never enter the lifecycle with an epic-sized change.**

---

## Phase Reference

### Phase 0: Bootstrap and Initialize

**Owner:** Any agent (first to act)

```bash
cd <project-root>
openspec init                    # first time only
openspec schemas                 # confirm active schema
```

**Skill:** `project-bootstrap`

---

### Phase 1: Proposal

**Owner:** Product Owner

**Entry:** `openspec_change(create)` at phase `idea`, then transition to `proposal`

**Commands:**

```bash
/opsx:propose "<feature description>"    # generates proposal.md, specs/, design.md, tasks.md
```

**Exit criteria:**

- `proposal.md` exists with clear problem, user story, and testable acceptance criteria
- `specs/` contains testable scenarios
- Scope boundaries explicit (in/out of scope)
- `current-focus.md` updated
- Handoff written to @dev-manager

**Skill:** `openspec-propose`

---

### Phase 2: Plan

**Owner:** Dev Manager

**Entry:** Transition from `proposal` to `plan` via `openspec_change(transition)`

**Commands:**

```bash
/opsx:continue                   # generate missing artifacts
/opsx:ff                         # fast-forward all remaining planning artifacts
openspec status --change "<id>" --json
```

**Task creation:**

```
openspec_task({
  action: "task_create",
  changeId: "<change-id>",
  id: "T1.1",
  title: "Initialize project scaffold",
  phase: "Phase 1: Setup",
  role: "devops",
  owner: "dev-manager",
  reviewer: "tech-lead",
  priority: "high",
  dependsOn: [],
  estimatedEffort: "30m"
})
```

**Worktree setup:**

```bash
openspec_projects({ action: "git_init", projectCode: "<code>" })  # ensure git repo exists
git worktree add .worktrees/<change-id> -b feat/<change-id>
openspec_change({ action: "assign", changeId: "<id>", role: "<role>", sessionKey: "<key>" })
```

**Exit criteria:**

- Individual task files exist under `tasks/` (one per task)
- `tasks-tracker.yaml` populated
- `tasks.md` updated as index table
- `current-focus.md` updated with branch/worktree assignment
- `handoff.md` initialized with first owner

**Skill:** `openspec-plan-change`

---

### Phase 3: Design

**Owner:** Tech Lead

**Entry:** Transition from `plan` to `design` (skip for trivial and small changes)

**Commands:**

```bash
/opsx:explore "<specific technical question>"    # investigate before designing
/opsx:continue                                   # generate design.md
/opsx:ff                                         # fast-forward remaining artifacts
```

**Phase gate:**

```bash
openclaw call openspec.changes.can-advance \
  '{ "projectCode": "<code>", "changeId": "<id>" }'
```

**Exit criteria:**

- `design.md` with API contracts, schema, component architecture, rollback plan
- `decision-log.md` updated for cross-cutting decisions
- Handoff written to implementation owner

**Skill:** `openspec-design-arch`

---

### Phase 4: Implementation

**Owner:** Sr. Fullstack Developer (or Staff Fullstack, Mobile)

**Entry:** Transition from `design` to `implementation`

**Hard stops:**

- `proposal.md` missing or empty -> STOP
- `design.md` missing or empty (for medium+ changes) -> STOP
- `tasks.md` missing or empty -> STOP
- `status.yaml` phase is not `implementation` -> STOP

**Commands:**

```bash
/opsx:apply                      # implements tasks from tasks.md

# Task updates during implementation:
openspec_task({ action: "task_update", changeId: "...", id: "T2.1", status: "in_progress" })
openspec_task({ action: "task_update", changeId: "...", id: "T2.1", status: "done" })
openspec_task({ action: "task_comment", changeId: "...", id: "T2.1",
  role: "sr-fullstack", content: "Implemented with React Query for data fetching" })
```

**Exit criteria:**

- All task files marked `done` via `openspec_task(task_update)`
- Activity log entries added to each completed task
- `tasks-tracker.yaml` reflects all tasks as `done`
- Tests written and passing
- `handoff.md` updated pointing to @qa-engineer

**Skills:** `openspec-implement`, `coding-agent`

---

### Phase 5: Verification

**Owner:** QA Engineer

**Entry:** Transition from `implementation` to `verification` (skip for trivial)

**Commands:**

```bash
/opsx:verify                     # traces acceptance criteria against implementation

# Bug reporting:
openspec_task({ action: "task_bug", changeId: "...", id: "T2.1",
  bugId: "BUG-001", title: "Short bug title", severity: "high",
  reportedBy: "qa-engineer", description: "...", reproduction: "..." })
```

**Verification evidence format:**

| Criterion               | Test/Check                | Result | Notes |
| ----------------------- | ------------------------- | ------ | ----- |
| Given X, when Y, then Z | `test/feature.test.ts:42` | Pass   |       |

**Exit criteria:**

- All acceptance criteria traced to test or manual check
- Evidence documented per criterion
- Deployment signoff: YES or NO with clear reason
- Handoff updated with next owner (@devops)

**Skill:** `openspec-test-verify`

---

### Phase 6: Deployment

**Owner:** DevOps Engineer

**Entry:** Transition from `verification` to `deployment`

**Prerequisite:** `handoff.md` must contain `Ready for deployment: YES`

**Commands:**

```bash
# Infrastructure (if any)
cd infra/
terraform init && terraform plan -out=tfplan && terraform apply tfplan

# Deploy
git push origin main

# Staging verification
gcloud run services describe <service> --region=<region> --format="value(status.conditions)"
gcloud logs read "resource.type=cloud_run_revision AND severity>=ERROR" --limit=20
curl -f https://<staging-url>/health

# Production
gcloud run services update-traffic <service> --to-latest --region=<region>

# Post-deploy monitoring (15 minutes)
gcloud logs read "resource.type=cloud_run_revision AND severity>=ERROR" --freshness=15m --limit=50
```

**Rollback:**

```bash
gcloud run services update-traffic <service> --to-revisions=<previous>=100 --region=<region>
npm run migrate:down
```

**Exit criteria:**

- QA signoff confirmed before starting
- Terraform applied (if any)
- Staging healthy
- Production deployed and healthy
- 15-minute monitoring window passed clean

**Skill:** `openspec-deploy-gcp`

---

### Phase 7: Archive

**Owner:** Dev Manager or last active agent

```bash
/opsx:archive                    # moves change to archive/
```

**Post-archive:**

- Update `.ai/shared-memory/current-focus.md` -- remove from active changes
- Write retrospective in `lessons-learned.md` if there are learnings

---

## Skills Reference

### Workflow Skills

| Skill                  | CLI commands                                               | Owner role      | Purpose                                                    |
| ---------------------- | ---------------------------------------------------------- | --------------- | ---------------------------------------------------------- |
| `openspec-change`      | `/opsx:propose`, `/opsx:apply`, `/opsx:archive`            | Dev Manager     | Full lifecycle orchestrator                                |
| `openspec-propose`     | `/opsx:propose "<idea>"`                                   | PO              | Generate proposal.md, specs/, design.md, tasks.md          |
| `openspec-plan-change` | `/opsx:continue`, `/opsx:ff`, `openspec status`            | Dev Manager     | Scaffold change folder, create task files, set up worktree |
| `openspec-design-arch` | `/opsx:explore`, `/opsx:continue`, `openspec status`       | Tech Lead       | Investigate then generate design.md                        |
| `openspec-implement`   | `/opsx:apply`, `openspec status`, `openspec instructions`  | Sr. Fullstack   | Implement tasks from tasks.md                              |
| `openspec-test-verify` | `/opsx:verify`, `openspec status`, `openspec instructions` | QA              | Trace acceptance criteria, produce signoff                 |
| `openspec-deploy-gcp`  | `/opsx:archive` + GCP CLI                                  | DevOps          | Deploy to GCP, monitor, archive                            |
| `openspec-review-code` | `openspec status`, `openspec instructions`                 | Staff Fullstack | Spec-driven code review                                    |
| `openspec-handoff`     | `openspec status`                                          | Any             | Write structured handoff between agents                    |
| `openspec-sdd`         | N/A                                                        | Tech Lead       | Produce Software Design Document                           |

### Shared Operational Skills

| Skill                     | Purpose                                                | Used by       |
| ------------------------- | ------------------------------------------------------ | ------------- |
| `project-bootstrap`       | Load 3-layer context before any work                   | All agents    |
| `mc-task-poll`            | Claim and process next task from Mission Control API   | Dev Manager   |
| `project-map-reader`      | Resolve project code to absolute path                  | All agents    |
| `handoff-standard`        | Write well-structured handoff with all required fields | All agents    |
| `coding-agent`            | Execute implementation with OpenSpec gate              | Sr. Fullstack |
| `self-learning-loop`      | Distill mistake-log entries into lessons-learned       | QA, automated |
| `git-worktree-discipline` | Manage git worktrees per change                        | Dev Manager   |

---

## CLI Commands Reference

### OpenSpec CLI (`@fission-ai/openspec`)

**Install:**

```bash
npm install -g @fission-ai/openspec
```

**Initialize:**

```bash
openspec init                    # creates openspec/ structure in project
openspec schemas                 # show active schema (default: spec-driven)
```

**Propose:**

```bash
/opsx:propose "<description>"    # generate proposal.md, specs/, design.md, tasks.md
```

**Continue / Fast-Forward:**

```bash
/opsx:continue                   # generate the next artifact in the dependency chain
/opsx:ff                         # generate all remaining artifacts in sequence
```

**Explore:**

```bash
/opsx:explore "<question>"       # research/investigate before designing
```

**Implement:**

```bash
/opsx:apply                      # implement tasks from tasks.md
```

**Verify:**

```bash
/opsx:verify                     # trace acceptance criteria (expanded profile only)
```

**Archive:**

```bash
/opsx:archive                    # move change to archive/
```

**Status:**

```bash
openspec status --json                              # all changes overview
openspec status --change "<id>" --json              # specific change state
openspec instructions specs --change "<id>" --json  # inspect artifact instructions
```

---

## Tool API Reference

### openspec_change

| Action       | Parameters                          | Description                            |
| ------------ | ----------------------------------- | -------------------------------------- |
| `create`     | `projectCode`, `title`, `changeId`  | Register new change at phase `idea`    |
| `transition` | `projectCode`, `changeId`           | Advance to next phase (enforces gates) |
| `assign`     | `changeId`, `role`, `sessionKey`    | Assign agent to change                 |
| `block`      | `changeId`, `reason`                | Mark change as blocked                 |
| `unblock`    | `changeId`                          | Remove block                           |
| `handoff`    | `changeId`, `from`, `to`, `summary` | Transfer ownership                     |
| `status`     | `changeId`                          | Get current status                     |

**Phase transition gates:**

- `idea` -> `proposal`: no prerequisites
- `proposal` -> `plan`: `proposal.md` must have content
- `plan` -> `design`: `tasks.md` must have content
- `design` -> `implementation`: `design.md` AND `tasks.md` must have content
- `implementation` -> `verification`: `handoff.md` must have content
- `verification` -> `deployment`: `verification.md` must contain "Signoff: YES"
- `deployment` -> `done`: `release.md` must have content

**Can-advance check:**

```bash
openclaw call openspec.changes.can-advance \
  '{ "projectCode": "<code>", "changeId": "<id>" }'
```

### openspec_task

| Action         | Parameters                                                                                                  | Description                       |
| -------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `task_create`  | `changeId`, `id`, `title`, `phase`, `role`, `owner`, `reviewer`, `priority`, `dependsOn`, `estimatedEffort` | Create task file + update tracker |
| `task_update`  | `changeId`, `id`, `status` (+ optional fields)                                                              | Update task status                |
| `task_comment` | `changeId`, `id`, `role`, `content`                                                                         | Add activity log entry            |
| `task_bug`     | `changeId`, `id`, `bugId`, `title`, `severity`, `reportedBy`, `description`, `reproduction`                 | Report bug on task                |
| `task_list`    | `changeId`                                                                                                  | List all tasks with status        |

### openspec_projects

| Action     | Parameters    | Description                             |
| ---------- | ------------- | --------------------------------------- |
| `list`     | none          | List all projects from project-map.yaml |
| `context`  | `projectCode` | Get project context and status          |
| `changes`  | `projectCode` | List all changes for a project          |
| `git_init` | `projectCode` | Initialize git repo (idempotent)        |

---

## Task Management

### Task Lifecycle

```
todo -> in_progress -> blocked -> in_review -> done
                    \                       /
                     -> done (direct if small task)
```

### Creating Tasks

```
openspec_task({
  action: "task_create",
  changeId: "0001-feature-name",
  id: "T2.1",
  title: "Implement login endpoint",
  phase: "Phase 2: Backend",
  role: "sr-fullstack",
  owner: "dev-manager",
  reviewer: "tech-lead",
  priority: "high",
  dependsOn: ["T1.1"],
  estimatedEffort: "2h"
})
```

### Updating Task Status

```
openspec_task({ action: "task_update", changeId: "0001-feature-name", id: "T2.1", status: "in_progress" })
openspec_task({ action: "task_update", changeId: "0001-feature-name", id: "T2.1", status: "done" })
```

### Adding Activity Comments

```
openspec_task({
  action: "task_comment",
  changeId: "0001-feature-name",
  id: "T2.1",
  role: "sr-fullstack",
  content: "Endpoint implemented with JWT auth. Tests cover happy path and invalid token."
})
```

### Reporting Bugs

```
openspec_task({
  action: "task_bug",
  changeId: "0001-feature-name",
  id: "T2.1",
  bugId: "BUG-001",
  title: "Login returns 500 for expired tokens",
  severity: "high",
  reportedBy: "qa-engineer",
  description: "Expired JWT tokens cause unhandled exception instead of 401",
  reproduction: "1. Login with valid credentials\n2. Wait for token expiry\n3. Call /api/protected\n4. Observe 500 instead of 401"
})
```

---

## Workflow Enforcement Rules

### Hard Rules (no exceptions)

1. **No code before `implementation` phase.** Writing source files, running `npm init`, scaffolding frameworks, or installing packages before `status.yaml` shows `phase: implementation` is a violation.

2. **No self-delegation.** If sub-agent spawning fails, report failure and stop. Do not execute the missing agent's role.

3. **No phase skipping.** Every phase must be entered via `openspec_change(transition)` in order.

4. **One role per phase.** The agent assigned to a phase owns only that phase. Do not produce artifacts for another phase.

5. **Spawn failure = stop.** Only permitted response: "Sub-agent spawning failed: [error]. Please fix the gateway connection and retry."

6. **Infrastructure is not your job.** If gateway, CLI, or version is broken: one sentence report, stop.

### Workflow Checkpoint (AGENTS.md)

Every agent reads this before doing anything:

1. Is the project registered in `project-map.yaml`? If not: STOP.
2. Is there an active OpenSpec change with `status.yaml` not in `done`? If not: STOP.
3. Are you about to write code? Is `status.yaml` showing `phase: implementation`? If not: STOP.
4. Did sub-agent spawning fail? STOP. One sentence report.
5. Is infrastructure broken? STOP. One sentence report.

### Known Bypass Patterns (and their fixes)

| Pattern                                      | Root cause                                        | Fix                                                  |
| -------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------- |
| Agent writes code before specs exist         | No rule for "empty project map" case              | Hard stop added to all BOOTSTRAP.md                  |
| Agent self-delegates on spawn failure        | Spawn failure not a STOP condition                | Exact permitted response defined in all SOUL.md      |
| Agent offers workarounds after spawn failure | Suggestions not explicitly banned                 | Ban on all responses except one sentence             |
| Agent diagnoses infrastructure               | "Own escalation" interpreted as "fix it yourself" | Infrastructure explicitly not agent's responsibility |
| coding-agent bypasses OpenSpec guards        | No OpenSpec awareness in coding-agent             | OpenSpec gate added to coding-agent skill            |

---

## Escalation Matrix

| Issue                                   | Escalate to                         | From                       |
| --------------------------------------- | ----------------------------------- | -------------------------- |
| Requirements unclear mid-implementation | @product-owner                      | Sr. Fullstack              |
| Architecture decision needed            | @tech-lead                          | Dev Manager, Sr. Fullstack |
| Blocker unresolvable at team level      | @cto                                | Dev Manager                |
| QA fails repeatedly                     | @staff-fullstack (design review)    | QA                         |
| Deployment fails repeatedly             | @tech-lead + @devops (joint review) | Dev Manager                |
| Business ambiguity unresolved           | @product-owner                      | Any                        |
| Scope too large for one change          | @product-owner (decompose)          | Dev Manager                |
| Cross-project risk or dependency        | @cto                                | Tech Lead                  |

---

## Heartbeat and Automation

### Heartbeat (all agents)

Every agent checks on heartbeat:

1. Whether any active change they own is blocked
2. Whether a handoff is missing or stale
3. Whether a decision, mistake, or lesson should be recorded

Role-specific additions:

| Role            | Also checks                                                                      |
| --------------- | -------------------------------------------------------------------------------- |
| CTO             | Stalled changes without owners, Dev Manager escalations, cross-project risks     |
| DevOps          | Pending deployments waiting for QA, CI/CD pipeline health, production monitoring |
| Sr. Fullstack   | Tests passing, PR feedback to address                                            |
| Staff Fullstack | Sr. developers blocked, open PRs for review, active designs up to date           |

If nothing needs attention: respond with `HEARTBEAT_OK`.

### Automated Cron Jobs

| Job                        | Interval | Purpose                                          |
| -------------------------- | -------- | ------------------------------------------------ |
| Team manager heartbeat     | 5 min    | Check all active changes for staleness           |
| QA stale-handoff scan      | 60 min   | Find handoffs that have not been picked up       |
| Self-learning distillation | 12 hours | Convert mistake-log entries into lessons-learned |

---

## File Inventory

### Agent Workspace Files (`~/.openclaw/workspaces/<role>/`)

| File           | Purpose                                                   |
| -------------- | --------------------------------------------------------- |
| `IDENTITY.md`  | Agent name, emoji, theme, mission, primary focus          |
| `SOUL.md`      | Non-negotiable rules, role-specific protocols             |
| `BOOTSTRAP.md` | Session bootstrap sequence, hard stops                    |
| `TOOLS.md`     | Tool usage policy, synchronization, documentation updates |
| `HEARTBEAT.md` | Heartbeat check items                                     |
| `USER.md`      | Shared user preferences                                   |
| `AGENTS.md`    | Team topology + role-specific responsibilities            |
| `README.md`    | Setup instructions                                        |

### Project Files

| File                 | Location             | Purpose                          |
| -------------------- | -------------------- | -------------------------------- |
| `project-map.yaml`   | `~/coding-projects/` | Global project registry          |
| `project-context.md` | `.ai/shared-memory/` | Product purpose, architecture    |
| `current-focus.md`   | `.ai/shared-memory/` | Active changes, owners, blockers |
| `decision-log.md`    | `.ai/shared-memory/` | Architecture decisions           |
| `mistake-log.md`     | `.ai/shared-memory/` | What went wrong and why          |
| `lessons-learned.md` | `.ai/shared-memory/` | Reusable prevention guidance     |
| `handoff-index.md`   | `.ai/shared-memory/` | Active handoffs overview         |
| `project-risks.md`   | `.ai/shared-memory/` | Known risks and mitigations      |

### Change Artifacts

| File                         | Location                       | Purpose                             |
| ---------------------------- | ------------------------------ | ----------------------------------- |
| `status.yaml`                | `openspec/changes/<id>/`       | Authoritative phase state           |
| `proposal.md`                | `openspec/changes/<id>/`       | Problem, story, acceptance criteria |
| `design.md`                  | `openspec/changes/<id>/`       | API contracts, schema, architecture |
| `tasks.md`                   | `openspec/changes/<id>/`       | Task index table                    |
| `tasks-tracker.yaml`         | `openspec/changes/<id>/`       | Fast status index for dashboard     |
| `tasks/Phase{X}-T{X}.{Y}.md` | `openspec/changes/<id>/tasks/` | Individual task details             |
| `handoff.md`                 | `openspec/changes/<id>/`       | Current baton between agents        |
| `verification.md`            | `openspec/changes/<id>/`       | QA evidence and signoff             |
| `release.md`                 | `openspec/changes/<id>/`       | Deployment summary                  |

### Skills (in repo `skills/` directory)

| Skill                  | File                                   |
| ---------------------- | -------------------------------------- |
| `openspec-change`      | `skills/openspec-change/SKILL.md`      |
| `openspec-propose`     | `skills/openspec-propose/SKILL.md`     |
| `openspec-plan-change` | `skills/openspec-plan-change/SKILL.md` |
| `openspec-design-arch` | `skills/openspec-design-arch/SKILL.md` |
| `openspec-implement`   | `skills/openspec-implement/SKILL.md`   |
| `openspec-test-verify` | `skills/openspec-test-verify/SKILL.md` |
| `openspec-deploy-gcp`  | `skills/openspec-deploy-gcp/SKILL.md`  |
| `openspec-review-code` | `skills/openspec-review-code/SKILL.md` |
| `openspec-handoff`     | `skills/openspec-handoff/SKILL.md`     |
| `openspec-sdd`         | `skills/openspec-sdd/SKILL.md`         |
| `project-bootstrap`    | `skills/project-bootstrap/SKILL.md`    |
| `project-map-reader`   | `skills/project-map-reader/SKILL.md`   |
| `handoff-standard`     | `skills/handoff-standard/SKILL.md`     |
| `coding-agent`         | `skills/coding-agent/SKILL.md`         |
| `self-learning-loop`   | `skills/self-learning-loop/SKILL.md`   |
| `mc-task-poll`         | `skills/mc-task-poll/SKILL.md`         |
