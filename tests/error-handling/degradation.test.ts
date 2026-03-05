/**
 * T024 [US3] — Graceful degradation tests (TDD red phase).
 *
 * Tests that the orchestrator degrades gracefully when individual agents
 * fail: offline agents, malformed responses, empty results, and network
 * errors should all be captured as structured error entries while
 * successful agents' results are still returned.
 *
 * These tests SHOULD FAIL — error enrichment (T025–T028) has not been
 * implemented yet.
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

/** Classifier that always returns EXPERTISE_DISCOVERY. */
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

/** Creates a healthy agent that responds with valid content. */
function createHealthyAgent(id: string, name: string): Agent {
  return {
    id,
    name,
    capabilities: [
      {
        intentCategory: IntentCategory.EXPERTISE_DISCOVERY,
        description: `Healthy: ${name}`,
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
        metadata: { processingTimeMs: 80 },
      };
    },
  };
}

/** Creates an agent that throws when executed — simulates an offline agent. */
function createOfflineAgent(id: string, name: string): Agent {
  return {
    id,
    name,
    capabilities: [
      {
        intentCategory: IntentCategory.EXPERTISE_DISCOVERY,
        description: `Offline: ${name}`,
        priority: 10,
      },
    ],
    canHandle: () => true,
    async execute(): Promise<AgentResponse> {
      throw new Error(`Connection refused: agent "${name}" is not running`);
    },
  };
}

/** Creates an agent that returns a malformed/unparseable response. */
function createMalformedAgent(id: string, name: string): Agent {
  return {
    id,
    name,
    capabilities: [
      {
        intentCategory: IntentCategory.EXPERTISE_DISCOVERY,
        description: `Malformed: ${name}`,
        priority: 10,
      },
    ],
    canHandle: () => true,
    async execute(
      intent: ClassifiedIntent,
      _context: ExecutionContext,
    ): Promise<AgentResponse> {
      // Return a response with a broken structure — missing required fields
      // or content that looks like a corrupted payload.
      return {
        agentId: id,
        intentCategory: intent.category,
        status: "success",
        content: "<<<MALFORMED::: {broken json [[[ >>>",
        confidence: -1, // invalid confidence
        metadata: undefined,
      } as AgentResponse;
    },
  };
}

/** Creates an agent that returns empty results. */
function createEmptyAgent(id: string, name: string): Agent {
  return {
    id,
    name,
    capabilities: [
      {
        intentCategory: IntentCategory.EXPERTISE_DISCOVERY,
        description: `Empty: ${name}`,
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
        content: "",
        confidence: 0.0,
        metadata: { processingTimeMs: 10, resultCount: 0 },
      };
    },
  };
}

