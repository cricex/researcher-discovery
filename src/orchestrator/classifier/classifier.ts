/**
 * Intent Classifier — parses raw user input into a ClassifiedIntent.
 *
 * Stub implementation: defaults everything to GENERAL.
 * River owns the real NLP logic that replaces this.
 */

import { IntentClassifier, ClassifiedIntent, IntentCategory } from '../../specs/index.js';

export class DefaultClassifier implements IntentClassifier {
  async classify(input: string): Promise<ClassifiedIntent> {
    // Stub: always classifies as GENERAL with low confidence.
    // Replace with actual NLP routing logic.
    return {
      category: IntentCategory.GENERAL,
      confidence: 0.1,
      rawInput: input,
      parameters: {},
    };
  }
}
