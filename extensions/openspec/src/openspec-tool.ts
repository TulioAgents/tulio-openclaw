import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Type } from "@sinclair/typebox";
import { z } from "openclaw/plugin-sdk/zod";
import { parse as parseYaml } from "yaml";
import { stringify as stringifyYaml } from "yaml";
import type { OpenClawPluginApi } from "../runtime-api.js";
import type {
  OpenSpecChange,
  OpenSpecPhase,
  OpenSpecTask,
  TaskStatus,
  TaskPriority,
  TaskTracker,
  TaskTrackerEntry,
} from "./openspec-types.js";

// Zod schema for input validation at the tool boundary
const OpenSpecChangeInputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    projectCode: z.string().min(1),
    changeId: z.string().min(1),
    title: z.string().min(1),
    phase: z
      .enum([
        "idea",
        "proposal",
        "plan",
        "design",
        "implementation",
        "verification",
        "deployment",
        "done",
        "blocked",
      ])
      .optional(),
  }),
  z.object({
    action: z.literal("transition"),
    changeId: z.string().min(1),
    toPhase: z.enum([
      "idea",
      "proposal",
      "plan",
      "design",
      "implementation",
      "verification",
      "deployment",
      "done",
      "blocked",
    ]),
  }),
  z.object({
    action: z.literal("assign"),
    changeId: z.string().min(1),
    role: z.string().min(1),
    sessionKey: z.string().min(1),
  }),
  z.object({
    action: z.literal("block"),
    changeId: z.string().min(1),
    blocker: z.string().min(1),
  }),
  z.object({
    action: z.literal("unblock"),
    changeId: z.string().min(1),
    blocker: z.string().min(1),
  }),
  z.object({
    action: z.literal("handoff"),
    changeId: z.string().min(1),
    from: z.string().min(1),
    to: z.string().min(1),
    summary: z.string().min(1),
    nextStep: z.string().min(1),
  }),
  z.object({
    action: z.literal("status"),
    changeId: z.string().min(1),
  }),
]);

type OpenSpecChangeInput = z.infer<typeof OpenSpecChangeInputSchema>;

function resolveWorkspaceDir(api: OpenClawPluginApi): string {
  return (api.config?.agents?.defaults?.workspace ?? process.cwd()).trim();
}

function resolveProjectMapPath(api: OpenClawPluginApi): string {
  const raw =
    typeof api.pluginConfig === "object" &&
    api.pluginConfig !== null &&
    "projectMapPath" in api.pluginConfig &&
    typeof api.pluginConfig.projectMapPath === "string"
      ? api.pluginConfig.projectMapPath
      : "~/coding-projects/project-map.yaml";
  return expandTilde(raw);
}

async function resolveWorkspaceDirForProject(
  api: OpenClawPluginApi,
  projectCode: string,
): Promise<string | null> {
  // Read project-map.yaml directly — avoids a circular import with projects-tool.ts
  // (which imports resolveChangesDir and readStatusYaml from this file).
  const mapPath = resolveProjectMapPath(api);
  try {
    const raw = await fs.readFile(mapPath, "utf8");
    const parsed = parseYaml(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || !("projects" in parsed)) {
      return null;
    }
    const projects = (parsed as { projects?: unknown[] }).projects;
    if (!Array.isArray(projects)) {
      return null;
    }
    const entry = projects.find((e) => {
      if (!e || typeof e !== "object") {
        return false;
      }
      const r = e as Record<string, unknown>;
      const code = typeof r.projectCode === "string" ? r.projectCode : "";
      const name = typeof r.name === "string" ? r.name : "";
      return code === projectCode || name === projectCode;
    }) as Record<string, unknown> | undefined;
    if (!entry) {
      return null;
    }
    const location =
      typeof entry.location === "string"
        ? entry.location
        : typeof entry.path === "string"
          ? entry.path
          : "";
    return location ? expandTilde(location) : null;
  } catch {
    return null;
  }
}

/**
 * Find which project workspace contains a given changeId by scanning all projects
 * in the project map. Used to route non-"create" actions to the right project dir.
 */
async function resolveWorkspaceDirForChange(
  api: OpenClawPluginApi,
  changeId: string,
): Promise<string | null> {
  const mapPath = resolveProjectMapPath(api);
  try {
    const raw = await fs.readFile(mapPath, "utf8");
    const parsed = parseYaml(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || !("projects" in parsed)) {
      return null;
    }
    const projects = (parsed as { projects?: unknown[] }).projects;
    if (!Array.isArray(projects)) {
      return null;
    }
    for (const e of projects) {
      if (!e || typeof e !== "object") {
        continue;
      }
      const entry = e as Record<string, unknown>;
      const location =
        typeof entry.location === "string"
          ? entry.location
          : typeof entry.path === "string"
            ? entry.path
            : "";
      if (!location) {
        continue;
      }
      const projectDir = expandTilde(location);
      const changeDir = path.join(projectDir, "openspec", "changes", changeId);
      const statusPath = path.join(changeDir, "status.yaml");
      try {
        await fs.access(statusPath);
        return projectDir;
      } catch {
        // not in this project
      }
    }
    return null;
  } catch {
    return null;
  }
}

function resolveChangesDir(workspaceDir: string): string {
  return path.join(workspaceDir, "openspec", "changes");
}

function resolveChangeDir(workspaceDir: string, changeId: string): string {
  return path.join(resolveChangesDir(workspaceDir), changeId);
}

function resolveSharedMemoryDir(workspaceDir: string): string {
  return path.join(workspaceDir, ".ai", "shared-memory");
}

async function readStatusYaml(changeDir: string): Promise<OpenSpecChange | null> {
  const statusPath = path.join(changeDir, "status.yaml");
  try {
    const raw = await fs.readFile(statusPath, "utf8");
    // Simple YAML parsing for the flat structure we write
    const parsed = parseSimpleYaml(raw);
    return parsed as unknown as OpenSpecChange;
  } catch {
    return null;
  }
}

