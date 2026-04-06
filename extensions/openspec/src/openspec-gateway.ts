import fs from "node:fs/promises";
import path from "node:path";
import type { GatewayRequestHandlerOptions } from "openclaw/plugin-sdk/core";
import type { OpenClawPluginApi } from "../runtime-api.js";
import {
  resolveChangesDir,
  readStatusYaml,
  readTaskTracker,
  listTaskFiles,
} from "./openspec-tool.js";
import type {
  OpenSpecAgentStatus,
  OpenSpecChange,
  OpenSpecPhase,
  OpenSpecProject,
  TaskTrackerEntry,
} from "./openspec-types.js";
import {
  readProjectMap,
  resolveProjectMapPath,
  resolveProjectLocation,
  countActiveChanges,
  expandTildeProjects,
} from "./projects-tool.js";

/** Read all changes for a project from its changes directory. */
async function listChangesForProject(projectLocation: string): Promise<OpenSpecChange[]> {
  const changesDir = resolveChangesDir(projectLocation);
  const changes: OpenSpecChange[] = [];
  try {
    const entries = await fs.readdir(changesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const changeDir = path.join(changesDir, entry.name);
      const change = await readStatusYaml(changeDir);
      if (change) {
        changes.push(change);
      }
    }
  } catch {
    // Directory may not exist yet
  }
  return changes;
}

/** Find a change by changeId across a project's changes directory. */
async function findChange(
  projectLocation: string,
  changeId: string,
): Promise<OpenSpecChange | null> {
  const changeDir = path.join(resolveChangesDir(projectLocation), changeId);
  return readStatusYaml(changeDir);
}

/** Read artifact files (*.md) from a change directory. */
async function readChangeArtifacts(
  projectLocation: string,
  changeId: string,
): Promise<Record<string, string>> {
  const changeDir = path.join(resolveChangesDir(projectLocation), changeId);
  const artifacts: Record<string, string> = {};
  try {
    const entries = await fs.readdir(changeDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) {
        continue;
      }
      try {
        const content = await fs.readFile(path.join(changeDir, entry.name), "utf8");
        artifacts[entry.name] = content;
      } catch {
        // skip unreadable
      }
    }
  } catch {
    // changeDir may not exist
  }
  return artifacts;
}

interface PhaseCheck {
  name: string;
  pass: boolean;
}

interface CanAdvanceResult {
  canAdvance: boolean;
  nextPhase: OpenSpecPhase | null;
  checks: PhaseCheck[];
  blockers: string[];
}

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

async function fileHasContent(filePath: string): Promise<boolean> {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return content.trim().length > 0;
  } catch {
    return false;
  }
}

async function dirHasFiles(dirPath: string): Promise<boolean> {
  try {
    const entries = await fs.readdir(dirPath);
    return entries.length > 0;
  } catch {
    return false;
  }
}

async function fileContains(filePath: string, text: string): Promise<boolean> {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return content.includes(text);
  } catch {
    return false;
  }
}

