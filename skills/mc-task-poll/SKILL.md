---
name: mc-task-poll
description: Claim and process the next pending task (inbox, handoff, or review) from Mission Control, routing to the appropriate agent or handling directly.
---

# mc-task-poll

## Purpose

Claim and process the next pending task (inbox or review) assigned to this agent from Mission Control.

## Mandatory 3-layer context protocol

Before acting on any task, load context in this order:

1. Layer 1 — read IDENTITY.md, SOUL.md, TOOLS.md, BOOTSTRAP.md from your workspace
2. Layer 2 — read ~/coding-projects/project-map.yaml, then the active project's .ai/shared-memory/\*
3. Layer 3 — read the task's change context from openspec/changes/<change-id>/

## Procedure

### 1. Check for review tasks first

POST http://localhost:4010/api/v1/tasks/next-review
Body: {"instanceId": "org-development", "agentId": "<your agentId>"}
Header: Authorization: Bearer <value of MISSION_CONTROL_AUTH_TOKEN env var>

- If response is 200 → review task received. Skip to step 2 (review mode).
- If response is 204 → no review tasks. Continue to step 1b.

### 1b. Claim next inbox task

POST http://localhost:4010/api/v1/tasks/next
Body: {"instanceId": "org-development", "agentId": "<your agentId>"}
Header: Authorization: Bearer <value of MISSION_CONTROL_AUTH_TOKEN env var>

- If response is 204 → no tasks pending. Respond: POLL_OK
- If response is 200 → task received. Continue to step 2.

### 2. Load context

Run the project-bootstrap skill to load all 3 layers for the project referenced in the task.

### 3. Route the task

**Skip this step if you received a review task in step 1 — go directly to step 5 (review mode).**

Read the task title and description. Decide who owns it:

| Situation                              | Delegate to     |
| -------------------------------------- | --------------- |
| Requirements unclear or missing        | po              |
| Architecture decision needed           | tech-lead       |
| Web / backend / API / DB / infra       | fullstack       |
| Flutter / mobile                       | mobile          |
| Verification, testing, release signoff | qa              |
| Coordination, planning, or unclear     | handle directly |

### 3b. Post a trace comment

POST http://localhost:4010/api/v1/tasks/<taskKey>/traces
Header: Authorization: Bearer <MISSION_CONTROL_AUTH_TOKEN>
Body:
{
"instanceId": "org-development",
"agentId": "<routed_agent>",
"kind": "comment",
"title": "Starting work",
"body": "Routing to <routed_agent>: <reason>.\n\nTask: <title>\n<description if any>"
}

### 4. Mark in_progress with the routed agent

PATCH http://localhost:4010/api/v1/tasks/<taskKey>
Body: {"status": "in_progress", "agentId": "<routed_agent>"}
Header: Authorization: Bearer <MISSION_CONTROL_AUTH_TOKEN>

Where <routed_agent> is the agent selected in Step 3 (po / tech-lead / fullstack / mobile / qa / manager).
This makes the working agent visible in the Mission Control activity feed and on the Kanban card.

### 5. Spawn the sub-agent

Spawn the target agent as a sub-agent session with:

- the task title and description
- the handoff template (use handoff-standard skill)
- the project context loaded in step 2

**Review mode:** if this is a review task, spawn yourself (your own agent role) as the reviewer with the full task trace for context.

### 6. Close the loop

When the sub-agent completes its work, first signal completion:
POST http://localhost:4010/api/v1/signals/events
Body: {
"kind": "task.status",
"instanceId": "org-development",
"agentId": "<routed_agent>",
"state": "completed_work",
"message": "<taskKey>: <routed_agent> completed work",
"source": "hook",
"timestamp": "<now ISO 8601>"
}
Header: Authorization: Bearer <MISSION_CONTROL_AUTH_TOKEN>

Also post a completion trace:
POST http://localhost:4010/api/v1/tasks/<taskKey>/traces
Header: Authorization: Bearer <MISSION_CONTROL_AUTH_TOKEN>
Body:
{
"instanceId": "org-development",
"agentId": "<routed_agent>",
"kind": "comment",
"title": "Update",
"body": "**Update**\n<summary of what was done>\n\n**Evidence**\n<links or file paths changed>\n\n**Next**\n<next steps or 'Sent for review'>"
}

Then PATCH final status — choose based on your role and outcome:

**If you are a reviewer (picked up a review task in step 1):**

- Approved → PATCH body: {"status": "done", "agentId": "<your agentId>"}
- Rejected → PATCH body: {"status": "in_progress", "agentId": "<original working agent>"} and notify them why

**If you are the working agent (picked up an inbox/work task):**

- Work complete, needs QA sign-off → PATCH body: {"status": "review", "agentId": "qa"}
- Work complete, no review needed → PATCH body: {"status": "done", "agentId": "<your agentId>"}
- Blocked → PATCH body: {"status": "failed"} and escalate to operator

**Never send a task back to "review" with your own agentId — that creates a loop.**
