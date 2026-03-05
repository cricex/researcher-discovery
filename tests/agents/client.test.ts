/**
 * T012 [US1] — Agent client contract tests.
 *
 * Tests the HttpAgentClient from src/agents/client.ts against the agent
 * contract spec. Verifies request format, response parsing, error handling,
 * and timeout behavior.
 *
 * Uses vi.fn() to mock global fetch — no real HTTP calls are made.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HttpAgentClient } from "../../src/agents/client.js";
import type { AgentEndpointConfig } from "../../src/agents/endpoints.js";
import {
  type AgentRequest,
  type AgentContractResponse,
  type AgentErrorResponse,
  AgentErrorCode,
} from "../../src/specs/agent-contract.js";

// ── Test fixtures ──────────────────────────────────────────────────────────

const TEST_ENDPOINT: AgentEndpointConfig = {
  id: "expertise_discovery",
  name: "Expertise Discovery",
  url: "http://localhost:5001/api/v1/expertise",
  healthUrl: "http://localhost:5001/health",
  timeoutMs: 5000,
  enabled: true,
};

/** A snake_case wire-format success response as the remote agent would return. */
function createWireSuccessResponse() {
  return {
    agent: "expertise_discovery",
    query_timestamp: "2026-03-05T12:00:00Z",
    results: { experts: [{ name: "Dr. Smith" }] },
    citations: ["https://example.com/smith"],
    metadata: {
      processing_time_ms: 150,
      result_count: 1,
    },
  };
}

/** A snake_case wire-format error response. */
function createWireErrorResponse() {
  return {
    error: "No matching records found",
    error_code: "NO_RESULTS",
    details: "Query returned zero hits",
    timestamp: "2026-03-05T12:00:01Z",
  };
}

// ── Setup / Teardown ───────────────────────────────────────────────────────

let client: HttpAgentClient;
const originalFetch = globalThis.fetch;

beforeEach(() => {
  client = new HttpAgentClient();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("HttpAgentClient — callAgent()", () => {
  it("should send correct snake_case request format per agent contract spec", async () => {
    // Capture the outgoing request
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => createWireSuccessResponse(),
    });
    globalThis.fetch = mockFetch;

    const request: AgentRequest = {
      query: "who works on autism research?",
      context: {
        goldenRecordIds: ["GR-001", "GR-002"],
        keywords: ["autism", "neuroscience"],
        sessionId: "sess-abc-123",
      },
      options: {
        maxResults: 10,
        includeMetadata: true,
      },
    };

    await client.callAgent(TEST_ENDPOINT, request);

    // Verify fetch was called with correct method and headers
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, fetchOpts] = mockFetch.mock.calls[0];
    expect(url).toBe(TEST_ENDPOINT.url);
    expect(fetchOpts.method).toBe("POST");
    expect(fetchOpts.headers).toEqual({ "Content-Type": "application/json" });

    // Parse the body and verify snake_case field names
    const body = JSON.parse(fetchOpts.body);
    expect(body.query).toBe("who works on autism research?");

    // Context fields must be snake_case on the wire
    expect(body.context.golden_record_ids).toEqual(["GR-001", "GR-002"]);
    expect(body.context.keywords).toEqual(["autism", "neuroscience"]);
    expect(body.context.session_id).toBe("sess-abc-123");

    // Options fields must be snake_case on the wire
    expect(body.options.max_results).toBe(10);
    expect(body.options.include_metadata).toBe(true);

    // camelCase versions must NOT appear in wire format
    expect(body.context.goldenRecordIds).toBeUndefined();
    expect(body.context.sessionId).toBeUndefined();
    expect(body.options.maxResults).toBeUndefined();
    expect(body.options.includeMetadata).toBeUndefined();
  });

  it("should parse snake_case wire response into camelCase TypeScript types", async () => {
    const wireResponse = createWireSuccessResponse();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => wireResponse,
    });

    const result: AgentContractResponse = await client.callAgent(
      TEST_ENDPOINT,
      { query: "test query" },
    );

    // Top-level fields
    expect(result.agent).toBe("expertise_discovery");
    expect(result.queryTimestamp).toBe("2026-03-05T12:00:00Z");
    expect(result.results).toEqual({ experts: [{ name: "Dr. Smith" }] });
    expect(result.citations).toEqual(["https://example.com/smith"]);

    // Metadata must be camelCase
    expect(result.metadata).toBeDefined();
    expect(result.metadata!.processingTimeMs).toBe(150);
    expect(result.metadata!.resultCount).toBe(1);

    // snake_case keys should NOT leak into the typed response
    const raw = result as Record<string, unknown>;
    expect(raw["query_timestamp"]).toBeUndefined();
    expect((raw["metadata"] as Record<string, unknown> | undefined)?.["processing_time_ms"]).toBeUndefined();
  });

  it("should return typed AgentErrorResponse on HTTP error with structured body", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: async () => createWireErrorResponse(),
    });

    try {
      await client.callAgent(TEST_ENDPOINT, { query: "missing data" });
      expect.fail("callAgent should have thrown on HTTP error");
    } catch (err) {
      const error = err as AgentErrorResponse;
      expect(error.error).toBe("No matching records found");
      expect(error.errorCode).toBe(AgentErrorCode.NO_RESULTS);
      expect(error.details).toBe("Query returned zero hits");
      expect(error.timestamp).toBe("2026-03-05T12:00:01Z");
    }
  });

  it("should return AGENT_TIMEOUT error code on AbortError", async () => {
    // Simulate fetch throwing an AbortError (timeout)
    const abortError = new DOMException(
      "The operation was aborted",
      "AbortError",
    );
    globalThis.fetch = vi.fn().mockRejectedValue(abortError);

    const shortTimeoutEndpoint: AgentEndpointConfig = {
      ...TEST_ENDPOINT,
      timeoutMs: 100,
    };

    try {
      await client.callAgent(shortTimeoutEndpoint, { query: "slow query" });
      expect.fail("callAgent should have thrown on timeout");
    } catch (err) {
      const error = err as AgentErrorResponse;
      expect(error.errorCode).toBe(AgentErrorCode.AGENT_TIMEOUT);
      expect(error.error).toContain("timed out");
      expect(error.timestamp).toBeTruthy();
    }
  });

  it("should return INTERNAL_ERROR on non-JSON HTTP error response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => { throw new Error("not JSON"); },
    });

    try {
      await client.callAgent(TEST_ENDPOINT, { query: "broken endpoint" });
      expect.fail("callAgent should have thrown");
    } catch (err) {
      const error = err as AgentErrorResponse;
      expect(error.errorCode).toBe(AgentErrorCode.INTERNAL_ERROR);
      expect(error.error).toContain("500");
    }
  });

  it("should return INTERNAL_ERROR on network failure", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(
      new TypeError("Failed to fetch"),
    );

    try {
      await client.callAgent(TEST_ENDPOINT, { query: "network down" });
      expect.fail("callAgent should have thrown");
    } catch (err) {
      const error = err as AgentErrorResponse;
      expect(error.errorCode).toBe(AgentErrorCode.INTERNAL_ERROR);
      expect(error.error).toContain("Network error");
    }
  });
});
