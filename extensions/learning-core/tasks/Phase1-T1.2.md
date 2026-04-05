# Phase1-T1.2 — Fingerprint counting and rate limiting

## Status

`done`

## Objective

Hash each tool sequence into a stable fingerprint and persist per-fingerprint occurrence counts, session references, and daily rate-limit counters to `learning/fingerprints.json`.

## Acceptance criteria

- [ ] `computeFingerprint(toolSequence)` returns a stable 16-char hex string; order matters
- [ ] Identical sequences → same fingerprint; different order → different fingerprint
- [ ] `recordFingerprint()` increments count, deduplicates sessionKeys, appends runIds
- [ ] `markFingerprintCandidated()` sets `candidateId` so no duplicate extraction fires
- [ ] `markFingerprintPromoted()` records `countAtPromotion` as baseline for revision detection
- [ ] `markFingerprintRevision()` sets `revisionCandidateId` and resets `countAtPromotion`
- [ ] `checkDailyLimit()` returns false when daily count >= maxCandidatesPerDay
- [ ] `incrementDailyCount()` increments the ISO-date keyed counter in the store
- [ ] All writes use a file lock (acquire → read → mutate → atomic write-rename → release)
- [ ] Stale locks (> 60s) are cleaned up automatically

## Implementation notes

- Fingerprint: `sha1(toolSequence.join("\x00")).slice(0, 16)`
- Lock path: `learning/.fingerprints.lock`, content = timestamp string for staleness detection
- Store path: `learning/fingerprints.json`
- `dailyCandidateCounts` keyed by `YYYY-MM-DD` ISO date string
- Lock retry: 40ms intervals up to 10s timeout before giving up
- Source: `extensions/learning-core/src/trace-store.ts`

## Files touched

- `src/trace-store.ts` — all fingerprint functions
- `src/types.ts` — `FingerprintEntry`, `FingerprintStore`

## Test coverage

- `src/trace-store.test.ts` — fingerprint determinism, recordFingerprint deduplication, markFingerprintCandidated, daily limit/increment

## Agent comments

<!-- Agents: append timestamped notes below when working on or handing off this task -->

2026-04-05 [tulio] — Implemented. `readFingerprintStore` initially private; exposed as export after CLI needed it for `markFingerprintPromoted` during approve flow. `incrementDailyCount` initially missed `ensureLearningDir()` call — fixed after first test run.

## Bugs / blockers

_None._
