# Phase4-T4.1 — Memory integration via synthetic recall injection

## Status

`not started`

## Objective

Let interesting facts observed during skill extraction feed into the existing dreaming promotion pipeline (`memory-core`) instead of building a separate memory approval system.

## Acceptance criteria

- [ ] `injectSyntheticRecall()` exported from `memory-core`'s `short-term-promotion.ts` (or accessible via `openclaw/plugin-sdk/memory-core`)
- [ ] Function signature: `injectSyntheticRecall({ path, snippet, score, conceptTags }): Promise<void>`
- [ ] Writes a valid `ShortTermRecallEntry` to `memory/.dreams/short-term-recall.json` with `recallCount: 1`, `source: "memory"`
- [ ] Uses same file lock pattern as existing short-term-promotion writes
- [ ] `learning-core` calls `injectSyntheticRecall` during Phase2 extraction when LLM identifies durable user preferences or environment facts
- [ ] Injected entries flow through existing dreaming scoring (frequency, relevance, diversity, etc.) without bypassing thresholds
- [ ] Existing dreaming tests still pass after the change

## Implementation notes

### Change needed in `memory-core`

Add to `extensions/memory-core/src/short-term-promotion.ts`:

```typescript
export async function injectSyntheticRecall(
  workspaceDir: string,
  entry: {
    path: string; // e.g. "memory/2026-04-05.md"
    snippet: string;
    score: number; // 0.0-1.0, treated as relevance seed
    conceptTags: string[];
  },
): Promise<void>;
```

This writes a `ShortTermRecallEntry` with:

- `key`: `"memory:<path>:0:0"` (synthetic, no real line numbers)
- `recallCount: 1`
- `totalScore`: entry.score
- `maxScore`: entry.score
- `firstRecalledAt` / `lastRecalledAt`: now
- `queryHashes`: `[sha1("synthetic")]`
- `recallDays`: `[today]`
- `conceptTags`: entry.conceptTags

Then expose via `openclaw/plugin-sdk/memory-core` so `learning-core` can import it without breaking boundary rules.

### Change needed in `learning-core`

During Phase 2 extraction (`processTrace`), after a successful `extractSkillFromWorkflow()` call:

- If the LLM reasoning mentions a durable preference or environment fact, write it to `memory/YYYY-MM-DD.md` (following flush-plan conventions)
- Call `injectSyntheticRecall` so it enters the dreaming scoring pipeline

### Why not a separate memory approval system

The dreaming system already handles short-term → long-term promotion with weighted scoring (frequency 0.24, relevance 0.30, etc.) and promotion thresholds (score >= 0.75, recall count >= 3). Adding a parallel pipeline would create confusion and maintenance burden.

## Files to touch

- `extensions/memory-core/src/short-term-promotion.ts` — add `injectSyntheticRecall()`
- `src/plugin-sdk/memory-core.ts` — export `injectSyntheticRecall` as part of the narrow SDK facade
- `extensions/learning-core/src/observer.ts` — call `injectSyntheticRecall` after extraction

## Dependencies

- Requires coordination with memory-core owner before changing `short-term-promotion.ts`
- Must not break existing dreaming tests (`extensions/memory-core/src/short-term-promotion.test.ts`)
- Needs review of Plugin SDK boundary — `injectSyntheticRecall` is a new public seam

## Test coverage needed

- Unit test: injected entry appears in `short-term-recall.json`
- Unit test: injected entry scores correctly in `rankShortTermPromotionCandidates()`
- Integration test: existing dreaming thresholds still apply (no auto-promotion bypass)

## Agent comments

<!-- Agents: append timestamped notes below -->

2026-04-05 [tulio] — Not started. Deferred from v1 scope. Core prereq: get `injectSyntheticRecall` reviewed and approved as a new Plugin SDK seam before implementing the learning-core side.

## Bugs / blockers

- **Prerequisite**: `injectSyntheticRecall` needs to be added to `memory-core` and exposed via `plugin-sdk/memory-core`. This requires memory-core owner sign-off since it modifies the short-term recall store that dreaming depends on.
- **Boundary check needed**: verify that `learning-core` importing from `openclaw/plugin-sdk/memory-core` is acceptable under the extension boundary rules in `extensions/CLAUDE.md`.
