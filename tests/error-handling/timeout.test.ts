/**
 * T023 [US3] — Timeout handling tests (TDD red phase).
 *
 * Tests that the orchestrator enforces per-agent timeouts, returns partial
 * results from successful agents, and surfaces structured error entries
 * for timed-out agents.
 *
 * These tests SHOULD FAIL — per-agent timeout enforcement (T025) and
 * error metadata enrichment (T026) have not been implemented yet.
 */

import { describe, it, expect } from "vitest";
import { Orchestrator } from "../../src/orchestrator/orchestrator.js";
import { DefaultAggregator } from "../../src/orchestrator/aggregator/aggregator.js";
import { DefaultRouter } from "../../src/orchestrator/router.js";
import { AgentRegistry } from "../../src/agents/registry.js";
import {
  type Agent,
  type AgentResponse,
  type ClassifiedIntent,
  type ExecutionContext,
  type OrchestrationResult,
  type AgentErrorEntry,
  type IntentClassifier,
  IntentCategory,
} from "../../src/specs/index.js";

// ── Helpers ────────────────────────────────────────────────────────────────

/** Classifier that always returns EXPERTISE_DISCOVERY for multi-agent tests. */
class AlwaysExpertiseClassifier implements IntentClassifier {
  async classify(input: string): Promise<ClassifiedIntent> {
    return {
      category: IntentCategory.EXPERTISE_DISCOVERY,
      confidence: 0.9,
      rawInput: input,
      parameters: {},
    };
  }

  async classifyMulti(input: string): Promise<ClassifiedIntent[]> {
    return [await this.classify(input)];
  }
}

/** Creates an agent that responds instantly with a success result. */
function createFastAgent(id: string, name: string): Agent {
  return {
    id,
    name,
    capabilities: [
      {
        intentCategory: IntentCategory.EXPERTISE_DISCOVERY,
        description: `Fast agent: ${name}`,
        priority: 10,
      },
    ],
    canHandle: () => true,
    async execute(
      intent: ClassifiedIntent,
      _context: ExecutionContext,
    ): Promise<AgentResponse> {
      return {
        agentId: id,
        intentCategory: intent.category,
        status: "success",
        content: `Result from ${name} <cite>gold_researcher_${id}</cite>`,
        confidence: 0.9,
        metadata: { processingTimeMs: 50 },
      };
    },
  };
}

/**
 * Creates an agent that delays before responding — simulates a slow/hung agent.
 * Uses a short delay (200ms) so the test doesn't hang even when timeouts
 * aren't enforced yet. The orchestrator should abort this agent before it
 * completes (at a configured timeout shorter than the delay).
 */
function createSlowAgent(id: string, name: string, delayMs: number): Agent {
  return {
    id,
    name,
    capabilities: [
      {
        intentCategory: IntentCategory.EXPERTISE_DISCOVERY,
        description: `Slow agent: ${name}`,
        priority: 10,
      },
    ],
    canHandle: () => true,
    async execute(
      intent: ClassifiedIntent,
      _context: ExecutionContext,
    ): Promise<AgentResponse> {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return {
        agentId: id,
        intentCategory: intent.category,
        status: "success",
        content: `Late result from ${name}`,
        confidence: 0.5,
      };
    },
  };
}

/** Wires up an Orchestrator pipeline with the given agents. */
function buildPipeline(agents: Agent[]): Orchestrator {
  const registry = new AgentRegistry();
  for (const agent of agents) {
    registry.register(agent);
  }
  const classifier = new AlwaysExpertiseClassifier();
  const router = new DefaultRouter(registry);
  const aggregator = new DefaultAggregator();
  return new Orchestrator(classifier, router, aggregator);
}

/** Extended result type that includes the error entries we expect T025-T026 to add. */
interface EnrichedResult extends OrchestrationResult {
  errors: AgentErrorEntry[];
  status: string;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Timeout Handling (T023)", () => {
  // ── 1. Agent that exceeds timeout → partial results + error entry ────

  it("should return partial results from fast agents and an error entry for the timed-out agent", async () => {
    const fastAgent = createFastAgent("expertise_discovery", "Expertise Discovery");
    const slowAgent = createSlowAgent("research_output", "Research Output", 200);
    const orchestrator = buildPipeline([fastAgent, slowAgent]);

    const result = await orchestrator.process(
      "who works on autism neurobiology?",
    );
    const enriched = result as unknown as EnrichedResult;

    // The fast agent's result should be included in sections
    expect(enriched.sections).toBeInstanceOf(Map);
    expect(enriched.sections.has("Expertise Discovery")).toBe(true);

    // The slow agent should NOT have a content section — it timed out
    expect(enriched.sections.has("Research Output")).toBe(false);

    // The result should include a structured AgentErrorEntry for the timed-out agent
    expect(enriched.errors).toBeDefined();
    expect(Array.isArray(enriched.errors)).toBe(true);
    expect(enriched.errors.length).toBeGreaterThanOrEqual(1);

    const timeoutError = enriched.errors.find(
      (e: AgentErrorEntry) => e.agentId === "research_output",
    );
    expect(timeoutError).toBeDefined();
    expect(timeoutError!.errorCode).toBe("AGENT_TIMEOUT");
    expect(timeoutError!.message).toContain("timed out");

    // Overall status should be "partial" (some succeeded, some failed)
    expect(enriched.status).toBe("partial");
  });

