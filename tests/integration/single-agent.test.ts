/**
 * T011 [US1] — Single-agent integration test.
 *
 * Tests the full orchestration pipeline for a single-intent query:
 * query → classify → route → dispatch → response
 *
 * These tests are TDD stubs — they SHOULD FAIL because the pipeline does not
 * yet produce OrchestrationResult objects with citations, sections, or metadata.
 * The current Orchestrator.process() returns an AggregatedResponse, not an
 * OrchestrationResult. A future implementation will bridge that gap.
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
  type AggregatedResponse,
  type OrchestrationResult,
  type IntentClassifier,
  IntentCategory,
} from "../../src/specs/index.js";
import {
  createStubAgent,
  createTestIntent,
  createTestContext,
} from "../helpers.js";

// ── Mock classifier that uses keyword-based routing rules ──────────────────

/**
 * A test classifier that matches "who works on" → EXPERTISE_DISCOVERY.
 * Mirrors the ROUTING_RULES keywords so the pipeline routes correctly.
 */
class TestKeywordClassifier implements IntentClassifier {
  async classify(input: string): Promise<ClassifiedIntent> {
    const lower = input.toLowerCase();
    if (lower.includes("who works on") || lower.includes("expertise in")) {
      return {
        category: IntentCategory.EXPERTISE_DISCOVERY,
        confidence: 0.92,
        rawInput: input,
        parameters: {},
      };
    }
    return {
      category: IntentCategory.GENERAL,
      confidence: 0.1,
      rawInput: input,
      parameters: {},
    };
  }

  async classifyMulti(input: string): Promise<ClassifiedIntent[]> {
    return [await this.classify(input)];
  }
}

// ── Mock agent that simulates expertise_discovery HTTP agent ────────────────

function createMockExpertiseAgent(): Agent {
  const id = "expertise_discovery";
  const name = "Expertise Discovery";
  return {
    id,
    name,
    capabilities: [
      {
        intentCategory: IntentCategory.EXPERTISE_DISCOVERY,
        description: "Discovers domain experts",
        priority: 10,
      },
    ],
    canHandle(intent: ClassifiedIntent): boolean {
      return intent.category === IntentCategory.EXPERTISE_DISCOVERY;
    },
    async execute(
      intent: ClassifiedIntent,
      context: ExecutionContext,
    ): Promise<AgentResponse> {
      return {
        agentId: id,
        intentCategory: IntentCategory.EXPERTISE_DISCOVERY,
        status: "success",
        content: JSON.stringify({
          agent: name,
          results: {
            experts: [
              { name: "Dr. Smith", field: "autism research" },
            ],
          },
          citations: ["https://example.com/dr-smith-profile"],
        }),
        confidence: 0.95,
        metadata: {
          processingTimeMs: 42,
        },
      };
    },
  };
}

describe("Integration: Single-Agent Pipeline (T011)", () => {
  it("should classify 'who works on autism research?' as EXPERTISE_DISCOVERY and invoke exactly one agent", async () => {
    // Wire up the pipeline with our test classifier and mock agent
    const registry = new AgentRegistry();
    registry.register(createMockExpertiseAgent());

    const classifier = new TestKeywordClassifier();
    const router = new DefaultRouter(registry);
    const aggregator = new DefaultAggregator();
    const orchestrator = new Orchestrator(classifier, router, aggregator);

    const result = await orchestrator.process(
      "who works on autism research?",
    );

    // The current pipeline returns AggregatedResponse.
    // Verify classification routed to the right agent.
    expect(result.intent.category).toBe(IntentCategory.EXPERTISE_DISCOVERY);
    expect(result.responses).toHaveLength(1);
    expect(result.responses[0].agentId).toBe("expertise_discovery");
    expect(result.responses[0].status).toBe("success");

    // ── OrchestrationResult assertions (TDD — expected to FAIL) ────────
    // The pipeline should eventually return an OrchestrationResult with
    // enriched sections, citations, and metadata. Cast to check shape.
    const enriched = result as unknown as OrchestrationResult;

    // Response should contain agent name as a section key
    expect(enriched.sections).toBeDefined();
    expect(enriched.sections).toBeInstanceOf(Map);
    expect(enriched.sections.has("Expertise Discovery")).toBe(true);

    // Response must include a citations array
    expect(enriched.citations).toBeDefined();
    expect(Array.isArray(enriched.citations)).toBe(true);
    expect(enriched.citations.length).toBeGreaterThan(0);

    // Metadata must include processingTimeMs and agentsInvoked
    expect(enriched.metadata).toBeDefined();
    expect(typeof enriched.metadata.processingTimeMs).toBe("number");
    expect(enriched.metadata.agentsInvoked).toEqual(["expertise_discovery"]);
  });

  it("should produce an AggregatedResponse with all required fields", async () => {
    const registry = new AgentRegistry();
    registry.register(createMockExpertiseAgent());

    const classifier = new TestKeywordClassifier();
    const router = new DefaultRouter(registry);
    const aggregator = new DefaultAggregator();
    const orchestrator = new Orchestrator(classifier, router, aggregator);

    const result: AggregatedResponse = await orchestrator.process(
      "who works on autism research?",
    );

    // ── AggregatedResponse shape validation ────────────────────────────
    expect(result.requestId).toBeTruthy();
    expect(typeof result.requestId).toBe("string");

    expect(result.intent).toBeDefined();
    expect(result.intent.rawInput).toBe("who works on autism research?");
    expect(result.intent.category).toBe(IntentCategory.EXPERTISE_DISCOVERY);
    expect(typeof result.intent.confidence).toBe("number");

    expect(Array.isArray(result.responses)).toBe(true);
    expect(result.responses.length).toBeGreaterThan(0);

    for (const resp of result.responses) {
      expect(resp.agentId).toBeTruthy();
      expect(resp.status).toMatch(/^(success|error|partial)$/);
      expect(typeof resp.content).toBe("string");
      expect(typeof resp.confidence).toBe("number");
    }

    expect(typeof result.mergedContent).toBe("string");
    expect(result.status).toMatch(/^(success|error|partial)$/);
    expect(result.timestamp).toBeInstanceOf(Date);

    // ── OrchestrationResult enrichment (TDD — expected to FAIL) ────────
    // The final result should eventually be an OrchestrationResult
    const enriched = result as unknown as OrchestrationResult;
    expect(enriched.sections).toBeInstanceOf(Map);
    expect(enriched.citations).toBeDefined();
    expect(enriched.metadata.processingTimeMs).toBeGreaterThanOrEqual(0);
    expect(enriched.metadata.agentsInvoked).toContain("expertise_discovery");
    expect(typeof enriched.overallConfidence).toBe("number");
    expect(typeof enriched.reasoning).toBe("string");
  });
});
