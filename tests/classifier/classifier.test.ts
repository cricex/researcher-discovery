import { describe, it, expect } from "vitest";
import { DefaultClassifier } from "../../src/orchestrator/classifier/classifier.js";
import { IntentCategory } from "../../src/specs/index.js";

describe("DefaultClassifier", () => {
  it("should be importable and constructable", () => {
    const classifier = new DefaultClassifier();
    expect(classifier).toBeDefined();
    expect(classifier).toBeInstanceOf(DefaultClassifier);
  });

  it("should classify unmatched input as EXPERTISE_DISCOVERY fallback", async () => {
    const classifier = new DefaultClassifier();
    const result = await classifier.classify("help me write code");
    expect(result.category).toBe(IntentCategory.EXPERTISE_DISCOVERY);
    expect(result.rawInput).toBe("help me write code");
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("should preserve raw input in the classified intent", async () => {
    const classifier = new DefaultClassifier();
    const result = await classifier.classify("refactor my function");
    expect(result.rawInput).toBe("refactor my function");
    expect(result.parameters).toEqual({});
  });
});

describe("Keyword-based classification", () => {
  const classifier = new DefaultClassifier();

  it("should classify 'who works on autism research?' as EXPERTISE_DISCOVERY", async () => {
    const result = await classifier.classify("who works on autism research?");
    expect(result.category).toBe(IntentCategory.EXPERTISE_DISCOVERY);
    expect(result.rawInput).toBe("who works on autism research?");
  });

  it("should classify 'publications about neuroscience' as RESEARCH_OUTPUT", async () => {
    const result = await classifier.classify("publications about neuroscience");
    expect(result.category).toBe(IntentCategory.RESEARCH_OUTPUT);
    expect(result.rawInput).toBe("publications about neuroscience");
  });

  it("should classify 'compliance steps for IRB' as POLICY_COMPLIANCE", async () => {
    const result = await classifier.classify("compliance steps for IRB");
    expect(result.category).toBe(IntentCategory.POLICY_COMPLIANCE);
    expect(result.rawInput).toBe("compliance steps for IRB");
  });

  it("should default unknown/ambiguous queries to EXPERTISE_DISCOVERY", async () => {
    const result = await classifier.classify("tell me something interesting");
    expect(result.category).toBe(IntentCategory.EXPERTISE_DISCOVERY);
  });

  it("should return confidence >= 0.8 for keyword match", async () => {
    const result = await classifier.classify("who works on autism research?");
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("should return confidence <= 0.2 for default fallback", async () => {
    const result = await classifier.classify("tell me something interesting");
    expect(result.confidence).toBeLessThanOrEqual(0.2);
  });
});
