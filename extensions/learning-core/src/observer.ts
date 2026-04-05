/**
 * Plugin hook observer for learning-core.
 *
 * Registers after_tool_call and agent_end handlers to:
 * 1. Accumulate tool names per run into a per-session in-memory buffer
 * 2. On agent_end: flush the buffer as a TraceEntry, update fingerprint counts,
 *    and optionally trigger skill draft extraction when a pattern threshold is met
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { OpenClawConfig } from "openclaw/plugin-sdk/config-runtime";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-entry";
import { logVerbose } from "openclaw/plugin-sdk/runtime-env";
import { listCandidates, writeCandidate, writeDraftSkill } from "./candidate-store.js";
import { buildDraftSkillContent, extractSkillFromWorkflow } from "./skill-extractor.js";
import {
  appendTrace,
  checkDailyLimit,
  computeFingerprint,
  incrementDailyCount,
  markFingerprintCandidated,
  markFingerprintPromoted,
  markFingerprintRevision,
  recordFingerprint,
  readTracesForFingerprint,
} from "./trace-store.js";
import type { LearningConfig, TraceEntry } from "./types.js";

/** How many new occurrences after promotion before triggering a revision. */
const REVISION_OCCURRENCE_DELTA = 5;

/** Per-run buffer of tool names — keyed by runId. */
const runToolBuffers = new Map<string, string[]>();
/** Per-run trigger — populated by agent_end since after_tool_call context lacks trigger. */
const runTriggers = new Map<string, string>();
/** Per-session extraction flag to enforce maxExtractionsPerSession. */
const sessionExtractionDone = new Set<string>();

function isTriggerAllowed(trigger: string | undefined, cfg: LearningConfig): boolean {
  const t = trigger ?? "user";
  if (t === "user") return cfg.triggers.userSessions;
  if (t === "cron") return cfg.triggers.cronSessions;
  if (t === "heartbeat") return cfg.triggers.heartbeatSessions;
  return false;
}

export function registerObserverHooks(
  api: OpenClawPluginApi,
  getConfig: () => LearningConfig,
  getOpenClawConfig: () => OpenClawConfig,
): void {
  // ── after_tool_call: accumulate tool names per run ────────────────────────
  // Note: PluginHookToolContext does not include trigger — we check it in agent_end.
  api.on("after_tool_call", (event, ctx) => {
    const cfg = getConfig();
    if (!cfg.enabled || cfg.mode === "off") return;

    const runId = ctx.runId ?? "unknown";
    const toolName = (event as { toolName?: string }).toolName ?? "unknown";

    let buffer = runToolBuffers.get(runId);
    if (!buffer) {
      buffer = [];
      runToolBuffers.set(runId, buffer);
    }
    buffer.push(toolName);
  });

  // ── agent_end: flush trace + optionally trigger extraction ────────────────
  api.on("agent_end", (event, ctx) => {
    const cfg = getConfig();
    if (!cfg.enabled || cfg.mode === "off") return;
    if (!isTriggerAllowed(ctx.trigger, cfg)) return;

    const runId = ctx.runId ?? "unknown";
    const sessionKey = ctx.sessionKey ?? "unknown";
    const agentId = ctx.agentId ?? "unknown";
    const workspaceDir = ctx.workspaceDir;

    const toolSequence = runToolBuffers.get(runId) ?? [];
    runToolBuffers.delete(runId);
    runTriggers.delete(runId);

    const agentEndEvent = event as { success?: boolean; durationMs?: number };

    // Only record successful user-initiated turns with at least 2 tool calls
    if (!agentEndEvent.success || toolSequence.length < 2 || !workspaceDir) {
      return;
    }

    const trace: TraceEntry = {
      timestamp: new Date().toISOString(),
      sessionKey,
      runId,
      agentId,
      trigger: ctx.trigger ?? "user",
      toolSequence,
      success: true,
      durationMs: agentEndEvent.durationMs ?? 0,
    };

    // Fire-and-forget background processing — never block the agent turn
    void processTrace(trace, workspaceDir, sessionKey, cfg, getOpenClawConfig());
  });
}

