import { html } from "lit";
import type { OpenSpecChange } from "./projects-types.ts";

/** Format milliseconds duration as "Xh Ym" or "Ym" or "just now". */
function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) {
    return "just now";
  }
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/** Map change status to a CSS class suffix for the status dot. */
function resolveStatusClass(change: OpenSpecChange): string {
  if (change.blockers.length > 0) {
    return "blocked";
  }
  // Heuristic: if updated within the last 5 minutes, consider it running.
  const ageMs = Date.now() - change.updatedAt;
  if (ageMs < 5 * 60 * 1000) {
    return "running";
  }
  if (ageMs < 30 * 60 * 1000) {
    return "waiting";
  }
  return "idle";
}

export type ChangeCardProps = {
  change: OpenSpecChange;
  onSelect: (change: OpenSpecChange) => void;
};

export function renderChangeCard({ change, onSelect }: ChangeCardProps) {
  const statusClass = resolveStatusClass(change);
  const timeInPhase = formatDuration(Date.now() - change.updatedAt);
  const blockerCount = change.blockers.length;
  const isBlocked = blockerCount > 0;

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
          ? html`<span class="change-card__blocker-badge">${blockerCount}</span>`
          : ""}
      </div>
      <div class="change-card__title">${change.title}</div>
      <div class="change-card__meta">
        <span class="change-card__owner">${change.owner}</span>
        <span class="change-card__time">${timeInPhase}</span>
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
        border-radius: 6px;
        padding: 10px 12px;
        cursor: pointer;
        transition:
          border-color 0.15s,
          box-shadow 0.15s;
        user-select: none;
      }
      .change-card:hover {
        border-color: var(--color-accent, var(--color-primary, #666));
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
      }
      .change-card--blocked {
        border-color: var(--color-error, #c0392b);
      }
      .change-card__header {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 4px;
      }
      .change-card__status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      .change-card__status-dot--running {
        background: var(--color-success, #27ae60);
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
      .change-card__id {
        font-size: 11px;
        color: var(--color-text-muted, #888);
        font-family: var(--font-mono, monospace);
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .change-card__blocker-badge {
        background: var(--color-error, #c0392b);
        color: #fff;
        font-size: 10px;
        font-weight: 700;
        border-radius: 10px;
        padding: 0 5px;
        line-height: 16px;
        flex-shrink: 0;
      }
      .change-card__title {
        font-size: 13px;
        font-weight: 600;
        color: var(--color-text, inherit);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        margin-bottom: 6px;
      }
      .change-card__meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 11px;
        color: var(--color-text-muted, #888);
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
