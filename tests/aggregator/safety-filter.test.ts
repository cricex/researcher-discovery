import { describe, it, expect } from "vitest";

// T030 [US4] — Safety filter tests (TDD red phase)
//
// These tests import from a module that doesn't exist yet. They will FAIL
// at import time. That's expected — the implementation (T-next) creates:
//   src/orchestrator/aggregator/safety-filter.ts
//
// Exports under test:
//   sanitizeRankingLanguage(content: string): { sanitized: string, violations: string[] }
//   PROHIBITED_RANKING_WORDS: string[]

import {
  sanitizeRankingLanguage,
  PROHIBITED_RANKING_WORDS,
} from "../../src/orchestrator/aggregator/safety-filter.js";

describe("Safety Filter — sanitizeRankingLanguage (T030)", () => {
  // ── FR-007: Prohibited ranking words ────────────────────────────────

  it('should flag and sanitize content containing "best researcher"', () => {
    const input = "Dr. Smith is the best researcher in autism neurobiology.";
    const { sanitized, violations } = sanitizeRankingLanguage(input);

    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.toLowerCase().includes("best"))).toBe(true);
    // Sanitized output should not contain the prohibited word
    expect(sanitized.toLowerCase()).not.toContain("best");
  });

  it('should flag content containing "top university"', () => {
    const input = "She works at a top university in the field.";
    const { violations } = sanitizeRankingLanguage(input);

    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.toLowerCase().includes("top"))).toBe(true);
  });

  it('should flag content containing "leading expert"', () => {
    const input = "He is a leading expert on synaptic plasticity.";
    const { violations } = sanitizeRankingLanguage(input);

    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.toLowerCase().includes("leading"))).toBe(
      true,
    );
  });

  it("should pass clean content through unchanged", () => {
    const input =
      "Dr. Krueger has published 12 papers on autism neurobiology since 2020.";
    const { sanitized, violations } = sanitizeRankingLanguage(input);

    expect(violations).toHaveLength(0);
    expect(sanitized).toBe(input);
  });

  // ── Prohibited words list completeness (FR-007) ─────────────────────

  it("should include all FR-007 prohibited ranking words", () => {
    const required = [
      "best",
      "top",
      "leading",
      "foremost",
      "premier",
      "preeminent",
      "renowned",
      "distinguished",
    ];

    for (const word of required) {
      expect(
        PROHIBITED_RANKING_WORDS.map((w: string) => w.toLowerCase()),
      ).toContain(word.toLowerCase());
    }
  });
});
