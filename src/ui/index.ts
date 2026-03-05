/**
 * UI entry point — user-facing formatting utilities.
 *
 * Wash owns this. Renders orchestration results and query summaries
 * as markdown strings for terminal / chat display.
 */

import type { OrchestrationResult, Citation } from '../specs/response.js';
import type { ClassifiedIntent } from '../specs/intent.js';

export { Orchestrator } from '../orchestrator/index.js';

/**
 * Render an OrchestrationResult as a markdown string with citation footnotes.
 *
 * - Each section becomes an `## AgentName` heading followed by its content.
 * - Inline `<cite>…</cite>` markers are replaced with `[N]` footnote refs.
 * - A footnotes block is appended at the end when citations exist.
 * - Empty sections are skipped; error-status results get a notice.
 */
export function formatOrchestrationResult(result: OrchestrationResult): string {
  const parts: string[] = [];

  // Build the citation lookup: raw string → footnote number
  const footnoteMap = new Map<string, number>();
  result.citations.forEach((c, i) => {
    footnoteMap.set(c.raw, i + 1);
  });

  // Render sections
  const sectionEntries = result.sections instanceof Map
    ? Array.from(result.sections.entries())
    : Object.entries(result.sections as Record<string, string>);

  if (sectionEntries.length === 0) {
    parts.push('*No agent sections were returned.*');
  } else {
    for (const [agentName, content] of sectionEntries) {
      if (!content || content.trim().length === 0) continue;

      let rendered = content;
      // Replace <cite>…</cite> with [N] footnotes
      for (const [raw, num] of footnoteMap) {
        rendered = rendered.replaceAll(raw, `[${num}]`);
      }

      parts.push(`## ${agentName}\n\n${rendered}`);
    }
  }

  // Reasoning / metadata
  if (result.reasoning) {
    parts.push(`---\n\n**Reasoning:** ${result.reasoning}`);
  }

  parts.push(
    `**Confidence:** ${(result.overallConfidence * 100).toFixed(0)}% · ` +
    `**Processing:** ${result.metadata.processingTimeMs}ms · ` +
    `**Agents:** ${result.metadata.agentsInvoked.join(', ') || 'none'}`
  );

  // Citation footnotes
  if (result.citations.length > 0) {
    parts.push(formatCitationFootnotes(result.citations));
  }

  return parts.join('\n\n');
}

/**
 * Render an agent timeline summary for a classified query.
 *
 * Lists intents with their confidence and the agents invoked.
 */
export function formatQuerySummary(
  intents: ClassifiedIntent[],
  agentsInvoked: string[],
): string {
  const parts: string[] = [];

  if (intents.length === 0) {
    parts.push('*No intents classified.*');
  } else {
    parts.push('### Classified Intents\n');
    for (const intent of intents) {
      const pct = (intent.confidence * 100).toFixed(0);
      parts.push(
        `- **${intent.category}** (${pct}% confidence) — "${intent.rawInput}"`,
      );
    }
  }

  if (agentsInvoked.length === 0) {
    parts.push('\n*No agents invoked.*');
  } else {
    parts.push(`\n### Agents Invoked\n`);
    parts.push(agentsInvoked.map((a) => `- ${a}`).join('\n'));
  }

  return parts.join('\n');
}

// ── internal helpers ──────────────────────────────────────────────

function formatCitationFootnotes(citations: Citation[]): string {
  const lines = citations.map(
    (c, i) => `[${i + 1}]: ${c.sourceType} — ${c.sourceId}`,
  );
  return '### References\n\n' + lines.join('\n');
}
