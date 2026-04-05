# Phase3-T3.2 — CLI: approve and reject (new + revision)

## Status

`done`

## Objective

Allow operators to promote a pending candidate into the workspace skills directory, or reject it with an optional reason. Handle both new skills and revisions correctly.

## Acceptance criteria

- [ ] `openclaw learning approve <id>` copies `learning/skills/<id>/SKILL.md` to `skills/<name>/SKILL.md` for new candidates
- [ ] `openclaw learning approve <id>` replaces `skills/<name>/SKILL.md` in place for revision candidates (no `--force` required)
- [ ] `openclaw learning approve <id> --force` overwrites an existing skill for new candidates
- [ ] Approve fails with a clear message if candidate is not `pending`
- [ ] Approve fails with a clear message if draft SKILL.md is missing
- [ ] Approve fails if target skill already exists and candidate is `new` and `--force` not passed
- [ ] After approve: candidate status → `promoted`, `promotedAt` and `promotedTo` set
- [ ] After approve: `markFingerprintPromoted()` called with current count to set baseline for revision
- [ ] `openclaw learning reject <id> [--reason "..."]` sets status → `rejected`, `rejectedAt`, `rejectedReason`
- [ ] Reject fails if candidate is not `pending`
- [ ] Skills snapshot version is bumped automatically via chokidar file watcher (no explicit call needed)

## Implementation notes

- For revisions: `workspaceRelative = candidate.revisesSkillPath` — points directly at the existing promoted skill
- `markFingerprintPromoted()` is called via dynamic import of `trace-store.ts` to keep the CLI lazy
- Chokidar watcher in `src/agents/skills/refresh.ts` detects the new/updated SKILL.md and calls `bumpSkillsSnapshotVersion()` automatically — no explicit bump needed from the plugin CLI
- Source: `src/cli.ts` — `approve` and `reject` subcommands

## Files touched

- `src/cli.ts` — approve and reject subcommands

## Test coverage

- No automated tests yet
- Manual test: approve a new candidate → verify `skills/<name>/SKILL.md` created
- Manual test: approve a revision candidate → verify existing skill replaced

## Agent comments

<!-- Agents: append timestamped notes below -->

2026-04-05 [tulio] — Implemented. Dynamic import of `readFingerprintStore` for `markFingerprintPromoted` in CLI is a code smell — should expose a single `markPromoted(workspaceDir, fingerprint)` helper that reads its own store internally. Left as-is for v1.

## Bugs / blockers

- **Code smell**: CLI reads `readFingerprintStore` via dynamic import just to get current count for `markFingerprintPromoted`. Should be refactored to an encapsulated helper.
- **Missing tests**: approve and reject have no vitest coverage.
