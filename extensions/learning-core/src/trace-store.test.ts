import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  appendTrace,
  checkDailyLimit,
  computeFingerprint,
  incrementDailyCount,
  markFingerprintCandidated,
  recordFingerprint,
} from "./trace-store.js";
import type { TraceEntry } from "./types.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "learning-core-test-"));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function makeTrace(overrides: Partial<TraceEntry> = {}): TraceEntry {
  return {
    timestamp: new Date().toISOString(),
    sessionKey: "session-abc",
    runId: "run-001",
    agentId: "agent-1",
    trigger: "user",
    toolSequence: ["memory_search", "read", "write"],
    success: true,
    durationMs: 1200,
    ...overrides,
  };
}

describe("computeFingerprint", () => {
  it("returns a stable hex string for a tool sequence", () => {
    const fp = computeFingerprint(["a", "b", "c"]);
    expect(fp).toMatch(/^[0-9a-f]{16}$/);
    expect(fp).toBe(computeFingerprint(["a", "b", "c"]));
  });

  it("produces different fingerprints for different sequences", () => {
    const fp1 = computeFingerprint(["a", "b"]);
    const fp2 = computeFingerprint(["b", "a"]);
    expect(fp1).not.toBe(fp2);
  });

  it("order matters — same tools in different order yield different fingerprints", () => {
    const fp1 = computeFingerprint(["read", "write"]);
    const fp2 = computeFingerprint(["write", "read"]);
    expect(fp1).not.toBe(fp2);
  });
});

describe("appendTrace", () => {
  it("writes a JSONL line to traces.jsonl", async () => {
    const trace = makeTrace();
    await appendTrace(tmpDir, trace, 10_000);

    const content = await fs.readFile(path.join(tmpDir, "learning", "traces.jsonl"), "utf8");
    const parsed = JSON.parse(content.trim()) as TraceEntry;
    expect(parsed.sessionKey).toBe("session-abc");
    expect(parsed.toolSequence).toEqual(["memory_search", "read", "write"]);
  });

  it("appends multiple entries", async () => {
    await appendTrace(tmpDir, makeTrace({ runId: "run-1" }), 10_000);
    await appendTrace(tmpDir, makeTrace({ runId: "run-2" }), 10_000);

    const content = await fs.readFile(path.join(tmpDir, "learning", "traces.jsonl"), "utf8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(2);
  });

  it("rotates oldest entries when maxEntries is exceeded", async () => {
    for (let i = 0; i < 5; i++) {
      await appendTrace(tmpDir, makeTrace({ runId: `run-${i}` }), 3);
    }

    const content = await fs.readFile(path.join(tmpDir, "learning", "traces.jsonl"), "utf8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(3);
    const last = JSON.parse(lines[lines.length - 1]) as TraceEntry;
    expect(last.runId).toBe("run-4");
  });
});

describe("recordFingerprint", () => {
  it("creates a new fingerprint entry on first call", async () => {
    const tools = ["memory_search", "read"];
    const entry = await recordFingerprint(tmpDir, tools, "session-1", "run-1");
    expect(entry.count).toBe(1);
    expect(entry.sessionKeys).toEqual(["session-1"]);
    expect(entry.runIds).toEqual(["run-1"]);
    expect(entry.candidateId).toBeUndefined();
  });

  it("increments count and deduplicates session keys", async () => {
    const tools = ["a", "b"];
    await recordFingerprint(tmpDir, tools, "session-1", "run-1");
    await recordFingerprint(tmpDir, tools, "session-1", "run-2");
    const entry = await recordFingerprint(tmpDir, tools, "session-2", "run-3");

    expect(entry.count).toBe(3);
    expect(entry.sessionKeys).toEqual(["session-1", "session-2"]);
    expect(entry.runIds).toHaveLength(3);
  });

  it("tracks separate fingerprints independently", async () => {
    await recordFingerprint(tmpDir, ["a", "b"], "s1", "r1");
    const entry2 = await recordFingerprint(tmpDir, ["c", "d"], "s1", "r2");
    expect(entry2.count).toBe(1);
    expect(entry2.toolSequence).toEqual(["c", "d"]);
  });
});

describe("markFingerprintCandidated", () => {
  it("sets candidateId on the fingerprint entry", async () => {
    const tools = ["x", "y"];
    await recordFingerprint(tmpDir, tools, "s1", "r1");
    const fp = computeFingerprint(tools);
    await markFingerprintCandidated(tmpDir, fp, "candidate-abc");

    // Re-read by recording again and checking the return
    const entry = await recordFingerprint(tmpDir, tools, "s2", "r2");
    expect(entry.candidateId).toBe("candidate-abc");
  });
});

describe("checkDailyLimit / incrementDailyCount", () => {
  it("allows generation when under limit", async () => {
    const ok = await checkDailyLimit(tmpDir, 5);
    expect(ok).toBe(true);
  });

  it("blocks generation when limit is reached", async () => {
    for (let i = 0; i < 3; i++) {
      await incrementDailyCount(tmpDir);
    }
    const ok = await checkDailyLimit(tmpDir, 3);
    expect(ok).toBe(false);
  });

  it("does not block when under limit", async () => {
    await incrementDailyCount(tmpDir);
    const ok = await checkDailyLimit(tmpDir, 5);
    expect(ok).toBe(true);
  });
});