function stringifySimpleYaml(obj: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) {
      continue;
    }
    if (typeof value === "string") {
      lines.push(`${key}: ${JSON.stringify(value)}`);
    } else if (typeof value === "number" || typeof value === "boolean") {
      lines.push(`${key}: ${value}`);
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`);
      } else {
        lines.push(`${key}:`);
        for (const item of value) {
          lines.push(`  - ${JSON.stringify(String(item))}`);
        }
      }
    } else if (typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>);
      if (entries.length === 0) {
        lines.push(`${key}: {}`);
      } else {
        lines.push(`${key}:`);
        for (const [k, v] of entries) {
          lines.push(`  ${k}: ${JSON.stringify(typeof v === "string" ? v : (v ?? ""))}`);
        }
      }
    }
  }
  return lines.join("\n") + "\n";
}

function parseSimpleYaml(raw: string): Record<string, unknown> {
  // Minimal YAML parser for flat key: value structures we write.
  // Handles strings, numbers, booleans, arrays, and simple objects.
  const result: Record<string, unknown> = {};
  const lines = raw.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith("#")) {
      i += 1;
      continue;
    }
    const colonIdx = line.indexOf(":");
    if (colonIdx < 0) {
      i += 1;
      continue;
    }
    const key = line.slice(0, colonIdx).trim();
    const rest = line.slice(colonIdx + 1).trim();

    if (rest === "" || rest === ">") {
      // Could be a block value (array or object)
      const children: string[] = [];
      i += 1;
      while (i < lines.length && (lines[i].startsWith("  ") || lines[i].startsWith("\t"))) {
        children.push(lines[i].trim());
        i += 1;
      }
      if (children.length === 0) {
        result[key] = null;
      } else if (children[0].startsWith("- ")) {
        result[key] = children.map((c) => {
          const val = c.slice(2).trim();
          try {
            return JSON.parse(val);
          } catch {
            return val;
          }
        });
      } else {
        const obj: Record<string, string> = {};
        for (const child of children) {
          const ci = child.indexOf(":");
          if (ci >= 0) {
            const ck = child.slice(0, ci).trim();
            const cv = child.slice(ci + 1).trim();
            try {
              obj[ck] = JSON.parse(cv);
            } catch {
              obj[ck] = cv;
            }
          }
        }
        result[key] = obj;
      }
    } else if (rest === "[]") {
      result[key] = [];
      i += 1;
    } else if (rest === "{}") {
      result[key] = {};
      i += 1;
    } else {
      try {
        result[key] = JSON.parse(rest);
      } catch {
        result[key] = rest;
      }
      i += 1;
    }
  }
  return result;
}

async function writeStatusYaml(changeDir: string, change: OpenSpecChange): Promise<void> {
  const statusPath = path.join(changeDir, "status.yaml");
  await fs.mkdir(changeDir, { recursive: true });
  const yamlData: Record<string, unknown> = {
    changeId: change.changeId,
    title: change.title,
    phase: change.phase,
    owner: change.owner,
    assignees: change.assignees,
    blockers: change.blockers,
    branch: change.branch,
    createdAt: change.createdAt,
    updatedAt: change.updatedAt,
    flowId: change.flowId,
    projectCode: change.projectCode,
  };
  if (change.worktree !== undefined) {
    yamlData.worktree = change.worktree;
  }
  await fs.writeFile(statusPath, stringifySimpleYaml(yamlData), "utf8");
}

/** Template content for shared-memory files that don't yet exist. */
const SHARED_MEMORY_TEMPLATES: Record<string, string> = {
  "project-context.md": `# Project Context

## Product Purpose

<!-- What problem does this product solve? Who uses it? -->

## Architecture Overview

<!-- Key technical components and how they connect -->

## Constraints

<!-- Business rules, compliance requirements, technical limits -->

## Open Questions

<!-- Unresolved decisions that affect the project -->
`,
  "decision-log.md": `# Decision Log

<!-- Format for each entry:
## YYYY-MM-DD: <decision title>
**Change:** <change-id or "global">
**Decision:** <what was decided>
**Rationale:** <why>
**Alternatives considered:** <what else was considered>
**Decided by:** <role>
-->
`,
  "mistake-log.md": `# Mistake Log

<!-- Format for each entry:
## YYYY-MM-DD: <brief description>
**Change:** <change-id>
**What happened:** <concrete description of what went wrong>
**Root cause:** <why it happened>
**Fix applied:** <what was done to fix it>
**Prevention:** <what should happen instead>
**Logged by:** <role>
-->
`,
  "lessons-learned.md": `# Lessons Learned

<!-- Reusable guidance distilled from mistake-log.md entries.
     Only add lessons here when they are durable and reusable, not incident-specific.

Format:
## <lesson title>
**Applies to:** <which roles / phases>
**Guidance:** <the lesson in one or two sentences>
**Source:** <mistake-log entry date + title>
-->
`,
  "handoff-index.md": `# Handoff Index

<!-- Quick index of active handoffs. Updated whenever a handoff.md is written.

Format:
| change-id | phase | from | to | updated | stale? |
|-----------|-------|------|-----|---------|--------|
-->
`,
  "project-risks.md": `# Project Risks

<!-- Format:
## <risk title>
**Likelihood:** high | medium | low
**Impact:** high | medium | low
**Owner:** <role>
**Mitigation:** <what is being done>
**Status:** open | mitigated | closed
-->
`,
};

/**
 * Scaffold shared-memory template files that don't exist yet.
 * Called on change `create` so the directory is ready for agents on first use.
 */
async function scaffoldSharedMemory(workspaceDir: string): Promise<void> {
  const sharedMemoryDir = resolveSharedMemoryDir(workspaceDir);
  await fs.mkdir(sharedMemoryDir, { recursive: true });
  for (const [filename, content] of Object.entries(SHARED_MEMORY_TEMPLATES)) {
    const filePath = path.join(sharedMemoryDir, filename);
    try {
      await fs.access(filePath);
      // File already exists — leave it untouched
    } catch {
      await fs.writeFile(filePath, content, "utf8");
    }
  }
}

async function updateCurrentFocus(workspaceDir: string, change: OpenSpecChange): Promise<void> {
  const sharedMemoryDir = resolveSharedMemoryDir(workspaceDir);
  await fs.mkdir(sharedMemoryDir, { recursive: true });
  const focusPath = path.join(sharedMemoryDir, "current-focus.md");
  const content = [
    `# Current Focus`,
    ``,
    `**Change:** ${change.changeId} — ${change.title}`,
    `**Phase:** ${change.phase}`,
    `**Project:** ${change.projectCode}`,
    `**Branch:** ${change.branch}`,
    `**Owner:** ${change.owner}`,
    `**Updated:** ${new Date(change.updatedAt).toISOString()}`,
    ``,
    `## Assignees`,
    ...Object.entries(change.assignees).map(([role, sessionKey]) => `- ${role}: ${sessionKey}`),
    ``,
    `## Blockers`,
    change.blockers.length === 0 ? `- (none)` : change.blockers.map((b) => `- ${b}`).join("\n"),
    ``,
  ].join("\n");
  await fs.writeFile(focusPath, content, "utf8");
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function fileHasContent(p: string, minBytes = 1): Promise<boolean> {
  try {
    const stat = await fs.stat(p);
    return stat.size >= minBytes;
  } catch {
    return false;
  }
}

