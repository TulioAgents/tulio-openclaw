# Phase3-T3.1 — CLI: list, show, traces

## Status

`done`

## Objective

Provide read-only CLI commands for operators to inspect pending candidates, view draft skill content, and browse recent tool-sequence traces.

## Acceptance criteria

- [ ] `openclaw learning list` shows pending candidates with id, name, confidence, description, created date
- [ ] `openclaw learning list --all` includes promoted and rejected candidates
- [ ] Revision candidates show `[revision]` badge and `revises:` path
- [ ] `openclaw learning show <id>` prints candidate metadata and full draft SKILL.md content
- [ ] `openclaw learning show <id>` shows `kind`, `revisesSkillPath` for revisions
- [ ] `openclaw learning show <id>` exits with error if id not found
- [ ] `openclaw learning traces [--limit N]` shows recent JSONL entries with timestamp, trigger, session suffix, tool sequence, success flag
- [ ] `openclaw learning traces` gracefully handles missing traces.jsonl

## Implementation notes

- Registered via `api.registerCli()` with descriptor `{ name: "learning", hasSubcommands: true }`
- Pattern mirrors `extensions/memory-core/src/cli.ts`
- `resolveWorkspaceDir()` defaults to `process.cwd()` when `--workspace` not provided
- No color/theme library used — plain `console.log` with bracket badges
- Source: `src/cli.ts`

## Files touched

- `src/cli.ts` — `registerLearningCli()`, list/show/traces subcommands

## Test coverage

- No automated CLI tests yet — commands tested manually
- To add: vitest tests using Commander's `parseAsync` with a mock program

## Agent comments

<!-- Agents: append timestamped notes below -->

2026-04-05 [tulio] — Implemented. `openclaw learning` CLI is plugin-contributed (not a core sub-CLI) to keep the layering clean — core CLI does not depend on plugin state.

## Bugs / blockers

- **Missing tests**: CLI commands have no vitest coverage. Should add Commander parseAsync tests for list/show/traces in a follow-up.
