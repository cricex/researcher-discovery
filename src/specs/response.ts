/**
 * Response types — what comes back from agents and the aggregator.
 */

import { ClassifiedIntent, IntentCategory } from './intent.js';

export type ResponseStatus = 'success' | 'error' | 'partial';

export interface AgentResponse {
  agentId: string;
  intentCategory: IntentCategory;
  status: ResponseStatus;
  /** The agent's output content */
  content: string;
  /** How confident the agent is in its response, 0–1 */
  confidence: number;
  metadata?: Record<string, unknown>;
  error?: string;
}

export interface AggregatedResponse {
  requestId: string;
  intent: ClassifiedIntent;
  /** Individual responses from each dispatched agent */
  responses: AgentResponse[];
  /** Merged final content produced by the aggregator */
  mergedContent: string;
  status: ResponseStatus;
  timestamp: Date;
}

/**
 * A parsed citation extracted from agent response content.
 * Citations use the format `<cite>sourceType_sourceId</cite>`.
 */
export interface Citation {
  /** The full citation string in `<cite>source_type_source_id</cite>` format */
  raw: string;
  /** Extracted source type (e.g., "gold", "openalex") */
  sourceType: string;
  /** Extracted source ID (e.g., "researcher_krueger_bruce_k") */
  sourceId: string;
}

/**
 * The final orchestration result after all agents have responded
 * and their outputs have been aggregated, enriched with citations
 * and processing metadata.
 */
export interface OrchestrationResult {
  /** Sections map keyed by agent name, value is that agent's content */
  sections: Map<string, string>;
  /** Deduplicated citations collected across all agent responses */
  citations: Citation[];
  /** Overall confidence score across all agents, 0–1 */
  overallConfidence: number;
  /** Explanation of which agents were invoked and why */
  reasoning: string;
  /** Processing metadata */
  metadata: {
    /** Wall-clock time for the full orchestration pass in milliseconds */
    processingTimeMs: number;
    /** IDs of agents that were invoked for this request */
    agentsInvoked: string[];
    /** Total number of citations collected across all agent responses */
    citationCount?: number;
    /** Ratio of sections with at least one citation, 0–1 */
    citationCoverage?: number;
    /** Safety filter violations detected and sanitized */
    safetyViolations?: string[];
  };
}

/**
 * A structured error entry for an agent that failed during dispatch.
 * Used to surface per-agent errors without coupling to the agent-contract module.
 */
export interface AgentErrorEntry {
  /** The agent that produced the error */
  agentId: string;
  /** A machine-readable error code (kept as string to avoid cross-module coupling) */
  errorCode: string;
  /** Human-readable error description */
  message: string;
}
