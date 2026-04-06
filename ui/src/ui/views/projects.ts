import { html, nothing } from "lit";
import { renderProjectsAgents, renderProjectsAgentsStyles } from "./projects-agents.ts";
import { renderProjectsBoard, renderProjectsBoardStyles } from "./projects-board.ts";
import type {
  OpenSpecAgentStatus,
  OpenSpecChange,
  OpenSpecProject,
  TaskTrackerEntry,
} from "./projects-types.ts";

/** Map task status to a badge style. */
function taskStatusBadge(status: TaskTrackerEntry["status"]) {
  const map: Record<string, { label: string; cls: string }> = {
    todo: { label: "Todo", cls: "todo" },
    in_progress: { label: "Active", cls: "active" },
    blocked: { label: "Blocked", cls: "blocked" },
    in_review: { label: "Review", cls: "review" },
    done: { label: "Done", cls: "done" },
  };
  return map[status] ?? { label: status, cls: "todo" };
}

/** Map priority to a color class. */
function priorityCls(priority: TaskTrackerEntry["priority"]) {
  const map: Record<string, string> = {
    critical: "critical",
    high: "high",
    medium: "medium",
    low: "low",
  };
  return map[priority] ?? "medium";
}

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
  selectedChange: OpenSpecChange | null;
  selectedChangeTasks: TaskTrackerEntry[];
  changeDetailLoading: boolean;
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
    selectedChange,
    selectedChangeTasks,
    changeDetailLoading,
  } = props;

  const selectedProject = projects.find((p) => p.projectCode === selectedProjectCode) ?? null;

  // Build a map of changeId -> tasks for the board cards
  const tasksByChange = new Map<string, TaskTrackerEntry[]>();
  if (selectedChange && selectedChangeTasks.length > 0) {
    tasksByChange.set(selectedChange.changeId, selectedChangeTasks);
  }

  return html`
    ${renderProjectsStyles()} ${renderProjectsBoardStyles()} ${renderProjectsAgentsStyles()}
    ${renderDetailPanelStyles()}

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
                        <button
                          class="projects-view__refresh-btn"
                          @click=${onRefresh}
                          title="Refresh"
                        >
                          ↺
                        </button>
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
                          <button
                            class="projects-view__refresh-btn"
                            @click=${onRefresh}
                            title="Refresh"
                          >
                            ↺
                          </button>
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
                        tasksByChange,
                        selectedChangeId: selectedChange?.changeId ?? null,
                        onChangeSelect,
                      })}
                ${selectedChange
                  ? renderDetailPanel(
                      selectedChange,
                      selectedChangeTasks,
                      changeDetailLoading,
                      onChangeSelect,
                    )
                  : nothing}

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

function renderDetailPanel(
  change: OpenSpecChange,
  tasks: TaskTrackerEntry[],
  loading: boolean,
  onClose: (change: OpenSpecChange) => void,
) {
  const doneTasks = tasks.filter((t) => t.status === "done").length;
  const totalTasks = tasks.length;

  // Group by phase prefix (e.g. "Phase 1: ...", "Phase 2: ...")
  const phases = new Map<string, TaskTrackerEntry[]>();
  for (const task of tasks) {
    const phase = task.id.split(".")[0] ?? task.id; // e.g. "T1" from "T1.1"
    const existing = phases.get(phase) ?? [];
    existing.push(task);
    phases.set(phase, existing);
  }

  return html`
    <div class="detail-panel">
      <div class="detail-panel__header">
        <div class="detail-panel__header-left">
          <span class="detail-panel__change-id">${change.changeId}</span>
          <span class="detail-panel__title">${change.title}</span>
          ${totalTasks > 0
            ? html`<span class="detail-panel__progress-pill">${doneTasks}/${totalTasks} done</span>`
            : nothing}
        </div>
        <button class="detail-panel__close" @click=${() => onClose(change)} title="Close">✕</button>
      </div>

      <div class="detail-panel__body">
        ${loading
          ? html`<div class="detail-panel__loading">Loading tasks…</div>`
          : tasks.length === 0
            ? html`<div class="detail-panel__empty">No tasks found for this change.</div>`
            : html`
                <table class="detail-panel__table">
                  <thead>
                    <tr>
                      <th class="detail-panel__th">ID</th>
                      <th class="detail-panel__th">Task</th>
                      <th class="detail-panel__th">Status</th>
                      <th class="detail-panel__th">Role</th>
                      <th class="detail-panel__th">Assignee</th>
                      <th class="detail-panel__th">Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${tasks.map((task) => {
                      const badge = taskStatusBadge(task.status);
                      const pri = priorityCls(task.priority);
                      return html`
                        <tr class="detail-panel__row detail-panel__row--${task.status}">
                          <td class="detail-panel__td detail-panel__td--id">${task.id}</td>
                          <td class="detail-panel__td detail-panel__td--title">${task.title}</td>
                          <td class="detail-panel__td">
                            <span class="detail-panel__badge detail-panel__badge--${badge.cls}"
                              >${badge.label}</span
                            >
                          </td>
                          <td class="detail-panel__td detail-panel__td--meta">
                            ${task.role || "—"}
                          </td>
                          <td class="detail-panel__td detail-panel__td--meta">
                            ${task.assignee || "—"}
                          </td>
                          <td class="detail-panel__td">
                            <span class="detail-panel__priority detail-panel__priority--${pri}"
                              >${task.priority}</span
                            >
                          </td>
                        </tr>
                      `;
                    })}
                  </tbody>
                </table>
              `}
      </div>
    </div>
  `;
}

function renderDetailPanelStyles() {
  return html`
    <style>
      .detail-panel {
        margin: 16px 0;
        border: 1px solid var(--color-border);
        border-radius: 10px;
        background: var(--color-surface-raised, var(--color-surface));
        overflow: hidden;
        animation: detail-slide-in 0.18s ease-out;
      }
      @keyframes detail-slide-in {
        from {
          opacity: 0;
          transform: translateY(-6px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .detail-panel__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        border-bottom: 1px solid var(--color-border);
        background: var(--color-surface-subtle, rgba(0, 0, 0, 0.02));
        gap: 12px;
      }
      .detail-panel__header-left {
        display: flex;
        align-items: center;
        gap: 10px;
        overflow: hidden;
        flex: 1;
      }
      .detail-panel__change-id {
        font-family: var(--font-mono, monospace);
        font-size: 11px;
        color: var(--color-text-muted, #aaa);
        white-space: nowrap;
        flex-shrink: 0;
      }
      .detail-panel__title {
        font-size: 14px;
        font-weight: 700;
        color: var(--color-text, inherit);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .detail-panel__progress-pill {
        background: rgba(39, 174, 96, 0.12);
        color: var(--color-success, #27ae60);
        font-size: 11px;
        font-weight: 700;
        border-radius: 10px;
        padding: 2px 8px;
        white-space: nowrap;
        flex-shrink: 0;
      }
      .detail-panel__close {
        background: none;
        border: none;
        color: var(--color-text-muted, #aaa);
        font-size: 14px;
        cursor: pointer;
        padding: 4px 6px;
        border-radius: 4px;
        flex-shrink: 0;
        line-height: 1;
      }
      .detail-panel__close:hover {
        background: var(--color-border);
        color: var(--color-text, inherit);
      }
      .detail-panel__body {
        overflow-x: auto;
      }
      .detail-panel__loading,
      .detail-panel__empty {
        padding: 20px 16px;
        color: var(--color-text-muted, #888);
        font-size: 13px;
        text-align: center;
      }
      .detail-panel__table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
      }
      .detail-panel__th {
        text-align: left;
        padding: 8px 12px;
        border-bottom: 1px solid var(--color-border);
        color: var(--color-text-muted, #888);
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        white-space: nowrap;
        background: var(--color-surface-subtle, rgba(0, 0, 0, 0.01));
      }
      .detail-panel__td {
        padding: 8px 12px;
        border-bottom: 1px solid var(--color-border-subtle, rgba(0, 0, 0, 0.04));
        vertical-align: middle;
        color: var(--color-text, inherit);
      }
      .detail-panel__row--done .detail-panel__td {
        opacity: 0.6;
      }
      .detail-panel__row:last-child .detail-panel__td {
        border-bottom: none;
      }
      .detail-panel__td--id {
        font-family: var(--font-mono, monospace);
        font-size: 11px;
        color: var(--color-text-muted, #aaa);
        white-space: nowrap;
        width: 56px;
      }
      .detail-panel__td--title {
        font-weight: 500;
        max-width: 320px;
      }
      .detail-panel__td--meta {
        color: var(--color-text-muted, #888);
        font-size: 11px;
        white-space: nowrap;
      }
      .detail-panel__badge {
        display: inline-block;
        font-size: 10px;
        font-weight: 700;
        border-radius: 4px;
        padding: 2px 7px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        white-space: nowrap;
      }
      .detail-panel__badge--todo {
        background: rgba(128, 128, 128, 0.1);
        color: var(--color-text-muted, #888);
      }
      .detail-panel__badge--active {
        background: rgba(52, 152, 219, 0.12);
        color: #2980b9;
      }
      .detail-panel__badge--blocked {
        background: rgba(192, 57, 43, 0.1);
        color: var(--color-error, #c0392b);
      }
      .detail-panel__badge--review {
        background: rgba(243, 156, 18, 0.12);
        color: #d68910;
      }
      .detail-panel__badge--done {
        background: rgba(39, 174, 96, 0.1);
        color: var(--color-success, #27ae60);
      }
      .detail-panel__priority {
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .detail-panel__priority--critical {
        color: var(--color-error, #c0392b);
      }
      .detail-panel__priority--high {
        color: #e67e22;
      }
      .detail-panel__priority--medium {
        color: var(--color-text-muted, #888);
      }
      .detail-panel__priority--low {
        color: var(--color-text-muted, #bbb);
      }
    </style>
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
      .projects-view__refresh-btn {
        background: none;
        border: 1px solid var(--color-border);
        border-radius: 4px;
        padding: 3px 8px;
        font-size: 14px;
        cursor: pointer;
        color: var(--color-text-muted, #888);
        line-height: 1;
      }
      .projects-view__refresh-btn:hover {
        color: var(--color-text, inherit);
        border-color: var(--color-accent, #666);
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
