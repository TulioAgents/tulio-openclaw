import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { SkillCandidate } from "./types.js";

const CANDIDATES_RELATIVE_DIR = path.join("learning", "candidates");
const DRAFT_SKILLS_RELATIVE_DIR = path.join("learning", "skills");

function candidatePath(workspaceDir: string, id: string): string {
  return path.join(workspaceDir, CANDIDATES_RELATIVE_DIR, `${id}.json`);
}

function draftSkillDir(workspaceDir: string, id: string): string {
  return path.join(workspaceDir, DRAFT_SKILLS_RELATIVE_DIR, id);
}

export function draftSkillPath(workspaceDir: string, id: string): string {
  return path.join(draftSkillDir(workspaceDir, id), "SKILL.md");
}

/** Write a new candidate to disk. Returns the candidate with its assigned id. */
export async function writeCandidate(
  workspaceDir: string,
  candidate: Omit<SkillCandidate, "id" | "createdAt">,
): Promise<SkillCandidate> {
  const id = randomUUID();
  const full: SkillCandidate = {
    ...candidate,
    id,
    createdAt: new Date().toISOString(),
  };
  const p = candidatePath(workspaceDir, id);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(full, null, 2), "utf8");
  return full;
}

/** Write a draft SKILL.md for a candidate. */
export async function writeDraftSkill(
  workspaceDir: string,
  candidateId: string,
  skillContent: string,
): Promise<void> {
  const dir = draftSkillDir(workspaceDir, candidateId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "SKILL.md"), skillContent, "utf8");
}

/** Read a candidate by id. Throws if not found. */
export async function readCandidate(workspaceDir: string, id: string): Promise<SkillCandidate> {
  const raw = await fs.readFile(candidatePath(workspaceDir, id), "utf8");
  return JSON.parse(raw) as SkillCandidate;
}

/** Update a candidate in place (atomic write). */
export async function updateCandidate(
  workspaceDir: string,
  candidate: SkillCandidate,
): Promise<void> {
  const p = candidatePath(workspaceDir, candidate.id);
  const tmp = p + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(candidate, null, 2), "utf8");
  await fs.rename(tmp, p);
}

/** List all candidates, optionally filtered by status. */
export async function listCandidates(
  workspaceDir: string,
  filter?: SkillCandidate["status"],
): Promise<SkillCandidate[]> {
  const dir = path.join(workspaceDir, CANDIDATES_RELATIVE_DIR);
  try {
    const entries = await fs.readdir(dir);
    const candidates: SkillCandidate[] = [];
    for (const entry of entries) {
      if (!entry.endsWith(".json")) continue;
      try {
        const raw = await fs.readFile(path.join(dir, entry), "utf8");
        const c = JSON.parse(raw) as SkillCandidate;
        if (!filter || c.status === filter) {
          candidates.push(c);
        }
      } catch {
        // Malformed candidate — skip
      }
    }
    candidates.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return candidates;
  } catch {
    return [];
  }
}
