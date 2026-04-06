import { html } from "lit";
import { renderChangeCardStyles } from "./projects-card.ts";
import type { OpenSpecChange, OpenSpecPhase, TaskTrackerEntry } from "./projects-types.ts";

/** Human-readable label for each phase. */
function phaseLabel(phase: OpenSpecPhase): string {
  switch (phase) {
    case "idea":
      return "Idea";
    case "proposal":
      return "Proposal";
    case "plan":
      return "Plan";
    case "design":
      return "Design";
    case "implementation":
      return "Implementation";
    case "verification":
      return "Verification";
    case "deployment":
      return "Deployment";
    case "done":
      return "Done";
    case "blocked":
      return "Blocked";
    default:
      return phase;
  }
}

/** CSS class suffix for the phase pill. */
function phaseClass(phase: OpenSpecPhase): string {
  switch (phase) {
    case "idea":
      return "idea";
    case "proposal":
      return "proposal";
    case "plan":
      return "plan";
    case "design":
      return "design";
    case "implementation":
      return "implementation";
    case "verification":
      return "verification";
    case "deployment":
      return "deployment";
    case "done":
      return "done";
    case "blocked":
      return "blocked";
    default:
      return "idea";
  }
}

/** Format a short relative time. */
function formatRelativeTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) {
    return "just now";
  }
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600) % 24;
  const days = Math.floor(totalSeconds / 86400);
  if (days > 0) {
    return `${days}d ago`;
  }
  if (hours > 0) {
    return `${hours}h ago`;
  }
  return `${minutes}m ago`;
}

export type ProjectsBoardProps = {
  projectCode: string;
  changes: OpenSpecChange[];
  tasksByChange?: Map<string, TaskTrackerEntry[]>;
  selectedChangeId?: string | null;
  onChangeSelect: (change: OpenSpecChange) => void;
};

export function renderProjectsBoard({
  projectCode: _projectCode,
  changes,
  tasksByChange,
  selectedChangeId,
  onChangeSelect,
}: ProjectsBoardProps) {
  if (changes.length === 0) {
    return html`
      ${renderChangeCardStyles()} ${renderProjectsBoardStyles()}
      <div class="changes-list__empty">No changes found for this project.</div>
    `;
  }

  return html`
    ${renderChangeCardStyles()} ${renderProjectsBoardStyles()}
    <div class="changes-list">
      ${changes.map((change) => {
        const tasks = tasksByChange?.get(change.changeId) ?? [];
        const totalTasks = tasks.length;
        const doneTasks = tasks.filter((t) => t.status === "done").length;
        const inProgressTasks = tasks.filter((t) => t.status === "in_progress").length;
        const blockedTasks = tasks.filter((t) => t.status === "blocked").length;
        const donePercent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
        const inProgressPercent =
          totalTasks > 0 ? Math.round((inProgressTasks / totalTasks) * 100) : 0;
        const isSelected = selectedChangeId === change.changeId;
        const effectivePhase: OpenSpecPhase = change.phase === "blocked" ? "blocked" : change.phase;

        // Assignees list
        const assigneeEntries = Object.entries(change.assignees ?? {});

        return html`
          <div
            class="change-item ${isSelected ? "change-item--selected" : ""} ${change.blockers
              .length > 0
              ? "change-item--blocked"
              : ""}"
            role="button"
            tabindex="0"
            @click=${() => onChangeSelect(change)}
            @keydown=${(e: KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onChangeSelect(change);
              }
            }}
          >
            <!-- Left: phase pill + title + id -->
            <div class="change-item__main">
              <div class="change-item__top">
                <span class="change-item__phase change-item__phase--${phaseClass(effectivePhase)}">
                  ${phaseLabel(effectivePhase)}
                </span>
                ${change.blockers.length > 0
                  ? html`<span class="change-item__blocker-pill">⚠ Blocked</span>`
                  : ""}
                <span class="change-item__id">${change.changeId}</span>
              </div>
              <div class="change-item__title">${change.title}</div>
              ${change.branch ? html`<div class="change-item__branch">${change.branch}</div>` : ""}
            </div>

            <!-- Center: progress bar -->
            <div class="change-item__progress-col">
              ${totalTasks > 0
                ? html`
                    <div class="change-item__progress-bar">
                      <div
                        class="change-item__progress-fill change-item__progress-fill--done"
                        style="width:${donePercent}%"
                      ></div>
                      <div
                        class="change-item__progress-fill change-item__progress-fill--active"
                        style="width:${inProgressPercent}%"
                      ></div>
                    </div>
                    <div class="change-item__progress-stats">
                      <span class="change-item__stat">${doneTasks}/${totalTasks} done</span>
                      ${inProgressTasks > 0
                        ? html`<span class="change-item__stat change-item__stat--active"
                            >${inProgressTasks} active</span
                          >`
                        : ""}
                      ${blockedTasks > 0
                        ? html`<span class="change-item__stat change-item__stat--blocked"
                            >${blockedTasks} blocked</span
                          >`
                        : ""}
                    </div>
                  `
                : html`<span class="change-item__no-tasks">No tasks yet</span>`}
            </div>

            <!-- Right: assignees + time -->
            <div class="change-item__meta-col">
              ${assigneeEntries.length > 0
                ? html`
                    <div class="change-item__assignees">
                      ${assigneeEntries.map(
                        ([role, agent]) => html`
                          <div class="change-item__assignee">
                            <span class="change-item__assignee-role">${role}</span>
                            <span class="change-item__assignee-name">${agent || "—"}</span>
                          </div>
                        `,
                      )}
                    </div>
                  `
                : html`<span class="change-item__owner">${change.owner}</span>`}
              <div class="change-item__time">
                ${formatRelativeTime(Date.now() - change.updatedAt)}
              </div>
            </div>

            <!-- Expand indicator -->
            <div class="change-item__chevron">${isSelected ? "▾" : "▸"}</div>
          </div>
        `;
      })}
    </div>
  `;
}

