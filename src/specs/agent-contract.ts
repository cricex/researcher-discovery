/**
 * Agent HTTP contract types — request/response shapes for agent communication.
 *
 * These define the wire format (in camelCase) for agent requests, responses,
 * errors, and health checks. The HTTP client layer handles snake_case mapping
 * when talking to external services.
 */

/**
 * Standard error codes returned by agents when a request fails.
 */
export enum AgentErrorCode {
  /** The agent did not respond within the allowed time window */
  AGENT_TIMEOUT = 'AGENT_TIMEOUT',
  /** The request payload was malformed or missing required fields */
  INVALID_REQUEST = 'INVALID_REQUEST',
  /** The agent found no results matching the query */
  NO_RESULTS = 'NO_RESULTS',
  /** An unexpected error occurred inside the agent */
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

/**
 * Inbound request sent to an agent for processing.
 */
export interface AgentRequest {
  /** The user query — a string or structured query object */
  query: string | Record<string, unknown>;
  /** Optional context scoping the request to specific records or sessions */
  context?: {
    goldenRecordIds?: string[];
    keywords?: string[];
    sessionId?: string;
  };
  /** Optional parameters controlling result shape */
  options?: {
    maxResults?: number;
    includeMetadata?: boolean;
  };
}

/**
 * Successful response returned by an agent after processing a request.
 */
export interface AgentContractResponse {
  /** Identifier of the agent that produced this response */
  agent: string;
  /** ISO 8601 timestamp of when the query was received */
  queryTimestamp: string;
  /** The agent's result payload */
  results: Record<string, unknown>;
  /** Source citations supporting the results */
  citations: string[];
  /** Optional processing metadata */
  metadata?: {
    processingTimeMs?: number;
    resultCount?: number;
  };
}

/**
 * Error response returned by an agent when processing fails.
 */
export interface AgentErrorResponse {
  /** Human-readable error message */
  error: string;
  /** Machine-readable error classification */
  errorCode: AgentErrorCode;
  /** Optional additional detail about the failure */
  details?: string;
  /** ISO 8601 timestamp of when the error occurred */
  timestamp: string;
}

/**
 * Health-check response indicating agent availability.
 */
export interface AgentHealthResponse {
  /** Current health status */
  status: 'healthy' | 'unhealthy';
  /** Identifier of the agent reporting health */
  agent: string;
  /** Semantic version of the agent */
  version: string;
  /** ISO 8601 timestamp of the health check */
  timestamp: string;
}
