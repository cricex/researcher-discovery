import { describe, it, expect } from "vitest";
import { Orchestrator } from "../../src/orchestrator/orchestrator.js";
import { DefaultClassifier } from "../../src/orchestrator/classifier/classifier.js";
import { DefaultAggregator } from "../../src/orchestrator/aggregator/aggregator.js";
import { DefaultRouter } from "../../src/orchestrator/router.js";
import { AgentRegistry } from "../../src/agents/registry.js";
import { createStubAgent } from "../helpers.js";

describe("Orchestrator", () => {
  it("should be importable and constructable", () => {
    const registry = new AgentRegistry();
    const orchestrator = new Orchestrator(
      new DefaultClassifier(),
      new DefaultRouter(registry),
      new DefaultAggregator(),
    );
    expect(orchestrator).toBeDefined();
    expect(orchestrator).toBeInstanceOf(Orchestrator);
  });

  it("should process input through the full pipeline", async () => {
    const registry = new AgentRegistry();
    registry.register(createStubAgent({ id: "general-1" }));

    const orchestrator = new Orchestrator(
      new DefaultClassifier(),
      new DefaultRouter(registry),
      new DefaultAggregator(),
    );

    const result = await orchestrator.process("hello");
    expect(result).toBeDefined();
    expect(result.requestId).toBeTruthy();
    expect(result.responses.length).toBeGreaterThanOrEqual(1);
    expect(result.status).toBe("success");
  });
});
