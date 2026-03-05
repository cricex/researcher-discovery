import { describe, it, expect } from "vitest";
import { Orchestrator } from "../../src/orchestrator/orchestrator.js";
import { DefaultClassifier } from "../../src/orchestrator/classifier/classifier.js";
import { DefaultAggregator } from "../../src/orchestrator/aggregator/aggregator.js";
import { DefaultRouter } from "../../src/orchestrator/router.js";
import { AgentRegistry } from "../../src/agents/registry.js";
import { createStubAgent } from "../helpers.js";
import { IntentCategory } from "../../src/specs/index.js";

describe("Integration: Full Pipeline", () => {
  it("should wire all components and process input end-to-end", async () => {
    const registry = new AgentRegistry();
    registry.register(createStubAgent({ id: "general-agent", categories: [IntentCategory.EXPERTISE_DISCOVERY] }));

    const classifier = new DefaultClassifier();
    const router = new DefaultRouter(registry);
    const aggregator = new DefaultAggregator();
    const orchestrator = new Orchestrator(classifier, router, aggregator);

    const result = await orchestrator.process("help me with something");

    expect(result).toBeDefined();
    expect(result.requestId).toBeTruthy();
    expect(result.intent.rawInput).toBe("help me with something");
    expect(result.responses).toHaveLength(1);
    expect(result.responses[0].agentId).toBe("general-agent");
    expect(result.status).toBe("success");
  });

  it("should handle input with no matching agents", async () => {
    const registry = new AgentRegistry();
    // No agents registered

    const orchestrator = new Orchestrator(
      new DefaultClassifier(),
      new DefaultRouter(registry),
      new DefaultAggregator(),
    );

    const result = await orchestrator.process("something");
    expect(result).toBeDefined();
    expect(result.responses).toHaveLength(0);
  });
});