  // ── 2. All agents timeout → user-friendly error, not crash ──────────

  it("should return a user-friendly error message when all agents timeout", async () => {
    const slow1 = createSlowAgent("expertise_discovery", "Expertise Discovery", 200);
    const slow2 = createSlowAgent("research_output", "Research Output", 200);
    const slow3 = createSlowAgent("policy_compliance", "Policy Compliance", 200);
    const orchestrator = buildPipeline([slow1, slow2, slow3]);

    // The orchestrator should not throw — it should return an error result
    const result = await orchestrator.process(
      "summarize everything about autism research",
    );
    const enriched = result as unknown as EnrichedResult;

    // Status should be "error" when all agents fail
    expect(enriched.status).toBe("error");

    // Should contain a user-friendly merged content or message
    expect(result.mergedContent).toContain(
      "All agents failed to respond. Please try again later.",
    );

    // Error entries should exist for ALL agents
    expect(enriched.errors).toBeDefined();
    expect(enriched.errors).toHaveLength(3);
    for (const err of enriched.errors) {
      expect(err.errorCode).toBe("AGENT_TIMEOUT");
    }
  });

  // ── 3. Timeout should use AbortController ───────────────────────────

  it("should abort the timed-out agent via AbortController (not let it complete)", async () => {
    let agentCompleted = false;

    // Agent that sets a flag when it finishes — if timeout works,
    // this flag should remain false.
    const abortableAgent: Agent = {
      id: "slow_agent",
      name: "Slow Agent",
      capabilities: [
        {
          intentCategory: IntentCategory.EXPERTISE_DISCOVERY,
          description: "Abortable slow agent",
          priority: 10,
        },
      ],
      canHandle: () => true,
      async execute(
        intent: ClassifiedIntent,
        context: ExecutionContext,
      ): Promise<AgentResponse> {
        // Simulate a slow operation that respects AbortSignal
        await new Promise((resolve) => setTimeout(resolve, 300));
        agentCompleted = true;
        return {
          agentId: "slow_agent",
          intentCategory: intent.category,
          status: "success",
          content: "Should not appear",
          confidence: 0.5,
        };
      },
    };

    const fastAgent = createFastAgent("fast_agent", "Fast Agent");
    const orchestrator = buildPipeline([fastAgent, abortableAgent]);

    const result = await orchestrator.process("test query");
    const enriched = result as unknown as EnrichedResult;

    // The slow agent should have been aborted before it completed
    // (This will fail until per-agent AbortController timeouts are implemented)
    expect(agentCompleted).toBe(false);

    // The error entry should reference the aborted agent
    expect(enriched.errors).toBeDefined();
    const abortedEntry = enriched.errors.find(
      (e: AgentErrorEntry) => e.agentId === "slow_agent",
    );
    expect(abortedEntry).toBeDefined();
    expect(abortedEntry!.errorCode).toBe("AGENT_TIMEOUT");
  });

  // ── 4. Response metadata should include which agents timed out ──────

  it("should include timed-out agent IDs in response metadata", async () => {
    const fastAgent = createFastAgent("expertise_discovery", "Expertise Discovery");
    const slowAgent1 = createSlowAgent("research_output", "Research Output", 200);
    const slowAgent2 = createSlowAgent("policy_compliance", "Policy Compliance", 200);
    const orchestrator = buildPipeline([fastAgent, slowAgent1, slowAgent2]);

    const result = await orchestrator.process(
      "full analysis of autism research",
    );
    const enriched = result as unknown as EnrichedResult;

    // Metadata should list all invoked agents
    expect(enriched.metadata).toBeDefined();
    expect(enriched.metadata.agentsInvoked).toContain("expertise_discovery");
    expect(enriched.metadata.agentsInvoked).toContain("research_output");
    expect(enriched.metadata.agentsInvoked).toContain("policy_compliance");

    // Metadata should also indicate which agents timed out
    const meta = enriched.metadata as Record<string, unknown>;
    expect(meta.timedOutAgents).toBeDefined();
    expect(Array.isArray(meta.timedOutAgents)).toBe(true);

    const timedOut = meta.timedOutAgents as string[];
    expect(timedOut).toContain("research_output");
    expect(timedOut).toContain("policy_compliance");
    expect(timedOut).not.toContain("expertise_discovery");
  });
});
