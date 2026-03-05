/**
 * Intent types — the taxonomy of recognized user intents.
 *
 * This is the shared vocabulary. Every component that touches intents
 * imports from here. Extend IntentCategory as new capabilities land.
 */

export enum IntentCategory {
  CODE_GENERATION = 'code_generation',
  CODE_REVIEW = 'code_review',
  EXPLANATION = 'explanation',
  REFACTOR = 'refactor',
  TEST_GENERATION = 'test_generation',
  DOCUMENTATION = 'documentation',
  DEBUGGING = 'debugging',
  GENERAL = 'general',
}

export interface ClassifiedIntent {
  /** Which category the classifier resolved to */
  category: IntentCategory;
  /** Classifier confidence, 0–1 */
  confidence: number;
  /** The original user input */
  rawInput: string;
  /** Extracted parameters (e.g., target file, language, scope) */
  parameters: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}
