import { html } from "lit";
import type { OpenSpecChange, TaskTrackerEntry } from "./projects-types.ts";

/** Map change status to a CSS class suffix for the status dot. */
function resolveStatusClass(change: OpenSpecChange): string {
  if (change.blockers.length > 0) {
    return "blocked";
  }
  const ageMs = Date.now() - change.updatedAt;
  if (ageMs < 5 * 60 * 1000) {
    return "running";
  }
  if (ageMs < 30 * 60 * 1000) {
    return "waiting";
  }
  return "idle";
}

/** Format a short relative time: "2h ago", "5m ago", "just now". */
function formatRelativeTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) {
    return "just now";
  }
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  if (hours > 0) {
    return `${hours}h ago`;
  }
  return `${minutes}m ago`;
}

export type ChangeCardProps = {
  change: OpenSpecChange;
  tasks?: TaskTrackerEntry[];
  onSelect: (change: OpenSpecChange) => void;
};

export function renderChangeCard({ change, tasks, onSelect }: ChangeCardProps) {
  const statusClass = resolveStatusClass(change);
  const timeAgo = formatRelativeTime(Date.now() - change.updatedAt);
  const blockerCount = change.blockers.length;
  const isBlocked = blockerCount > 0;

  // Task progress
  const taskList = tasks ?? [];
  const totalTasks = taskList.length;
  const doneTasks = taskList.filter((t) => t.status === "done").length;
  const inProgressTasks = taskList.filter((t) => t.status === "in_progress").length;
  const blockedTasks = taskList.filter((t) => t.status === "blocked").length;
  const hasTaskData = totalTasks > 0;
  const donePercent = hasTaskData ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const inProgressPercent = hasTaskData ? Math.round((inProgressTasks / totalTasks) * 100) : 0;

  return html`
    <div
      class="change-card ${isBlocked ? "change-card--blocked" : ""}"
      role="button"
      tabindex="0"
      @click=${() => onSelect(change)}
      @keydown=${(e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(change);
        }
      }}
    >
      <div class="change-card__header">
        <span class="change-card__status-dot change-card__status-dot--${statusClass}"></span>
        <span class="change-card__id">${change.changeId}</span>
        ${blockerCount > 0
          ? html`<span class="change-card__blocker-badge">⚠ ${blockerCount}</span>`
          : ""}
      </div>
      <div class="change-card__title">${change.title}</div>
      ${hasTaskData
        ? html`
            <div class="change-card__progress">
              <div class="change-card__progress-bar">
                <div
                  class="change-card__progress-fill change-card__progress-fill--done"
                  style="width: ${donePercent}%"
                ></div>
                <div
                  class="change-card__progress-fill change-card__progress-fill--active"
                  style="width: ${inProgressPercent}%"
                ></div>
              </div>
              <div class="change-card__progress-label">
                <span>${doneTasks}/${totalTasks} done</span>
                ${inProgressTasks > 0
                  ? html`<span class="change-card__progress-active"
                      >${inProgressTasks} active</span
                    >`
                  : ""}
                ${blockedTasks > 0
                  ? html`<span class="change-card__progress-blocked">${blockedTasks} blocked</span>`
                  : ""}
              </div>
            </div>
          `
        : ""}
      <div class="change-card__meta">
        <span class="change-card__owner">${change.owner}</span>
        <span class="change-card__time">${timeAgo}</span>
      </div>
    </div>
  `;
}

export function renderChangeCardStyles() {
  return html`
    <style>
      .change-card {
        background: var(--color-surface-raised, var(--color-surface));
        border: 1px solid var(--color-border);
        border-radius: 8px;
        padding: 12px 14px;
        cursor: pointer;
        transition:
          border-color 0.15s,
          box-shadow 0.15s,
          transform 0.1s;
        user-select: none;
      }
      .change-card:hover {
        border-color: var(--color-accent, var(--color-primary, #666));
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        transform: translateY(-1px);
      }
      .change-card:active {
        transform: translateY(0);
      }
      .change-card--blocked {
        border-color: var(--color-error, #c0392b);
        border-left: 3px solid var(--color-error, #c0392b);
      }
      .change-card__header {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 5px;
      }
      .change-card__status-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      .change-card__status-dot--running {
        background: var(--color-success, #27ae60);
        box-shadow: 0 0 0 2px rgba(39, 174, 96, 0.25);
        animation: card-pulse 1.8s ease-in-out infinite;
      }
      .change-card__status-dot--waiting {
        background: var(--color-warning, #f39c12);
      }
      .change-card__status-dot--blocked {
        background: var(--color-error, #c0392b);
      }
      .change-card__status-dot--idle {
        background: var(--color-text-muted, #888);
      }
      @keyframes card-pulse {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.5;
        }
      }
      .change-card__id {
        font-size: 10px;
        color: var(--color-text-muted, #aaa);
        font-family: var(--font-mono, monospace);
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .change-card__blocker-badge {
        background: rgba(192, 57, 43, 0.12);
        color: var(--color-error, #c0392b);
        font-size: 10px;
        font-weight: 700;
        border-radius: 4px;
        padding: 1px 5px;
        flex-shrink: 0;
      }
      .change-card__title {
        font-size: 13px;
        font-weight: 600;
        color: var(--color-text, inherit);
        line-height: 1.35;
        margin-bottom: 8px;
        overflow: hidden;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
      }
      .change-card__progress {
        margin-bottom: 8px;
      }
      .change-card__progress-bar {
        height: 4px;
        background: var(--color-border, #e0e0e0);
        border-radius: 2px;
        overflow: hidden;
        display: flex;
        margin-bottom: 4px;
      }
      .change-card__progress-fill {
        height: 100%;
        transition: width 0.3s ease;
      }
      .change-card__progress-fill--done {
        background: var(--color-success, #27ae60);
      }
      .change-card__progress-fill--active {
        background: var(--color-accent, #3498db);
        opacity: 0.7;
      }
      .change-card__progress-label {
        display: flex;
        gap: 8px;
        font-size: 10px;
        color: var(--color-text-muted, #aaa);
      }
      .change-card__progress-active {
        color: var(--color-accent, #3498db);
      }
      .change-card__progress-blocked {
        color: var(--color-error, #c0392b);
      }
      .change-card__meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 11px;
        color: var(--color-text-muted, #aaa);
        padding-top: 2px;
        border-top: 1px solid var(--color-border-subtle, rgba(0, 0, 0, 0.06));
      }
      .change-card__owner {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 60%;
      }
      .change-card__time {
        white-space: nowrap;
        flex-shrink: 0;
      }
    </style>
  `;
}