/**
 * Ordered phase sequence. "blocked" is a state, not a sequence position.
 * Transitions must move forward along this sequence (or to "blocked" from anywhere).
 * No phase may be skipped.
 */
const PHASE_ORDER: OpenSpecPhase[] = [
  "idea",
  "proposal",
  "plan",
  "design",
  "implementation",
  "verification",
  "deployment",
  "done",
];

async function validatePhaseTransition(
  changeDir: string,
  fromPhase: OpenSpecPhase,
  toPhase: OpenSpecPhase,
): Promise<string | null> {
  // "blocked" can be entered from any phase; unblocking returns to the same phase.
  if (toPhase === "blocked") {
    return null;
  }

  // Enforce forward-only, no-skip transitions.
  if (fromPhase !== "blocked") {
    const fromIdx = PHASE_ORDER.indexOf(fromPhase);
    const toIdx = PHASE_ORDER.indexOf(toPhase);
    if (toIdx <= fromIdx) {
      return `Cannot transition from "${fromPhase}" to "${toPhase}": phases must advance forward in sequence (${PHASE_ORDER.join(" → ")})`;
    }
    if (toIdx - fromIdx > 1) {
      const expected = PHASE_ORDER[fromIdx + 1];
      return `Cannot skip from "${fromPhase}" to "${toPhase}": next required phase is "${expected}"`;
    }
  }

  // Artifact guards: required files must exist before entering each phase.
  if (toPhase === "proposal") {
    // No artifact required to enter proposal — it is the first writing phase.
  }
  if (toPhase === "plan") {
    const proposalPath = path.join(changeDir, "proposal.md");
    if (!(await fileHasContent(proposalPath))) {
      return `Cannot transition to "plan": proposal.md must exist and have content`;
    }
  }
  if (toPhase === "design") {
    const proposalPath = path.join(changeDir, "proposal.md");
    if (!(await fileHasContent(proposalPath))) {
      return `Cannot transition to "design": proposal.md must exist and have content`;
    }
  }
  if (toPhase === "implementation") {
    const designPath = path.join(changeDir, "design.md");
    if (!(await fileHasContent(designPath))) {
      return `Cannot transition to "implementation": design.md must exist and have content. Complete the design phase first.`;
    }
    // Accept either a populated tasks.md (legacy) or at least one file in tasks/ directory
    const tasksPath = path.join(changeDir, "tasks.md");
    const tasksDir = path.join(changeDir, "tasks");
    const hasTasks = await (async () => {
      if (await fileHasContent(tasksPath)) {
        return true;
      }
      try {
        const entries = await fs.readdir(tasksDir);
        return entries.some((f) => f.endsWith(".md") && f !== "TEMPLATE.md");
      } catch {
        return false;
      }
    })();
    if (!hasTasks) {
      return `Cannot transition to "implementation": tasks.md must exist and have content, or at least one task file must exist in tasks/. Complete the plan phase first.`;
    }
  }
  if (toPhase === "verification") {
    const handoffPath = path.join(changeDir, "handoff.md");
    if (!(await fileHasContent(handoffPath))) {
      return `Cannot transition to "verification": handoff.md must be written by the implementer first`;
    }
  }
  if (toPhase === "deployment") {
    const verificationPath = path.join(changeDir, "verification.md");
    if (!(await fileExists(verificationPath))) {
      return `Cannot transition to "deployment": verification.md does not exist`;
    }
    const verificationContent = await fs.readFile(verificationPath, "utf8");
    if (!verificationContent.includes("Signoff: YES")) {
      return `Cannot transition to "deployment": verification.md does not contain "Signoff: YES" — QA has not signed off`;
    }
  }
  return null;
}

// Expand ~ to home directory
function expandTilde(p: string): string {
  if (p.startsWith("~/") || p === "~") {
    return path.join(os.homedir(), p.slice(2));
  }
  return p;
}

async function handleCreate(
  workspaceDir: string,
  input: Extract<OpenSpecChangeInput, { action: "create" }>,
): Promise<string> {
  // New changes always start at "idea" — no agent may create a change already
  // in an advanced phase, which would bypass the phase-gate enforcement.
  const allowedCreatePhases: OpenSpecPhase[] = ["idea", "proposal"];
  const startPhase: OpenSpecPhase = input.phase ?? "idea";
  if (!allowedCreatePhases.includes(startPhase)) {
    return JSON.stringify(
      {
        ok: false,
        error: `Cannot create a change at phase "${startPhase}". New changes must start at "idea" or "proposal". Use openspec_change(transition) to advance phases in order.`,
      },
      null,
      2,
    );
  }

  const changeDir = resolveChangeDir(workspaceDir, input.changeId);
  await fs.mkdir(changeDir, { recursive: true });

  const now = Date.now();
  const change: OpenSpecChange = {
    changeId: input.changeId,
    title: input.title,
    phase: startPhase,
    owner: "",
    assignees: {},
    blockers: [],
    branch: `openspec/${input.changeId}`,
    createdAt: now,
    updatedAt: now,
    flowId: `flow-${input.changeId}`,
    projectCode: input.projectCode,
  };

  await writeStatusYaml(changeDir, change);
  await scaffoldSharedMemory(workspaceDir);
  await updateCurrentFocus(workspaceDir, change);

  return JSON.stringify({ ok: true, change }, null, 2);
}

