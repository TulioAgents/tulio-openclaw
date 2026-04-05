export type OpenSpecPhase =
  | "idea"
  | "proposal"
  | "plan"
  | "design"
  | "implementation"
  | "verification"
  | "deployment"
  | "done"
  | "blocked";

export interface OpenSpecProject {
  projectCode: string;
  projectName: string;
  location: string;
  status: "active" | "discovery" | "paused" | "closed";
  activeChanges: number;
}

export interface OpenSpecChange {
  changeId: string;
  title: string;
  phase: OpenSpecPhase;
  owner: string;
  assignees: Record<string, string>; // role -> sessionKey
  blockers: string[];
  branch: string;
  worktree?: string;
  createdAt: number;
  updatedAt: number;
  flowId: string;
  projectCode: string;
}

export interface OpenSpecAgentStatus {
  sessionKey: string;
  role: string;
  changeId: string;
  projectCode: string;
  status: "running" | "idle" | "blocked" | "completed" | "failed";
  currentTask: string;
  startedAt: number;
  lastEventAt: number;
}

export interface OpenSpecBoardData {
  projectCode: string;
  columns: Array<{
    phase: OpenSpecPhase;
    changes: OpenSpecChange[];
  }>;
  agents: OpenSpecAgentStatus[];
}

/** Canonical (normalized) project map entry — all fields resolved from raw YAML. */
export interface ProjectMapEntry {
  projectName: string;
  projectCode: string;
  location: string;
  status: "active" | "discovery" | "paused" | "closed";
}

export interface ProjectMap {
  version?: number;
  root?: string;
  projects: ProjectMapEntry[];
}
