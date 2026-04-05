# OpenSpec Multi-Agent Development System

A role-based multi-agent software development workflow built on OpenClaw. Agents execute asynchronously in the background via OpenClaw's subagent spawning. A kanban dashboard provides live visibility into agent status, task progress, and project state.

---

## How it works

Every piece of work flows through a structured lifecycle:

```
Idea → Proposal → Plan → Design → Implementation → Verification → Deployment → Done
```

Each phase is owned by a specific role. The orchestrator skill routes work between roles, enforces phase transitions, and spawns background agents to execute each phase autonomously. Shared filesystem files — not chat history — are the system of record.

---

## Quick start

### 1. Install the OpenSpec CLI

```bash
npm install -g @fission-ai/openspec
```

### 2. Set up your project registry

Create `~/coding-projects/project-map.yaml`:

```yaml
version: 1
root: ~/coding-projects

projects:
  - projectName: My App
    projectCode: my-app
    location: ~/coding-projects/my-app
    status: active
```

### 3. Initialize OpenSpec in your project

```bash
cd ~/coding-projects/my-app
openspec init
```

This creates `openspec/` structure and `.claude/skills/` for AI assistant integration.

### 4. Scaffold shared memory

```bash
cp -r <openclaw-repo>/skills/openspec-change/templates/.ai ./
```

Fill in `.ai/shared-memory/project-context.md` with your product's purpose and constraints.

### 5. Start a new change

```bash
/opsx:propose "add dark mode support"
# → generates proposal.md, specs/, design.md, tasks.md

/opsx:apply
# → implements all tasks

/opsx:archive
# → archives the completed change
```

Or use the `openspec-change` skill to orchestrate the full pipeline across multiple agents.

---

## Project registry

**`~/coding-projects/project-map.yaml`** is the global index of all projects on the machine. Every agent reads this first to resolve a project code to an absolute path before loading any other context.

```yaml
version: 1
root: ~/coding-projects

projects:
  - projectName: Acme Billing
    projectCode: acme-billing
    location: ~/coding-projects/acme-billing
    status: active # active | discovery | paused
```

---

## Shared memory

Once inside a project, `.ai/shared-memory/` is the persistent, agent-shared brain. All agents read and write these files to stay coordinated across sessions and handoffs.

| File                 | Purpose                                                                   |
| -------------------- | ------------------------------------------------------------------------- |
| `project-context.md` | Static truth: product purpose, architecture, constraints, open questions  |
| `current-focus.md`   | Dynamic state: active changes, owners, branches, worktrees, blockers      |
| `decision-log.md`    | Architectural decisions with date, rationale, and alternatives considered |
| `mistake-log.md`     | What went wrong, root cause, fix applied, prevention guidance             |
| `lessons-learned.md` | Reusable guidance distilled from mistake-log entries                      |
| `handoff-index.md`   | Quick index of active handoffs and freshness                              |
| `project-risks.md`   | Known risks, likelihood, owner, mitigation status                         |

---

## OpenSpec change artifacts

Each change lives in its own directory:

```
openspec/
  specs/                          # long-lived project specifications
  changes/
    <change-id>/
      status.yaml                 # machine-readable phase state (authoritative)
      proposal.md                 # problem, user story, acceptance criteria
      design.md                   # API contracts, schema, component architecture
      tasks.md                    # task list with owners and status
      handoff.md                  # current baton between agents
      verification.md             # acceptance criteria trace + QA signoff
      release.md                  # deployment summary and monitoring results
    archive/                      # completed changes
  _template/                      # scaffold for new changes
```

Change IDs follow the pattern: `<project-code>-<feature>-<YYYYMMDD>`
Example: `acme-billing-retry-20240315`

---

## Agent bootstrap sequence

Every agent — regardless of role — runs this sequence before taking any action:

```
1. Read ~/coding-projects/project-map.yaml
         ↓  resolve projectCode → absolute path
2. Read .ai/shared-memory/project-context.md
3. Read .ai/shared-memory/current-focus.md
4. Read decision-log, mistake-log, lessons-learned
5. Read openspec/specs/ and openspec/changes/ inventory
6. Read the active change's handoff.md
7. Confirm branch and worktree
         ↓
   Only now: plan or act
```

Spawned sub-agents receive no parent session state. They must self-recover from files using this same sequence. The `project-bootstrap` skill implements this protocol.

---

## Roles and responsibilities

| Role                 | Owns                                                    | Key writes                                            |
| -------------------- | ------------------------------------------------------- | ----------------------------------------------------- |
| **CTO**              | Technical strategy, escalation, cross-project oversight | `decision-log.md`, architectural guidance             |
| **Dev Manager**      | Change routing, OpenSpec lifecycle, handoffs            | `current-focus.md`, `handoff-index.md`, `status.yaml` |
| **Product Owner**    | Requirements, acceptance criteria, scope                | `proposal.md`, `project-context.md`                   |
| **Tech Lead**        | Architecture, design decisions, risks                   | `design.md`, `decision-log.md`, `project-risks.md`    |
| **Staff Fullstack**  | Architecture ownership, code review, mentoring          | Review feedback, architectural guidance               |
| **Sr. Fullstack**    | Feature implementation, tests, PRs                      | Code, tests, `handoff.md`, `mistake-log.md`           |
| **Mobile Developer** | Flutter/mobile implementation                           | Mobile code, build configs                            |
| **QA Engineer**      | Verification, acceptance criteria tracing, signoff      | `verification.md`, `lessons-learned.md`               |
| **DevOps**           | GCP infrastructure, CI/CD, deployment                   | `release.md`, Terraform, Cloud Run config             |