/** Pure deterministic phase gate — reads only files, no agent calls. */
async function checkCanAdvance(
  changeDir: string,
  currentPhase: OpenSpecPhase,
): Promise<CanAdvanceResult> {
  const idx = PHASE_ORDER.indexOf(currentPhase);
  const nextPhase: OpenSpecPhase | null =
    idx >= 0 && idx < PHASE_ORDER.length - 1 ? PHASE_ORDER[idx + 1] : null;

  if (!nextPhase || currentPhase === "done" || currentPhase === "blocked") {
    return { canAdvance: false, nextPhase, checks: [], blockers: ["Phase is terminal"] };
  }

  const checks: PhaseCheck[] = [];

  switch (currentPhase) {
    case "idea": {
      const pass = await fileHasContent(path.join(changeDir, "proposal.md"));
      checks.push({ name: "proposal.md exists with content", pass });
      break;
    }
    case "proposal": {
      const pass = await fileHasContent(path.join(changeDir, "tasks.md"));
      checks.push({ name: "tasks.md exists with content", pass });
      break;
    }
    case "plan": {
      const tasksMd = await fileHasContent(path.join(changeDir, "tasks.md"));
      const trackerYaml = await fileHasContent(path.join(changeDir, "tasks-tracker.yaml"));
      const tasksDir = await dirHasFiles(path.join(changeDir, "tasks"));
      checks.push({ name: "tasks.md exists with content", pass: tasksMd });
      checks.push({ name: "tasks-tracker.yaml exists with content", pass: trackerYaml });
      checks.push({ name: "tasks/ directory has task files", pass: tasksDir });
      break;
    }
    case "design": {
      const designMd = await fileHasContent(path.join(changeDir, "design.md"));
      const tasksMd = await fileHasContent(path.join(changeDir, "tasks.md"));
      checks.push({ name: "design.md exists with content", pass: designMd });
      checks.push({ name: "tasks.md exists with content", pass: tasksMd });
      break;
    }
    case "implementation": {
      const handoffMd = await fileHasContent(path.join(changeDir, "handoff.md"));
      checks.push({ name: "handoff.md exists with content", pass: handoffMd });
      // All tasks in tracker must be done
      const tracker = await readTaskTracker(changeDir);
      if (tracker && tracker.tasks.length > 0) {
        const allDone = tracker.tasks.every((t) => t.status === "done");
        const pendingCount = tracker.tasks.filter((t) => t.status !== "done").length;
        checks.push({
          name: `all tasks done in tasks-tracker.yaml (${tracker.tasks.length - pendingCount}/${tracker.tasks.length})`,
          pass: allDone,
        });
      } else {
        checks.push({ name: "tasks-tracker.yaml has tasks", pass: false });
      }
      break;
    }
    case "verification": {
      const signoff = await fileContains(path.join(changeDir, "verification.md"), "Signoff: YES");
      checks.push({ name: 'verification.md contains "Signoff: YES"', pass: signoff });
      break;
    }
    case "deployment": {
      const releaseMd = await fileHasContent(path.join(changeDir, "release.md"));
      checks.push({ name: "release.md exists with content", pass: releaseMd });
      break;
    }
  }

  const blockers = checks.filter((c) => !c.pass).map((c) => c.name);
  return { canAdvance: blockers.length === 0, nextPhase, checks, blockers };
}

