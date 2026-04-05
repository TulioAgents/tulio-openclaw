import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { Type } from "@sinclair/typebox";
import { z } from "openclaw/plugin-sdk/zod";
import { parse as parseYaml } from "yaml";
import type { OpenClawPluginApi } from "../runtime-api.js";
import { resolveChangesDir, readStatusYaml } from "./openspec-tool.js";

const execFileAsync = promisify(execFile);
import type {
  OpenSpecChange,
  OpenSpecProject,
  ProjectMap,
  ProjectMapEntry,
} from "./openspec-types.js";

const OpenSpecProjectsInputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("list") }),
  z.object({ action: z.literal("context"), projectCode: z.string().min(1) }),
  z.object({ action: z.literal("changes"), projectCode: z.string().min(1) }),
  z.object({
    action: z.literal("git_init"),
    projectCode: z.string().min(1),
    /** Optional initial branch name — defaults to "main" */
    defaultBranch: z.string().optional(),
  }),
]);

type OpenSpecProjectsInput = z.infer<typeof OpenSpecProjectsInputSchema>;

function expandTilde(p: string): string {
  if (p.startsWith("~/") || p === "~") {
    return path.join(os.homedir(), p.slice(2));
  }
  return p;
}

function resolveProjectMapPath(api: OpenClawPluginApi): string {
  const rawPath =
    typeof api.pluginConfig === "object" &&
    api.pluginConfig !== null &&
    "projectMapPath" in api.pluginConfig &&
    typeof (api.pluginConfig as Record<string, unknown>).projectMapPath === "string"
      ? ((api.pluginConfig as Record<string, unknown>).projectMapPath as string)
      : "~/coding-projects/project-map.yaml";
  return expandTilde(rawPath);
}

/** Normalize a raw project-map entry to canonical field names. */
function normalizeProjectMapEntry(raw: Record<string, unknown>): ProjectMapEntry {
  // Support both canonical (projectCode/projectName/location) and legacy (name/path) field names.
  const location = String(raw.location ?? raw.path ?? "");
  const projectName = String(raw.projectName ?? raw.name ?? location);
  const projectCode = String(raw.projectCode ?? raw.name ?? projectName);
  const status = (raw.status ?? "active") as ProjectMapEntry["status"];
  return { projectName, projectCode, location, status };
}

async function readProjectMap(mapPath: string): Promise<ProjectMap> {
  const raw = await fs.readFile(mapPath, "utf8");
  const parsed = parseYaml(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || !("projects" in parsed)) {
    throw new Error(`Invalid project-map.yaml at ${mapPath}`);
  }
  const rawMap = parsed as { projects?: unknown[] };
  const projects = Array.isArray(rawMap.projects)
    ? rawMap.projects
        .filter((e) => e && typeof e === "object")
        .map((e) => normalizeProjectMapEntry(e as Record<string, unknown>))
    : [];
  return { ...rawMap, projects };
}

async function countActiveChanges(projectLocation: string): Promise<number> {
  const changesDir = resolveChangesDir(projectLocation);
  try {
    const entries = await fs.readdir(changesDir, { withFileTypes: true });
    let count = 0;
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const changeDir = path.join(changesDir, entry.name);
      const change = await readStatusYaml(changeDir);
      if (change && change.phase !== "done") {
        count += 1;
      }
    }
    return count;
  } catch {
    return 0;
  }
}

