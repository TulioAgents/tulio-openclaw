import { html, nothing } from "lit";
import { renderProjectsAgents, renderProjectsAgentsStyles } from "./projects-agents.ts";
import { renderProjectsBoard, renderProjectsBoardStyles } from "./projects-board.ts";
import type { OpenSpecAgentStatus, OpenSpecChange, OpenSpecProject } from "./projects-types.ts";

export type ProjectsProps = {
  loading: boolean;
  error: string | null;
  projects: OpenSpecProject[];
  selectedProjectCode: string | null;
  changes: OpenSpecChange[];
  changesLoading: boolean;
  changesError: string | null;
  agents: OpenSpecAgentStatus[];
  agentsLoading: boolean;
  agentsError: string | null;
  onRefresh: () => void;
  onSelectProject: (projectCode: string) => void;
  onChangeSelect: (change: OpenSpecChange) => void;
};

export function renderProjects(props: ProjectsProps) {
  const {
    loading,
    error,
    projects,
    selectedProjectCode,
    changes,
    changesLoading,
    changesError,
    agents,
    agentsLoading,
    onRefresh,
    onSelectProject,
    onChangeSelect,
  } = props;

  const selectedProject = projects.find((p) => p.projectCode === selectedProjectCode) ?? null;

  return html`
    ${renderProjectsStyles()} ${renderProjectsBoardStyles()} ${renderProjectsAgentsStyles()}

    <div class="projects-view">
      ${loading
        ? html`<div class="projects-view__loading">Loading projects…</div>`
        : error
          ? html`
              <div class="projects-view__error">
                <span>${error}</span>
                <button class="projects-view__retry-btn" @click=${onRefresh}>Retry</button>
              </div>
            `
          : projects.length === 0
            ? html`
                <div class="projects-view__empty">
                  <div class="projects-view__empty-title">No projects found</div>
                  <div class="projects-view__empty-sub">
                    No OpenSpec projects are configured on this gateway.
                  </div>
                  <button class="projects-view__retry-btn" @click=${onRefresh}>Refresh</button>
                </div>
              `
            : html`
                ${projects.length > 1
                  ? html`
                      <div class="projects-view__selector">
                        <label class="projects-view__selector-label" for="project-select"
                          >Project</label
                        >
                        <select
                          id="project-select"
                          class="projects-view__select"
                          .value=${selectedProjectCode ?? ""}
                          @change=${(e: Event) => {
                            const sel = e.target as HTMLSelectElement;
                            onSelectProject(sel.value);
                          }}
                        >
                          ${projects.map(
                            (p) => html`
                              <option value="${p.projectCode}">
                                ${p.projectName} (${p.projectCode})
                              </option>
                            `,
                          )}
                        </select>
                        ${selectedProject
                          ? html`<span
                              class="projects-view__project-status projects-view__project-status--${selectedProject.status}"
                              >${selectedProject.status}</span
                            >`
                          : nothing}
                      </div>
                    `
                  : projects[0]
                    ? html`
                        <div class="projects-view__project-title">
                          <span class="projects-view__project-name"
                            >${projects[0].projectName}</span
                          >
                          <span class="projects-view__project-code"
                            >${projects[0].projectCode}</span
                          >
                          <span
                            class="projects-view__project-status projects-view__project-status--${projects[0]
                              .status}"
                            >${projects[0].status}</span
                          >
                        </div>
                      `
                    : nothing}
                ${changesLoading
                  ? html`<div class="projects-view__loading">Loading changes…</div>`
                  : changesError
                    ? html`
                        <div class="projects-view__error">
                          <span>${changesError}</span>
                          <button class="projects-view__retry-btn" @click=${onRefresh}>
                            Retry
                          </button>
                        </div>
                      `
                    : renderProjectsBoard({
                        projectCode: selectedProjectCode ?? "",
                        changes,
                        onChangeSelect,
                      })}

                <div class="projects-view__agents-section">
                  <div class="projects-view__agents-heading">Active Agents</div>
                  ${agentsLoading
                    ? html`<div class="projects-view__loading">Loading agents…</div>`
                    : renderProjectsAgents({ agents })}
                </div>
              `}
    </div>
  `;
}

function renderProjectsStyles() {
  return html`
    <style>
      .projects-view {
        padding: 16px 0;
      }
      .projects-view__loading {
        color: var(--color-text-muted, #888);
        font-size: 13px;
        padding: 24px 0;
        text-align: center;
      }
      .projects-view__error {
        display: flex;
        align-items: center;
        gap: 12px;
        color: var(--color-error, #c0392b);
        font-size: 13px;
        padding: 16px 0;
      }
      .projects-view__empty {
        text-align: center;
        padding: 48px 0;
      }
      .projects-view__empty-title {
        font-size: 16px;
        font-weight: 600;
        color: var(--color-text, inherit);
        margin-bottom: 8px;
      }
      .projects-view__empty-sub {
        font-size: 13px;
        color: var(--color-text-muted, #888);
        margin-bottom: 20px;
      }
      .projects-view__retry-btn {
        background: var(--color-surface-raised, var(--color-surface));
        border: 1px solid var(--color-border);
        border-radius: 4px;
        padding: 6px 14px;
        font-size: 13px;
        cursor: pointer;
        color: var(--color-text, inherit);
      }
      .projects-view__retry-btn:hover {
        border-color: var(--color-accent, var(--color-primary, #666));
      }
      .projects-view__selector {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 20px;
      }
      .projects-view__selector-label {
        font-size: 13px;
        font-weight: 600;
        color: var(--color-text-muted, #888);
      }
      .projects-view__select {
        background: var(--color-surface-raised, var(--color-surface));
        border: 1px solid var(--color-border);
        border-radius: 4px;
        padding: 4px 8px;
        font-size: 13px;
        color: var(--color-text, inherit);
        cursor: pointer;
      }
      .projects-view__project-title {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 20px;
      }
      .projects-view__project-name {
        font-size: 16px;
        font-weight: 700;
        color: var(--color-text, inherit);
      }
      .projects-view__project-code {
        font-family: var(--font-mono, monospace);
        font-size: 12px;
        color: var(--color-text-muted, #888);
        background: var(--color-surface-raised, var(--color-surface));
        border: 1px solid var(--color-border);
        border-radius: 4px;
        padding: 2px 6px;
      }
      .projects-view__project-status {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        border-radius: 4px;
        padding: 2px 8px;
      }
      .projects-view__project-status--active {
        background: rgba(39, 174, 96, 0.15);
        color: var(--color-success, #27ae60);
      }
      .projects-view__project-status--discovery {
        background: rgba(243, 156, 18, 0.15);
        color: var(--color-warning, #f39c12);
      }
      .projects-view__project-status--paused {
        background: rgba(128, 128, 128, 0.12);
        color: var(--color-text-muted, #888);
      }
      .projects-view__project-status--closed {
        background: rgba(128, 128, 128, 0.08);
        color: var(--color-text-muted, #aaa);
      }
      .projects-view__agents-section {
        margin-top: 28px;
        padding-top: 20px;
        border-top: 1px solid var(--color-border);
      }
      .projects-view__agents-heading {
        font-size: 13px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--color-text-muted, #888);
        margin-bottom: 8px;
      }
    </style>
  `;
}
