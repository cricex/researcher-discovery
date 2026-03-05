import { describe, it, expect } from "vitest";
import { DefaultClassifier } from "../../src/orchestrator/classifier/classifier.js";
import { IntentCategory } from "../../src/specs/index.js";

describe("DefaultClassifier", () => {
  it("should be importable and constructable", () => {
    const classifier = new DefaultClassifier();
    expect(classifier).toBeDefined();
    expect(classifier).toBeInstanceOf(DefaultClassifier);
  });

  it("should classify input as GENERAL (stub behavior)", async () => {
    const classifier = new DefaultClassifier();
    const result = await classifier.classify("help me write code");
    expect(result.category).toBe(IntentCategory.GENERAL);
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