/** Creates an agent that throws a network-level error. */
function createNetworkErrorAgent(id: string, name: string): Agent {
  return {
    id,
    name,
    capabilities: [
      {
        intentCategory: IntentCategory.EXPERTISE_DISCOVERY,
        description: `NetworkError: ${name}`,
        priority: 10,
      },
    ],
    canHandle: () => true,
    async execute(): Promise<AgentResponse> {
      throw new TypeError(
        `fetch failed: ECONNREFUSED 127.0.0.1:5002 (agent "${name}")`,
      );
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

/** Extended result type that includes the error entries we expect T025-T028 to add. */
interface EnrichedResult extends OrchestrationResult {
  errors: AgentErrorEntry[];
  status: string;
  warnings: string[];
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Graceful Degradation (T024)", () => {
  // ── 1. One of three agents offline → partial results + error entry ──

  it("should return results from 2 healthy agents and an error entry when 1 agent is offline", async () => {
    const agent1 = createHealthyAgent("expertise_discovery", "Expertise Discovery");
    const agent2 = createOfflineAgent("research_output", "Research Output");
    const agent3 = createHealthyAgent("policy_compliance", "Policy Compliance");
    const orchestrator = buildPipeline([agent1, agent2, agent3]);

    const result = await orchestrator.process(
      "who works on autism neurobiology?",
    );
    const enriched = result as unknown as EnrichedResult;

    // Status should be "partial" — not all agents succeeded
    expect(enriched.status).toBe("partial");

    // Sections should contain the 2 successful agents' content
    expect(enriched.sections).toBeInstanceOf(Map);
    expect(enriched.sections.size).toBe(2);
    expect(enriched.sections.has("Expertise Discovery")).toBe(true);
    expect(enriched.sections.has("Policy Compliance")).toBe(true);

    // Structured error entry for the offline agent
    expect(enriched.errors).toBeDefined();
    expect(Array.isArray(enriched.errors)).toBe(true);
    expect(enriched.errors).toHaveLength(1);

    const offlineError = enriched.errors[0];
    expect(offlineError.agentId).toBe("research_output");
    expect(offlineError.errorCode).toBe("INTERNAL_ERROR");
    expect(offlineError.message).toContain("Connection refused");
  });

  // ── 2. Agent returns malformed response → error caught, others ok ───

  it("should catch malformed agent responses and still return other agents' results", async () => {
    const agent1 = createHealthyAgent("expertise_discovery", "Expertise Discovery");
    const agent2 = createMalformedAgent("research_output", "Research Output");
    const agent3 = createHealthyAgent("policy_compliance", "Policy Compliance");
    const orchestrator = buildPipeline([agent1, agent2, agent3]);

    const result = await orchestrator.process(
      "summarize autism research landscape",
    );
    const enriched = result as unknown as EnrichedResult;

    // Healthy agents should have their sections
    expect(enriched.sections).toBeInstanceOf(Map);
    expect(enriched.sections.has("Expertise Discovery")).toBe(true);
    expect(enriched.sections.has("Policy Compliance")).toBe(true);

    // The malformed agent should produce an error entry — its content
    // was unparseable or had invalid confidence, so the orchestrator
    // should flag it rather than include garbage in the final result.
    expect(enriched.errors).toBeDefined();
    expect(Array.isArray(enriched.errors)).toBe(true);
    expect(enriched.errors.length).toBeGreaterThanOrEqual(1);

    const malformedError = enriched.errors.find(
      (e: AgentErrorEntry) => e.agentId === "research_output",
    );
    expect(malformedError).toBeDefined();
    expect(malformedError!.errorCode).toMatch(/INVALID_RESPONSE|INTERNAL_ERROR/);
  });

  // ── 3. Agent returns empty results → handled, noted in metadata ─────

  it("should handle empty agent results without crashing and note it in metadata", async () => {
    const agent1 = createHealthyAgent("expertise_discovery", "Expertise Discovery");
    const agent2 = createEmptyAgent("research_output", "Research Output");
    const orchestrator = buildPipeline([agent1, agent2]);

    const result = await orchestrator.process("find autism researchers");
    const enriched = result as unknown as EnrichedResult;

    // Should not crash
    expect(enriched.sections).toBeInstanceOf(Map);

    // The healthy agent's section should exist
    expect(enriched.sections.has("Expertise Discovery")).toBe(true);

    // The empty agent should be noted — either as a warning or metadata flag.
    // It shouldn't be an error (the agent responded successfully, just with
    // no results), but the orchestrator should surface that information.
    expect(enriched.warnings).toBeDefined();
    expect(Array.isArray(enriched.warnings)).toBe(true);
    expect(enriched.warnings.length).toBeGreaterThanOrEqual(1);

    const emptyWarning = enriched.warnings.find((w: string) =>
      w.includes("research_output") || w.includes("empty"),
    );
    expect(emptyWarning).toBeDefined();
  });

  // ── 4. Network error → captured as error entry, others proceed ──────

  it("should capture network errors as error entries and let other agents proceed", async () => {
    const agent1 = createHealthyAgent("expertise_discovery", "Expertise Discovery");
    const agent2 = createNetworkErrorAgent("research_output", "Research Output");
    const agent3 = createHealthyAgent("policy_compliance", "Policy Compliance");
    const orchestrator = buildPipeline([agent1, agent2, agent3]);

    const result = await orchestrator.process(
      "compliance steps for neurobiology research",
    );
    const enriched = result as unknown as EnrichedResult;

    // Successful agents should be unaffected
    expect(enriched.sections).toBeInstanceOf(Map);
    expect(enriched.sections.size).toBe(2);
    expect(enriched.sections.has("Expertise Discovery")).toBe(true);
    expect(enriched.sections.has("Policy Compliance")).toBe(true);

    // Network error should be captured as an AgentErrorEntry
    expect(enriched.errors).toBeDefined();
    expect(Array.isArray(enriched.errors)).toBe(true);
    expect(enriched.errors).toHaveLength(1);

    const networkError = enriched.errors[0];
    expect(networkError.agentId).toBe("research_output");
    expect(networkError.errorCode).toBe("INTERNAL_ERROR");
    expect(networkError.message).toContain("ECONNREFUSED");
  });

  // ── 5. Partial results include warning that some agents failed ──────

  it("should include a warning/note when partial results are returned due to agent failures", async () => {
    const agent1 = createHealthyAgent("expertise_discovery", "Expertise Discovery");
    const agent2 = createOfflineAgent("research_output", "Research Output");
    const orchestrator = buildPipeline([agent1, agent2]);

    const result = await orchestrator.process(
      "who works on autism neurobiology?",
    );
    const enriched = result as unknown as EnrichedResult;

    // Status should indicate degraded results
    expect(enriched.status).toBe("partial");

    // There should be a user-visible warning about the degradation
    expect(enriched.warnings).toBeDefined();
    expect(Array.isArray(enriched.warnings)).toBe(true);

    // At least one warning should mention that some agents failed
    const degradationWarning = enriched.warnings.find(
      (w: string) =>
        w.toLowerCase().includes("failed") ||
        w.toLowerCase().includes("unavailable") ||
        w.toLowerCase().includes("partial"),
    );
    expect(degradationWarning).toBeDefined();

    // The reasoning string should also acknowledge the failure
    expect(enriched.reasoning).toBeDefined();
    expect(typeof enriched.reasoning).toBe("string");
    expect(enriched.reasoning.length).toBeGreaterThan(0);
  });
});
