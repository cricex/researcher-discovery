/**
 * Ranking Language Safety Filter (FR-007)
 *
 * Scans content for prohibited superlative/ranking words and neutralizes them.
 * Only flags words when used as adjectives (before nouns), not in other contexts
 * such as prepositions ("on top of") or verb phrases ("leading to").
 */

/** Prohibited ranking/superlative words per FR-007 */
export const PROHIBITED_RANKING_WORDS: string[] = [
  'best',
  'top',
  'leading',
  'foremost',
  'premier',
  'preeminent',
  'renowned',
  'distinguished',
];

/** Words that, when following a prohibited word, indicate non-superlative usage */
const NON_SUPERLATIVE_FOLLOWERS = new Set([
  'of', 'to', 'up', 'down', 'off', 'out', 'into', 'from',
  'towards', 'toward', 'at', 'in', 'on', 'for', 'with',
  'the', 'a', 'an', 'and', 'or', 'but',
]);

/** Prepositions that before "top" indicate non-superlative usage (e.g., "on top of") */
const TOP_PRECEDING_PREP = /\b(on|at|from|near|over)\s+$/i;

/** Auxiliary verbs that before "leading" indicate verb usage, not adjective */
const LEADING_VERB_PRECEDING = /\b(is|are|was|were|been|be)\s+$/i;

function buildSuperlativePattern(): RegExp {
  const words = PROHIBITED_RANKING_WORDS.join('|');
  return new RegExp(`\\b(${words})\\s+([a-zA-Z]\\w*)`, 'gi');
}

interface SuperlativeMatch {
  index: number;
  length: number;
  word: string;
  fullMatch: string;
  follower: string;
}

/**
 * Scans content for prohibited ranking/superlative language and neutralizes it.
 *
 * Only flags prohibited words when used as adjectives before nouns.
 * Common non-superlative usages (e.g., "on top of", "leading to") are preserved.
 *
 * @param content - The text to scan and sanitize
 * @returns The sanitized text and a list of violations found
 */
export function sanitizeRankingLanguage(content: string): {
  sanitized: string;
  violations: string[];
} {
  const violations: string[] = [];
  const pattern = buildSuperlativePattern();

  const matches: SuperlativeMatch[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    matches.push({
      index: match.index,
      length: match[0].length,
      word: match[1],
      fullMatch: match[0],
      follower: match[2],
    });
  }

  let sanitized = content;

  // Process from end to start to preserve earlier indices
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    const followerLower = m.follower.toLowerCase();
    const wordLower = m.word.toLowerCase();

    // Skip if the follower indicates non-superlative usage
    if (NON_SUPERLATIVE_FOLLOWERS.has(followerLower)) continue;

    // Skip "top" preceded by a preposition (e.g., "on top of")
    if (wordLower === 'top') {
      const preceding = content.substring(0, m.index);
      if (TOP_PRECEDING_PREP.test(preceding)) continue;
    }

    // Skip "leading" used as a verb (preceded by auxiliary verbs)
    if (wordLower === 'leading') {
      const preceding = content.substring(0, m.index);
      if (LEADING_VERB_PRECEDING.test(preceding)) continue;
    }

    // This is a superlative usage — record and neutralize
    violations.push(m.fullMatch);

    const preceding = sanitized.substring(0, m.index);
    const hasArticle = /\b(the|a|an)\s+$/i.test(preceding);

    // Capitalize "The" at sentence boundaries
    const isStartOfSentence =
      m.index === 0 || /[.!?\n]\s*$/.test(preceding);
    const article = isStartOfSentence ? 'The' : 'the';

    const replacement = hasArticle ? m.follower : `${article} ${m.follower}`;

    sanitized =
      sanitized.substring(0, m.index) +
      replacement +
      sanitized.substring(m.index + m.length);
  }

  // Reverse violations to match document order
  violations.reverse();

  return { sanitized, violations };
}