async function handleTransition(
  workspaceDir: string,
  input: Extract<OpenSpecChangeInput, { action: "transition" }>,
): Promise<string> {
  const changeDir = resolveChangeDir(workspaceDir, input.changeId);
  const change = await readStatusYaml(changeDir);
  if (!change) {
    return JSON.stringify({ ok: false, error: `Change ${input.changeId} not found` }, null, 2);
  }

  const guardError = await validatePhaseTransition(changeDir, change.phase, input.toPhase);
  if (guardError) {
    return JSON.stringify({ ok: false, error: guardError }, null, 2);
  }

  change.phase = input.toPhase;
  change.updatedAt = Date.now();
  await writeStatusYaml(changeDir, change);
  await updateCurrentFocus(workspaceDir, change);

  return JSON.stringify({ ok: true, change }, null, 2);
}

async function handleAssign(
  workspaceDir: string,
  input: Extract<OpenSpecChangeInput, { action: "assign" }>,
): Promise<string> {
  const changeDir = resolveChangeDir(workspaceDir, input.changeId);
  const change = await readStatusYaml(changeDir);
  if (!change) {
    return JSON.stringify({ ok: false, error: `Change ${input.changeId} not found` }, null, 2);
  }

  change.assignees = { ...change.assignees, [input.role]: input.sessionKey };
  change.updatedAt = Date.now();
  await writeStatusYaml(changeDir, change);
  await updateCurrentFocus(workspaceDir, change);

  return JSON.stringify({ ok: true, change }, null, 2);
}

async function handleBlock(
  workspaceDir: string,
  input: Extract<OpenSpecChangeInput, { action: "block" }>,
): Promise<string> {
  const changeDir = resolveChangeDir(workspaceDir, input.changeId);
  const change = await readStatusYaml(changeDir);
  if (!change) {
    return JSON.stringify({ ok: false, error: `Change ${input.changeId} not found` }, null, 2);
  }

  if (!change.blockers.includes(input.blocker)) {
    change.blockers = [...change.blockers, input.blocker];
  }
  change.updatedAt = Date.now();
  await writeStatusYaml(changeDir, change);
  await updateCurrentFocus(workspaceDir, change);

  return JSON.stringify({ ok: true, change }, null, 2);
}

async function handleUnblock(
  workspaceDir: string,
  input: Extract<OpenSpecChangeInput, { action: "unblock" }>,
): Promise<string> {
  const changeDir = resolveChangeDir(workspaceDir, input.changeId);
  const change = await readStatusYaml(changeDir);
  if (!change) {
    return JSON.stringify({ ok: false, error: `Change ${input.changeId} not found` }, null, 2);
  }

  change.blockers = change.blockers.filter((b) => b !== input.blocker);
  change.updatedAt = Date.now();
  await writeStatusYaml(changeDir, change);
  await updateCurrentFocus(workspaceDir, change);

  return JSON.stringify({ ok: true, change }, null, 2);
}

async function handleHandoff(
  workspaceDir: string,
  input: Extract<OpenSpecChangeInput, { action: "handoff" }>,
): Promise<string> {
  const changeDir = resolveChangeDir(workspaceDir, input.changeId);
  const change = await readStatusYaml(changeDir);
  if (!change) {
    return JSON.stringify({ ok: false, error: `Change ${input.changeId} not found` }, null, 2);
  }

  const now = Date.now();
  const handoffContent = [
    `# Handoff: ${input.changeId}`,
    ``,
    `**From:** ${input.from}`,
    `**To:** ${input.to}`,
    `**Date:** ${new Date(now).toISOString()}`,
    ``,
    `## Summary`,
    ``,
    input.summary,
    ``,
    `## Next Step`,
    ``,
    input.nextStep,
    ``,
  ].join("\n");

  const handoffPath = path.join(changeDir, "handoff.md");
  await fs.writeFile(handoffPath, handoffContent, "utf8");

  // Update handoff-index.md in shared-memory
  const sharedMemoryDir = resolveSharedMemoryDir(workspaceDir);
  await fs.mkdir(sharedMemoryDir, { recursive: true });
  const indexPath = path.join(sharedMemoryDir, "handoff-index.md");
  const indexEntry = `- [${now}] ${input.changeId}: ${input.from} -> ${input.to} — ${input.summary.slice(0, 80)}\n`;
  await fs.appendFile(indexPath, indexEntry, "utf8");

  change.updatedAt = now;
  await writeStatusYaml(changeDir, change);

  return JSON.stringify({ ok: true, change, handoffPath }, null, 2);
}

async function handleStatus(
  workspaceDir: string,
  input: Extract<OpenSpecChangeInput, { action: "status" }>,
): Promise<string> {
  const changeDir = resolveChangeDir(workspaceDir, input.changeId);
  const change = await readStatusYaml(changeDir);
  if (!change) {
    return JSON.stringify({ ok: false, error: `Change ${input.changeId} not found` }, null, 2);
  }
  return JSON.stringify({ ok: true, change }, null, 2);
}

// ─── Task file helpers ───────────────────────────────────────────────────────

function resolveTasksDir(changeDir: string): string {
  return path.join(changeDir, "tasks");
}

function resolveTaskFilePath(changeDir: string, taskId: string, phase: string): string {
  // Derive phase number from the phase string (e.g. "Phase 2: ..." -> "Phase2")
  const phaseSlug = phase.replace(/\s*:.*$/, "").replace(/\s+/g, "");
  const filename = `${phaseSlug}-${taskId}.md`;
  return path.join(resolveTasksDir(changeDir), filename);
}

function resolveTrackerPath(changeDir: string): string {
  return path.join(changeDir, "tasks-tracker.yaml");
}

/** Parse YAML frontmatter from a markdown file. Returns the frontmatter object and the body. */
function parseMarkdownFrontmatter(content: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  if (!content.startsWith("---")) {
    return { frontmatter: {}, body: content };
  }
  const end = content.indexOf("\n---", 3);
  if (end < 0) {
    return { frontmatter: {}, body: content };
  }
  const fmRaw = content.slice(4, end);
  const body = content.slice(end + 4).replace(/^\n/, "");
  try {
    const frontmatter = (parseYaml(fmRaw) as Record<string, unknown>) ?? {};
    return { frontmatter, body };
  } catch {
    return { frontmatter: {}, body: content };
  }
}

