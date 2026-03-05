/**
 * Intent Classifier — parses raw user input into a ClassifiedIntent.
 *
 * Phase 1: keyword-based classification using ROUTING_RULES.
 * Scans input (case-insensitive) against each category's keyword patterns,
 * returns the highest-confidence match. Falls back to EXPERTISE_DISCOVERY
 * when no keywords match.
 *
 * Replaceable by NLP/ML classifier in a later phase.
 */

import { IntentClassifier, ClassifiedIntent, IntentCategory } from '../../specs/index.js';
import { ROUTING_RULES } from './routing-rules.js';

export class DefaultClassifier implements IntentClassifier {
  async classify(input: string): Promise<ClassifiedIntent> {
    const lowerInput = input.toLowerCase();

    let bestCategory: IntentCategory | null = null;
    let bestConfidence = 0;
    let bestKeywords: string[] = [];

    for (const [category, keywords] of ROUTING_RULES) {
      const matched: string[] = [];
      let categoryConfidence = 0;

      for (const keyword of keywords) {
        if (lowerInput.includes(keyword.toLowerCase())) {
          matched.push(keyword);
          categoryConfidence = Math.max(categoryConfidence, 0.9);
        }
      }

      if (categoryConfidence > bestConfidence) {
        bestConfidence = categoryConfidence;
        bestCategory = category;
        bestKeywords = matched;
      }
    }

    if (bestCategory === null) {
      return {
        category: IntentCategory.EXPERTISE_DISCOVERY,
        confidence: 0.1,
        rawInput: input,
        parameters: {},
      };
    }

    return {
      category: bestCategory,
      confidence: bestConfidence,
      rawInput: input,
      parameters: { keywords: bestKeywords },
    };
  }

  async classifyMulti(input: string): Promise<ClassifiedIntent[]> {
    const lowerInput = input.toLowerCase();
    const results: ClassifiedIntent[] = [];

    for (const [category, keywords] of ROUTING_RULES) {
      const matched: string[] = [];
      let categoryConfidence = 0;

      for (const keyword of keywords) {
        const lowerKeyword = keyword.toLowerCase();
        if (lowerInput.includes(lowerKeyword)) {
          matched.push(keyword);
          // Word-boundary hit → exact match confidence
          categoryConfidence = Math.max(categoryConfidence, 0.9);
        }
      }

      if (matched.length > 0) {
        results.push({
          category,
          confidence: categoryConfidence,
          rawInput: input,
          parameters: { keywords: matched },
        });
      }
    }

    if (results.length === 0) {
      return [{
        category: IntentCategory.EXPERTISE_DISCOVERY,
        confidence: 0.1,
        rawInput: input,
        parameters: {},
      }];
    }

    results.sort((a, b) => b.confidence - a.confidence);
    return results;
  }
}