async function processTrace(
  trace: TraceEntry,
  workspaceDir: string,
  sessionKey: string,
  cfg: LearningConfig,
  openClawCfg: OpenClawConfig,
): Promise<void> {
  try {
    // Persist trace
    await appendTrace(workspaceDir, trace, cfg.limits.maxTraceEntries);

    // Update fingerprint count
    const fingerprint = computeFingerprint(trace.toolSequence);
    const entry = await recordFingerprint(
      workspaceDir,
      trace.toolSequence,
      sessionKey,
      trace.runId,
    );

    // ── Determine what kind of extraction to run ────────────────────────────

    const hasInitialCandidate = Boolean(entry.candidateId);
    const belowThreshold =
      entry.count < cfg.fingerprint.minOccurrences ||
      entry.sessionKeys.length < cfg.fingerprint.minSessions;

    // Check if the initial candidate was promoted — if so, look for revision opportunity
    let promotedSkillPath: string | undefined;
    let promotedCandidateId: string | undefined;
    if (hasInitialCandidate) {
      const allCandidates = await listCandidates(workspaceDir);
      const promoted = allCandidates.find(
        (c) => c.id === entry.candidateId && c.status === "promoted" && c.promotedTo,
      );
      if (promoted?.promotedTo) {
        promotedSkillPath = promoted.promotedTo;
        promotedCandidateId = promoted.id;
      }
    }

    const isRevisionEligible =
      promotedSkillPath !== undefined &&
      !entry.revisionCandidateId && // no pending revision yet
      entry.countAtPromotion !== undefined &&
      entry.count - entry.countAtPromotion >= REVISION_OCCURRENCE_DELTA;

    // Skip if: not yet at threshold AND not a revision opportunity
    if (belowThreshold && !isRevisionEligible) return;
    // Skip if: initial candidate pending (not promoted yet) OR already has pending revision
    if (hasInitialCandidate && !promotedSkillPath && !isRevisionEligible) return;
    if (entry.revisionCandidateId) return;

    // Per-session extraction limit
    if (sessionExtractionDone.has(sessionKey)) {
      logVerbose(`learning-core: skipping extraction (session limit reached): ${sessionKey}`);
      return;
    }

    // Daily rate limit
    const withinLimit = await checkDailyLimit(workspaceDir, cfg.limits.maxCandidatesPerDay);
    if (!withinLimit) {
      logVerbose(`learning-core: skipping extraction (daily limit reached)`);
      return;
    }

    sessionExtractionDone.add(sessionKey);

    // Collect recent matching traces for context
    const recentTraces = await readTracesForFingerprint(workspaceDir, fingerprint, 1_000);

    // For revisions, read the existing skill content
    let existingSkillContent: string | undefined;
    if (isRevisionEligible && promotedSkillPath) {
      try {
        existingSkillContent = await fs.readFile(
          path.join(workspaceDir, promotedSkillPath),
          "utf8",
        );
      } catch {
        // Skill was deleted externally — fall back to new extraction
        existingSkillContent = undefined;
      }
    }

    logVerbose(
      `learning-core: triggering ${isRevisionEligible ? "revision" : "new"} extraction for fingerprint ${fingerprint} (count=${entry.count}, sessions=${entry.sessionKeys.length})`,
    );

    const result = await extractSkillFromWorkflow({
      cfg: openClawCfg,
      agentId: trace.agentId,
      toolSequence: trace.toolSequence,
      count: entry.count,
      sessionCount: entry.sessionKeys.length,
      recentTraces,
      existingSkillContent,
    });

    if (!result) {
      logVerbose(`learning-core: extraction produced no result for fingerprint ${fingerprint}`);
      return;
    }

    // Write candidate and draft skill
    const candidate = await writeCandidate(workspaceDir, {
      fingerprint,
      toolSequence: trace.toolSequence,
      sourceSessionKeys: entry.sessionKeys,
      sourceRunIds: entry.runIds,
      status: "pending",
      kind: isRevisionEligible ? "revision" : "new",
      confidence: result.confidence,
      reasoning: result.reasoning,
      skillName: result.name,
      skillDescription: result.description,
      ...(isRevisionEligible && promotedSkillPath
        ? { revisesSkillPath: promotedSkillPath, revisesCandidateId: promotedCandidateId }
        : {}),
    });

    const draftContent = buildDraftSkillContent({
      result,
      fingerprint,
      candidateId: candidate.id,
    });

    await writeDraftSkill(workspaceDir, candidate.id, draftContent);

    if (isRevisionEligible) {
      await markFingerprintRevision(workspaceDir, fingerprint, candidate.id);
    } else {
      await markFingerprintCandidated(workspaceDir, fingerprint, candidate.id);
    }
    await incrementDailyCount(workspaceDir);

    logVerbose(
      `learning-core: created ${candidate.kind} candidate ${candidate.id} for skill "${result.name}" (confidence=${result.confidence})`,
    );
  } catch (err) {
    // Never surface extraction errors to the user
    logVerbose(`learning-core: background processing error: ${String(err)}`);
  }
}
