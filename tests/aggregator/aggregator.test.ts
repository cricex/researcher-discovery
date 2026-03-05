import { describe, it, expect } from "vitest";
import { DefaultAggregator } from "../../src/orchestrator/aggregator/aggregator.js";
import {
  IntentCategory,
  type AgentResponse,
  type OrchestrationResult,
  type Citation,
  type AgentErrorEntry,
} from "../../src/specs/index.js";
import {
  createTestIntent,
  createTestContext,
  createMockAgentResponse,
} from "../helpers.js";

// ── Existing baseline tests ────────────────────────────────────────────────

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

// ── T018 [US2] — Sectioned aggregation tests (TDD red phase) ──────────────
//
// These tests validate that DefaultAggregator produces OrchestrationResult
// objects with sectioned output, deduplicated citations, confidence scoring,
// and merged metadata. They are expected to FAIL until T021/T022 implements
// sectioned aggregation.

describe("DefaultAggregator — Sectioned Aggregation (T018)", () => {
  const aggregator = new DefaultAggregator();
  const intent = createTestIntent({
    category: IntentCategory.EXPERTISE_DISCOVERY,
    rawInput: "collaborators and compliance steps for autism neurobiology",
  });
  const context = createTestContext();

  // ── 1. Single agent response → single section ───────────────────────

  it("should produce a single section when one agent responds", async () => {
    const responses: AgentResponse[] = [
      {
        agentId: "expertise_discovery",
        intentCategory: IntentCategory.EXPERTISE_DISCOVERY,
        status: "success",
        content:
          "Dr. Smith specializes in autism neurobiology <cite>gold_researcher_smith</cite>",
        confidence: 0.92,
        metadata: { processingTimeMs: 150 },
      },
    ];

    const raw = await aggregator.aggregate(intent, responses, context);
    const result = raw as unknown as OrchestrationResult;

    expect(result.sections).toBeDefined();
    expect(result.sections).toBeInstanceOf(Map);
    expect(result.sections.size).toBe(1);

    // The section should be keyed by agent ID or agent name
    const sectionKeys = Array.from(result.sections.keys());
    expect(
      sectionKeys.some((k) => k.includes("expertise")),
    ).toBe(true);

    // Section content should contain the agent's response
    const sectionContent = result.sections.get(sectionKeys[0]);
    expect(sectionContent).toContain("Dr. Smith");
  });

  // ── 2. Multiple agent responses → grouped sections ──────────────────

  it("should produce sections grouped by agent for multiple responses", async () => {
    const responses: AgentResponse[] = [
      {
        agentId: "expertise_discovery",
        intentCategory: IntentCategory.EXPERTISE_DISCOVERY,
        status: "success",
        content:
          "Dr. Smith works on autism neurobiology <cite>gold_researcher_smith</cite>",
        confidence: 0.92,
        metadata: { processingTimeMs: 150 },
      },
      {
        agentId: "research_output",
        intentCategory: IntentCategory.RESEARCH_OUTPUT,
        status: "success",
        content:
          'Published: "Neurobiology of ASD" (2024) <cite>openalex_pub_12345</cite>',
        confidence: 0.88,
        metadata: { processingTimeMs: 200 },
      },
      {
        agentId: "policy_compliance",
        intentCategory: IntentCategory.POLICY_COMPLIANCE,
        status: "success",
        content:
          "IRB approval required for human subjects <cite>policy_irb_2024</cite>",
        confidence: 0.95,
        metadata: { processingTimeMs: 80 },
      },
    ];

    const raw = await aggregator.aggregate(intent, responses, context);
    const result = raw as unknown as OrchestrationResult;

    // Should have 3 distinct sections, one per agent
    expect(result.sections).toBeInstanceOf(Map);
    expect(result.sections.size).toBe(3);

    // Metadata should list all 3 agents
    expect(result.metadata).toBeDefined();
    expect(result.metadata.agentsInvoked).toHaveLength(3);
    expect(result.metadata.agentsInvoked).toContain("expertise_discovery");
    expect(result.metadata.agentsInvoked).toContain("research_output");
    expect(result.metadata.agentsInvoked).toContain("policy_compliance");
  });

  // ── 3. Citation deduplication ───────────────────────────────────────

  it("should deduplicate identical citations from different agents", async () => {
    // Both agents cite the same source — should appear only once
    const sharedCitation = "<cite>gold_researcher_smith</cite>";
    const responses: AgentResponse[] = [
      {
        agentId: "expertise_discovery",
        intentCategory: IntentCategory.EXPERTISE_DISCOVERY,
        status: "success",
        content: `Expert: Dr. Smith ${sharedCitation}`,
        confidence: 0.9,
      },
      {
        agentId: "collaboration_insight",
        intentCategory: IntentCategory.COLLABORATION_INSIGHT,
        status: "success",
        content: `Collaborator: Dr. Smith ${sharedCitation} and Dr. Jones <cite>gold_researcher_jones</cite>`,
        confidence: 0.85,
      },
    ];

    const raw = await aggregator.aggregate(intent, responses, context);
    const result = raw as unknown as OrchestrationResult;

    expect(result.citations).toBeDefined();
    expect(Array.isArray(result.citations)).toBe(true);

    // There are 2 unique citations across both responses
    // "gold_researcher_smith" appears in both — should be deduplicated
    const rawCitations = result.citations.map((c: Citation) => c.raw);
    const uniqueRaws = new Set(rawCitations);
    expect(uniqueRaws.size).toBe(rawCitations.length); // no duplicates

    // Should have exactly 2 unique citations total
    expect(result.citations).toHaveLength(2);

    // Verify citation structure
    const smithCite = result.citations.find(
      (c: Citation) => c.sourceId === "researcher_smith",
    );
    expect(smithCite).toBeDefined();
    expect(smithCite!.sourceType).toBe("gold");
  });

  // ── 4. Empty responses → graceful handling ──────────────────────────

  it("should handle empty responses gracefully without crashing", async () => {
    const responses: AgentResponse[] = [
      {
        agentId: "expertise_discovery",
        intentCategory: IntentCategory.EXPERTISE_DISCOVERY,
        status: "success",
        content: "",
        confidence: 0.0,
      },
    ];

    const raw = await aggregator.aggregate(intent, responses, context);
    const result = raw as unknown as OrchestrationResult;

    // Should not crash — result should still be valid
    expect(result.sections).toBeDefined();
    expect(result.sections).toBeInstanceOf(Map);

    // Empty content should produce an empty or omitted section — not an error
    const sectionCount = result.sections.size;
    expect(sectionCount).toBeLessThanOrEqual(1); // either omitted or empty
  });

  it("should handle a mix of empty and non-empty responses", async () => {
    const responses: AgentResponse[] = [
      {
        agentId: "expertise_discovery",
        intentCategory: IntentCategory.EXPERTISE_DISCOVERY,
        status: "success",
        content: "",
        confidence: 0.0,
      },
      {
        agentId: "research_output",
        intentCategory: IntentCategory.RESEARCH_OUTPUT,
        status: "success",
        content:
          'Found 3 publications <cite>openalex_pub_001</cite>',
        confidence: 0.85,
      },
    ];

    const raw = await aggregator.aggregate(intent, responses, context);
    const result = raw as unknown as OrchestrationResult;

    expect(result.sections).toBeInstanceOf(Map);

    // The non-empty agent should have a section
    const hasResearchSection = Array.from(result.sections.keys()).some((k) =>
      k.includes("research"),
    );
    expect(hasResearchSection).toBe(true);
  });

  // ── 5. Mixed success/error responses ────────────────────────────────

  it("should include successful agent results and error entries for failed agents", async () => {
    const responses: AgentResponse[] = [
      {
        agentId: "expertise_discovery",
        intentCategory: IntentCategory.EXPERTISE_DISCOVERY,
        status: "success",
        content:
          "Dr. Smith found <cite>gold_researcher_smith</cite>",
        confidence: 0.9,
        metadata: { processingTimeMs: 120 },
      },
      {
        agentId: "research_output",
        intentCategory: IntentCategory.RESEARCH_OUTPUT,
        status: "error",
        content: "",
        confidence: 0.0,
        error: "Agent timed out after 5000ms",
      },
      {
        agentId: "policy_compliance",
        intentCategory: IntentCategory.POLICY_COMPLIANCE,
        status: "success",
        content:
          "Compliance steps identified <cite>policy_irb_2024</cite>",
        confidence: 0.88,
        metadata: { processingTimeMs: 90 },
      },
    ];

    const raw = await aggregator.aggregate(intent, responses, context);
    const result = raw as unknown as OrchestrationResult;

    // Successful agents should still appear in sections
    expect(result.sections).toBeInstanceOf(Map);
    expect(result.sections.size).toBeGreaterThanOrEqual(2); // at least the 2 successful agents

    // The error agent should not have a content section
    const sectionKeys = Array.from(result.sections.keys());
    expect(
      sectionKeys.every((k) => !k.includes("research_output")),
    ).toBe(true);

    // The result should contain error entries for failed agents
    // (OrchestrationResult doesn't have an errors field in the spec,
    //  so we check the AggregatedResponse.responses for the error)
    const errorResponses = raw.responses.filter((r) => r.status === "error");
    expect(errorResponses).toHaveLength(1);
    expect(errorResponses[0].agentId).toBe("research_output");

    // Metadata should still list all invoked agents (including failed ones)
    expect(result.metadata.agentsInvoked).toContain("research_output");
    expect(result.metadata.agentsInvoked).toContain("expertise_discovery");
    expect(result.metadata.agentsInvoked).toContain("policy_compliance");
  });

  // ── 6. Confidence scoring — weighted average ────────────────────────

  it("should compute overall confidence as weighted average of agent confidences", async () => {
    const responses: AgentResponse[] = [
      {
        agentId: "expertise_discovery",
        intentCategory: IntentCategory.EXPERTISE_DISCOVERY,
        status: "success",
        content: "Expert results <cite>gold_researcher_abc</cite>",
        confidence: 0.9,
      },
      {
        agentId: "research_output",
        intentCategory: IntentCategory.RESEARCH_OUTPUT,
        status: "success",
        content: "Publication results <cite>openalex_pub_xyz</cite>",
        confidence: 0.7,
      },
      {
        agentId: "policy_compliance",
        intentCategory: IntentCategory.POLICY_COMPLIANCE,
        status: "success",
        content: "Policy results <cite>policy_irb_001</cite>",
        confidence: 0.8,
      },
    ];

    const raw = await aggregator.aggregate(intent, responses, context);
    const result = raw as unknown as OrchestrationResult;

    expect(typeof result.overallConfidence).toBe("number");
    expect(result.overallConfidence).toBeGreaterThan(0);
    expect(result.overallConfidence).toBeLessThanOrEqual(1);

    // Weighted average of (0.9, 0.7, 0.8) = 0.8
    expect(result.overallConfidence).toBeCloseTo(0.8, 1);
  });

  it("should exclude error agents from confidence calculation", async () => {
    const responses: AgentResponse[] = [
      {
        agentId: "expertise_discovery",
        intentCategory: IntentCategory.EXPERTISE_DISCOVERY,
        status: "success",
        content: "Expert results",
        confidence: 0.9,
      },
      {
        agentId: "research_output",
        intentCategory: IntentCategory.RESEARCH_OUTPUT,
        status: "error",
        content: "",
        confidence: 0.0,
        error: "Agent unavailable",
      },
    ];

    const raw = await aggregator.aggregate(intent, responses, context);
    const result = raw as unknown as OrchestrationResult;

    // Only successful agent confidence should count
    // Average of successful agents only: 0.9
    expect(typeof result.overallConfidence).toBe("number");
    expect(result.overallConfidence).toBeCloseTo(0.9, 1);
  });

  // ── 7. Metadata merging — timing info preserved ─────────────────────

  it("should preserve per-agent timing info in merged metadata", async () => {
    const responses: AgentResponse[] = [
      {
        agentId: "expertise_discovery",
        intentCategory: IntentCategory.EXPERTISE_DISCOVERY,
        status: "success",
        content: "Expert results",
        confidence: 0.9,
        metadata: { processingTimeMs: 150 },
      },
      {
        agentId: "research_output",
        intentCategory: IntentCategory.RESEARCH_OUTPUT,
        status: "success",
        content: "Research results",
        confidence: 0.85,
        metadata: { processingTimeMs: 230 },
      },
      {
        agentId: "policy_compliance",
        intentCategory: IntentCategory.POLICY_COMPLIANCE,
        status: "success",
        content: "Policy results",
        confidence: 0.88,
        metadata: { processingTimeMs: 95 },
      },
    ];

    const raw = await aggregator.aggregate(intent, responses, context);
    const result = raw as unknown as OrchestrationResult;

    // Metadata must exist with required fields
    expect(result.metadata).toBeDefined();
    expect(typeof result.metadata.processingTimeMs).toBe("number");
    expect(result.metadata.processingTimeMs).toBeGreaterThanOrEqual(0);

    // All agents should be listed in agentsInvoked
    expect(result.metadata.agentsInvoked).toEqual(
      expect.arrayContaining([
        "expertise_discovery",
        "research_output",
        "policy_compliance",
      ]),
    );

    // Reasoning string should explain what agents were invoked
    expect(typeof result.reasoning).toBe("string");
    expect(result.reasoning.length).toBeGreaterThan(0);
  });
});
