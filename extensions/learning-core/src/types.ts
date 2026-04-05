/** Append-only record of a single agent turn's tool usage. */
export type TraceEntry = {
  timestamp: string;
  sessionKey: string;
  runId: string;
  agentId: string;
  /** "user" | "heartbeat" | "cron" | "memory" */
  trigger: string;
  /** Ordered list of tool names called during the turn. */
  toolSequence: string[];
  success: boolean;
  durationMs: number;
};

/** Per-fingerprint occurrence tracking persisted to fingerprints.json. */
export type FingerprintEntry = {
  fingerprint: string;
  toolSequence: string[];
  count: number;
  sessionKeys: string[];
  runIds: string[];
  firstSeenAt: string;
  lastSeenAt: string;
  /** Set to candidate id once initial extraction has been triggered. */
  candidateId?: string;
  /**
   * Count at the time the initial skill was promoted.
   * Used to detect enough new evidence for a revision.
   */
  countAtPromotion?: number;
  /** Most recent revision candidate id. */
  revisionCandidateId?: string;
};

export type FingerprintStore = {
  version: 1;
  updatedAt: string;
  /** ISO date → count of candidates generated that day, for rate limiting. */
  dailyCandidateCounts: Record<string, number>;
  entries: Record<string, FingerprintEntry>;
};

/** A draft skill candidate generated from a repeated workflow. */
export type SkillCandidate = {
  id: string;
  fingerprint: string;
  toolSequence: string[];
  sourceSessionKeys: string[];
  sourceRunIds: string[];
  createdAt: string;
  status: "pending" | "promoted" | "rejected";
  /**
   * "new": brand-new skill draft.
   * "revision": improvement of an already-promoted skill.
   */
  kind: "new" | "revision";
  confidence: number;
  reasoning: string;
  skillName: string;
  skillDescription: string;
  /** For revisions: the workspace-relative path of the existing skill being improved. */
  revisesSkillPath?: string;
  /** For revisions: the id of the candidate that originally promoted this skill. */
  revisesCandidateId?: string;
  rejectedAt?: string;
  rejectedReason?: string;
  promotedAt?: string;
  /** Workspace-relative path where the promoted SKILL.md was written. */
  promotedTo?: string;
};

/** Resolved config for the learning-core plugin. */
export type LearningConfig = {
  enabled: boolean;
  mode: "off" | "suggest" | "auto";
  fingerprint: {
    minOccurrences: number;
    minSessions: number;
  };
  limits: {
    maxCandidatesPerDay: number;
    maxExtractionsPerSession: number;
    maxTraceEntries: number;
  };
  triggers: {
    userSessions: boolean;
    cronSessions: boolean;
    heartbeatSessions: boolean;
  };
};

export const DEFAULT_LEARNING_CONFIG: LearningConfig = {
  enabled: false,
  mode: "suggest",
  fingerprint: {
    minOccurrences: 3,
    minSessions: 2,
  },
  limits: {
    maxCandidatesPerDay: 5,
    maxExtractionsPerSession: 1,
    maxTraceEntries: 10_000,
  },
  triggers: {
    userSessions: true,
    cronSessions: false,
    heartbeatSessions: false,
  },
};
