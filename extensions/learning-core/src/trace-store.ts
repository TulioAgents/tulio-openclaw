import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { FingerprintEntry, FingerprintStore, LearningConfig, TraceEntry } from "./types.js";

const TRACES_RELATIVE_PATH = path.join("learning", "traces.jsonl");
const FINGERPRINTS_RELATIVE_PATH = path.join("learning", "fingerprints.json");
const LOCK_RELATIVE_PATH = path.join("learning", ".fingerprints.lock");
const LOCK_WAIT_TIMEOUT_MS = 10_000;
const LOCK_STALE_MS = 60_000;
const LOCK_RETRY_DELAY_MS = 40;

/** Compute a stable fingerprint hash for an ordered tool sequence. */
export function computeFingerprint(toolSequence: string[]): string {
  return createHash("sha1").update(toolSequence.join("\x00")).digest("hex").slice(0, 16);
}

async function ensureLearningDir(workspaceDir: string): Promise<void> {
  await fs.mkdir(path.join(workspaceDir, "learning", "candidates"), { recursive: true });
  await fs.mkdir(path.join(workspaceDir, "learning", "skills"), { recursive: true });
}

// ── File lock helpers (mirrors short-term-promotion.ts pattern) ──────────────

async function acquireLock(lockPath: string): Promise<void> {
  const deadline = Date.now() + LOCK_WAIT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      await fs.writeFile(lockPath, String(Date.now()), { flag: "wx" });
      return;
    } catch {
      // Lock exists — check if stale
      try {
        const content = await fs.readFile(lockPath, "utf8");
        const age = Date.now() - Number(content);
        if (age > LOCK_STALE_MS) {
          await fs.unlink(lockPath).catch(() => undefined);
        }
      } catch {
        // lock file may have been removed concurrently
      }
      await new Promise((r) => setTimeout(r, LOCK_RETRY_DELAY_MS));
    }
  }
}

async function releaseLock(lockPath: string): Promise<void> {
  await fs.unlink(lockPath).catch(() => undefined);
}

// ── Trace append ─────────────────────────────────────────────────────────────

/** Append a trace entry to traces.jsonl. Rotates oldest entries when over limit. */
export async function appendTrace(
  workspaceDir: string,
  entry: TraceEntry,
  maxEntries: number,
): Promise<void> {
  await ensureLearningDir(workspaceDir);
  const tracesPath = path.join(workspaceDir, TRACES_RELATIVE_PATH);
  const line = JSON.stringify(entry) + "\n";

  await fs.appendFile(tracesPath, line, "utf8");

  // Rotate if over limit (read, trim, rewrite)
  try {
    const raw = await fs.readFile(tracesPath, "utf8");
    const lines = raw.split("\n").filter(Boolean);
    if (lines.length > maxEntries) {
      const trimmed = lines.slice(lines.length - maxEntries).join("\n") + "\n";
      const tmp = tracesPath + ".tmp";
      await fs.writeFile(tmp, trimmed, "utf8");
      await fs.rename(tmp, tracesPath);
    }
  } catch {
    // Non-critical — rotation failure does not block the learning pipeline
  }
}

/** Read trace entries matching a specific fingerprint (last N lines scanned). */
export async function readTracesForFingerprint(
  workspaceDir: string,
  fingerprint: string,
  maxScan = 5_000,
): Promise<TraceEntry[]> {
  const tracesPath = path.join(workspaceDir, TRACES_RELATIVE_PATH);
  try {
    const raw = await fs.readFile(tracesPath, "utf8");
    const lines = raw.split("\n").filter(Boolean);
    const tail = lines.slice(-maxScan);
    const results: TraceEntry[] = [];
    for (const line of tail) {
      try {
        const entry = JSON.parse(line) as TraceEntry;
        if (computeFingerprint(entry.toolSequence) === fingerprint) {
          results.push(entry);
        }
      } catch {
        // Malformed line — skip
      }
    }
    return results;
  } catch {
    return [];
  }
}

// ── Fingerprint store ─────────────────────────────────────────────────────────

export async function readFingerprintStore(workspaceDir: string): Promise<FingerprintStore> {
  const p = path.join(workspaceDir, FINGERPRINTS_RELATIVE_PATH);
  try {
    const raw = await fs.readFile(p, "utf8");
    return JSON.parse(raw) as FingerprintStore;
  } catch {
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      dailyCandidateCounts: {},
      entries: {},
    };
  }
}

async function writeFingerprintStore(workspaceDir: string, store: FingerprintStore): Promise<void> {
  const p = path.join(workspaceDir, FINGERPRINTS_RELATIVE_PATH);
  const tmp = p + ".tmp";
  store.updatedAt = new Date().toISOString();
  await fs.writeFile(tmp, JSON.stringify(store, null, 2), "utf8");
  await fs.rename(tmp, p);
}

/**
 * Record a new occurrence of a tool sequence.
 * Returns the updated FingerprintEntry so callers can decide whether to trigger extraction.
 */
