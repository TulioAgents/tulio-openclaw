/**
 * Skill extraction via simple completion.
 *
 * When a tool-sequence fingerprint crosses the occurrence threshold, this module
 * calls the agent's configured model to synthesize a draft SKILL.md from the
 * observed workflow. The response is structured JSON so it can be parsed
 * deterministically without full agent scaffolding.
 */

import {
  completeWithPreparedSimpleCompletionModel,
  extractAssistantText,
  prepareSimpleCompletionModelForAgent,
} from "openclaw/plugin-sdk/agent-runtime";
import type { OpenClawConfig } from "openclaw/plugin-sdk/config-runtime";
import { logVerbose } from "openclaw/plugin-sdk/runtime-env";
import type { TraceEntry } from "./types.js";

const EXTRACTION_TIMEOUT_MS = 60_000;
const _MAX_TRANSCRIPT_CHARS_PER_RUN = 6_000;
const MAX_RUNS_FOR_CONTEXT = 3;
const EXTRACTION_MAX_TOKENS = 2_048;

const EXTRACTION_SYSTEM_PROMPT = `You analyze repeated agent workflows and generate reusable skill definitions.
Reply ONLY with a single JSON object — no markdown fences, no prose.`;

export type ExtractionResult = {
  name: string;
  description: string;
  body: string;
  confidence: number;
  reasoning: string;
};

type ExtractionRaw = {
  name?: unknown;
  description?: unknown;
  body?: unknown;
  confidence?: unknown;
  reasoning?: unknown;
};

function buildExtractionPrompt(params: {
  toolSequence: string[];
  count: number;
  sessionCount: number;
  recentTraces: TraceEntry[];
  existingSkillContent?: string;
}): string {
  const seqList = params.toolSequence.map((t, i) => `${i + 1}. ${t}`).join("\n");

  const traceExcerpts = params.recentTraces
    .slice(0, MAX_RUNS_FOR_CONTEXT)
    .map((t, i) => {
      const summary = `Session ${i + 1} (${t.sessionKey.slice(-8)}, trigger: ${t.trigger}):\n  Tools: ${t.toolSequence.join(" → ")}`;
      return summary;
    })
    .join("\n\n");

  const isRevision = Boolean(params.existingSkillContent);

  const existingSection = isRevision
    ? `\nExisting skill content to improve:\n\`\`\`\n${params.existingSkillContent!.slice(0, 3_000)}\n\`\`\`\n`
    : "";

  const taskDescription = isRevision
    ? `Improve the existing skill above based on the additional usage patterns observed.`
    : `Generate a reusable SKILL.md that captures this workflow as procedural guidance.`;

  const nameRule = isRevision
    ? `- name must match the existing skill name exactly`
    : `- name must be kebab-case, 2-5 words, descriptive`;

  const bodyRule = isRevision
    ? `- body must be the full improved skill content — not a diff or patch; write the complete updated procedure`
    : `- body must be procedural guidance — not a transcript dump; reference tool names generically`;

  return `The following tool-call sequence has been observed ${params.count} times across ${params.sessionCount} distinct sessions:

${seqList}

Representative session traces:
${traceExcerpts}
${existingSection}
${taskDescription}

Reply with this exact JSON shape:
{
  "name": "short-kebab-case-name",
  "description": "One-line description of what this skill does (max 100 chars)",
  "body": "Full markdown body starting with a ## When to use section, then step-by-step procedure",
  "confidence": 0.0,
  "reasoning": "${isRevision ? "What was improved and why" : "Why this workflow is worth capturing as a reusable skill"}"
}

Rules:
- ${nameRule}
- description must be a single sentence, no trailing period
- ${bodyRule}
- body must NOT contain session-specific paths, IDs, or timestamps
- confidence is 0.0-1.0; use higher values when the pattern is clearly generic and reusable
- if the workflow is too session-specific to generalize, set confidence below 0.4`;
}