Each role is defined as an OpenClaw agent workspace under the assembled directories. The shared team topology is in `dev-team-agents/shared/TEAM_TOPOLOGY.md`.

---

## Skills reference

### Workflow skills (invoke for specific phases)

All workflow skills use the installed `openspec` CLI (`@fission-ai/openspec`) for artifact generation. Install it once: `npm install -g @fission-ai/openspec`

| Skill                  | CLI commands used                                        | What it does                                                              |
| ---------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------- |
| `openspec-change`      | `/opsx:propose` `/opsx:apply` `/opsx:archive`            | Full lifecycle orchestrator — routes through all phases                   |
| `openspec-propose`     | `/opsx:propose "<idea>"`                                 | Runs propose to generate `proposal.md`, `specs/`, `design.md`, `tasks.md` |
| `openspec-plan-change` | `/opsx:continue` `/opsx:ff` `openspec status`            | Scaffolds change folder, refines tasks, sets up worktree                  |
| `openspec-design-arch` | `/opsx:explore` `/opsx:continue` `openspec status`       | Investigates then generates `design.md`                                   |
| `openspec-implement`   | `/opsx:apply` `openspec status` `openspec instructions`  | Implements tasks from `tasks.md`                                          |
| `openspec-test-verify` | `/opsx:verify` `openspec status` `openspec instructions` | Traces acceptance criteria, produces QA signoff                           |
| `openspec-deploy-gcp`  | `/opsx:archive` + GCP CLI                                | Deploys to GCP, monitors, archives change                                 |
| `openspec-review-code` | `openspec status` `openspec instructions`                | Spec-driven review against `proposal.md` and `design.md`                  |
| `openspec-handoff`     | `openspec status`                                        | Writes structured handoff between agents                                  |

### Shared operational skills

| Skill                     | Purpose                                                              |
| ------------------------- | -------------------------------------------------------------------- |
| `project-bootstrap`       | Load 3-layer context before any work (role → project → change)       |
| `mc-task-poll`            | Claim and process the next task from Mission Control API             |
| `project-map-reader`      | Resolve project code → absolute path from project-map.yaml           |
| `handoff-standard`        | Write a well-structured handoff with all required fields             |
| `openspec-sdd`            | Produce a Software Design Document for complex changes               |
| `self-learning-loop`      | Distill mistake-log entries into lessons-learned                     |
| `monorepo-navigation`     | Navigate and understand monorepo structure                           |
| `git-worktree-discipline` | One change per worktree — setup and discipline                       |
| `ui-design`               | High-agency frontend design (React/Next.js, Tailwind, Framer Motion) |

---

## The `openspec_change` tool

The plugin registers this tool so agents can manage changes programmatically rather than through file edits alone:

```
openspec_change(action: "create",    projectCode, changeId, title)
openspec_change(action: "transition", changeId, toPhase)
openspec_change(action: "assign",    changeId, role, sessionKey)
openspec_change(action: "block",     changeId, blocker)
openspec_change(action: "unblock",   changeId, blocker)
openspec_change(action: "handoff",   changeId, from, to, summary, nextStep)
openspec_change(action: "status",    changeId)
```

Phase transition guards are enforced by the tool — invalid transitions return an error:

- `design` requires `proposal.md` to exist
- `implementation` requires `design.md` + `tasks.md`
- `verification` requires a non-empty `handoff.md`
- `deployment` requires `verification.md` containing `Signoff: YES`

The `openspec_projects` tool reads the project registry and shared-memory:

```
openspec_projects(action: "list")
openspec_projects(action: "context", projectCode)
openspec_projects(action: "changes", projectCode)
```

---

## Mission Control integration

The `mc-task-poll` skill connects to a Mission Control API (`localhost:4010` by default, configurable via plugin config `missionControlUrl`).

When an agent polls for work:

1. Checks for review tasks (`POST /api/v1/tasks/next-review`)
2. Falls back to inbox tasks (`POST /api/v1/tasks/next`)
3. Loads 3-layer context via `project-bootstrap`
4. Routes to the appropriate role agent
5. Posts trace comments back to the task
6. Marks the task `in_progress`
7. Spawns the role agent as a background sub-agent
8. Reports completion back to Mission Control

---

## Dashboard — Projects tab

The OpenClaw web dashboard has a **Projects** tab (in the Control group, after Cron) that shows a live kanban board for all OpenSpec projects.

### Board layout

```
Idea | Proposal | Plan | Design | Implementation | Verification | Deployment | Done
  □       □□       □       □            □□□               □              □
```

Each card shows:

- Change title and ID
- Current assigned agent with live status indicator
- Time in current phase
- Blocker count (red badge when > 0)

