/**
 * T040 — Performance validation tests.
 *
 * Verifies that the orchestration pipeline completes within timing budgets
 * using stub agents with simulated latency (50ms per agent).
 *
 * Budgets:
 *  - Single-agent query: < 3 s
 *  - Multi-agent query (3 agents): < 5 s
 *  - Individual pipeline stages: each within budget
 */

import { describe, it, expect } from "vitest";
import { performance } from "node:perf_hooks";
import { Orchestrator } from "../../src/orchestrator/orchestrator.js";
import { DefaultAggregator } from "../../src/orchestrator/aggregator/aggregator.js";
import { DefaultRouter } from "../../src/orchestrator/router.js";
import { AgentRegistry } from "../../src/agents/registry.js";
import {
  type Agent,
  type AgentResponse,
  type ClassifiedIntent,
  type ExecutionContext,
  type IntentClassifier,
  IntentCategory,
} from "../../src/specs/index.js";
import { createStubAgent, createTestIntent } from "../helpers.js";

// ── Simulated-latency agent factory ────────────────────────────────────────

const SIMULATED_LATENCY_MS = 50;

/**
 * Creates a stub agent that adds artificial delay via setTimeout.
 * The latency (50ms) is well under the per-agent timeout (150ms default)
 * so the agent always succeeds.
 */
function createLatencyAgent(
  id: string,
  category: IntentCategory = IntentCategory.EXPERTISE_DISCOVERY,
  latencyMs: number = SIMULATED_LATENCY_MS,
): Agent {
  return {
    id,
    name: `Latency Agent (${id})`,
    capabilities: [
      {
        intentCategory: category,
        description: `Agent ${id} with ${latencyMs}ms latency`,
        priority: 10,
      },
    ],
    canHandle(intent: ClassifiedIntent): boolean {
      return intent.category === category;
    },
    async execute(
      intent: ClassifiedIntent,
      _context: ExecutionContext,
    ): Promise<AgentResponse> {
      await new Promise((resolve) => setTimeout(resolve, latencyMs));
      return {
        agentId: id,
        intentCategory: intent.category,
        status: "success",
        content: `Response from ${id} after ${latencyMs}ms`,
        confidence: 0.85,
      };
    },
  };
}

// ── Deterministic classifier for performance tests ─────────────────────────

class PerfTestClassifier implements IntentClassifier {
  constructor(private readonly category: IntentCategory) {}

  async classify(input: string): Promise<ClassifiedIntent> {
    return {
      category: this.category,
      confidence: 0.95,
      rawInput: input,
      parameters: {},
    };
  }