function taskFromFrontmatter(fm: Record<string, unknown>): OpenSpecTask {
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.map(String) : typeof v === "string" && v ? [v] : [];

  return {
    id: typeof fm.id === "string" ? fm.id : "",
    title: typeof fm.title === "string" ? fm.title : "",
    phase: typeof fm.phase === "string" ? fm.phase : "",
    status: (fm.status as TaskStatus) ?? "todo",
    priority: (fm.priority as TaskPriority) ?? "medium",
    assignee: typeof fm.assignee === "string" ? fm.assignee : "",
    role: typeof fm.role === "string" ? fm.role : "",
    owner: typeof fm.owner === "string" ? fm.owner : "",
    reviewer: typeof fm.reviewer === "string" ? fm.reviewer : "",
    dependsOn: arr(fm.depends_on),
    blockedBy: arr(fm.blocked_by),
    createdAt: typeof fm.created_at === "string" ? fm.created_at : "",
    updatedAt: typeof fm.updated_at === "string" ? fm.updated_at : "",
    startedAt: typeof fm.started_at === "string" ? fm.started_at : "",
    completedAt: typeof fm.completed_at === "string" ? fm.completed_at : "",
    estimatedEffort: typeof fm.estimated_effort === "string" ? fm.estimated_effort : "",
  };
}

function taskToFrontmatter(task: OpenSpecTask): Record<string, unknown> {
  return {
    id: task.id,
    title: task.title,
    phase: task.phase,
    status: task.status,
    priority: task.priority,
    assignee: task.assignee,
    role: task.role,
    owner: task.owner,
    reviewer: task.reviewer,
    depends_on: task.dependsOn,
    blocked_by: task.blockedBy,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
    started_at: task.startedAt,
    completed_at: task.completedAt,
    estimated_effort: task.estimatedEffort,
  };
}

async function readTaskFile(
  filePath: string,
): Promise<{ task: OpenSpecTask; body: string } | null> {
  try {
    const content = await fs.readFile(filePath, "utf8");
    const { frontmatter, body } = parseMarkdownFrontmatter(content);
    if (!frontmatter.id) {
      return null;
    }
    return { task: taskFromFrontmatter(frontmatter), body };
  } catch {
    return null;
  }
}

async function writeTaskFile(filePath: string, task: OpenSpecTask, body: string): Promise<void> {
  const fm = taskToFrontmatter(task);
  // Use yaml stringify for proper YAML output of the frontmatter block
  const fmStr = stringifyYaml(fm, { lineWidth: 0 }).trimEnd();
  const content = `---\n${fmStr}\n---\n\n${body}`;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

async function listTaskFiles(changeDir: string): Promise<OpenSpecTask[]> {
  const tasksDir = resolveTasksDir(changeDir);
  try {
    const entries = await fs.readdir(tasksDir);
    const taskFiles = entries.filter((f) => f.endsWith(".md") && f !== "TEMPLATE.md").toSorted(); // alphabetical = Phase order
    const tasks: OpenSpecTask[] = [];
    for (const filename of taskFiles) {
      const result = await readTaskFile(path.join(tasksDir, filename));
      if (result) {
        tasks.push(result.task);
      }
    }
    return tasks;
  } catch {
    return [];
  }
}

async function readTaskTracker(changeDir: string): Promise<TaskTracker | null> {
  const trackerPath = resolveTrackerPath(changeDir);
  try {
    const raw = await fs.readFile(trackerPath, "utf8");
    const parsed = parseYaml(raw) as Record<string, unknown> | null;
    if (!parsed) {
      return null;
    }
    const tasks = Array.isArray(parsed.tasks) ? (parsed.tasks as TaskTrackerEntry[]) : [];
    return {
      changeId: typeof parsed.changeId === "string" ? parsed.changeId : "",
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
      tasks,
    };
  } catch {
    return null;
  }
}

async function writeTaskTracker(changeDir: string, tracker: TaskTracker): Promise<void> {
  const trackerPath = resolveTrackerPath(changeDir);
  tracker.updatedAt = new Date().toISOString();
  const yamlStr = stringifyYaml(
    {
      changeId: tracker.changeId,
      updatedAt: tracker.updatedAt,
      tasks: tracker.tasks,
    },
    { lineWidth: 0 },
  );
  await fs.writeFile(trackerPath, yamlStr, "utf8");
}

/** Update (or insert) a single task entry in tasks-tracker.yaml. */
async function syncTaskToTracker(changeDir: string, task: OpenSpecTask): Promise<void> {
  const changeId = path.basename(changeDir);
  let tracker = await readTaskTracker(changeDir);
  if (!tracker) {
    tracker = { changeId, updatedAt: "", tasks: [] };
  }
  const entry: TaskTrackerEntry = {
    id: task.id,
    title: task.title,
    status: task.status,
    assignee: task.assignee,
    role: task.role,
    owner: task.owner,
    reviewer: task.reviewer,
    priority: task.priority,
    dependsOn: task.dependsOn,
  };
  const idx = tracker.tasks.findIndex((t) => t.id === task.id);
  if (idx >= 0) {
    tracker.tasks[idx] = entry;
  } else {
    tracker.tasks.push(entry);
  }
  await writeTaskTracker(changeDir, tracker);
}

function buildDefaultTaskBody(task: OpenSpecTask): string {
  return [
    `# ${task.id} — ${task.title}`,
    ``,
    `## Description`,
    ``,
    `<!-- What needs to be done and why -->`,
    ``,
    `## Acceptance Criteria`,
    ``,
    `- [ ] Criterion 1`,
    ``,
    `## Technical Notes`,
    ``,
    `<!-- Implementation hints, commands, commit message -->`,
    ``,
    `## Files`,
    ``,
    `| File | Action | Notes |`,
    `|------|--------|-------|`,
    `| \`path/to/file\` | create/modify/delete | description |`,
    ``,
    `## Activity Log`,
    ``,
    `<!-- Agents: append new entries below. Do not edit previous entries. -->`,
    `<!-- Format: ### YYYY-MM-DDTHH:MM:SSZ — role-name -->`,
    ``,
    `### ${task.createdAt || new Date().toISOString()} — ${task.owner || "owner"}`,
    `Created task.`,
    ``,
    `## Bugs`,
    ``,
    `<!-- ### BUG-NNN: title (open|fixing|fixed|wontfix) -->`,
    `<!-- Reported by, Date, Severity, Description, Reproduction, Fix -->`,
  ].join("\n");
}

// ─── openspec_task Zod schema ─────────────────────────────────────────────────

const TASK_STATUSES = ["todo", "in_progress", "blocked", "in_review", "done"] as const;
const TASK_PRIORITIES = ["low", "medium", "high", "critical"] as const;

const OpenSpecTaskInputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("task_create"),
    changeId: z.string().min(1),
    id: z.string().min(1),
    title: z.string().min(1),
    phase: z.string().min(1),
    role: z.string().min(1),
    owner: z.string().min(1),
    reviewer: z.string().optional(),
    assignee: z.string().optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    dependsOn: z.array(z.string()).optional(),
    estimatedEffort: z.string().optional(),
  }),
  z.object({
    action: z.literal("task_update"),
    changeId: z.string().min(1),
    id: z.string().min(1),
    status: z.enum(TASK_STATUSES).optional(),
    assignee: z.string().optional(),
    reviewer: z.string().optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    blockedBy: z.array(z.string()).optional(),
  }),
  z.object({
    action: z.literal("task_comment"),
    changeId: z.string().min(1),
    id: z.string().min(1),
    role: z.string().min(1),
    content: z.string().min(1),
  }),
  z.object({
    action: z.literal("task_bug"),
    changeId: z.string().min(1),
    id: z.string().min(1),
    bugId: z.string().min(1),
    title: z.string().min(1),
    severity: z.enum(["low", "medium", "high", "critical"]),
    reportedBy: z.string().min(1),
    description: z.string().min(1),
    reproduction: z.string().optional(),
  }),
  z.object({
    action: z.literal("task_list"),
    changeId: z.string().min(1),
  }),
]);

