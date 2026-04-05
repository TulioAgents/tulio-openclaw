# Hermes-Style Self-Learning Loop for OpenClaw

## Summary

Build a hybrid core + plugin self-learning system for runtime agent improvement. The system should improve agents through persisted memory, workflow distillation, draft-skill generation, evaluation, and human-approved promotion, without autonomous model retraining or silent core self-modification.

The implementation should preserve OpenClaw's current constraints:

- prompt-cache stability must remain deterministic
- active-session prompts must not be rewritten mid-turn for newly learned content
- plugin and channel boundaries must stay intact
- generated behavior changes must flow through explicit approval before becoming live skills

The v1 outcome is a closed loop:

1. the agent observes repeated successful workflows and durable user/environment facts
2. learning artifacts are persisted outside the active prompt
3. a learning plugin synthesizes candidate memories and draft skills
4. candidates are evaluated against simple quality gates
5. approved candidates are promoted into workspace-visible memory or skills
6. promoted artifacts affect behavior only on the next turn or session snapshot boundary

## Architecture

### Core responsibilities

Add small, generic primitives in core for learning artifact lifecycle, not Hermes-specific policy.

Key core additions:

- A learning artifact store under the workspace for draft/promoted artifacts and review metadata.
- A promotion boundary that keeps newly learned artifacts out of the current run's frozen prompt/snapshot.
- A reviewable skill promotion flow so generated skills can move from draft to active workspace skill only after approval.
- A stable hook/event surface so plugins can observe runs and publish learning candidates without modifying prompt assembly directly.
- A deterministic session refresh rule so approved skills are picked up on the next agent turn or new session via the existing skills snapshot/version mechanism.

Recommended artifact layout:

- `learning/candidates/*.json` for draft learning artifacts
- `learning/evaluations/*.json` for quality checks and scores
- `learning/approvals/*.json` for approval decisions and audit trail
- `learning/skills/<candidate-id>/SKILL.md` for generated draft skills before promotion
- promoted skills still land in normal workspace-visible skill roots such as `skills/<name>/SKILL.md`
- promoted memory still lands in canonical memory surfaces such as `MEMORY.md`, `USER.md`, or `memory/YYYY-MM-DD.md`

Public/core interfaces to add:

- plugin runtime support for a learning/context-engine style plugin that can observe completed runs and emit candidate artifacts
- a typed `LearningArtifact` union, with at least:
  - `memory_fact`
  - `workflow_pattern`
  - `skill_draft`
  - `skill_revision`
- a typed `LearningDecision` union:
  - `pending`
  - `approved`
  - `rejected`
  - `promoted`
  - `superseded`
- a promotion API/tool seam that can:
  - list pending candidates
  - inspect candidate details
  - approve or reject a candidate
  - promote approved candidates into live memory or skills

Do not add a generic self-modify-code capability in v1.

### Plugin responsibilities

Implement the actual Hermes-like loop as a bundled or optional plugin on top of those primitives.

Plugin behavior:

- Observe completed runs and tool traces using existing lifecycle hooks such as `before_tool_call`, `after_tool_call`, `agent_end`, and compaction-adjacent hooks.
- Extract candidate learnings from:
  - repeated multi-step workflows
  - explicit "remember this" style user requests
  - durable user preferences or environment facts
  - successful tool-use patterns with low variance
- Classify candidates into:
  - memory-only
  - workflow-only
  - draft-skill-worthy
- Generate:
  - concise memory entries for `MEMORY.md` or `USER.md`
  - draft `SKILL.md` artifacts for reusable workflows
  - evaluation metadata with provenance and confidence
- Surface pending items through CLI/chat/UI for approval.
- On approval:
  - append/promote memory to canonical files
  - move/copy skill draft into the active workspace `skills/` tree
  - bump the skills snapshot version so the next turn picks up the new skill
- On rejection:
  - preserve the audit record and mark the candidate rejected
- On revision:
  - create a new draft candidate linked to the prior one, rather than mutating history in place

### Prompt and cache behavior

Preserve the current cache-safe design.

Rules:

