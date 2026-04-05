# Phase1-T1.1 — Tool-sequence trace store

## Status

`done`

## Objective

Build an append-only JSONL store that records what tools the agent calls per turn. No LLM calls, no approval — pure data collection.

## Acceptance criteria

- [ ] `after_tool_call` hook accumulates tool names per runId into an in-memory buffer
- [ ] `agent_end` hook flushes the buffer as a `TraceEntry` to `learning/traces.jsonl`
- [ ] Only user-triggered, successful turns with 2+ tool calls are recorded
- [ ] Heartbeat, cron, and memory-flush turns are filtered out
- [ ] File rotation trims oldest entries when `maxTraceEntries` is exceeded
- [ ] `learning/` directory is created automatically if it does not exist

## Implementation notes

- `TraceEntry` shape: `{ timestamp, sessionKey, runId, agentId, trigger, toolSequence, success, durationMs }`
- Uses `after_tool_call` to accumulate and `agent_end` to flush — because `PluginHookToolContext` does not carry `trigger`, only `PluginHookAgentContext` does
- Rotation: read → trim oldest → atomic write-rename (to avoid partial writes)
- Source: `extensions/learning-core/src/trace-store.ts` — `appendTrace()`

## Files touched

- `src/trace-store.ts` — `appendTrace()`, `readTracesForFingerprint()`
- `src/observer.ts` — `after_tool_call` and `agent_end` handlers
- `src/types.ts` — `TraceEntry`

## Test coverage

- `src/trace-store.test.ts` — `appendTrace` writes JSONL, appends multiple entries, rotates correctly

## Agent comments

<!-- Agents: append timestamped notes below when working on or handing off this task -->

2026-04-05 [tulio] — Implemented. `PluginHookToolContext` lacks `trigger` so we cannot filter by trigger in `after_tool_call`. Buffer is accumulated unconditionally and the filter is applied in `agent_end` where `PluginHookAgentContext` is available.

## Bugs / blockers

<!-- Report bugs here before reassigning to a dev -->

_None._
