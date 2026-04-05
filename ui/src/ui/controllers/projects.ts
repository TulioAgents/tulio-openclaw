import type { GatewayBrowserClient } from "../gateway.ts";
import type {
  OpenSpecAgentStatus,
  OpenSpecChange,
  OpenSpecProject,
} from "../views/projects-types.ts";

export type ProjectsState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  projectsLoading: boolean;
  projectsError: string | null;
  projectsList: OpenSpecProject[];
  projectsSelectedCode: string | null;
  projectsChangesLoading: boolean;
  projectsChangesError: string | null;
  projectsChanges: OpenSpecChange[];
  projectsAgentsLoading: boolean;
  projectsAgentsError: string | null;
  projectsAgents: OpenSpecAgentStatus[];
};

/** Load the list of OpenSpec projects from the gateway. */
export async function loadProjects(state: ProjectsState): Promise<void> {
  if (!state.client || !state.connected) {
    return;
  }
  if (state.projectsLoading) {
    return;
  }
  state.projectsLoading = true;
  state.projectsError = null;
  try {
    const result = (await state.client.request("openspec.projects.list", {})) as {
      projects?: OpenSpecProject[];
    };
    state.projectsList = result?.projects ?? [];
    // Auto-select the first project if nothing is selected yet.
    if (!state.projectsSelectedCode && state.projectsList.length > 0) {
      state.projectsSelectedCode = state.projectsList[0].projectCode;
    }
  } catch (err) {
    state.projectsError = String(err);
    state.projectsList = [];
  } finally {
    state.projectsLoading = false;
  }
}

/** Load changes for the currently selected project. */
export async function loadProjectChanges(state: ProjectsState): Promise<void> {
  if (!state.client || !state.connected || !state.projectsSelectedCode) {
    return;
  }
  if (state.projectsChangesLoading) {
    return;
  }
  state.projectsChangesLoading = true;
  state.projectsChangesError = null;
  try {
    const result = (await state.client.request("openspec.changes.list", {
      projectCode: state.projectsSelectedCode,
    })) as { changes?: OpenSpecChange[] };
    state.projectsChanges = result?.changes ?? [];
  } catch (err) {
    state.projectsChangesError = String(err);
    state.projectsChanges = [];
  } finally {
    state.projectsChangesLoading = false;
  }
}

/** Load agent statuses for the currently selected project. */
export async function loadProjectAgents(state: ProjectsState): Promise<void> {
  if (!state.client || !state.connected || !state.projectsSelectedCode) {
    return;
  }
  if (state.projectsAgentsLoading) {
    return;
  }
  state.projectsAgentsLoading = true;
  state.projectsAgentsError = null;
  try {
    const result = (await state.client.request("openspec.agents.status", {
      projectCode: state.projectsSelectedCode,
    })) as { agents?: OpenSpecAgentStatus[] };
    state.projectsAgents = result?.agents ?? [];
  } catch (err) {
    state.projectsAgentsError = String(err);
    state.projectsAgents = [];
  } finally {
    state.projectsAgentsLoading = false;
  }
}

/** Load all projects data: projects list, then changes + agents for selected project. */
export async function loadProjectsTab(state: ProjectsState): Promise<void> {
  await loadProjects(state);
  if (state.projectsSelectedCode) {
    await Promise.all([loadProjectChanges(state), loadProjectAgents(state)]);
  }
}

/** Select a project and load its data. */
export async function selectProject(state: ProjectsState, projectCode: string): Promise<void> {
  state.projectsSelectedCode = projectCode;
  state.projectsChanges = [];
  state.projectsChangesError = null;
  state.projectsAgents = [];
  state.projectsAgentsError = null;
  await Promise.all([loadProjectChanges(state), loadProjectAgents(state)]);
}
