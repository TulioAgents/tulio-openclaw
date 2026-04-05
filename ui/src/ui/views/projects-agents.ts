import { html, nothing } from "lit";
import type { OpenSpecAgentStatus } from "./projects-types.ts";

/** Format a running duration from a start timestamp. */
function formatRunDuration(startedAt: number): string {
  const ms = Date.now() - startedAt;
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/** Truncate a string to maxLen characters with ellipsis. */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) {
    return str;
  }
  return `${str.slice(0, maxLen - 1)}\u2026`;
}

export type ProjectsAgentsProps = {
  agents: OpenSpecAgentStatus[];
};

export function renderProjectsAgents({ agents }: ProjectsAgentsProps) {
  if (agents.length === 0) {
    return html`
      <div class="projects-agents">
        <div class="projects-agents__empty">No active agents</div>
      </div>
    `;
  }

  return html`
    <div class="projects-agents">
      <table class="projects-agents__table">
        <thead>
          <tr>
            <th class="projects-agents__th">Role</th>
            <th class="projects-agents__th">Session</th>
            <th class="projects-agents__th">Change</th>
            <th class="projects-agents__th">Status</th>
            <th class="projects-agents__th">Current Task</th>
            <th class="projects-agents__th">Duration</th>
          </tr>
        </thead>
        <tbody>
          ${agents.map((agent) => renderAgentRow(agent))}
        </tbody>
      </table>
    </div>
  `;
}

function renderAgentRow(agent: OpenSpecAgentStatus) {
  const duration = formatRunDuration(agent.startedAt);
  const sessionDisplay = truncate(agent.sessionKey, 16);
  const taskDisplay = truncate(agent.currentTask, 48);

  return html`
    <tr class="projects-agents__row">
      <td class="projects-agents__td projects-agents__td--role">${agent.role}</td>
      <td class="projects-agents__td projects-agents__td--session">
        <span class="projects-agents__session-key" title="${agent.sessionKey}"
          >${sessionDisplay}</span
        >
      </td>
      <td class="projects-agents__td projects-agents__td--change">
        <span class="projects-agents__change-id">${agent.changeId || nothing}</span>
      </td>
      <td class="projects-agents__td">
        <span class="projects-agents__status projects-agents__status--${agent.status}">
          ${agent.status === "running"
            ? html`<span class="projects-agents__pulse"></span>`
            : nothing}
          ${agent.status}
        </span>
      </td>
      <td class="projects-agents__td projects-agents__td--task" title="${agent.currentTask}">
        ${taskDisplay}
      </td>
      <td class="projects-agents__td projects-agents__td--duration">${duration}</td>
    </tr>
  `;
}

export function renderProjectsAgentsStyles() {
  return html`
    <style>
      .projects-agents {
        margin-top: 16px;
      }
      .projects-agents__empty {
        color: var(--color-text-muted, #888);
        font-size: 13px;
        padding: 12px 0;
        text-align: center;
      }
      .projects-agents__table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
      }
      .projects-agents__th {
        text-align: left;
        padding: 6px 10px;
        border-bottom: 1px solid var(--color-border);
        color: var(--color-text-muted, #888);
        font-weight: 600;
        white-space: nowrap;
      }
      .projects-agents__td {
        padding: 6px 10px;
        border-bottom: 1px solid var(--color-border-subtle, var(--color-border));
        vertical-align: middle;
        color: var(--color-text, inherit);
      }
      .projects-agents__td--role {
        font-weight: 600;
        white-space: nowrap;
      }
      .projects-agents__td--session,
      .projects-agents__td--change {
        font-family: var(--font-mono, monospace);
        font-size: 11px;
        color: var(--color-text-muted, #888);
      }
      .projects-agents__td--task {
        color: var(--color-text-muted, #888);
        max-width: 300px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .projects-agents__td--duration {
        white-space: nowrap;
        color: var(--color-text-muted, #888);
      }
      .projects-agents__session-key {
        cursor: default;
      }
      .projects-agents__change-id {
        cursor: default;
      }
      .projects-agents__status {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }
      .projects-agents__status--running {
        color: var(--color-success, #27ae60);
      }
      .projects-agents__status--idle {
        color: var(--color-text-muted, #888);
      }
      .projects-agents__status--blocked {
        color: var(--color-error, #c0392b);
      }
      .projects-agents__status--completed {
        color: var(--color-text-muted, #aaa);
      }
      .projects-agents__status--failed {
        color: var(--color-error, #c0392b);
      }
      .projects-agents__pulse {
        display: inline-block;
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--color-success, #27ae60);
        animation: projects-agents-pulse 1.4s ease-in-out infinite;
      }
      @keyframes projects-agents-pulse {
        0%,
        100% {
          opacity: 1;
          transform: scale(1);
        }
        50% {
          opacity: 0.4;
          transform: scale(0.75);
        }
      }
    </style>
  `;
}
