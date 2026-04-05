# Phase2-T2.3 — Skill revision detection and re-extraction

## Status

`done`

## Objective

After a skill is promoted, continue observing the same workflow. When enough new evidence accumulates, generate a revision candidate that improves the existing skill rather than creating a duplicate.

## Acceptance criteria

- [ ] Revision triggers when `fingerprint.count - countAtPromotion >= REVISION_OCCURRENCE_DELTA (5)`
- [ ] Revision does not trigger if `revisionCandidateId` is already set (pending revision exists)
- [ ] Revision candidate has `kind: "revision"`, `revisesSkillPath`, `revisesCandidateId`
- [ ] Revision extraction prompt includes existing SKILL.md content (truncated to 3000 chars)
- [ ] If existing skill file is missing (deleted externally), falls back to new extraction silently
- [ ] `markFingerprintRevision()` sets `revisionCandidateId` and resets `countAtPromotion = count`
- [ ] `markFingerprintPromoted()` records `countAtPromotion` when a skill (new or revision) is approved
- [ ] After approving a revision, the cycle resets and can trigger again with next evidence delta

## Implementation notes

- `REVISION_OCCURRENCE_DELTA = 5` constant in `src/observer.ts`
- Revision eligibility check runs inside `processTrace()` after initial candidate check
- `listCandidates(workspaceDir)` is used to find the promoted candidate for a fingerprint — scans all candidate files, O(n). Acceptable for v1.
- `markFingerprintRevision()` resets `countAtPromotion` to current count so the next revision cycle starts fresh
- The approve CLI path calls `markFingerprintPromoted()` for both new and revision approvals

## Files touched

- `src/observer.ts` — revision eligibility logic in `processTrace()`
- `src/trace-store.ts` — `markFingerprintPromoted()`, `markFingerprintRevision()`
- `src/types.ts` — `FingerprintEntry.countAtPromotion`, `FingerprintEntry.revisionCandidateId`
- `src/skill-extractor.ts` — `existingSkillContent` param in `extractSkillFromWorkflow()`

## Test coverage

- No dedicated revision cycle test yet — to be added in a follow-up
- Fingerprint marking functions tested indirectly via trace-store tests

## Agent comments

<!-- Agents: append timestamped notes below -->

2026-04-05 [tulio] — Implemented alongside Phase3-T3.2 since the approve CLI needed to handle both kinds. The revision trigger block in `processTrace()` has multiple early-return conditions; took care to order them correctly (check pending revision before daily limit to avoid burning a daily slot).

## Bugs / blockers

- **Missing test**: revision end-to-end cycle (promote → observe 5 more → revision candidate generated → approve → skill updated) has no automated test. Needs a `Phase2-T2.3.revision-cycle.test.ts` with a mock for the LLM extraction call.