export function renderProjectsBoardStyles() {
  return html`
    <style>
      .changes-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-bottom: 8px;
      }
      .changes-list__empty {
        color: var(--color-text-muted, #888);
        font-size: 13px;
        padding: 32px 0;
        text-align: center;
      }

      /* Initiative row card */
      .change-item {
        display: grid;
        grid-template-columns: 1fr 220px 180px 20px;
        align-items: center;
        gap: 16px;
        background: var(--color-surface-raised, var(--color-surface));
        border: 1px solid var(--color-border);
        border-radius: 10px;
        padding: 14px 16px;
        cursor: pointer;
        transition:
          border-color 0.15s,
          box-shadow 0.12s,
          transform 0.1s;
        user-select: none;
      }
      .change-item:hover {
        border-color: var(--color-accent, #3498db);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        transform: translateY(-1px);
      }
      .change-item:active {
        transform: translateY(0);
      }
      .change-item--selected {
        border-color: var(--color-accent, #3498db);
        box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.15);
      }
      .change-item--blocked {
        border-left: 3px solid var(--color-error, #c0392b);
      }

      /* Main column: phase + title + id */
      .change-item__main {
        overflow: hidden;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .change-item__top {
        display: flex;
        align-items: center;
        gap: 7px;
        flex-wrap: wrap;
      }
      .change-item__phase {
        display: inline-block;
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        border-radius: 5px;
        padding: 2px 8px;
        white-space: nowrap;
      }
      .change-item__phase--idea {
        background: rgba(149, 165, 166, 0.15);
        color: #7f8c8d;
      }
      .change-item__phase--proposal {
        background: rgba(52, 152, 219, 0.12);
        color: #2980b9;
      }
      .change-item__phase--plan {
        background: rgba(155, 89, 182, 0.12);
        color: #8e44ad;
      }
      .change-item__phase--design {
        background: rgba(230, 126, 34, 0.12);
        color: #ca6f1e;
      }
      .change-item__phase--implementation {
        background: rgba(52, 152, 219, 0.15);
        color: #1a6fa8;
      }
      .change-item__phase--verification {
        background: rgba(243, 156, 18, 0.15);
        color: #b7950b;
      }
      .change-item__phase--deployment {
        background: rgba(39, 174, 96, 0.12);
        color: #1e8449;
      }
      .change-item__phase--done {
        background: rgba(39, 174, 96, 0.18);
        color: #1a7a40;
      }
      .change-item__phase--blocked {
        background: rgba(192, 57, 43, 0.12);
        color: #c0392b;
      }

      .change-item__blocker-pill {
        font-size: 10px;
        font-weight: 700;
        background: rgba(192, 57, 43, 0.1);
        color: var(--color-error, #c0392b);
        border-radius: 5px;
        padding: 2px 7px;
        white-space: nowrap;
      }
      .change-item__id {
        font-size: 10px;
        color: var(--color-text-muted, #bbb);
        font-family: var(--font-mono, monospace);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .change-item__title {
        font-size: 14px;
        font-weight: 700;
        color: var(--color-text, inherit);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .change-item__branch {
        font-size: 11px;
        font-family: var(--font-mono, monospace);
        color: var(--color-text-muted, #aaa);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      /* Progress column */
      .change-item__progress-col {
        display: flex;
        flex-direction: column;
        gap: 5px;
        min-width: 0;
      }
      .change-item__progress-bar {
        height: 5px;
        background: var(--color-border, #e0e0e0);
        border-radius: 3px;
        overflow: hidden;
        display: flex;
      }
      .change-item__progress-fill {
        height: 100%;
        transition: width 0.3s ease;
      }
      .change-item__progress-fill--done {
        background: var(--color-success, #27ae60);
      }
      .change-item__progress-fill--active {
        background: var(--color-accent, #3498db);
        opacity: 0.6;
      }
      .change-item__progress-stats {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .change-item__stat {
        font-size: 11px;
        color: var(--color-text-muted, #999);
      }
      .change-item__stat--active {
        color: var(--color-accent, #3498db);
      }
      .change-item__stat--blocked {
        color: var(--color-error, #c0392b);
      }
      .change-item__no-tasks {
        font-size: 11px;
        color: var(--color-text-muted, #ccc);
      }

      /* Meta column: assignees + time */
      .change-item__meta-col {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 5px;
        min-width: 0;
      }
      .change-item__assignees {
        display: flex;
        flex-direction: column;
        gap: 2px;
        align-items: flex-end;
      }
      .change-item__assignee {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 11px;
      }
      .change-item__assignee-role {
        color: var(--color-text-muted, #aaa);
        font-size: 10px;
      }
      .change-item__assignee-name {
        font-weight: 600;
        color: var(--color-text, inherit);
        font-size: 11px;
      }
      .change-item__owner {
        font-size: 12px;
        color: var(--color-text-muted, #888);
      }
      .change-item__time {
        font-size: 11px;
        color: var(--color-text-muted, #bbb);
        white-space: nowrap;
      }

      /* Chevron */
      .change-item__chevron {
        font-size: 12px;
        color: var(--color-text-muted, #bbb);
        text-align: center;
        flex-shrink: 0;
      }

      @media (max-width: 800px) {
        .change-item {
          grid-template-columns: 1fr 20px;
        }
        .change-item__progress-col,
        .change-item__meta-col {
          display: none;
        }
      }
    </style>
  `;
}