### Agent status panel

Below the board: a live table of all active OpenSpec agents showing role, current task, running duration, and status (running / waiting / blocked / completed).

### Gateway methods

The plugin exposes these WebSocket methods used by the dashboard:

| Method                    | Description                                                  |
| ------------------------- | ------------------------------------------------------------ |
| `openspec.projects.list`  | All projects from project-map.yaml with active change counts |
| `openspec.changes.list`   | Changes for a project with phase, owner, status              |
| `openspec.changes.detail` | Full change detail with child tasks and artifact content     |
| `openspec.agents.status`  | Live OpenSpec agent sessions (stub — see known gaps)         |

---

## Async execution model

When the orchestrator routes to a role, it spawns a background sub-agent:

```
Orchestrator
    │
    ├─ openspec_change(transition, toPhase)       ← updates status.yaml + TaskFlow
    │
    └─ sessions_spawn(                            ← ACP subagent spawn
         mode: "run",
         sessionKey: "agent:openspec:<change-id>:<role>",
         task: "<role skill to invoke> for change <change-id>",
         ...
       )
           │
           └─ Sub-agent self-bootstraps
              → reads project-map.yaml
              → reads .ai/shared-memory/
              → reads openspec/changes/<change-id>/
              → invokes role skill
              → writes artifacts
              → calls openspec_change(handoff, ...)
              → exits
```

The parent session continues or completes. The spawned agent works independently. Progress is visible in the dashboard as it updates `status.yaml`.

---

## TaskFlow integration

Each OpenSpec change maps to one **managed TaskFlow** in OpenClaw's durable task registry:

- `controllerId: "openspec/orchestrator"`
- `currentStep`: mirrors the current phase
- `stateJson`: stores `{ changeId, projectCode, assignees, phase, blockers }`
- Child tasks linked via `runTask()` for each spawned role agent

This gives the dashboard real-time visibility into change progress via the task registry, and ensures work survives restarts.

---

## Heartbeat and self-learning

### Heartbeat (automated via cron)

| Job                        | Schedule       | Checks                                                          |
| -------------------------- | -------------- | --------------------------------------------------------------- |
| Team manager heartbeat     | Every 5 min    | Stuck phases, stale handoffs, orphaned agents                   |
| QA stale-handoff scan      | Every 60 min   | Changes awaiting verification with no recent update             |
| Self-learning distillation | Every 12 hours | New `mistake-log.md` entries to promote to `lessons-learned.md` |

Findings are written to `.ai/shared-memory/heartbeat-log.md`.

### Self-learning loop

```
mistake happens
    ↓
agent writes to mistake-log.md
    ↓  (self-learning-loop skill, runs on heartbeat)
distill into lessons-learned.md
    ↓
future agents read lessons-learned.md during bootstrap
    ↓
mistake is not repeated
```

---

## File inventory

### Skills (`skills/`)

```
mc-task-poll/               openspec-change/
project-bootstrap/          openspec-propose/
monorepo-navigation/        openspec-plan-change/
self-learning-loop/         openspec-design-arch/
project-map-reader/         openspec-implement/
handoff-standard/           openspec-test-verify/
openspec-sdd/               openspec-deploy-gcp/
git-worktree-discipline/    openspec-review-code/
ui-design/                  openspec-handoff/
```

### Plugin (`extensions/openspec/`)

```
openclaw.plugin.json        src/openspec-types.ts
package.json                src/openspec-tool.ts
index.ts                    src/projects-tool.ts
api.ts                      src/openspec-gateway.ts
runtime-api.ts
```

### Dashboard (`ui/src/ui/`)

```
views/projects.ts           views/projects-board.ts
views/projects-card.ts      views/projects-agents.ts
views/projects-types.ts     controllers/projects.ts
```

### Templates (`skills/openspec-change/templates/`)

```
.ai/shared-memory/
  project-context.md    current-focus.md    decision-log.md
  mistake-log.md        lessons-learned.md  handoff-index.md
  project-risks.md

openspec/
  specs/README.md
  changes/_template/
    status.yaml   proposal.md   design.md   tasks.md
    handoff.md    verification.md           release.md
```

---

## Known gaps

- **`openspec.agents.status`** returns an empty array. The plugin SDK does not currently expose a public seam for querying active sessions by `sessionKey` prefix. A new SDK seam needs to be added to `src/plugin-sdk/` to surface this to the dashboard.
- **Role agent workspaces** (the assembled `manager/`, `po/`, `tech-lead/`, etc. directories from `dev-team-agents/`) need to be installed at `~/.openclaw/workspaces/<role>` to be available as named agents for subagent spawning.
- **Mission Control API** (`localhost:4010`) is required for `mc-task-poll` to work. If you are not running Mission Control, use the workflow skills directly instead.

---

## Source

The canonical skill and workflow source lives at:
`/Users/javierhbr/openclaw/lob-claw/dev-team-agents/`

The adapter scripts there (`adapters/generate-claude.sh`, `adapters/generate-opencode.sh`, etc.) can regenerate output for other AI runtimes (Claude Code agents, OpenCode, Codex CLI) from the same shared source.