export async function recordFingerprint(
  workspaceDir: string,
  toolSequence: string[],
  sessionKey: string,
  runId: string,
): Promise<FingerprintEntry> {
  await ensureLearningDir(workspaceDir);
  const lockPath = path.join(workspaceDir, LOCK_RELATIVE_PATH);
  await acquireLock(lockPath);
  try {
    const store = await readFingerprintStore(workspaceDir);
    const fingerprint = computeFingerprint(toolSequence);
    const now = new Date().toISOString();

    let entry = store.entries[fingerprint];
    if (!entry) {
      entry = {
        fingerprint,
        toolSequence,
        count: 0,
        sessionKeys: [],
        runIds: [],
        firstSeenAt: now,
        lastSeenAt: now,
      };
      store.entries[fingerprint] = entry;
    }

    entry.count += 1;
    entry.lastSeenAt = now;
    if (!entry.sessionKeys.includes(sessionKey)) {
      entry.sessionKeys.push(sessionKey);
    }
    if (!entry.runIds.includes(runId)) {
      entry.runIds.push(runId);
    }

    await writeFingerprintStore(workspaceDir, store);
    return entry;
  } finally {
    await releaseLock(lockPath);
  }
}

/** Mark a fingerprint as having a candidate so we don't generate duplicates. */
export async function markFingerprintCandidated(
  workspaceDir: string,
  fingerprint: string,
  candidateId: string,
): Promise<void> {
  const lockPath = path.join(workspaceDir, LOCK_RELATIVE_PATH);
  await acquireLock(lockPath);
  try {
    const store = await readFingerprintStore(workspaceDir);
    const entry = store.entries[fingerprint];
    if (entry) {
      entry.candidateId = candidateId;
    }
    await writeFingerprintStore(workspaceDir, store);
  } finally {
    await releaseLock(lockPath);
  }
}

/**
 * Mark a fingerprint as promoted and record the count at that moment.
 * This establishes the baseline for detecting revision eligibility later.
 */
export async function markFingerprintPromoted(
  workspaceDir: string,
  fingerprint: string,
  currentCount: number,
): Promise<void> {
  const lockPath = path.join(workspaceDir, LOCK_RELATIVE_PATH);
  await acquireLock(lockPath);
  try {
    const store = await readFingerprintStore(workspaceDir);
    const entry = store.entries[fingerprint];
    if (entry) {
      entry.countAtPromotion = currentCount;
    }
    await writeFingerprintStore(workspaceDir, store);
  } finally {
    await releaseLock(lockPath);
  }
}

/** Mark a fingerprint as having a pending revision candidate. */
export async function markFingerprintRevision(
  workspaceDir: string,
  fingerprint: string,
  revisionCandidateId: string,
): Promise<void> {
  const lockPath = path.join(workspaceDir, LOCK_RELATIVE_PATH);
  await acquireLock(lockPath);
  try {
    const store = await readFingerprintStore(workspaceDir);
    const entry = store.entries[fingerprint];
    if (entry) {
      entry.revisionCandidateId = revisionCandidateId;
      // Reset countAtPromotion so another revision can be triggered later
      entry.countAtPromotion = entry.count;
    }
    await writeFingerprintStore(workspaceDir, store);
  } finally {
    await releaseLock(lockPath);
  }
}

/** Check whether today's candidate count is within the daily limit. */
export async function checkDailyLimit(workspaceDir: string, maxPerDay: number): Promise<boolean> {
  const store = await readFingerprintStore(workspaceDir);
  const today = new Date().toISOString().slice(0, 10);
  const count = store.dailyCandidateCounts[today] ?? 0;
  return count < maxPerDay;
}

/** Increment the daily candidate counter. */
export async function incrementDailyCount(workspaceDir: string): Promise<void> {
  await ensureLearningDir(workspaceDir);
  const lockPath = path.join(workspaceDir, LOCK_RELATIVE_PATH);
  await acquireLock(lockPath);
  try {
    const store = await readFingerprintStore(workspaceDir);
    const today = new Date().toISOString().slice(0, 10);
    store.dailyCandidateCounts[today] = (store.dailyCandidateCounts[today] ?? 0) + 1;
    await writeFingerprintStore(workspaceDir, store);
  } finally {
    await releaseLock(lockPath);
  }
}

/** Resolve the LearningConfig from plugin entry config, applying defaults. */
export function resolveLearningConfig(raw: unknown): LearningConfig {
  const cfg = (raw ?? {}) as Record<string, unknown>;
  const fp = (cfg["fingerprint"] ?? {}) as Record<string, unknown>;
  const limits = (cfg["limits"] ?? {}) as Record<string, unknown>;
  const triggers = (cfg["triggers"] ?? {}) as Record<string, unknown>;

  return {
    enabled: Boolean(cfg["enabled"] ?? false),
    mode: (cfg["mode"] as LearningConfig["mode"]) ?? "suggest",
    fingerprint: {
      minOccurrences: Number(fp["minOccurrences"] ?? 3),
      minSessions: Number(fp["minSessions"] ?? 2),
    },
    limits: {
      maxCandidatesPerDay: Number(limits["maxCandidatesPerDay"] ?? 5),
      maxExtractionsPerSession: Number(limits["maxExtractionsPerSession"] ?? 1),
      maxTraceEntries: Number(limits["maxTraceEntries"] ?? 10_000),
    },
    triggers: {
      userSessions: Boolean(triggers["userSessions"] ?? true),
      cronSessions: Boolean(triggers["cronSessions"] ?? false),
      heartbeatSessions: Boolean(triggers["heartbeatSessions"] ?? false),
    },
  };
}

export type { LearningConfig };
