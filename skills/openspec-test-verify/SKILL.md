---
name: openspec-test-verify
description: Verify a completed change against its acceptance criteria using the OpenSpec CLI /opsx:verify command. Produces QA signoff. Use after implementation is complete before deployment.
metadata: { "openclaw": { "emoji": "✅" } }
---

# openspec-test-verify

Verify a completed change against its OpenSpec acceptance criteria and produce evidence-based QA signoff. No deployment happens without this step.

## Prerequisites

```bash
npm list -g @fission-ai/openspec || npm install -g @fission-ai/openspec
```

Implementation must be complete (`handoff.md` status: implementation complete).

## When to use

- Implementation is complete and handoff points to @qa-engineer
- Verifying a bug fix before closing
- Running regression checks before a release

## Do not use when

- Implementation is not done — check `handoff.md` status first
- Acceptance criteria are missing — return to @product-owner

## Steps

### 1. Bootstrap and load spec

Run the `project-bootstrap` skill, then:

```bash
cd <project-root>
openspec status --change "<change-id>" --json
openspec instructions specs --change "<change-id>" --json  # review verification instructions
```

Read:

- `proposal.md` — extract all acceptance criteria
- `design.md` — API contracts to verify
- `handoff.md` — what was implemented and what changed

### 2. Run verification via the CLI (expanded profile)

```bash
/opsx:verify
```

The CLI traces acceptance criteria from `proposal.md` against the implementation.

If not using the expanded profile, run verification manually (Step 3).

### 3. Manual verification

For each acceptance criterion in `proposal.md`:

```bash
# Run automated tests
npm test
npm run test:e2e       # E2E if available
flutter test           # for mobile changes

# Security and regression checks
npm audit
git diff main -- package.json   # new dependencies?
```

For manual checks: follow the steps, observe the outcome, record the result.

### 4. Document evidence in handoff.md

```markdown
## Verification Results: <change-id>

| Criterion                                | Test/Check                | Result | Notes |
| ---------------------------------------- | ------------------------- | ------ | ----- |
| Given X, when Y, then Z                  | `test/feature.test.ts:42` | Pass   |       |
| Given A, when B, then C                  | Manual check              | Pass   |       |
| Given error condition, then safe outcome | `test/feature.test.ts:89` | Pass   |       |

### Regression

- [ ] All existing tests pass
- [ ] No new console errors
- [ ] API matches design.md contracts

### Signoff

**Verification status:** PASSED / FAILED
**Ready for deployment:** YES / NO
**Reason (if NO):** <what needs to be fixed>
```

### 5. Handle failures

If verification fails:

- Update `handoff.md` status to `failed`, owner back to the developer
- Record escaped defect in `.ai/shared-memory/mistake-log.md`
- Do NOT give deployment signoff

### 6. Give signoff

If all criteria pass:

- Set `handoff.md` verification status: `passed`
- Set next owner: @devops
- Write "Ready for deployment: YES"

Update `lessons-learned.md` if a reusable quality insight emerged.

## Done when

- [ ] All acceptance criteria traced to a test or manual check
- [ ] Evidence documented per criterion
- [ ] Deployment signoff is YES or NO with clear reason
- [ ] Handoff updated with next owner (@devops)

## Rules

| Rule                                     | Why                                   |
| ---------------------------------------- | ------------------------------------- |
| No signoff without evidence              | "I think it works" is not QA          |
| Verify against proposal.md criteria only | Don't invent acceptance criteria      |
| Record every defect in mistake-log       | The next agent should not repeat this |
| Block deployment if criteria fail        | Protecting prod is the job            |