type OpenSpecTaskInput = z.infer<typeof OpenSpecTaskInputSchema>;

// ─── openspec_task handlers ───────────────────────────────────────────────────

async function handleTaskCreate(
  workspaceDir: string,
  input: Extract<OpenSpecTaskInput, { action: "task_create" }>,
): Promise<string> {
  const changeDir = resolveChangeDir(workspaceDir, input.changeId);
  const change = await readStatusYaml(changeDir);
  if (!change) {
    return JSON.stringify({ ok: false, error: `Change ${input.changeId} not found` }, null, 2);
  }

  const now = new Date().toISOString();
  const task: OpenSpecTask = {
    id: input.id,
    title: input.title,
    phase: input.phase,
    status: "todo",
    priority: input.priority ?? "medium",
    assignee: input.assignee ?? "",
    role: input.role,
    owner: input.owner,
    reviewer: input.reviewer ?? "",
    dependsOn: input.dependsOn ?? [],
    blockedBy: [],
    createdAt: now,
    updatedAt: now,
    startedAt: "",
    completedAt: "",
    estimatedEffort: input.estimatedEffort ?? "",
  };

  const filePath = resolveTaskFilePath(changeDir, input.id, input.phase);

  // Check for duplicate
  if (await fileExists(filePath)) {
    return JSON.stringify({ ok: false, error: `Task file already exists: ${filePath}` }, null, 2);
  }

  const body = buildDefaultTaskBody(task);
  await writeTaskFile(filePath, task, body);
  await syncTaskToTracker(changeDir, task);

  return JSON.stringify({ ok: true, task, filePath }, null, 2);
}

async function handleTaskUpdate(
  workspaceDir: string,
  input: Extract<OpenSpecTaskInput, { action: "task_update" }>,
): Promise<string> {
  const changeDir = resolveChangeDir(workspaceDir, input.changeId);

  // Find the task file by scanning the tasks directory
  const tasksDir = resolveTasksDir(changeDir);
  let taskFilePath: string | null = null;
  let existingBody = "";
  let task: OpenSpecTask | null = null;
  try {
    const entries = await fs.readdir(tasksDir);
    for (const filename of entries) {
      if (!filename.endsWith(".md") || filename === "TEMPLATE.md") {
        continue;
      }
      const fp = path.join(tasksDir, filename);
      const result = await readTaskFile(fp);
      if (result && result.task.id === input.id) {
        taskFilePath = fp;
        task = result.task;
        existingBody = result.body;
        break;
      }
    }
  } catch {
    // tasksDir may not exist yet
  }

  if (!task || !taskFilePath) {
    return JSON.stringify(
      { ok: false, error: `Task ${input.id} not found in change ${input.changeId}` },
      null,
      2,
    );
  }

  // Apply updates
  const now = new Date().toISOString();
  if (input.status !== undefined) {
    if (input.status === "in_progress" && !task.startedAt) {
      task.startedAt = now;
    }
    if (input.status === "done" && !task.completedAt) {
      task.completedAt = now;
    }
    task.status = input.status;
  }
  if (input.assignee !== undefined) {
    task.assignee = input.assignee;
  }
  if (input.reviewer !== undefined) {
    task.reviewer = input.reviewer;
  }
  if (input.priority !== undefined) {
    task.priority = input.priority;
  }
  if (input.blockedBy !== undefined) {
    task.blockedBy = input.blockedBy;
  }
  task.updatedAt = now;

  await writeTaskFile(taskFilePath, task, existingBody);
  await syncTaskToTracker(changeDir, task);

  return JSON.stringify({ ok: true, task }, null, 2);
}

