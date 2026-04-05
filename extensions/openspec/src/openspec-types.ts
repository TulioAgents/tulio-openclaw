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

export type TaskStatus = "todo" | "in_progress" | "blocked" | "in_review" | "done";
export type TaskPriority = "low" | "medium" | "high" | "critical";

export interface OpenSpecTask {
  id: string; // e.g. "T2.1"
  title: string;
  phase: string; // e.g. "Phase 2: Application Code"
  status: TaskStatus;
  priority: TaskPriority;
  assignee: string; // agent currently executing (e.g. "claudecoder")
  role: string; // required role (e.g. "sr-fullstack", "qa-engineer")
  owner: string; // who created/manages the task
  reviewer: string; // who reviews before marking done
  dependsOn: string[]; // task IDs
  blockedBy: string[]; // free-text blockers
  createdAt: string; // ISO 8601
  updatedAt: string;
  startedAt: string;
  completedAt: string;
  estimatedEffort: string;
}

export interface TaskTrackerEntry {
  id: string;
  title: string;
  status: TaskStatus;
  assignee: string;
  role: string;
  owner: string;
  reviewer: string;
  priority: TaskPriority;
  dependsOn: string[];
}

export interface TaskTracker {
  changeId: string;
  updatedAt: string;
  tasks: TaskTrackerEntry[];
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
