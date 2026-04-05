---
name: openspec-review-code
description: Conduct a structured code review verifying alignment with the OpenSpec change artifacts. Checks correctness against proposal.md, API contracts from design.md, security, performance, and test coverage.
metadata: { "openclaw": { "emoji": "🔍" } }
---

# openspec-review-code

Conduct a thorough, spec-driven code review. Review against the OpenSpec artifacts — not personal preferences.

## When to use

- A PR is open and needs review before merge
- Checking implementation against `design.md` API contracts
- Reviewing for security, performance, or architecture concerns

## Steps

### 1. Load the spec

```bash
cd <project-root>
openspec status --change "<change-id>" --json
openspec instructions specs --change "<change-id>" --json
```

Read:

- `proposal.md` — acceptance criteria to verify
- `design.md` — API contracts and architecture to check against
- The PR diff / changed files

### 2. Review by lens

#### Lens 1: Correctness vs. spec

- Does the implementation match every acceptance criterion in `proposal.md`?
- Does it match the API contracts in `design.md` (methods, paths, request/response shapes, status codes)?
- Are edge cases and error states handled?

#### Lens 2: Security

- Input validation missing at API boundaries
- Auth middleware missing on protected routes
- Sensitive data in logs or API responses
- Hardcoded secrets or credentials

#### Lens 3: Performance

- N+1 database queries
- Missing indexes on queried columns
- Unbounded queries (no pagination, no LIMIT)
- Unnecessary re-renders or large synchronous blocking

#### Lens 4: Architecture alignment

- Does it follow patterns from `design.md`?
- Package/module boundaries respected?
- No business logic in route handlers?

#### Lens 5: Test coverage

- Are all acceptance criteria covered by tests?
- Are error paths tested?
- Are tests readable and focused?

#### Lens 6: Readability

- Clear, descriptive names?
- Non-obvious logic explained with comments?
- No dead code or commented-out blocks?

### 3. Write structured feedback

For each issue:

```
**[Lens] file:line**
What: <describe the issue>
Why: <why it matters>
Fix: <concrete suggestion>
Severity: blocking / non-blocking / suggestion
```

### 4. Give verdict

```markdown
## Code Review: <change-id> / PR #<number>

### Summary

<1-2 sentence overall assessment>

### Blocking (must fix before merge)

- [Security] `src/api/users.ts:42` — Missing input validation on `email`. Add Zod schema.

### Non-blocking (should fix)

- [Performance] `src/db/queries.ts:15` — N+1 pattern. Batch or eager-load.

### Suggestions (optional)

- [Readability] `src/utils/format.ts:8` — rename `x` to `formattedDate`.

### Verdict

- [ ] Approved — ready to merge
- [ ] Approved with minor changes
- [ ] Changes requested — fix blocking issues and re-review
```

## Done when

- [ ] All six lenses checked
- [ ] Review is against `proposal.md` and `design.md`, not preferences
- [ ] Blocking issues clearly labeled
- [ ] Feedback is actionable (what + why + how)
- [ ] Verdict is explicit

## Rules

| Rule                                | Why                                              |
| ----------------------------------- | ------------------------------------------------ |
| Review against the spec             | Criteria come from `proposal.md`, not your taste |
| Explain why, not just what          | Developers learn from understanding context      |
| Separate blocking from non-blocking | Reviewees need to know what stops the merge      |
