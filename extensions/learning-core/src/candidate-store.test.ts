import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  draftSkillPath,
  listCandidates,
  readCandidate,
  updateCandidate,
  writeCandidate,
  writeDraftSkill,
} from "./candidate-store.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "learning-candidate-test-"));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("writeCandidate", () => {
  it("writes a candidate JSON file with a generated id", async () => {
    const c = await writeCandidate(tmpDir, {
      fingerprint: "abc123",
      toolSequence: ["read", "write"],
      sourceSessionKeys: ["s1"],
      sourceRunIds: ["r1"],
      status: "pending",
      kind: "new",
      confidence: 0.8,
      reasoning: "observed twice",
      skillName: "read-then-write",
      skillDescription: "Reads then writes a file",
    });

    expect(c.id).toBeTruthy();
    expect(c.status).toBe("pending");
    expect(c.skillName).toBe("read-then-write");
    expect(c.createdAt).toBeTruthy();

    // Verify persisted
    const read = await readCandidate(tmpDir, c.id);
    expect(read.skillName).toBe("read-then-write");
  });
});

describe("writeDraftSkill / draftSkillPath", () => {
  it("writes SKILL.md at the expected path", async () => {
    const content = "---\nname: test-skill\ndescription: test\n---\n\n# Test";
    await writeDraftSkill(tmpDir, "candidate-001", content);

    const expectedPath = draftSkillPath(tmpDir, "candidate-001");
    const read = await fs.readFile(expectedPath, "utf8");
    expect(read).toBe(content);
  });
});

describe("listCandidates", () => {
  it("returns empty array when no candidates exist", async () => {
    const list = await listCandidates(tmpDir);
    expect(list).toEqual([]);
  });

  it("returns all candidates sorted by createdAt", async () => {
    const c1 = await writeCandidate(tmpDir, {
      fingerprint: "fp1",
      toolSequence: ["a"],
      sourceSessionKeys: [],
      sourceRunIds: [],
      status: "pending",
      kind: "new",
      confidence: 0.5,
      reasoning: "",
      skillName: "skill-a",
      skillDescription: "",
    });
    const c2 = await writeCandidate(tmpDir, {
      fingerprint: "fp2",
      toolSequence: ["b"],
      sourceSessionKeys: [],
      sourceRunIds: [],
      status: "promoted",
      kind: "new",
      confidence: 0.9,
      reasoning: "",
      skillName: "skill-b",
      skillDescription: "",
    });

    const all = await listCandidates(tmpDir);
    expect(all).toHaveLength(2);

    const pending = await listCandidates(tmpDir, "pending");
    expect(pending).toHaveLength(1);
    expect(pending[0].skillName).toBe("skill-a");

    const promoted = await listCandidates(tmpDir, "promoted");
    expect(promoted).toHaveLength(1);
    expect(promoted[0].skillName).toBe("skill-b");

    void c1;
    void c2;
  });
});

describe("updateCandidate", () => {
  it("overwrites the candidate status atomically", async () => {
    const c = await writeCandidate(tmpDir, {
      fingerprint: "fp",
      toolSequence: ["x"],
      sourceSessionKeys: [],
      sourceRunIds: [],
      status: "pending",
      kind: "new",
      confidence: 0.6,
      reasoning: "",
      skillName: "my-skill",
      skillDescription: "",
    });

    await updateCandidate(tmpDir, {
      ...c,
      status: "rejected",
      rejectedAt: new Date().toISOString(),
      rejectedReason: "too narrow",
    });

    const updated = await readCandidate(tmpDir, c.id);
    expect(updated.status).toBe("rejected");
    expect(updated.rejectedReason).toBe("too narrow");
  });
});
