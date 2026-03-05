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
    category: overrides.category ?? IntentCategory.GENERAL,
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
