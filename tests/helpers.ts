/**
 * Test Helpers
 *
 * Shared utilities for orchestration-agent tests.
 * Provides common fixtures, factory functions, and assertion helpers.
 */

import {
  type Agent,
  type AgentCapability,
  type AgentResponse,
  type AgentRequest,
  type AgentContractResponse,
  type ClassifiedIntent,
  type ExecutionContext,
  IntentCategory,
} from "../src/specs/index.js";

/** Creates a stub Agent for testing. */
export function createStubAgent(
  overrides: Partial<Pick<Agent, "id" | "name">> & {
    categories?: IntentCategory[];
  } = {},
): Agent {
  const categories = overrides.categories ?? [IntentCategory.GENERAL];
  const capabilities: AgentCapability[] = categories.map((cat) => ({
    intentCategory: cat,
    description: `Handles ${cat}`,
    priority: 0,
  }));

  return {
    id: overrides.id ?? "test-agent",
    name: overrides.name ?? "Test Agent",
    capabilities,
    canHandle(intent: ClassifiedIntent): boolean {
      return capabilities.some((c) => c.intentCategory === intent.category);
    },
    async execute(
      intent: ClassifiedIntent,
      context: ExecutionContext,
    ): Promise<AgentResponse> {
      return {
        agentId: overrides.id ?? "test-agent",
        intentCategory: intent.category,
        status: "success",
        content: `Response from ${overrides.id ?? "test-agent"}`,
        confidence: 0.9,
      };
    },
  };
}

/** Creates a ClassifiedIntent for testing. */
export function createTestIntent(
  overrides: Partial<ClassifiedIntent> = {},
): ClassifiedIntent {
  return {
    category: overrides.category ?? IntentCategory.EXPERTISE_DISCOVERY,
    confidence: overrides.confidence ?? 0.8,
    rawInput: overrides.rawInput ?? "test input",
    parameters: overrides.parameters ?? {},
  };
}

/** Creates an ExecutionContext for testing. */
export function createTestContext(
  overrides: Partial<ExecutionContext> = {},
): ExecutionContext {
  return {
    requestId: overrides.requestId ?? "test-request-id",
    timestamp: overrides.timestamp ?? new Date("2025-01-01T00:00:00Z"),
  };
}

/** Creates a mock AgentContractResponse for testing HTTP agent responses. */
export function createMockAgentResponse(
  overrides: Partial<AgentContractResponse> = {},
): AgentContractResponse {
  return {
    agent: overrides.agent ?? "test-agent",
    queryTimestamp: overrides.queryTimestamp ?? new Date().toISOString(),
    results: overrides.results ?? { summary: "mock result" },
    citations: overrides.citations ?? ["https://example.com/source-1"],
    metadata: overrides.metadata,
  };
}

/** Creates a mock AgentRequest for testing HTTP agent requests. */
export function createMockAgentRequest(
  overrides: Partial<AgentRequest> = {},
): AgentRequest {
  return {
    query: overrides.query ?? "test query",
    context: overrides.context,
    options: overrides.options,
  };
}

/** Creates a stub HTTP agent for testing — a simple object with the expected shape. */
export function createStubHttpAgent(
  overrides: { baseUrl?: string; agentId?: string; timeout?: number } = {},
) {
  const agentId = overrides.agentId ?? "http-test-agent";
  const baseUrl = overrides.baseUrl ?? "http://localhost:3000";
  const timeout = overrides.timeout ?? 5000;

  return {
    agentId,
    baseUrl,
    timeout,
    async query(request: AgentRequest): Promise<AgentContractResponse> {
      return createMockAgentResponse({ agent: agentId });
    },
    async healthCheck(): Promise<{ status: "healthy" | "unhealthy" }> {
      return { status: "healthy" };
    },
  };
}
