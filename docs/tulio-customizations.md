# Tulio-OpenClaw Customizations

> **Purpose:** Reference document for all local customizations on the `self-improvement` branch.
> Review this file before every upstream `origin/main` merge to assess conflict risk and preserve intent.
>
> **Branch:** `self-improvement`
> **Base version when branched:** 2026.4.9
> **Last reviewed against:** 2026.4.10

---

## Quick Conflict Checklist (Pre-Merge)

Before merging any upstream release:

1. Run `git diff --name-only origin/main...HEAD` and compare against the [File Inventory](#file-inventory) below
2. For each overlapping file, check the [Impact column](#file-inventory) to decide if manual review is needed
3. Discard the uncommitted `package.json` version downgrade before merging (see [Known Pre-Merge Steps](#known-pre-merge-steps))
4. After merge, run `pnpm install` to restore the `learning-core` and `openspec` workspace lockfile entries
5. Verify the [Post-Merge Smoke Test](#post-merge-smoke-test)

---

## File Inventory

### New Plugins

| File / Directory            | Description                                                                                         | Upstream Conflict Risk       |
| --------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------- |
| `extensions/learning-core/` | Full new plugin — auto-discovers skills from repeated agent tool sequences                          | Low — entirely new directory |
| `extensions/openspec/`      | Full new plugin — multi-agent workflow orchestration with phase gates and dashboard gateway methods | Low — entirely new directory |

### Modified Files in Existing Extensions

| File                            | What Changed                                                                                         | Upstream Conflict Risk                                                               |
| ------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `extensions/acpx/src/config.ts` | Added fallback logic to resolve plugin root from both `dist/` and `dist-runtime/` bundle directories | Low — origin/main only bumps `extensions/acpx/package.json` version, not `config.ts` |

### UI Changes

| File                                 | What Changed                                                                                           | Upstream Conflict Risk                                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `ui/src/ui/navigation.ts`            | Added `projects` tab with folder icon and `/projects` route                                            | Medium — navigation is frequently touched upstream; check for new tabs added by origin/main              |
| `ui/src/ui/app.ts`                   | Added 17 `@state()` properties for projects tab state management                                       | Medium — app.ts grows with each release; verify new state properties don't clash with upstream additions |
| `ui/src/ui/app-render.ts`            | Added projects lazy-load and tab rendering with 18 props passed to `renderProjects()`                  | Medium — same file gets new tab renders in upstream releases                                             |
| `ui/src/ui/app-settings.ts`          | Added projects tab refresh logic in `refreshActiveTab()`                                               | Low — small targeted addition                                                                            |
| `ui/src/ui/app-view-state.ts`        | Added OpenSpec type exports and projects state property types                                          | Low — additive exports                                                                                   |
| `ui/src/ui/controllers/projects.ts`  | **New file** — state management and API integration for projects dashboard                             | Low — new file                                                                                           |
| `ui/src/ui/views/projects.ts`        | **New file** — main 500+ line projects dashboard view (kanban board, agent table, change detail panel) | Low — new file                                                                                           |
| `ui/src/ui/views/projects-board.ts`  | **New file** — kanban board rendering                                                                  | Low — new file                                                                                           |
| `ui/src/ui/views/projects-card.ts`   | **New file** — individual change card rendering                                                        | Low — new file                                                                                           |
| `ui/src/ui/views/projects-types.ts`  | **New file** — shared TypeScript types for projects UI                                                 | Low — new file                                                                                           |
| `ui/src/ui/views/projects-agents.ts` | **New file** — agent status table rendering                                                            | Low — new file                                                                                           |
| `ui/src/i18n/locales/en.ts`          | Added `projects` label string                                                                          | Medium — locale files are auto-generated upstream; re-add after regeneration if overwritten              |
| `ui/src/i18n/locales/de.ts`          | Added `projects` translation                                                                           | Medium — same as above                                                                                   |
| `ui/src/i18n/locales/es.ts`          | Added `projects` translation                                                                           | Medium — same as above                                                                                   |
| `ui/src/i18n/locales/pt-BR.ts`       | Added `projects` translation                                                                           | Medium — same as above                                                                                   |
| `ui/src/i18n/locales/zh-CN.ts`       | Added `projects` translation                                                                           | Medium — same as above                                                                                   |
| `ui/src/i18n/locales/zh-TW.ts`       | Added `projects` translation                                                                           | Medium — same as above                                                                                   |

### Scripts

| File                           | Description                                                                                     | Upstream Conflict Risk |
| ------------------------------ | ----------------------------------------------------------------------------------------------- | ---------------------- |
| `scripts/dev-start.sh`         | **New** — gateway lifecycle manager (start/stop/restart/status/logs/build/sync-skills/validate) | Low — new file         |
| `scripts/sync-agent-skills.sh` | **New** — syncs role-specific skills from `skills/` to `~/.openclaw/workspaces/<role>/skills/`  | Low — new file         |

### Skills

| Path                              | Description                                                        | Upstream Conflict Risk       |
| --------------------------------- | ------------------------------------------------------------------ | ---------------------------- |
| `skills/coding-agent/`            | Delegates coding tasks to Codex/Claude Code/Pi                     | Low — entirely new directory |
| `skills/git-worktree-discipline/` | Manages git worktrees for parallel agent work                      | Low                          |
| `skills/handoff-standard/`        | Standardized handoff format between agents                         | Low                          |
| `skills/mc-task-poll/`            | Polls task status from Mission Control                             | Low                          |
| `skills/monorepo-navigation/`     | Context-aware file discovery in monorepos                          | Low                          |
| `skills/openspec-change/`         | Orchestrates full change lifecycle (propose → implement → archive) | Low                          |
| `skills/openspec-design-arch/`    | Tech Lead writes architecture/design docs                          | Low                          |
| `skills/openspec-handoff/`        | Standardized handoff documentation                                 | Low                          |
| `skills/openspec-implement/`      | Implementers write code + tests with phase gate enforcement        | Low                          |
| `skills/openspec-plan-change/`    | Dev Manager creates task plans                                     | Low                          |
| `skills/openspec-propose/`        | Product Owner writes proposals                                     | Low                          |
| `skills/openspec-review-code/`    | Code reviewer procedure                                            | Low                          |
| `skills/openspec-sdd/`            | Creates system design documents                                    | Low                          |
| `skills/openspec-test-verify/`    | QA verifies acceptance criteria                                    | Low                          |
| `skills/openspec-deploy-gcp/`     | Deployment to GCP infrastructure                                   | Low                          |
| `skills/project-bootstrap/`       | Initializes projects in project-map                                | Low                          |
| `skills/project-map-reader/`      | Reads project registry                                             | Low                          |
| `skills/self-learning-loop/`      | Turns mistakes into skill improvements                             | Low                          |
| `skills/ui-design/`               | UI design workflow skill                                           | Low                          |
| _(+ additional utility skills)_   | Discord, Slack, GitHub, Notion, Bear Notes integrations            | Low                          |

### Documentation

| File                                                     | Description                                                                                       | Upstream Conflict Risk                                                                     |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `AGENTS.md`                                              | **Modified** — added workflow checkpoint rules (project-map, OpenSpec phase gates) at top of file | Medium — upstream may update AGENTS.md; check diff and re-apply checkpoint block if needed |
| `OPENSPEC.md`                                            | **New** — multi-agent system overview, 8-phase lifecycle, project registry format                 | Low                                                                                        |
| `docs/development-process.md`                            | **New** — 30+ section comprehensive reference for OpenSpec workflow, roles, phases, CLI commands  | Low                                                                                        |
| `docs/plans/2026-04-05-hermes-self-learning-openclaw.md` | **New** — original plan document for this branch                                                  | Low                                                                                        |

### Config / Tooling

| File             | Description                                  | Upstream Conflict Risk                                                           |
| ---------------- | -------------------------------------------- | -------------------------------------------------------------------------------- |
| `.nvm`           | Sets local Node version to `v24.14.1`        | Low — new file                                                                   |
| `pnpm-lock.yaml` | Updated with new extension workspace entries | **High** — always changes on upstream; must run `pnpm install` after every merge |

---

## What Each Customization Does

### `extensions/learning-core` Plugin

Observes agent tool usage patterns across sessions and automatically generates skill candidates when patterns repeat above configurable thresholds.

- **Config:** `min_occurrences` (default 3), `min_sessions` (default 2), `max_candidates_per_day` (default 5)
- **Modes:** `off` / `suggest` (manual review) / `auto` (auto-promote high-confidence)
- **CLI:** `openclaw learning list-candidates`, `openclaw learning promote <id>`, `openclaw learning reject <id>`
- **Storage:** Append-only trace log + JSON fingerprint store under agent workspace
- **Plugin ID:** Check `extensions/learning-core/openclaw.plugin.json`

### `extensions/openspec` Plugin

Multi-agent development orchestration system. Registers agent tools and gateway dashboard methods.

**Agent tools registered:**

- `openspec_change` — manages change lifecycle (create, advance phase, update status, archive)
- `openspec_task` — manages individual tasks within a change
- `openspec_projects` — queries project registry

**Gateway methods registered:**

- `openspec.projects.list` — list all projects
- `openspec.changes.list` — list changes for a project
- `openspec.changes.detail` — change details + task list
- `openspec.agents.status` — active agent statuses
- `openspec.tasks.list` — task list for a change
- `openspec.changes.can-advance` — validate phase gate transition

**Phase lifecycle:** `idea → proposal → plan → design → implementation → verification → deployment → done` (or `blocked`)

### Projects UI Tab

Adds a "Projects" tab to the main control UI navigation showing:

- **Kanban board** — changes organized by phase (8 columns)
- **Agent table** — active agents with role, session, assignment, status, current task, duration
- **Change detail panel** — task list with status (todo/in_progress/blocked/in_review/done) and priority

**Entry point:** `ui/src/ui/navigation.ts` → `ui/src/ui/views/projects.ts`

### Skills System

Skills are role-specific prompt templates deployed to `~/.openclaw/workspaces/<role>/skills/`. Each skill provides step-by-step procedures with phase gates.

**Role → Skills mapping** (enforced by `scripts/sync-agent-skills.sh`):
| Role | Key Skills |
|------|-----------|
| `cto` | shared + openspec-review-code |
| `manager` | shared + openspec-plan-change, openspec-handoff |
| `po` | shared + openspec-propose |
| `tech-lead` | shared + openspec-design-arch, openspec-review-code |
| `sr-fullstack` | shared + openspec-implement, openspec-review-code |
| `staff-fullstack` | shared + openspec-implement |
| `mobile` | shared + openspec-implement |
| `qa` | shared + openspec-test-verify |
| `devops` | shared + openspec-deploy-gcp |

**Shared skills** (all roles): coding-agent, git-worktree-discipline, handoff-standard, mc-task-poll, monorepo-navigation, openspec-change, openspec-sdd, project-bootstrap, project-map-reader, self-learning-loop

---

## Known Pre-Merge Steps

These must be done before every `git rebase origin/main`:

1. **Discard uncommitted `package.json` version change**

   ```bash
   git checkout -- package.json
   ```

   The local branch has an uncommitted downgrade to `2026.4.7-1`. Let upstream's version take effect.

2. **Confirm no stashes conflict** — do not use `--autostash` (see AGENTS.md multi-agent safety rules)

---

## Post-Merge Steps

After every rebase onto `origin/main`:

1. **Regenerate lockfile** — upstream removes `learning-core` and `openspec` workspace entries:

   ```bash
   pnpm install
   ```

2. **Check locale files** — if upstream ran `pnpm ui:i18n:sync`, the locale files may have been regenerated and the `projects` string dropped. Re-add manually if needed:

   ```diff
   # ui/src/i18n/locales/en.ts
   + projects: "Projects",
   ```

   Apply the same to `de.ts`, `es.ts`, `pt-BR.ts`, `zh-CN.ts`, `zh-TW.ts`.

3. **Run verification gate**
   ```bash
   pnpm check && pnpm build
   ```

---

## Post-Merge Smoke Test

Verify these after each merge:

- [ ] `extensions/learning-core/` directory exists with all source files
- [ ] `extensions/openspec/` directory exists with all source files
- [ ] `extensions/acpx/src/config.ts` still has the `dist-runtime/` fallback logic
- [ ] `ui/src/ui/navigation.ts` still has the `projects` tab
- [ ] `skills/` directory has all skill subdirectories
- [ ] `scripts/dev-start.sh` and `scripts/sync-agent-skills.sh` are executable
- [ ] `AGENTS.md` still has the Workflow Checkpoint block at the top
- [ ] `pnpm install` completes without errors
- [ ] `pnpm check` passes
- [ ] `pnpm build` passes

---

## Architecture Notes

All customizations follow **zero-impact on core** design:

- Plugins register through the Plugin SDK — no core modifications
- UI components are added through existing navigation/routing patterns
- Skills are deployed to independent agent workspaces
- No hardcoded plugin IDs added to core
- No new core imports from extension code

If a future upstream change modifies the Plugin SDK registration API or the navigation tab interface, the affected files are `extensions/learning-core/index.ts`, `extensions/openspec/index.ts`, and `ui/src/ui/navigation.ts` — check those first.
