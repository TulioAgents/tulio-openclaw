# Tasks: <title>

> Index only. See `tasks/Phase{X}-T{X}.{Y}.md` for full task details.
> For fast status overview, read `tasks-tracker.yaml`.

## Task Granularity Rules

Every task must satisfy ALL of the following before being created:

- **Objective**: one sentence describing the single outcome
- **Includes**: explicit list of what is in scope
- **Excludes**: explicit list of what is out of scope
- **Done when**: observable, testable condition (no "it works" or "it's complete")
- **Dependencies**: task IDs this requires (empty list is valid and explicit)
- **Estimated effort**: must be ≤ 4 hours — split if larger

A task is too large if it:

- Changes multiple subsystems without a single reviewable outcome
- Mixes infra + backend + UI in one unit
- Cannot be reviewed in one pass
- Has more than 3 unresolved dependencies

**Change size routing** (Dev Manager must classify before creating tasks):

| Size    | Tasks                  | Design                     | QA    |
| ------- | ---------------------- | -------------------------- | ----- |
| trivial | 1                      | No                         | No    |
| small   | 2–5                    | Optional                   | Basic |
| medium  | 5–15                   | Required                   | Full  |
| epic    | >15 or multi-subsystem | **STOP — decompose first** | N/A   |

---

## Task Index

| #    | Task | Role | Assignee | Owner | Status | File                                   |
| ---- | ---- | ---- | -------- | ----- | ------ | -------------------------------------- |
| T1.1 |      |      |          |       | todo   | [Phase1-T1.1.md](tasks/Phase1-T1.1.md) |

Status values: todo → in_progress → blocked → in_review → done
