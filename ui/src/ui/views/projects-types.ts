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

export interface OpenSpecChange {
  changeId: string;
  title: string;
  phase: OpenSpecPhase;
  owner: string;
  assignees: Record<string, string>;
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

export interface OpenSpecProject {
  projectCode: string;
  projectName: string;
  location: string;
  status: "active" | "discovery" | "paused" | "closed";
  activeChanges: number;
}

/** All phases shown as kanban columns (excluding "blocked" which is a state, not a column). */
export const KANBAN_PHASES: OpenSpecPhase[] = [
  "idea",
  "proposal",
  "plan",
  "design",
  "implementation",
  "verification",
  "deployment",
  "done",
];