async function handleList(api: OpenClawPluginApi): Promise<string> {
  const mapPath = resolveProjectMapPath(api);
  const projectMap = await readProjectMap(mapPath);

  const projects: OpenSpecProject[] = await Promise.all(
    projectMap.projects.map(async (entry: ProjectMapEntry) => {
      const location = expandTilde(entry.location);
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

  return JSON.stringify({ ok: true, projects }, null, 2);
}

async function resolveProjectLocation(
  api: OpenClawPluginApi,
  projectCode: string,
): Promise<string | null> {
  const mapPath = resolveProjectMapPath(api);
  const projectMap = await readProjectMap(mapPath);
  const entry = projectMap.projects.find((p) => p.projectCode === projectCode);
  if (!entry) {
    return null;
  }
  return expandTilde(entry.location);
}

async function handleContext(
  api: OpenClawPluginApi,
  input: Extract<OpenSpecProjectsInput, { action: "context" }>,
): Promise<string> {
  const location = await resolveProjectLocation(api, input.projectCode);
  if (!location) {
    return JSON.stringify(
      { ok: false, error: `Project ${input.projectCode} not found in project map` },
      null,
      2,
    );
  }

  const sharedMemoryDir = path.join(location, ".ai", "shared-memory");
  let files: Record<string, string> = {};

  try {
    const entries = await fs.readdir(sharedMemoryDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) {
        continue;
      }
      const filePath = path.join(sharedMemoryDir, entry.name);
      try {
        const content = await fs.readFile(filePath, "utf8");
        files[entry.name] = content;
      } catch {
        // skip unreadable files
      }
    }
  } catch {
    // shared-memory dir may not exist yet
  }

  return JSON.stringify({ ok: true, projectCode: input.projectCode, location, files }, null, 2);
}

async function handleChanges(
  api: OpenClawPluginApi,
  input: Extract<OpenSpecProjectsInput, { action: "changes" }>,
): Promise<string> {
  const location = await resolveProjectLocation(api, input.projectCode);
  if (!location) {
    return JSON.stringify(
      { ok: false, error: `Project ${input.projectCode} not found in project map` },
      null,
      2,
    );
  }

  const changesDir = resolveChangesDir(location);
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
    // changes dir may not exist yet
  }

  return JSON.stringify({ ok: true, projectCode: input.projectCode, changes }, null, 2);
}

async function handleGitInit(
  api: OpenClawPluginApi,
  input: Extract<OpenSpecProjectsInput, { action: "git_init" }>,
): Promise<string> {
  const location = await resolveProjectLocation(api, input.projectCode);
  if (!location) {
    return JSON.stringify(
      { ok: false, error: `Project ${input.projectCode} not found in project map` },
      null,
      2,
    );
  }

  const defaultBranch = input.defaultBranch ?? "main";

  // Ensure the project directory exists
  await fs.mkdir(location, { recursive: true });

  // Check if already a git repo
  try {
    await execFileAsync("git", ["rev-parse", "--git-dir"], { cwd: location });
    return JSON.stringify(
      {
        ok: true,
        alreadyInitialized: true,
        location,
        message: `Git repository already exists at ${location}`,
      },
      null,
      2,
    );
  } catch {
    // Not yet a git repo — proceed with init
  }

  const steps: string[] = [];

  // git init with default branch
  await execFileAsync("git", ["init", `-b`, defaultBranch], { cwd: location });
  steps.push(`git init -b ${defaultBranch}`);

  // Create a .gitignore if none exists
  const gitignorePath = path.join(location, ".gitignore");
  try {
    await fs.access(gitignorePath);
  } catch {
    await fs.writeFile(
      gitignorePath,
      ["node_modules/", "dist/", ".DS_Store", "*.log", ".env", ".env.local", ""].join("\n"),
      "utf8",
    );
    steps.push("created .gitignore");
  }

  // Initial commit so worktrees have a valid base
  await execFileAsync("git", ["add", ".gitignore"], { cwd: location });
  steps.push("git add .gitignore");

  await execFileAsync("git", ["commit", "--allow-empty", "-m", "chore: initialize repository"], {
    cwd: location,
  });
  steps.push(`git commit "chore: initialize repository"`);

  return JSON.stringify(
    {
      ok: true,
      alreadyInitialized: false,
      location,
      defaultBranch,
      steps,
      message: `Git repository initialized at ${location} on branch "${defaultBranch}". Ready for git worktrees.`,
    },
    null,
    2,
  );
}

export function createOpenSpecProjectsTool(api: OpenClawPluginApi) {
  return {
    name: "openspec_projects",
    label: "OpenSpec Projects",
    description:
      "List projects from the project map, retrieve shared-memory context, list changes for a project, or initialize git in a project directory.",
    parameters: Type.Object(
      {
        action: Type.Unsafe<string>({
          type: "string",
          enum: ["list", "context", "changes", "git_init"],
          description:
            "The action to perform. Use git_init to initialize a git repo in the project directory (required before creating worktrees).",
        }),
        projectCode: Type.Optional(
          Type.String({
            description: "Project code (required for context, changes, and git_init actions).",
          }),
        ),
        defaultBranch: Type.Optional(
          Type.String({
            description:
              "Default branch name for git_init (defaults to 'main'). Use 'main' unless the project convention differs.",
          }),
        ),
      },
      { additionalProperties: false },
    ),
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      const parseResult = OpenSpecProjectsInputSchema.safeParse(rawParams);
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
        let resultText: string;
        switch (input.action) {
          case "list":
            resultText = await handleList(api);
            break;
          case "context":
            resultText = await handleContext(api, input);
            break;
          case "changes":
            resultText = await handleChanges(api, input);
            break;
          case "git_init":
            resultText = await handleGitInit(api, input);
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

// Export for reuse in gateway
export {
  readProjectMap,
  resolveProjectMapPath,
  resolveProjectLocation,
  countActiveChanges,
  expandTilde as expandTildeProjects,
};
