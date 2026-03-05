import { describe, it, expect } from "vitest";
import { DefaultClassifier } from "../../src/orchestrator/classifier/classifier.js";
import { IntentCategory } from "../../src/specs/index.js";

describe("Multi-intent classification", () => {
  const classifier = new DefaultClassifier();

  describe("compound queries returning multiple categories", () => {
    it("should classify 'Summarize potential collaborators and funding opportunities' as EXPERTISE_DISCOVERY + COLLABORATION_INSIGHT", async () => {
      const results = await classifier.classifyMulti(
        "Summarize potential collaborators and funding opportunities",
      );
      const categories = results.map((r) => r.category);
      expect(categories).toContain(IntentCategory.EXPERTISE_DISCOVERY);
      expect(categories).toContain(IntentCategory.COLLABORATION_INSIGHT);
      expect(results.length).toBeGreaterThanOrEqual(2);
    });

    it("should classify 'Who works on autism research and what compliance steps are needed?' as EXPERTISE_DISCOVERY + POLICY_COMPLIANCE", async () => {
      const results = await classifier.classifyMulti(
        "Who works on autism research and what compliance steps are needed?",
      );
      const categories = results.map((r) => r.category);
      expect(categories).toContain(IntentCategory.EXPERTISE_DISCOVERY);
      expect(categories).toContain(IntentCategory.POLICY_COMPLIANCE);
      expect(results.length).toBeGreaterThanOrEqual(2);
    });

    it("should classify 'Find publications about neurobiology and list potential collaborators' as RESEARCH_OUTPUT + COLLABORATION_INSIGHT", async () => {
      const results = await classifier.classifyMulti(
        "Find publications about neurobiology and list potential collaborators",
      );
      const categories = results.map((r) => r.category);
      expect(categories).toContain(IntentCategory.RESEARCH_OUTPUT);
      expect(categories).toContain(IntentCategory.COLLABORATION_INSIGHT);
      expect(results.length).toBeGreaterThanOrEqual(2);
    });

    it("should return 3+ categories for a query spanning all domains", async () => {
      const results = await classifier.classifyMulti(
        "Who works on autism research, find publications about neurobiology, list collaborators and funding, and outline compliance guidelines",
      );
      expect(results.length).toBeGreaterThanOrEqual(3);

      const categories = results.map((r) => r.category);
      expect(categories).toContain(IntentCategory.EXPERTISE_DISCOVERY);
      expect(categories).toContain(IntentCategory.RESEARCH_OUTPUT);
      expect(categories).toContain(IntentCategory.COLLABORATION_INSIGHT);
      expect(categories).toContain(IntentCategory.POLICY_COMPLIANCE);
    });
  });

  describe("confidence scores", () => {
    it("should assign confidence reflecting keyword match strength for each category", async () => {
      const results = await classifier.classifyMulti(
        "Who works on autism research and what compliance steps are needed?",
      );
      for (const result of results) {
        expect(result.confidence).toBeGreaterThanOrEqual(0.3);
        expect(result.confidence).toBeLessThanOrEqual(1.0);
      }
    });

    it("should preserve rawInput in every returned intent", async () => {
      const query =
        "Find publications about neurobiology and list potential collaborators";
      const results = await classifier.classifyMulti(query);
      for (const result of results) {
        expect(result.rawInput).toBe(query);
      }
    });
  });

  describe("single-intent regression", () => {
    it("should return exactly one category for a single-intent query", async () => {
      const results = await classifier.classifyMulti(
        "who works on autism research?",
      );
      expect(results).toHaveLength(1);
      expect(results[0].category).toBe(IntentCategory.EXPERTISE_DISCOVERY);
      expect(results[0].confidence).toBeGreaterThanOrEqual(0.8);
    });

    it("should fall back to EXPERTISE_DISCOVERY for unrecognized queries", async () => {
      const results = await classifier.classifyMulti(
        "tell me something interesting",
      );
      expect(results).toHaveLength(1);
      expect(results[0].category).toBe(IntentCategory.EXPERTISE_DISCOVERY);
      expect(results[0].confidence).toBeLessThanOrEqual(0.2);
    });
  });
});
