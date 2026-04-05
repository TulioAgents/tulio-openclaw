import fs from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import {
  listCandidates,
  readCandidate,
  draftSkillPath,
  updateCandidate,
} from "./candidate-store.js";

/** Register the `openclaw learning` CLI namespace. */
export function registerLearningCli(program: Command): void {
  const learning = program
    .command("learning")
    .description("Review and promote auto-generated skill candidates");

  // ── list ──────────────────────────────────────────────────────────────────
  learning
    .command("list")
    .description("List skill candidates")
    .option("--all", "Show all candidates including promoted and rejected", false)
    .option("--workspace <dir>", "Workspace directory (defaults to cwd)")
    .action(async (opts: { all: boolean; workspace?: string }) => {
      const workspaceDir = resolveWorkspaceDir(opts.workspace);
      const filter = opts.all ? undefined : ("pending" as const);
      const candidates = await listCandidates(workspaceDir, filter);

      if (candidates.length === 0) {
        console.log(opts.all ? "No candidates found." : "No pending candidates.");
        return;
      }

      console.log(`\n  ${candidates.length} candidate(s):\n`);
      for (const c of candidates) {
        const badge = statusBadge(c.status);
        const kindTag = c.kind === "revision" ? " [revision]" : "";
        const conf = `${Math.round(c.confidence * 100)}%`;
        console.log(`  ${badge}${kindTag} ${c.skillName}  (${conf} confidence)`);
        console.log(`      id: ${c.id}`);
        console.log(`      ${c.skillDescription}`);
        if (c.kind === "revision" && c.revisesSkillPath) {
          console.log(`      revises: ${c.revisesSkillPath}`);
        }
        console.log(`      created: ${c.createdAt.slice(0, 16)}`);
        console.log();
      }
    });

  // ── show ──────────────────────────────────────────────────────────────────
  learning
    .command("show <id>")
    .description("Show a candidate's details and draft SKILL.md")
    .option("--workspace <dir>", "Workspace directory (defaults to cwd)")
    .action(async (id: string, opts: { workspace?: string }) => {
      const workspaceDir = resolveWorkspaceDir(opts.workspace);
      let candidate;
      try {
        candidate = await readCandidate(workspaceDir, id);
      } catch {
        console.error(`Candidate not found: ${id}`);
        process.exit(1);
      }

      console.log(`\n  Skill candidate: ${candidate.skillName}`);
      console.log(`  Status:       ${statusBadge(candidate.status)}`);
      console.log(`  Kind:         ${candidate.kind ?? "new"}`);
      console.log(`  Confidence:   ${Math.round(candidate.confidence * 100)}%`);
      console.log(`  Description:  ${candidate.skillDescription}`);
      console.log(`  Fingerprint:  ${candidate.fingerprint}`);
      console.log(`  Tools:        ${candidate.toolSequence.join(" → ")}`);
      console.log(`  Sessions:     ${candidate.sourceSessionKeys.length}`);
      console.log(`  Reasoning:    ${candidate.reasoning}`);
      console.log(`  Created:      ${candidate.createdAt}`);

      if (candidate.kind === "revision" && candidate.revisesSkillPath) {
        console.log(`  Revises:      ${candidate.revisesSkillPath}`);
      }
      if (candidate.status === "rejected" && candidate.rejectedReason) {
        console.log(`  Rejected:     ${candidate.rejectedReason}`);
      }
      if (candidate.status === "promoted" && candidate.promotedTo) {
        console.log(`  Promoted to:  ${candidate.promotedTo}`);
      }

      const draftPath = draftSkillPath(workspaceDir, candidate.id);
      try {
        const content = await fs.readFile(draftPath, "utf8");
        console.log(`\n  Draft SKILL.md (${draftPath}):\n`);
        console.log(
          content
            .split("\n")
            .map((l) => `  ${l}`)
            .join("\n"),
        );
      } catch {
        console.log("\n  (Draft SKILL.md not found)");
      }
    });

  // ── approve ───────────────────────────────────────────────────────────────
  learning
    .command("approve <id>")
    .description("Promote a pending skill candidate to the workspace skills directory")
    .option("--workspace <dir>", "Workspace directory (defaults to cwd)")
    .option("--force", "Overwrite an existing skill with the same name", false)
    .action(async (id: string, opts: { workspace?: string; force: boolean }) => {
      const workspaceDir = resolveWorkspaceDir(opts.workspace);

      let candidate;
      try {
        candidate = await readCandidate(workspaceDir, id);
      } catch {
        console.error(`Candidate not found: ${id}`);
        process.exit(1);
      }

      if (candidate.status !== "pending") {
        console.error(`Cannot approve: candidate is already ${candidate.status}.`);
        process.exit(1);
      }

      const draftPath = draftSkillPath(workspaceDir, candidate.id);
      let draftContent: string;
      try {
        draftContent = await fs.readFile(draftPath, "utf8");
      } catch {
        console.error(`Draft SKILL.md not found at ${draftPath}`);
        process.exit(1);
      }

      // For revisions, target is the existing skill path; for new, use skills/<name>/SKILL.md
      const isRevision = candidate.kind === "revision" && candidate.revisesSkillPath;
      const workspaceRelative = isRevision
        ? candidate.revisesSkillPath!
        : path.join("skills", candidate.skillName, "SKILL.md");
      const targetPath = path.join(workspaceDir, workspaceRelative);
      const targetDir = path.dirname(targetPath);

      // Collision check — only applies to new skills, not revisions
      if (!isRevision) {
        let targetExists = false;
        try {
          await fs.access(targetPath);
          targetExists = true;
        } catch {
          // Does not exist — fine
        }

        if (targetExists && !opts.force) {
          console.error(
            `Skill "${candidate.skillName}" already exists at ${targetPath}.\nUse --force to replace it.`,
          );
          process.exit(1);
        }
      }

      await fs.mkdir(targetDir, { recursive: true });
      await fs.writeFile(targetPath, draftContent, "utf8");

      // Update candidate status
      const now = new Date().toISOString();
      await updateCandidate(workspaceDir, {
        ...candidate,
        status: "promoted",
        promotedAt: now,
        promotedTo: workspaceRelative,
      });

      // Record the promotion baseline so the observer can detect revision opportunities later
      try {
        const { markFingerprintPromoted, readFingerprintStore } = await import("./trace-store.js");
        const store = await (
          readFingerprintStore as (
            d: string,
          ) => Promise<{ entries: Record<string, { count: number }> }>
        )(workspaceDir);
        const currentCount = store.entries[candidate.fingerprint]?.count ?? 0;
        await markFingerprintPromoted(workspaceDir, candidate.fingerprint, currentCount);
      } catch {
        // Non-critical
      }

      const action = isRevision ? "updated" : "promoted";
      console.log(`\n  Skill "${candidate.skillName}" ${action} at ${targetPath}`);
      console.log("  The skill will appear in available_skills on the next agent turn.\n");
    });

  // ── reject ────────────────────────────────────────────────────────────────
  learning
    .command("reject <id>")
    .description("Reject a pending skill candidate")
    .option("--workspace <dir>", "Workspace directory (defaults to cwd)")
    .option("--reason <reason>", "Optional reason for rejection")
    .action(async (id: string, opts: { workspace?: string; reason?: string }) => {
      const workspaceDir = resolveWorkspaceDir(opts.workspace);

      let candidate;
      try {
        candidate = await readCandidate(workspaceDir, id);
      } catch {
        console.error(`Candidate not found: ${id}`);
        process.exit(1);
      }

      if (candidate.status !== "pending") {
        console.error(`Cannot reject: candidate is already ${candidate.status}.`);
        process.exit(1);
      }

      await updateCandidate(workspaceDir, {
        ...candidate,
        status: "rejected",
        rejectedAt: new Date().toISOString(),
        rejectedReason: opts.reason,
      });

      console.log(`\n  Candidate "${candidate.skillName}" (${candidate.id}) rejected.\n`);
    });

  // ── traces ────────────────────────────────────────────────────────────────
  learning
    .command("traces")
    .description("Show recent tool-sequence traces")
    .option("--workspace <dir>", "Workspace directory (defaults to cwd)")
    .option("--limit <n>", "Number of recent traces to show", "20")
    .action(async (opts: { workspace?: string; limit: string }) => {
      const workspaceDir = resolveWorkspaceDir(opts.workspace);
      const tracesPath = path.join(workspaceDir, "learning", "traces.jsonl");
      const limit = Math.max(1, parseInt(opts.limit, 10) || 20);

      let lines: string[] = [];
      try {
        const raw = await fs.readFile(tracesPath, "utf8");
        lines = raw.split("\n").filter(Boolean);
      } catch {
        console.log("No traces found. The learning plugin may not be enabled yet.");
        return;
      }

      const recent = lines.slice(-limit);
      console.log(`\n  ${recent.length} recent trace(s) (of ${lines.length} total):\n`);
      for (const line of recent) {
        try {
          const t = JSON.parse(line) as {
            timestamp: string;
            toolSequence: string[];
            sessionKey: string;
            trigger: string;
            success: boolean;
          };
          const ts = t.timestamp.slice(0, 16);
          const session = t.sessionKey.slice(-8);
          const ok = t.success ? "✓" : "✗";
          console.log(`  ${ok} [${ts}] ${t.trigger} (${session}): ${t.toolSequence.join(" → ")}`);
        } catch {
          // Skip malformed lines
        }
      }
      console.log();
    });
}

function resolveWorkspaceDir(override?: string): string {
  return override ?? process.cwd();
}

function statusBadge(status: string): string {
  if (status === "pending") return "[pending]";
  if (status === "promoted") return "[promoted]";
  if (status === "rejected") return "[rejected]";
  return `[${status}]`;
}