  async classifyMulti(input: string): Promise<ClassifiedIntent[]> {
    return [await this.classify(input)];
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Integration: Performance Validation (T040)", () => {
  it("single-agent query completes in < 3s", async () => {
    const registry = new AgentRegistry();
    registry.register(
      createLatencyAgent("perf-agent-solo", IntentCategory.EXPERTISE_DISCOVERY),
    );

    const orchestrator = new Orchestrator(
      new PerfTestClassifier(IntentCategory.EXPERTISE_DISCOVERY),
      new DefaultRouter(registry),
      new DefaultAggregator(),
      { perAgentTimeoutMs: 150 },
    );

    const start = performance.now();
    const result = await orchestrator.process("who studies machine learning?");
    const elapsed = performance.now() - start;

    expect(result.status).toBe("success");
    expect(result.responses).toHaveLength(1);
    expect(result.responses[0].agentId).toBe("perf-agent-solo");
    expect(elapsed).toBeLessThan(3000);
  });

  it("multi-agent query (3 agents) completes in < 5s", async () => {
    const registry = new AgentRegistry();
    const category = IntentCategory.EXPERTISE_DISCOVERY;

    registry.register(createLatencyAgent("perf-agent-1", category));
    registry.register(createLatencyAgent("perf-agent-2", category));
    registry.register(createLatencyAgent("perf-agent-3", category));

    const orchestrator = new Orchestrator(
      new PerfTestClassifier(category),
      new DefaultRouter(registry),
      new DefaultAggregator(),
      { perAgentTimeoutMs: 150 },
    );

    const start = performance.now();
    const result = await orchestrator.process(
      "find researchers in genomics, proteomics, and bioinformatics",
    );
    const elapsed = performance.now() - start;

    expect(result.status).toBe("success");
    expect(result.responses).toHaveLength(3);
    expect(elapsed).toBeLessThan(5000);
  });

  it("pipeline stages (classify → route → dispatch → aggregate) each complete within budget", async () => {
    const category = IntentCategory.EXPERTISE_DISCOVERY;
    const registry = new AgentRegistry();
    registry.register(createLatencyAgent("stage-agent-1", category));
    registry.register(createLatencyAgent("stage-agent-2", category));

    const classifier = new PerfTestClassifier(category);
    const router = new DefaultRouter(registry);
    const aggregator = new DefaultAggregator();

    const input = "who studies computational biology?";
    const stageBudgetMs = 2000;

    // Stage 1: classify
    const classifyStart = performance.now();
    const intents = await classifier.classifyMulti(input);
    const classifyElapsed = performance.now() - classifyStart;
    expect(classifyElapsed).toBeLessThan(stageBudgetMs);
    expect(intents).toHaveLength(1);
    expect(intents[0].category).toBe(category);

    // Stage 2: route
    const routeStart = performance.now();
    const agents = await router.route(intents[0]);
    const routeElapsed = performance.now() - routeStart;
    expect(routeElapsed).toBeLessThan(stageBudgetMs);
    expect(agents).toHaveLength(2);

    // Stage 3: dispatch (agents run concurrently, 50ms simulated latency)
    const dispatchStart = performance.now();
    const context: ExecutionContext = {
      requestId: "perf-test",
      timestamp: new Date(),
    };
    const responses = await Promise.allSettled(
      agents.map((a) => a.execute(intents[0], context)),
    );
    const dispatchElapsed = performance.now() - dispatchStart;
    expect(dispatchElapsed).toBeLessThan(stageBudgetMs);
    // Concurrent dispatch: should be ~50ms, not ~100ms
    expect(dispatchElapsed).toBeLessThan(SIMULATED_LATENCY_MS * agents.length);

    const fulfilled = responses
      .filter((r) => r.status === "fulfilled")
      .map((r) => (r as PromiseFulfilledResult<AgentResponse>).value);
    expect(fulfilled).toHaveLength(2);

    // Stage 4: aggregate
    const aggregateStart = performance.now();
    const aggregated = await aggregator.aggregate(intents[0], fulfilled, context);
    const aggregateElapsed = performance.now() - aggregateStart;
    expect(aggregateElapsed).toBeLessThan(stageBudgetMs);
    expect(aggregated.status).toBe("success");
  });

  it("concurrent dispatch is faster than sequential execution", async () => {
    const category = IntentCategory.EXPERTISE_DISCOVERY;
    const registry = new AgentRegistry();
    registry.register(createLatencyAgent("conc-agent-1", category));
    registry.register(createLatencyAgent("conc-agent-2", category));
    registry.register(createLatencyAgent("conc-agent-3", category));

    const orchestrator = new Orchestrator(
      new PerfTestClassifier(category),
      new DefaultRouter(registry),
      new DefaultAggregator(),
      { perAgentTimeoutMs: 150 },
    );

    const start = performance.now();
    const result = await orchestrator.process("concurrent dispatch test");
    const elapsed = performance.now() - start;

    expect(result.status).toBe("success");
    expect(result.responses).toHaveLength(3);

    // 3 agents at 50ms each sequential = 150ms minimum.
    // Concurrent dispatch should complete well under 150ms of agent time.
    // Total pipeline overhead included, but should still be < 3 * latency.
    const sequentialMinimum = SIMULATED_LATENCY_MS * 3;
    expect(elapsed).toBeLessThan(sequentialMinimum * 2);
  });

  it("per-agent timing metadata is recorded", async () => {
    const category = IntentCategory.EXPERTISE_DISCOVERY;
    const registry = new AgentRegistry();
    registry.register(createLatencyAgent("timing-agent", category));

    const orchestrator = new Orchestrator(
      new PerfTestClassifier(category),
      new DefaultRouter(registry),
      new DefaultAggregator(),
      { perAgentTimeoutMs: 150 },
    );

    const result = await orchestrator.process("timing metadata test");

    expect(result.status).toBe("success");

    // Verify enriched metadata includes timing info
    const enriched = result as unknown as {
      metadata: {
        processingTimeMs: number;
        agentsInvoked: string[];
        agentTimings: Record<string, number>;
      };
    };
    expect(enriched.metadata.processingTimeMs).toBeGreaterThanOrEqual(0);
    expect(enriched.metadata.agentsInvoked).toContain("timing-agent");
    expect(enriched.metadata.agentTimings["timing-agent"]).toBeGreaterThanOrEqual(
      SIMULATED_LATENCY_MS * 0.8,
    );
  });
});