async function handleTaskComment(
  workspaceDir: string,
  input: Extract<OpenSpecTaskInput, { action: "task_comment" }>,
): Promise<string> {
  const changeDir = resolveChangeDir(workspaceDir, input.changeId);
  const tasksDir = resolveTasksDir(changeDir);

  let taskFilePath: string | null = null;
  let task: OpenSpecTask | null = null;
  let body = "";
  try {
    const entries = await fs.readdir(tasksDir);
    for (const filename of entries) {
      if (!filename.endsWith(".md") || filename === "TEMPLATE.md") {
        continue;
      }
      const fp = path.join(tasksDir, filename);
      const result = await readTaskFile(fp);
      if (result && result.task.id === input.id) {
        taskFilePath = fp;
        task = result.task;
        body = result.body;
        break;
      }
    }
  } catch {
    // directory may not exist
  }

  if (!task || !taskFilePath) {
    return JSON.stringify(
      { ok: false, error: `Task ${input.id} not found in change ${input.changeId}` },
      null,
      2,
    );
  }

  const timestamp = new Date().toISOString();
  const entry = `\n### ${timestamp} — ${input.role}\n${input.content}\n`;

  // Append to the Activity Log section
  const activityMarker = "## Activity Log";
  const bugsMarker = "## Bugs";
  const activityIdx = body.indexOf(activityMarker);
  const bugsIdx = body.indexOf(bugsMarker);

  let newBody: string;
  if (activityIdx >= 0 && bugsIdx > activityIdx) {
    // Insert before Bugs section
    newBody = body.slice(0, bugsIdx).trimEnd() + "\n" + entry + "\n" + body.slice(bugsIdx);
  } else if (activityIdx >= 0) {
    // Append at end of body
    newBody = body.trimEnd() + "\n" + entry;
  } else {
    // No Activity Log section found — append at end
    newBody = body.trimEnd() + `\n\n${activityMarker}\n${entry}`;
  }

  task.updatedAt = timestamp;
  await writeTaskFile(taskFilePath, task, newBody);
  await syncTaskToTracker(changeDir, task);

  return JSON.stringify({ ok: true, taskId: input.id, timestamp }, null, 2);
}

async function handleTaskBug(
  workspaceDir: string,
  input: Extract<OpenSpecTaskInput, { action: "task_bug" }>,
): Promise<string> {
  const changeDir = resolveChangeDir(workspaceDir, input.changeId);
  const tasksDir = resolveTasksDir(changeDir);

  let taskFilePath: string | null = null;
  let task: OpenSpecTask | null = null;
  let body = "";
  try {
    const entries = await fs.readdir(tasksDir);
    for (const filename of entries) {
      if (!filename.endsWith(".md") || filename === "TEMPLATE.md") {
        continue;
      }
      const fp = path.join(tasksDir, filename);
      const result = await readTaskFile(fp);
      if (result && result.task.id === input.id) {
        taskFilePath = fp;
        task = result.task;
        body = result.body;
        break;
      }
    }
  } catch {
    // directory may not exist
  }

  if (!task || !taskFilePath) {
    return JSON.stringify(
      { ok: false, error: `Task ${input.id} not found in change ${input.changeId}` },
      null,
      2,
    );
  }

  const timestamp = new Date().toISOString();
  const bugEntry = [
    ``,
    `### ${input.bugId}: ${input.title} (open)`,
    `**Reported by:** ${input.reportedBy}`,
    `**Date:** ${timestamp}`,
    `**Severity:** ${input.severity}`,
    `**Description:** ${input.description}`,
    input.reproduction ? `**Reproduction:** ${input.reproduction}` : null,
    `**Fix:** (pending)`,
  ]
    .filter((l) => l !== null)
    .join("\n");

  // Append to Bugs section
  const bugsMarker = "## Bugs";
  const bugsIdx = body.indexOf(bugsMarker);
  let newBody: string;
  if (bugsIdx >= 0) {
    newBody = body.trimEnd() + "\n" + bugEntry + "\n";
  } else {
    newBody = body.trimEnd() + `\n\n${bugsMarker}\n${bugEntry}\n`;
  }

  task.updatedAt = timestamp;
  await writeTaskFile(taskFilePath, task, newBody);
  await syncTaskToTracker(changeDir, task);

  return JSON.stringify({ ok: true, taskId: input.id, bugId: input.bugId }, null, 2);
}

async function handleTaskList(
  workspaceDir: string,
  input: Extract<OpenSpecTaskInput, { action: "task_list" }>,
): Promise<string> {
  const changeDir = resolveChangeDir(workspaceDir, input.changeId);
  const change = await readStatusYaml(changeDir);
  if (!change) {
    return JSON.stringify({ ok: false, error: `Change ${input.changeId} not found` }, null, 2);
  }

  // Fast path: read tracker
  const tracker = await readTaskTracker(changeDir);
  if (tracker && tracker.tasks.length > 0) {
    return JSON.stringify({ ok: true, source: "tracker", tasks: tracker.tasks }, null, 2);
  }

  // Fallback: parse individual task files
  const tasks = await listTaskFiles(changeDir);
  return JSON.stringify({ ok: true, source: "files", tasks }, null, 2);
}

