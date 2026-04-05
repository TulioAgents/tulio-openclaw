# learning-core

A self-improvement plugin for OpenClaw that observes repeated agent workflows, generates draft skills from patterns it detects, and lets you promote or improve them through a CLI review flow.

---

## What problem it solves

Every time you ask the agent to do something repetitive — search memory, read a file, edit it, write it back — that workflow exists only in your head. If the agent did it well, you have to either manually write a SKILL.md to codify it, or repeat the same prompting next time.

`learning-core` watches what tools get called each turn, detects when the same sequence repeats across multiple sessions, automatically drafts a skill for you to review, and continues improving that skill as more evidence accumulates.

---

## Implementation phases and task files

The feature is broken down into individual task files under:

```
extensions/learning-core/tasks/
  Phase1-T1.1.md   Tool-sequence trace store
  Phase1-T1.2.md   Fingerprint counting and rate limiting
  Phase2-T2.1.md   LLM extraction trigger and prompt
  Phase2-T2.2.md   Draft candidate and SKILL.md storage
  Phase2-T2.3.md   Skill revision detection and re-extraction
  Phase3-T3.1.md   CLI: list, show, traces
  Phase3-T3.2.md   CLI: approve and reject (new + revision)
  Phase4-T4.1.md   Memory integration via synthetic recall injection
```

Each task file contains: objective, acceptance criteria, implementation notes, agent comments log, and a bug/blocker section. Tasks are designed to be self-contained and reassignable between agent roles.

---

## How it works

### 1. Observation (every agent turn)

The plugin registers two hooks:

- **`after_tool_call`** — records each tool name as it is called during a turn
- **`agent_end`** — when the turn completes successfully, flushes the accumulated tool names as a `TraceEntry` to `learning/traces.jsonl`

Only turns where:

- `trigger === "user"` (configurable)
- `success === true`
- at least 2 tools were called

...are recorded. Heartbeat, cron, and memory-flush turns are ignored by default.

### 2. Fingerprinting (on each recorded trace)

Each tool sequence is hashed into a **fingerprint** — a 16-character SHA-1 prefix of the ordered tool names joined by a null byte. Order matters: `read → write` and `write → read` produce different fingerprints.

Fingerprint counts, session lists, and promotion baselines are persisted to `learning/fingerprints.json` under a file lock.

### 3. Extraction trigger

After recording a trace, the plugin evaluates one of two paths:

**New skill** — fires when:

```
fingerprint.count >= minOccurrences (default: 3)
  AND fingerprint.sessionKeys.length >= minSessions (default: 2)
  AND no candidateId set yet
  AND session extraction limit not reached
  AND daily candidate count < maxCandidatesPerDay (default: 5)
```

**Skill revision** — fires when a skill was already promoted and:

```
fingerprint.count - countAtPromotion >= 5 (new evidence delta)
  AND no pending revisionCandidateId
  AND session and daily limits not reached
```

Both paths fire in the background — never blocks the agent turn.

### 4. LLM extraction

Uses `prepareSimpleCompletionModelForAgent` + `completeWithPreparedSimpleCompletionModel` from `openclaw/plugin-sdk/agent-runtime`. Single-turn simple completion, not a full agent dispatch.

**For new skills** — the prompt receives the tool sequence and recent trace summaries, asks the model to synthesize a procedural SKILL.md.

**For revisions** — the prompt additionally receives the full content of the existing promoted SKILL.md and asks the model to improve it based on the new evidence.

Both paths return structured JSON:

```json
{
  "name": "kebab-case-skill-name",
  "description": "One-line description",
  "body": "Full markdown procedure with ## When to use section",
  "confidence": 0.85,
  "reasoning": "Why this is worth capturing / what was improved"
}
```

Results with `confidence < 0.4` are discarded. 60-second timeout.

### 5. Draft storage

On a successful extraction:

- `learning/candidates/<id>.json` — candidate metadata including `kind: "new" | "revision"`, status, confidence, source sessions, and for revisions: `revisesSkillPath` and `revisesCandidateId`
- `learning/skills/<id>/SKILL.md` — the generated draft, valid frontmatter ready for the skills loader

### 6. CLI review and promotion

You review candidates with `openclaw learning` commands.

