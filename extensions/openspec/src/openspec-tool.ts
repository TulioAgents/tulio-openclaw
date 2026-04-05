import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Type } from "@sinclair/typebox";
import { z } from "openclaw/plugin-sdk/zod";
import { parse as parseYaml } from "yaml";
import type { OpenClawPluginApi } from "../runtime-api.js";
import type { OpenSpecChange, OpenSpecPhase } from "./openspec-types.js";

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
    typeof (api.pluginConfig as Record<string, unknown>).projectMapPath === "string"
      ? ((api.pluginConfig as Record<string, unknown>).projectMapPath as string)
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
    if (!parsed || typeof parsed !== "object" || !("projects" in parsed)) return null;
    const projects = (parsed as { projects?: unknown[] }).projects;
    if (!Array.isArray(projects)) return null;
    const entry = projects.find(
      (e) =>
        e &&
        typeof e === "object" &&
        (String((e as Record<string, unknown>).projectCode ?? "") === projectCode ||
          String((e as Record<string, unknown>).name ?? "") === projectCode),
    ) as Record<string, unknown> | undefined;
    if (!entry) return null;
    const location = String(entry.location ?? entry.path ?? "");
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
    if (!parsed || typeof parsed !== "object" || !("projects" in parsed)) return null;
    const projects = (parsed as { projects?: unknown[] }).projects;
    if (!Array.isArray(projects)) return null;
    for (const e of projects) {
      if (!e || typeof e !== "object") continue;
      const entry = e as Record<string, unknown>;
      const location = String(entry.location ?? entry.path ?? "");
      if (!location) continue;
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
          lines.push(`  ${k}: ${JSON.stringify(String(v ?? ""))}`);
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
    const line = lines[i]!;
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
      while (i < lines.length && (lines[i]!.startsWith("  ") || lines[i]!.startsWith("\t"))) {
        children.push(lines[i]!.trim());
        i += 1;
      }
      if (children.length === 0) {
        result[key] = null;
      } else if (children[0]!.startsWith("- ")) {
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
  if (toPhase === "blocked") return null;

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
    const tasksPath = path.join(changeDir, "tasks.md");
    if (!(await fileHasContent(designPath))) {
      return `Cannot transition to "implementation": design.md must exist and have content. Complete the design phase first.`;
    }
    if (!(await fileHasContent(tasksPath))) {
      return `Cannot transition to "implementation": tasks.md must exist and have content. Complete the plan phase first.`;
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
export { resolveChangesDir, resolveChangeDir, resolveSharedMemoryDir, readStatusYaml, expandTilde };