export function createOpenSpecTaskTool(api: OpenClawPluginApi) {
  return {
    name: "openspec_task",
    label: "OpenSpec Task",
    description:
      "Manage individual tasks within an OpenSpec change. Create task files, update status/assignee, append activity log comments, report bugs, or list tasks.",
    parameters: Type.Object(
      {
        action: Type.Unsafe<string>({
          type: "string",
          enum: ["task_create", "task_update", "task_comment", "task_bug", "task_list"],
          description: "The task action to perform.",
        }),
        changeId: Type.Optional(Type.String({ description: "The change this task belongs to." })),
        id: Type.Optional(Type.String({ description: "Task ID (e.g. T2.1)." })),
        title: Type.Optional(Type.String({ description: "Task title." })),
        phase: Type.Optional(
          Type.String({ description: "Phase name (e.g. Phase 2: Application Code)." }),
        ),
        role: Type.Optional(
          Type.String({ description: "Required role for the task (e.g. sr-fullstack)." }),
        ),
        owner: Type.Optional(Type.String({ description: "Who manages/created the task." })),
        reviewer: Type.Optional(
          Type.String({ description: "Who reviews the task before marking done." }),
        ),
        assignee: Type.Optional(
          Type.String({ description: "Agent currently executing the task." }),
        ),
        priority: Type.Optional(
          Type.Unsafe<string>({
            type: "string",
            enum: ["low", "medium", "high", "critical"],
            description: "Task priority.",
          }),
        ),
        status: Type.Optional(
          Type.Unsafe<string>({
            type: "string",
            enum: ["todo", "in_progress", "blocked", "in_review", "done"],
            description: "Task status (for task_update).",
          }),
        ),
        dependsOn: Type.Optional(
          Type.Array(Type.String(), { description: "Task IDs this task depends on." }),
        ),
        blockedBy: Type.Optional(
          Type.Array(Type.String(), { description: "Free-text blockers (for task_update)." }),
        ),
        estimatedEffort: Type.Optional(Type.String({ description: "e.g. '1h', 'half-day'." })),
        content: Type.Optional(Type.String({ description: "Comment content (for task_comment)." })),
        bugId: Type.Optional(Type.String({ description: "Bug ID (e.g. BUG-001) for task_bug." })),
        severity: Type.Optional(
          Type.Unsafe<string>({
            type: "string",
            enum: ["low", "medium", "high", "critical"],
            description: "Bug severity.",
          }),
        ),
        reportedBy: Type.Optional(Type.String({ description: "Who reported the bug." })),
        description: Type.Optional(Type.String({ description: "Bug description." })),
        reproduction: Type.Optional(Type.String({ description: "Steps to reproduce the bug." })),
      },
      { additionalProperties: false },
    ),
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      const parseResult = OpenSpecTaskInputSchema.safeParse(rawParams);
      if (!parseResult.success) {
        const errText = parseResult.error.issues
          .map((e) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          content: [{ type: "text", text: JSON.stringify({ ok: false, error: errText }) }],
        };
      }

      const input = parseResult.data;

      try {
        const resolved = await resolveWorkspaceDirForChange(api, input.changeId);
        const workspaceDir = resolved ?? resolveWorkspaceDir(api);

        let resultText: string;
        switch (input.action) {
          case "task_create":
            resultText = await handleTaskCreate(workspaceDir, input);
            break;
          case "task_update":
            resultText = await handleTaskUpdate(workspaceDir, input);
            break;
          case "task_comment":
            resultText = await handleTaskComment(workspaceDir, input);
            break;
          case "task_bug":
            resultText = await handleTaskBug(workspaceDir, input);
            break;
          case "task_list":
            resultText = await handleTaskList(workspaceDir, input);
            break;
          default:
            resultText = JSON.stringify({ ok: false, error: "Unknown action" });
        }
        return { content: [{ type: "text", text: resultText }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: JSON.stringify({ ok: false, error: message }) }],
        };
      }
    },
  };
}

export function createOpenSpecChangeTool(api: OpenClawPluginApi) {
  return {
    name: "openspec_change",
    label: "OpenSpec Change",
    description:
      "Manage OpenSpec changes: create, transition phases, assign agents, block/unblock, handoff, or check status.",
    parameters: Type.Object(
      {
        action: Type.Unsafe<string>({
          type: "string",
          enum: ["create", "transition", "assign", "block", "unblock", "handoff", "status"],
          description: "The action to perform on the change.",
        }),
        projectCode: Type.Optional(
          Type.String({ description: "Project code (required for create)." }),
        ),
        changeId: Type.Optional(Type.String({ description: "Unique change identifier." })),
        title: Type.Optional(Type.String({ description: "Change title (required for create)." })),
        phase: Type.Optional(
          Type.Unsafe<string>({
            type: "string",
            enum: [
              "idea",
              "proposal",
              "plan",
              "design",
              "implementation",
              "verification",
              "deployment",
              "done",
              "blocked",
            ],
            description: "Phase for create or transition actions.",
          }),
        ),
        toPhase: Type.Optional(
          Type.Unsafe<string>({
            type: "string",
            enum: [
              "idea",
              "proposal",
              "plan",
              "design",
              "implementation",
              "verification",
              "deployment",
              "done",
              "blocked",
            ],
            description: "Target phase for transition action.",
          }),
        ),
        role: Type.Optional(Type.String({ description: "Agent role (for assign action)." })),
        sessionKey: Type.Optional(Type.String({ description: "Session key (for assign action)." })),
        blocker: Type.Optional(
          Type.String({ description: "Blocker description (for block/unblock actions)." }),
        ),
        from: Type.Optional(Type.String({ description: "Handoff sender role." })),
        to: Type.Optional(Type.String({ description: "Handoff recipient role." })),
        summary: Type.Optional(Type.String({ description: "Handoff summary." })),
        nextStep: Type.Optional(Type.String({ description: "Handoff next step." })),
      },
      { additionalProperties: false },
    ),
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      const parseResult = OpenSpecChangeInputSchema.safeParse(rawParams);
      if (!parseResult.success) {
        const errText = parseResult.error.issues
          .map((e) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          content: [{ type: "text", text: JSON.stringify({ ok: false, error: errText }) }],
        };
      }

      const input = parseResult.data;

      try {
        // Resolve the project workspace directory from project-map.yaml when possible.
        // - "create" supplies projectCode directly, resolved via project-map.yaml.
        // - All other actions scan project-map.yaml for the project that owns changeId.
        // Falls back to the agent default workspace if project-map resolution fails.
        let workspaceDir: string;
        if (input.action === "create") {
          const resolved = await resolveWorkspaceDirForProject(api, input.projectCode);
          workspaceDir = resolved ?? resolveWorkspaceDir(api);
        } else {
          const resolved = await resolveWorkspaceDirForChange(api, input.changeId);
          workspaceDir = resolved ?? resolveWorkspaceDir(api);
        }

        let resultText: string;
        switch (input.action) {
          case "create":
            resultText = await handleCreate(workspaceDir, input);
            break;
          case "transition":
            resultText = await handleTransition(workspaceDir, input);
            break;
          case "assign":
            resultText = await handleAssign(workspaceDir, input);
            break;
          case "block":
            resultText = await handleBlock(workspaceDir, input);
            break;
          case "unblock":
            resultText = await handleUnblock(workspaceDir, input);
            break;
          case "handoff":
            resultText = await handleHandoff(workspaceDir, input);
            break;
          case "status":
            resultText = await handleStatus(workspaceDir, input);
            break;
          default:
            resultText = JSON.stringify({ ok: false, error: "Unknown action" });
        }
        return { content: [{ type: "text", text: resultText }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: JSON.stringify({ ok: false, error: message }) }],
        };
      }
    },
  };
}

// Export helpers for use in projects-tool and gateway
export {
  resolveChangesDir,
  resolveChangeDir,
  resolveSharedMemoryDir,
  readStatusYaml,
  expandTilde,
  listTaskFiles,
  readTaskTracker,
  writeTaskTracker,
  syncTaskToTracker,
};