- **New skill approval**: draft is copied to `skills/<name>/SKILL.md`
- **Revision approval**: existing `skills/<name>/SKILL.md` is replaced with the improved version (no `--force` needed — it's an intentional update)

In both cases the chokidar file watcher bumps the skills snapshot version — the skill appears in `<available_skills>` on the **next agent turn**.

After a revision is approved, `countAtPromotion` resets so the cycle can trigger again with the next batch of evidence.

---

## Storage layout

All files live inside the workspace directory:

```
learning/
  traces.jsonl              # append-only, one JSON line per observed turn
  fingerprints.json         # fingerprint counts, session refs, promotion baselines
  .fingerprints.lock        # file lock for concurrent writes
  candidates/
    <uuid>.json             # one file per draft candidate (new or revision)
  skills/
    <uuid>/
      SKILL.md              # generated draft, not yet in workspace skills
```

Add `learning/` to `.gitignore` — it contains workspace-local runtime data.

---

## CLI reference

```
openclaw learning list [--all]
  List pending candidates (--all shows promoted and rejected too).
  Revision candidates are marked [revision] with the target skill path.

openclaw learning show <id>
  Show full candidate details, kind, revision target, and draft SKILL.md.

openclaw learning approve <id> [--force]
  New skill: copies draft to skills/<name>/SKILL.md.
  Revision: replaces the existing skill in place (--force not needed).
  Bumps skills snapshot. Records countAtPromotion for future revisions.

openclaw learning reject <id> [--reason "..."]
  Mark the candidate rejected. Audit record is preserved.

openclaw learning traces [--limit 20]
  Show recent tool-sequence traces for debugging.
```

---

## Configuration

Set under `plugins.entries.learning-core.config`:

```json
{
  "enabled": true,
  "mode": "suggest",
  "fingerprint": {
    "minOccurrences": 3,
    "minSessions": 2
  },
  "limits": {
    "maxCandidatesPerDay": 5,
    "maxExtractionsPerSession": 1,
    "maxTraceEntries": 10000
  },
  "triggers": {
    "userSessions": true,
    "cronSessions": false,
    "heartbeatSessions": false
  }
}
```

| Key                               | Default     | Description                                                                                                                       |
| --------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `enabled`                         | `false`     | Master switch. Off by default.                                                                                                    |
| `mode`                            | `"suggest"` | `off`: disabled. `suggest`: generates candidates, no auto-promote. `auto`: promotes high-confidence candidates (not recommended). |
| `fingerprint.minOccurrences`      | `3`         | How many times a sequence must repeat before extraction triggers.                                                                 |
| `fingerprint.minSessions`         | `2`         | How many distinct sessions must show the pattern.                                                                                 |
| `limits.maxCandidatesPerDay`      | `5`         | Daily cap on new candidates per workspace.                                                                                        |
| `limits.maxExtractionsPerSession` | `1`         | At most one extraction per agent session.                                                                                         |
| `limits.maxTraceEntries`          | `10000`     | Oldest traces are rotated out when this is exceeded.                                                                              |
| `triggers.userSessions`           | `true`      | Observe user-initiated turns.                                                                                                     |
| `triggers.cronSessions`           | `false`     | Observe cron-triggered turns.                                                                                                     |
| `triggers.heartbeatSessions`      | `false`     | Observe heartbeat turns.                                                                                                          |

---

## Candidate lifecycle

```
[observed N times]
       ↓
  [pending: new]  ──approve──►  [promoted]  ──5 more occurrences──►  [pending: revision]
       │                             │                                        │
    reject                        in skills/                              approve
       ↓                             ↓                                        ↓
  [rejected]                  used by agent                        skill updated in place
```

---

## What it improves

| Before                                                  | After                                                                                  |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Repeated workflows exist only in prompting habits       | Detected automatically after 3+ occurrences across 2+ sessions                         |
| Writing skills requires manual SKILL.md authoring       | Draft generated; you only need to review and approve                                   |
| Promoted skills are frozen                              | After 5 more observations, a revision candidate is generated with the improved version |
| No visibility into what tools the agent uses repeatedly | `openclaw learning traces` shows the full tool-sequence history                        |
| No audit trail for what patterns were considered        | Every candidate (approved, rejected, pending, revision) is preserved with reasoning    |

---

## What it does NOT do

- **No automatic memory promotion** — memory learning flows through the existing dreaming system (`memory-core`). This plugin does not duplicate that pipeline.
- **No auto-promotion by default** — `mode: "suggest"` means nothing reaches `skills/` without your explicit `openclaw learning approve`.
- **No agent-facing review tools** — review is CLI-only to avoid the recursive problem of the agent reviewing its own candidates.
- **No model fine-tuning** — this is prompt-level guidance (SKILL.md), not weight updates.
- **No dashboard UI panel** — visible in Config search after gateway restart; dedicated sidebar panel is deferred.

---

## Limitations

- Fingerprints match on tool names only, not parameters. `read /foo/bar` and `read /baz/qux` look identical to the fingerprinter. The LLM extraction prompt uses session traces to produce a generic procedure, so parameter-specific drift is mostly handled at the extraction stage.
- The extraction uses the same model configured for the agent. Small/fast models may produce lower-quality skills — check `confidence` in `openclaw learning show <id>` before approving.
- Subagent-originated tool calls are not recorded by default.
- A pending revision blocks a new revision for the same fingerprint until the pending one is approved or rejected.

---

## Example: new skill

1. You ask the agent to search memory, read a file, edit it, and write it back — three times across two sessions.
2. After the third matching turn, the plugin fires a background LLM call.
3. The model drafts `search-read-edit-write` at 82% confidence.
4. `openclaw learning list` shows one pending candidate.
5. `openclaw learning approve <id>` promotes it to `skills/search-read-edit-write/SKILL.md`.
6. Next agent turn picks it up via the skills snapshot refresh.

## Example: skill revision

1. The same pattern is observed 5 more times after the promotion.
2. The plugin fires a revision extraction, passing the existing SKILL.md content to the model.
3. The model returns an improved version at 88% confidence with `kind: "revision"`.
4. `openclaw learning list` shows `[revision] search-read-edit-write  revises: skills/search-read-edit-write/SKILL.md`.
5. `openclaw learning approve <id>` replaces the existing skill in place.
6. `countAtPromotion` resets — the cycle can repeat with the next batch of evidence.