export function createOpenSpecGatewayHandlers(api: OpenClawPluginApi) {
  /** openspec.projects.list — returns all projects with activeChanges count */
  const handleProjectsList = async (opts: GatewayRequestHandlerOptions): Promise<void> => {
    try {
      const mapPath = resolveProjectMapPath(api);
      const projectMap = await readProjectMap(mapPath);
      const projects: OpenSpecProject[] = await Promise.all(
        projectMap.projects.map(async (entry) => {
          const location = expandTildeProjects(entry.location);
          const activeChanges = await countActiveChanges(location);
          return {
            projectCode: entry.projectCode,
            projectName: entry.projectName,
            location,
            status: entry.status,
            activeChanges,
          };
        }),
      );
      opts.respond(true, { projects });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      opts.respond(false, undefined, { code: "openspec.error", message });
    }
  };

  /** openspec.changes.list — returns changes for a project */
  const handleChangesList = async (opts: GatewayRequestHandlerOptions): Promise<void> => {
    const projectCode =
      typeof opts.params.projectCode === "string" ? opts.params.projectCode.trim() : "";
    if (!projectCode) {
      opts.respond(false, undefined, {
        code: "openspec.missing_param",
        message: "projectCode is required",
      });
      return;
    }
    try {
      const location = await resolveProjectLocation(api, projectCode);
      if (!location) {
        opts.respond(false, undefined, {
          code: "openspec.not_found",
          message: `Project ${projectCode} not found`,
        });
        return;
      }
      const changes = await listChangesForProject(location);
      opts.respond(true, { changes });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      opts.respond(false, undefined, { code: "openspec.error", message });
    }
  };

  /** openspec.changes.detail — returns a single change with artifact content */
  const handleChangesDetail = async (opts: GatewayRequestHandlerOptions): Promise<void> => {
    const projectCode =
      typeof opts.params.projectCode === "string" ? opts.params.projectCode.trim() : "";
    const changeId = typeof opts.params.changeId === "string" ? opts.params.changeId.trim() : "";

    if (!projectCode || !changeId) {
      opts.respond(false, undefined, {
        code: "openspec.missing_param",
        message: "projectCode and changeId are required",
      });
      return;
    }
    try {
      const location = await resolveProjectLocation(api, projectCode);
      if (!location) {
        opts.respond(false, undefined, {
          code: "openspec.not_found",
          message: `Project ${projectCode} not found`,
        });
        return;
      }
      const change = await findChange(location, changeId);
      if (!change) {
        opts.respond(false, undefined, {
          code: "openspec.not_found",
          message: `Change ${changeId} not found`,
        });
        return;
      }
      const artifacts = await readChangeArtifacts(location, changeId);
      // Include task summary for dashboard rendering
      const changeDir = path.join(resolveChangesDir(location), changeId);
      const tracker = await readTaskTracker(changeDir);
      const tasks: TaskTrackerEntry[] =
        tracker?.tasks ??
        (await listTaskFiles(changeDir).then((ts) =>
          ts.map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            assignee: t.assignee,
            role: t.role,
            owner: t.owner,
            reviewer: t.reviewer,
            priority: t.priority,
            dependsOn: t.dependsOn,
          })),
        ));
      opts.respond(true, { change, artifacts, tasks });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      opts.respond(false, undefined, { code: "openspec.error", message });
    }
  };

  /** openspec.tasks.list — returns task tracker entries for a change (fast path via tasks-tracker.yaml) */
  const handleTasksList = async (opts: GatewayRequestHandlerOptions): Promise<void> => {
    const projectCode =
      typeof opts.params.projectCode === "string" ? opts.params.projectCode.trim() : "";
    const changeId = typeof opts.params.changeId === "string" ? opts.params.changeId.trim() : "";

    if (!projectCode || !changeId) {
      opts.respond(false, undefined, {
        code: "openspec.missing_param",
        message: "projectCode and changeId are required",
      });
      return;
    }
    try {
      const location = await resolveProjectLocation(api, projectCode);
      if (!location) {
        opts.respond(false, undefined, {
          code: "openspec.not_found",
          message: `Project ${projectCode} not found`,
        });
        return;
      }
      const changeDir = path.join(resolveChangesDir(location), changeId);
      // Fast path: tracker YAML
      const tracker = await readTaskTracker(changeDir);
      if (tracker && tracker.tasks.length > 0) {
        opts.respond(true, { tasks: tracker.tasks, source: "tracker" });
        return;
      }
      // Fallback: parse individual task files
      const tasks = await listTaskFiles(changeDir);
      opts.respond(true, { tasks, source: "files" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      opts.respond(false, undefined, { code: "openspec.error", message });
    }
  };

  /** openspec.changes.can-advance — deterministic phase gate check (zero agent tokens) */
  const handleCanAdvance = async (opts: GatewayRequestHandlerOptions): Promise<void> => {
    const projectCode =
      typeof opts.params.projectCode === "string" ? opts.params.projectCode.trim() : "";
    const changeId = typeof opts.params.changeId === "string" ? opts.params.changeId.trim() : "";

    if (!projectCode || !changeId) {
      opts.respond(false, undefined, {
        code: "openspec.missing_param",
        message: "projectCode and changeId are required",
      });
      return;
    }

    try {
      const location = await resolveProjectLocation(api, projectCode);
      if (!location) {
        opts.respond(false, undefined, {
          code: "openspec.not_found",
          message: `Project ${projectCode} not found`,
        });
        return;
      }

      const changeDir = path.join(resolveChangesDir(location), changeId);
      const change = await readStatusYaml(changeDir);
      if (!change) {
        opts.respond(false, undefined, {
          code: "openspec.not_found",
          message: `Change ${changeId} not found`,
        });
        return;
      }

      const { canAdvance, nextPhase, checks, blockers } = await checkCanAdvance(
        changeDir,
        change.phase,
      );

      opts.respond(true, {
        canAdvance,
        currentPhase: change.phase,
        nextPhase,
        checks,
        blockers,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      opts.respond(false, undefined, { code: "openspec.error", message });
    }
  };

  /**
   * openspec.agents.status — returns active agent statuses
   *
   * TODO: The plugin SDK does not expose a public surface for querying active
   * subagent sessions by sessionKey prefix. This implementation returns an
   * empty array as a placeholder. To implement fully, a plugin SDK seam would
   * need to expose session listing filtered by sessionKey pattern
   * (e.g. "agent:openspec:*").
   */
  const handleAgentsStatus = async (opts: GatewayRequestHandlerOptions): Promise<void> => {
    // TODO: Query active sessions matching sessionKey prefix "agent:openspec:*"
    // when the plugin SDK exposes a session listing seam.
    const agents: OpenSpecAgentStatus[] = [];
    opts.respond(true, { agents });
  };

  return {
    handleProjectsList,
    handleChangesList,
    handleChangesDetail,
    handleAgentsStatus,
    handleTasksList,
    handleCanAdvance,
  };
}