- New learning artifacts persist immediately to disk, but do not rewrite the active prompt mid-conversation.
- Draft skills are not injected into `<available_skills>` until approved and promoted.
- Approved skills become visible through the existing skill snapshot refresh path on the next turn/session boundary.
- Memory promotion should use existing canonical files, but the current turn should not assume that the active prompt has been reassembled.
- Any ordering of candidate lists, promotion metadata, or tool catalogs must be deterministic.

## Implementation Changes

### 1. Learning artifact model and storage

Add a small core module that defines and persists learning artifacts.

Implement:

- `LearningArtifact` schema with IDs, timestamps, provenance, source session/run IDs, status, confidence, and payload
- `LearningEvaluation` schema with scores and failure reasons
- `LearningApproval` schema with approver, time, decision, and optional notes
- file-backed storage helpers with deterministic file naming and ordering
- path guardrails so draft artifacts remain in the workspace and never escape allowed roots

Behavior:

- candidate creation is append-only
- approvals are append-only
- promotion writes a new state transition instead of mutating prior records destructively
- candidate payloads should store references to the originating session/tool events, not full transcript copies, unless needed for review

### 2. Hook and runtime integration

Expose a clean post-run integration point for learning without coupling it to prompt construction.

Implement:

- a plugin hook or context-engine callback that runs after a successful turn with access to:
  - session key/id
  - final messages
  - tool usage summary
  - skills snapshot metadata
  - workspace/agent identity
- a way for plugins to emit learning artifacts without directly editing skills/memory during the active run
- optional throttling/batching so the learning plugin can skip noisy or low-signal turns

Rules:

- learning extraction should default to main/runtime user sessions, not subagents or cron sessions
- subagent traces may be eligible as evidence, but should not directly publish new skills in v1
- failed tool runs should not become skill candidates unless explicitly marked as recovered and useful

### 3. Draft-skill generation and promotion

Create a reviewable path from observed workflow to real workspace skill.

Implement:

- draft skill generator that outputs AgentSkills-compatible `SKILL.md`
- candidate metadata linking the skill draft to:
  - source runs
  - observed tools
  - success count
  - suggested trigger description
- promotion action that copies the approved draft into `skills/<name>/SKILL.md`
- collision handling:
  - if the skill name is new, create it
  - if the skill already exists, create a `skill_revision` candidate instead of overwriting immediately
  - promotion of revisions should require explicit "replace existing skill" approval

Draft-skill generation rules:

- generated skills must be procedural, not repo-specific hidden prompt dumps
- relative paths inside generated skills must resolve against the skill directory
- generated skills must stay within existing OpenClaw skill frontmatter conventions
- generated skills should include provenance comments or metadata linking back to the learning candidate ID

### 4. Memory learning and consolidation

Reuse existing memory surfaces instead of inventing a parallel memory UX.

Implement:

- memory candidate extraction for:
  - durable user preferences
  - recurring environment facts
  - standing workflow preferences
- policy for destination:
  - `USER.md` for user profile and preferences
  - `MEMORY.md` for durable cross-session facts and decisions
  - `memory/YYYY-MM-DD.md` for short-lived notes
- integration with existing memory search/dreaming concepts:
  - learning candidates can seed daily notes immediately
  - promotion to durable memory should remain conservative

Rules:

- do not auto-promote every observation into `MEMORY.md`
- preference/fact extraction should require stability or explicit user instruction
- if a fact conflicts with an existing durable memory entry, create a review candidate instead of silently replacing it

### 5. Review and operator surfaces

Add minimal review surfaces for approving or rejecting candidates.

Implement at least one of these in v1, preferably both CLI and tool/chat:

- CLI:
  - `openclaw learning list`
  - `openclaw learning show <id>`
  - `openclaw learning approve <id>`
  - `openclaw learning reject <id>`
  - `openclaw learning promote <id>`
- agent/tool surface:
  - list pending learnings
  - inspect a pending candidate
  - request approval outcome
- optional gateway/UI support can follow after CLI is stable

Behavior:

- approvals must be explicit and auditable
- only approved skill candidates can be promoted into live workspace skills
- approved memory candidates can be written into canonical memory files immediately, but prompt impact begins next turn

### 6. Config and policy

Add narrow config, mostly plugin-owned, with only essential core switches.

Core or plugin config should cover:

