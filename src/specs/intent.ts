/**
 * Intent types — the taxonomy of recognized user intents.
 *
 * This is the shared vocabulary. Every component that touches intents
 * imports from here. Extend IntentCategory as new capabilities land.
 */

export enum IntentCategory {
  EXPERTISE_DISCOVERY = 'expertise_discovery',
  RESEARCH_OUTPUT = 'research_output',
  COLLABORATION_INSIGHT = 'collaboration_insight',
  POLICY_COMPLIANCE = 'policy_compliance',
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
  /** Optional context for enriching downstream routing and agent execution */
  context?: {
    goldenRecordIds?: string[];
    keywords?: string[];
    sessionId?: string;
  };
}
