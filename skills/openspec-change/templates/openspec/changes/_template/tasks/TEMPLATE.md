---
id: "T0.0"
title: "Task title"
phase: "Phase 0: Phase Name"
status: todo # todo | in_progress | blocked | in_review | done
priority: medium # low | medium | high | critical
assignee: "" # agent currently executing (e.g. "claudecoder")
role: "" # required role from TEAM_TOPOLOGY (e.g. "sr-fullstack", "qa-engineer", "devops")
owner: "" # who created/manages this task (e.g. "dev-manager")
reviewer: "" # who reviews completed work before marking done
depends_on: [] # list of task IDs that must be done first (e.g. ["T1.1", "T2.1"])
blocked_by: [] # free-text blockers (e.g. ["waiting for design sign-off"])
created_at: "" # ISO 8601 (e.g. "2026-04-05T10:00:00Z")
updated_at: ""
started_at: ""
completed_at: ""
estimated_effort: "" # e.g. "1h", "2h", "half-day"
---

# T0.0 — Task title

## Description

What needs to be done and why. Include enough context so an agent picking this up cold understands the goal.

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Technical Notes

- Implementation hints, patterns to follow, or decisions already made
- Relevant commands or commit message format

## Files

| File              | Action               | Notes        |
| ----------------- | -------------------- | ------------ |
| `path/to/file.ts` | create/modify/delete | what changes |

## Activity Log

<!-- Agents: append new entries at the bottom. Do not edit previous entries. -->
<!-- Format: ### YYYY-MM-DDTHH:MM:SSZ — role-name -->

### YYYY-MM-DDTHH:MM:SSZ — owner-role

Created task.

## Bugs

<!-- One subsection per bug found during implementation or review. -->
<!-- Format: ### BUG-NNN: short title (open|fixing|fixed|wontfix) -->
<!-- Fields: Reported by, Date, Severity (low|medium|high|critical), Description, Reproduction, Fix -->