function parseExtractionResponse(raw: string): ExtractionResult | null {
  let text = raw.trim();

  // Strip markdown fences if the model ignored the instruction
  if (text.startsWith("```")) {
    text = text
      .replace(/^```[a-z]*\n?/i, "")
      .replace(/\n?```$/, "")
      .trim();
  }

  try {
    const parsed = JSON.parse(text) as ExtractionRaw;
    const name = (typeof parsed.name === "string" ? parsed.name : "").trim();
    const description = (typeof parsed.description === "string" ? parsed.description : "").trim();
    const body = (typeof parsed.body === "string" ? parsed.body : "").trim();
    const confidence = Math.min(1, Math.max(0, Number(parsed.confidence ?? 0)));
    const reasoning = (typeof parsed.reasoning === "string" ? parsed.reasoning : "").trim();

    if (!name || !description || !body) {
      return null;
    }

    return { name: normalizeSkillName(name), description, body, confidence, reasoning };
  } catch {
    return null;
  }
}

function normalizeSkillName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

/** Build the draft SKILL.md content from an extraction result and candidate id. */
export function buildDraftSkillContent(params: {
  result: ExtractionResult;
  fingerprint: string;
  candidateId: string;
}): string {
  const { result, fingerprint, candidateId } = params;
  return [
    "---",
    `name: ${result.name}`,
    `description: "${result.description.replace(/"/g, '\\"')}"`,
    `metadata: { "openclaw": { "emoji": "🔄" } }`,
    "---",
    "",
    result.body,
    "",
    `<!-- Generated by learning-core | fingerprint: ${fingerprint} | candidate: ${candidateId} -->`,
  ].join("\n");
}

/**
 * Run the extraction LLM call for a repeated workflow.
 * Returns null if the model is unavailable, the response is unparseable,
 * or confidence is below the minimum threshold.
 */
export async function extractSkillFromWorkflow(params: {
  cfg: OpenClawConfig;
  agentId: string;
  toolSequence: string[];
  count: number;
  sessionCount: number;
  recentTraces: TraceEntry[];
  minConfidence?: number;
  /** If provided, generate a revision of this existing skill instead of a new one. */
  existingSkillContent?: string;
}): Promise<ExtractionResult | null> {
  const prepared = await prepareSimpleCompletionModelForAgent({
    cfg: params.cfg,
    agentId: params.agentId,
    allowMissingApiKeyModes: ["aws-sdk"],
  });

  if ("error" in prepared) {
    logVerbose(
      `learning-core: model not available for extraction (agent=${params.agentId}): ${prepared.error}`,
    );
    return null;
  }

  const prompt = buildExtractionPrompt({
    toolSequence: params.toolSequence,
    count: params.count,
    sessionCount: params.sessionCount,
    recentTraces: params.recentTraces,
    existingSkillContent: params.existingSkillContent,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EXTRACTION_TIMEOUT_MS);

  try {
    const response = await completeWithPreparedSimpleCompletionModel({
      model: prepared.model,
      auth: prepared.auth,
      context: {
        systemPrompt: EXTRACTION_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: prompt,
            timestamp: Date.now(),
          },
        ],
      },
      options: {
        maxTokens: EXTRACTION_MAX_TOKENS,
        signal: controller.signal,
      },
    });

    const text = extractAssistantText(response);
    if (!text) {
      logVerbose(`learning-core: extraction returned empty response`);
      return null;
    }

    const result = parseExtractionResponse(text);
    if (!result) {
      logVerbose(`learning-core: could not parse extraction response`);
      return null;
    }

    const minConfidence = params.minConfidence ?? 0.4;
    if (result.confidence < minConfidence) {
      logVerbose(
        `learning-core: extraction confidence ${result.confidence} below threshold ${minConfidence}, discarding`,
      );
      return null;
    }

    return result;
  } catch (err) {
    logVerbose(`learning-core: extraction failed: ${String(err)}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
