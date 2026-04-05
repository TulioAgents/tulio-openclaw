# Phase2-T2.1 — LLM extraction trigger and prompt

## Status

`done`

## Objective

When a fingerprint crosses the occurrence threshold (or a revision delta), fire a background LLM call using the agent's configured model to synthesize a draft skill from observed patterns.

## Acceptance criteria

- [ ] Extraction only fires when thresholds are met (count, sessions, no existing candidate)
- [ ] Revision extraction fires when `count - countAtPromotion >= 5` and no pending revision
- [ ] Both paths are fire-and-forget — never block or surface errors to the agent turn
- [ ] Per-session extraction limit (`maxExtractionsPerSession`) is enforced
- [ ] Daily rate limit (`maxCandidatesPerDay`) is enforced
- [ ] For new skills: prompt includes tool sequence + recent trace summaries
- [ ] For revisions: prompt additionally includes the existing SKILL.md content (truncated to 3000 chars)
- [ ] Model responds with structured JSON `{ name, description, body, confidence, reasoning }`
- [ ] Results with `confidence < 0.4` are discarded
- [ ] 60-second timeout on the LLM call
- [ ] Uses `prepareSimpleCompletionModelForAgent` + `completeWithPreparedSimpleCompletionModel` from `openclaw/plugin-sdk/agent-runtime` (same pattern as Discord thread title generator)

## Implementation notes

- `extractSkillFromWorkflow()` in `src/skill-extractor.ts` — accepts optional `existingSkillContent` to switch between new/revision mode
- `buildExtractionPrompt()` handles both modes; revision prompt instructs "write the complete updated procedure" not a diff
- For revision: read existing skill from `path.join(workspaceDir, entry.promotedTo)` — if file missing, fall back to new extraction silently
- `EXTRACTION_MAX_TOKENS = 2048`, `EXTRACTION_TEMPERATURE = 0.2`
- Model is whatever the agent uses — no separate model config in v1
- JSON fence stripping: if model wraps response in ```json, strip before parse

## Files touched

- `src/skill-extractor.ts` — `extractSkillFromWorkflow()`, `buildExtractionPrompt()`, `parseExtractionResponse()`
- `src/observer.ts` — extraction trigger logic, revision eligibility check

## Test coverage

- No unit tests for extraction LLM call itself (mocked in integration context)
- Observer trigger logic is covered implicitly by trace-store tests

## Agent comments

<!-- Agents: append timestamped notes below -->

2026-04-05 [tulio] — Implemented. The `dispatchReplyFromConfigWithSettledDispatcher` approach (used by MS Teams feedback reflection) requires channel-specific plumbing. Switched to `prepareSimpleCompletionModelForAgent` which is channel-agnostic and already used by Discord thread title generation. Much simpler.

2026-04-05 [tulio] — Revision extraction: `listCandidates()` is called to find the promoted candidate for a fingerprint. This is O(n candidates) per `agent_end`. Acceptable for small workspaces; if candidate list grows large this should be indexed.

## Bugs / blockers

- **Potential perf issue**: `listCandidates()` scans all candidate JSON files on every `agent_end` to check for promoted status. For v1 workspaces this is fine (< 100 candidates typical), but should be addressed if usage scales. Track in Phase4-T4.1 or as a follow-up.
