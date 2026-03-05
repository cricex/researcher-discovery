/**
 * HTTP agent client — sends requests to external agents and parses responses.
 *
 * Handles timeout via `AbortController`, maps between the camelCase TypeScript
 * types and the snake_case wire format defined in the agent contract spec, and
 * surfaces typed errors for every failure mode.
 */

import type { AgentEndpointConfig } from './endpoints.js';
import type {
  AgentRequest,
  AgentContractResponse,
  AgentErrorResponse,
  AgentHealthResponse,
} from '../specs/agent-contract.js';
import { AgentErrorCode } from '../specs/agent-contract.js';

// ─── Snake-case wire-format shapes ─────────────────────────────────────────

/** Wire-format request body (snake_case). */
interface WireRequest {
  query: string | Record<string, unknown>;
  context?: {
    golden_record_ids?: string[];
    keywords?: string[];
    session_id?: string;
  };
  options?: {
    max_results?: number;
    include_metadata?: boolean;
  };
}

/** Wire-format success response (snake_case). */
interface WireResponse {
  agent: string;
  query_timestamp: string;
  results: Record<string, unknown>;
  citations: string[];
  metadata?: {
    processing_time_ms?: number;
    result_count?: number;
  };
}

/** Wire-format error response (snake_case). */
interface WireError {
  error: string;
  error_code: string;
  details?: string;
  timestamp: string;
}

// ─── Mappers ───────────────────────────────────────────────────────────────

/**
 * Convert a camelCase `AgentRequest` to the snake_case wire format.
 * @internal
 */
function toWireRequest(req: AgentRequest): WireRequest {
  const wire: WireRequest = { query: req.query };

  if (req.context) {
    wire.context = {
      golden_record_ids: req.context.goldenRecordIds,
      keywords: req.context.keywords,
      session_id: req.context.sessionId,
    };
  }

  if (req.options) {
    wire.options = {
      max_results: req.options.maxResults,
      include_metadata: req.options.includeMetadata,
    };
  }

  return wire;
}

/**
 * Convert a snake_case wire response to the camelCase `AgentContractResponse`.
 * @internal
 */
function fromWireResponse(wire: WireResponse): AgentContractResponse {
  return {
    agent: wire.agent,
    queryTimestamp: wire.query_timestamp,
    results: wire.results,
    citations: wire.citations,
    metadata: wire.metadata
      ? {
          processingTimeMs: wire.metadata.processing_time_ms,
          resultCount: wire.metadata.result_count,
        }
      : undefined,
  };
}

/**
 * Convert a snake_case wire error to the camelCase `AgentErrorResponse`.
 * @internal
 */
function fromWireError(wire: WireError): AgentErrorResponse {
  return {
    error: wire.error,
    errorCode: (wire.error_code as AgentErrorCode) ?? AgentErrorCode.INTERNAL_ERROR,
    details: wire.details,
    timestamp: wire.timestamp,
  };
}

// ─── Client ────────────────────────────────────────────────────────────────

/**
 * HTTP client for communicating with external agents.
 *
 * Uses native `fetch` with `AbortController`-based timeouts. All public
 * methods accept an `AgentEndpointConfig` so the caller controls which
 * agent to talk to.
 *
 * @example
 * ```ts
 * const client = new HttpAgentClient();
 * const endpoint = DEFAULT_AGENT_ENDPOINTS.get('expertise_discovery')!;
 * const response = await client.callAgent(endpoint, { query: 'find experts' });
 * ```
 */
export class HttpAgentClient {
  /**
   * Send a request to an agent and return the typed response.
   *
   * @param endpoint - Connection configuration for the target agent.
   * @param request  - The `AgentRequest` to send (camelCase).
   * @returns A typed `AgentContractResponse` on success.
   * @throws {AgentErrorResponse} on timeout, HTTP error, or network failure.
   */
  async callAgent(
    endpoint: AgentEndpointConfig,
    request: AgentRequest,
  ): Promise<AgentContractResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      endpoint.timeoutMs ?? 5000,
    );

    try {
      const res = await fetch(endpoint.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toWireRequest(request)),
        signal: controller.signal,
      });

      if (!res.ok) {
        // Try to parse a structured error body; fall back to status text.
        let errorResponse: AgentErrorResponse;
        try {
          const wireErr: WireError = await res.json() as WireError;
          errorResponse = fromWireError(wireErr);
        } catch {
          errorResponse = {
            error: `HTTP ${res.status}: ${res.statusText}`,
            errorCode: AgentErrorCode.INTERNAL_ERROR,
            timestamp: new Date().toISOString(),
          };
        }
        throw errorResponse;
      }

      const wireRes: WireResponse = await res.json() as WireResponse;
      return fromWireResponse(wireRes);
    } catch (err: unknown) {
      // Re-throw our own AgentErrorResponse instances as-is.
      if (isAgentErrorResponse(err)) {
        throw err;
      }

      // AbortError → timeout
      if (err instanceof DOMException && err.name === 'AbortError') {
        const timeout: AgentErrorResponse = {
          error: `Agent "${endpoint.name}" timed out after ${endpoint.timeoutMs}ms`,
          errorCode: AgentErrorCode.AGENT_TIMEOUT,
          timestamp: new Date().toISOString(),
        };
        throw timeout;
      }

      // Everything else is a network-level failure.
      const networkErr: AgentErrorResponse = {
        error: `Network error calling agent "${endpoint.name}": ${String(err)}`,
        errorCode: AgentErrorCode.INTERNAL_ERROR,
        timestamp: new Date().toISOString(),
      };
      throw networkErr;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Check an agent's health by hitting its health endpoint.
   *
   * @param endpoint - Connection configuration for the target agent.
   * @returns An `AgentHealthResponse` indicating current status.
   *          Returns `status: 'unhealthy'` on any failure rather than throwing.
   */
  async checkHealth(endpoint: AgentEndpointConfig): Promise<AgentHealthResponse> {
    try {
      const res = await fetch(endpoint.healthUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(endpoint.timeoutMs ?? 5000),
      });

      if (!res.ok) {
        return unhealthyResponse(endpoint);
      }

      return await res.json() as AgentHealthResponse;
    } catch {
      return unhealthyResponse(endpoint);
    }
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Build a fallback "unhealthy" response when a health check fails. */
function unhealthyResponse(endpoint: AgentEndpointConfig): AgentHealthResponse {
  return {
    status: 'unhealthy',
    agent: endpoint.id,
    version: 'unknown',
    timestamp: new Date().toISOString(),
  };
}

/** Type-guard: is the value an `AgentErrorResponse` we already built? */
function isAgentErrorResponse(value: unknown): value is AgentErrorResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'errorCode' in value &&
    'error' in value &&
    'timestamp' in value
  );
}