- `learning.enabled`
- `learning.mode: off | suggest | review-gated`
- `learning.capture.sessions`
- `learning.capture.subagents`
- `learning.skills.enabled`
- `learning.memory.enabled`
- `learning.thresholds.*` for minimum confidence/repetition
- `learning.review.requiredForSkills` default `true`
- `learning.review.requiredForMemoryUpdates` default `false` for explicit user "remember this", otherwise thresholded or `true`
- max candidate generation rate per session/day

Defaults:

- disabled by default unless explicitly enabled
- review-gated by default
- skill generation enabled only when the plugin is enabled
- subagent-originated skill drafting off by default

## Public Interfaces and Types

Important additions or changes:

- new learning artifact types and schemas in core
- new plugin hook/callback for post-run learning candidate publication
- new CLI namespace `openclaw learning ...`
- optional new agent tools for learning review workflows
- no change to the existing skill prompt format except that promoted skills enter through the current snapshot pipeline
- no change to existing memory tool names or canonical memory file semantics

Compatibility rules:

- existing skills system remains the only live skill-loading path
- existing memory search/get behavior remains the source of truth
- Honcho/QMD/builtin memory integrations remain valid; the learning plugin should treat them as memory backends, not replacements for artifact governance
- no breaking change to third-party plugin SDK consumers in v1; prefer additive contracts only

## Test Plan

### Core unit tests

- learning artifact schemas reject malformed candidates
- file store writes deterministic filenames and ordering
- approval/promotion transitions are append-only and valid
- promotion refuses unapproved skill drafts
- skill revision candidates do not overwrite existing skills without explicit replacement approval
- conflicting memory updates create review candidates instead of silent replacement

### Agent/runtime tests

- completed turns can emit learning candidates through the new hook without altering the active prompt
- active session prompt bytes remain stable after candidate creation during the same session
- approved skill promotion bumps the skills snapshot version and becomes visible on the next turn
- rejected candidates never appear in the live skills snapshot
- subagent/minimal prompt sessions do not auto-publish draft skills by default

### Memory tests

- explicit "remember this" flows create the right candidate or direct write path based on policy
- durable user preferences route to `USER.md`
- durable cross-session facts route to `MEMORY.md`
- short-lived observations route to daily notes
- conflicting facts generate review records

### Skill tests

- generated draft skills conform to frontmatter and loader expectations
- promoted generated skills load through normal workspace skill discovery
- generated skills are filtered correctly by existing allowlist/gating logic
- existing cache-stable available-skills prompt remains deterministic after promotion

### End-to-end scenarios

- repeated successful workflow across multiple sessions produces a pending `skill_draft`
- operator approves the draft; next turn sees the skill in available skills
- operator rejects a draft; agent does not surface or use it
- repeated user preference becomes a memory candidate, gets approved, and is recalled in a later session
- a learning plugin enabled alongside Honcho still preserves review-gated promotion semantics

## Assumptions and Defaults

- "Hermes-style self-learning" means memory and skill improvement, not model fine-tuning or autonomous source-code rewriting.
- v1 optimizes for runtime user agents, not maintainer/repo process automation.
- Human approval is required for all skill promotion and skill revision promotion.
- Core remains generic; most policy lives in the plugin.
- Draft learnings persist immediately, but active prompt/session content does not change until the next refresh boundary.
- Existing `MEMORY.md`, `USER.md`, `memory_search`, `memory_get`, skills snapshotting, and plugin hooks are preserved and extended rather than replaced.
- UI work is optional for v1; CLI plus tool-accessible review flow is sufficient for the first release.

---

I think we need to breack down the tasks into indivitual files like :

~/coding-projects/helloworld4/openspec/{feature}/tasks/

- Phase1-T1.1.md
- Phase1-T1.2.md
- Phase1-T1.3.md
- Phase{x}-T{Y}.{z}}.md
- Phase{x}-T{Y}.{z}}.md

example

~/coding-projects/helloworld4/openspec/0001-name-capture-greeting-display/tasks/

- Phase1-T1.1.md
- Phase2-T2.2.md
- Phase2-T2.3.md
- Phase2-T2.4.md
- Phase3-T3.1.md
- Phase3-T3.2.md
- Phase{x}-T{Y}.{z}}.md

Inside each task a full details of the work to be done, and space to agents write commentes similar to JIRA type, so when the task it';s reasiigned to another agent roles, have contect about that task. also any bug should be reported there before asignes to a dev
