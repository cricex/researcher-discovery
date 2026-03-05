/**
 * Phase 1 keyword-based routing rules.
 *
 * Maps each {@link IntentCategory} to lowercase keyword patterns used for
 * intent classification via case-insensitive substring matching.
 *
 * `GENERAL` is intentionally omitted — it serves as the fallback when no
 * keyword patterns match.
 *
 * These static rules are a starting point. They can be replaced by an
 * NLP/ML classifier in a later phase without changing the downstream
 * routing contract.
 */

import { IntentCategory } from '../../specs/intent.js';

export const ROUTING_RULES: Map<IntentCategory, string[]> = new Map([
  [
    IntentCategory.EXPERTISE_DISCOVERY,
    [
      'who works on',
      'expertise in',
      'researchers',
      'faculty',
      'specializes in',
      'expert in',
    ],
  ],
  [
    IntentCategory.RESEARCH_OUTPUT,
    [
      'publications about',
      'papers on',
      'published',
      'research on',
      'studies',
    ],
  ],
  [
    IntentCategory.COLLABORATION_INSIGHT,
    [
      'collaborators',
      'collaboration',
      'funding',
      'grants',
      'partnerships',
    ],
  ],
  [
    IntentCategory.POLICY_COMPLIANCE,
    [
      'compliance',
      'policy',
      'regulations',
      'IRB',
      'ethics',
      'guidelines',
    ],
  ],
]);
