import { describe, it, expect } from "vitest";
import { DefaultAggregator } from "../../src/orchestrator/aggregator/aggregator.js";
import { IntentCategory, type AgentResponse } from "../../src/specs/index.js";
import { createTestIntent, createTestContext } from "../helpers.js";

describe("DefaultAggregator", () => {
  it("should be importable and constructable", () => {
    const aggregator = new DefaultAggregator();
    expect(aggregator).toBeDefined();
    expect(aggregator).toBeInstanceOf(DefaultAggregator);
  });

  it("should aggregate empty responses as success", async () => {
    const aggregator = new DefaultAggregator();
    const intent = createTestIntent();
    const context = createTestContext();
    const result = await aggregator.aggregate(intent, [], context);
    expect(result.responses).toHaveLength(0);
    expect(result.status).toBe("success");
  });

  it("should merge content from successful responses", async () => {
    const aggregator = new DefaultAggregator();
    const intent = createTestIntent();
    const context = createTestContext();

    const responses: AgentResponse[] = [
      {
        agentId: "a",
        intentCategory: IntentCategory.GENERAL,
        status: "success",
        content: "First response",
        confidence: 0.9,
      },
      {
        agentId: "b",
        intentCategory: IntentCategory.GENERAL,
        status: "success",
        content: "Second response",
        confidence: 0.8,
      },
    ];

    const result = await aggregator.aggregate(intent, responses, context);
    expect(result.status).toBe("success");
    expect(result.mergedContent).toContain("First response");
    expect(result.mergedContent).toContain("Second response");
    expect(result.requestId).toBe(context.requestId);
  });
});
