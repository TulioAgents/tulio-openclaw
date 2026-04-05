import { html } from "lit";
import { renderChangeCard, renderChangeCardStyles } from "./projects-card.ts";
import type { OpenSpecChange, OpenSpecPhase } from "./projects-types.ts";
import { KANBAN_PHASES } from "./projects-types.ts";

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

export type ProjectsBoardProps = {
  projectCode: string;
  changes: OpenSpecChange[];
  onChangeSelect: (change: OpenSpecChange) => void;
};

export function renderProjectsBoard({
  projectCode: _projectCode,
  changes,
  onChangeSelect,
}: ProjectsBoardProps) {
  // Group changes by phase. "blocked" changes appear in their last known phase column
  // but also carry a blocked border via their card renderer.
  const byPhase = new Map<OpenSpecPhase, OpenSpecChange[]>();
  for (const phase of KANBAN_PHASES) {
    byPhase.set(phase, []);
  }
  for (const change of changes) {
    const effectivePhase: OpenSpecPhase =
      change.phase === "blocked" ? "implementation" : change.phase;
    const bucket = byPhase.get(effectivePhase);
    if (bucket) {
      bucket.push(change);
    }
  }

  return html`
    ${renderChangeCardStyles()} ${renderProjectsBoardStyles()}
    <div class="projects-board">
      ${KANBAN_PHASES.map((phase) => {
        const columnChanges = byPhase.get(phase) ?? [];
        return html`
          <div class="projects-board__column">
            <div class="projects-board__column-header">
              <span class="projects-board__phase-label">${phaseLabel(phase)}</span>
              ${columnChanges.length > 0
                ? html`<span class="projects-board__count-badge">${columnChanges.length}</span>`
                : ""}
            </div>
            <div class="projects-board__column-body">
              ${columnChanges.length === 0
                ? html`<div class="projects-board__empty-col"></div>`
                : columnChanges.map((change) =>
                    renderChangeCard({ change, onSelect: onChangeSelect }),
                  )}
            </div>
          </div>
        `;
      })}
    </div>
  `;
}

export function renderProjectsBoardStyles() {
  return html`
    <style>
      .projects-board {
        display: flex;
        flex-direction: row;
        gap: 12px;
        overflow-x: auto;
        padding-bottom: 8px;
        align-items: flex-start;
      }
      .projects-board__column {
        flex: 0 0 200px;
        min-width: 180px;
        max-width: 240px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .projects-board__column-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 4px;
        border-bottom: 2px solid var(--color-border);
      }
      .projects-board__phase-label {
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--color-text-muted, #888);
      }
      .projects-board__count-badge {
        background: var(--color-surface-raised, var(--color-surface));
        border: 1px solid var(--color-border);
        border-radius: 10px;
        font-size: 11px;
        font-weight: 600;
        color: var(--color-text-muted, #888);
        padding: 0 6px;
        line-height: 18px;
      }
      .projects-board__column-body {
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-height: 60px;
      }
      .projects-board__empty-col {
        min-height: 40px;
      }
    </style>
  `;
}
