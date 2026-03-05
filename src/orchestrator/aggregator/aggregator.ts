/**
 * Response Aggregator — merges multiple agent responses into a single output.
 *
 * Produces sectioned output grouped by agent, with deduplicated citations,
 * weighted-average confidence scoring, citation coverage analysis,
 * safety-filter enforcement, and merged timing metadata.
 */

import {
  ResponseAggregator,
  ClassifiedIntent,
  ExecutionContext,
  AgentResponse,
  AggregatedResponse,
  ResponseStatus,
  Citation,
  OrchestrationResult,
} from '../../specs/index.js';
import { sanitizeRankingLanguage } from './safety-filter.js';

export class DefaultAggregator implements ResponseAggregator {
  async aggregate(
    intent: ClassifiedIntent,
    responses: AgentResponse[],
    context: ExecutionContext,
  ): Promise<AggregatedResponse> {
    const status = this.resolveStatus(responses);

    // T035: Sanitize agent content for prohibited ranking language
    const safetyViolations: string[] = [];
    for (const r of responses) {
      if (r.status !== 'error' && r.content.trim()) {
        const { sanitized, violations } = sanitizeRankingLanguage(r.content);
        if (violations.length > 0) {
          r.content = sanitized;
          safetyViolations.push(...violations);
          console.warn(
            `[safety-filter] Agent "${r.agentId}": ${violations.length} violation(s) — ${violations.join(', ')}`,
          );
        }
      }
    }

    // Build sections from successful, non-empty responses keyed by agentId
    const sections = new Map<string, string>();
    for (const r of responses) {
      if (r.status !== 'error' && r.content.trim()) {
        sections.set(r.agentId, r.content);
      }
    }

    // Build merged content with section headers
    const mergedContent = Array.from(sections.entries())
      .map(([key, content]) => `## ${this.formatSectionName(key)}\n\n${content}`)
      .join('\n\n');

    const citations = this.extractCitations(responses);
    const overallConfidence = this.calculateConfidence(responses);
    const agentsInvoked = responses.map((r) => r.agentId);

    // T033: Citation coverage scoring
    const citationCoverage = this.calculateCitationCoverage(responses);
    const warnings: string[] = [];
    if (citationCoverage < 1.0) {
      warnings.push(
        `Citation coverage is ${(citationCoverage * 100).toFixed(0)}% — some factual claims are uncited`,
      );
    }

    const processingTimeMs = responses.reduce((sum, r) => {
      const time = r.metadata?.processingTimeMs as number | undefined;
      return sum + (time ?? 0);
    }, 0);

    const reasoning =
      `Invoked ${agentsInvoked.length} agent(s): ${agentsInvoked.join(', ')}. ` +
      `${sections.size} agent(s) returned content successfully.`;

    const result: AggregatedResponse & OrchestrationResult = {
      requestId: context.requestId,
      intent,
      responses,
      mergedContent,
      status,
      timestamp: new Date(),
      sections,
      citations,
      overallConfidence,
      reasoning,
      metadata: {
        processingTimeMs,
        agentsInvoked,
        citationCount: citations.length,
        citationCoverage,
        ...(safetyViolations.length > 0 ? { safetyViolations } : {}),
      },
    };

    if (warnings.length > 0) {
      (result as unknown as Record<string, unknown>).warnings = warnings;
    }

    return result;
  }

  private resolveStatus(responses: AgentResponse[]): ResponseStatus {
    if (responses.length === 0) return 'success';
    if (responses.every((r) => r.status === 'success')) return 'success';
    if (responses.every((r) => r.status === 'error')) return 'error';
    return 'partial';
  }

  private formatSectionName(agentId: string): string {
    return agentId
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private extractCitations(responses: AgentResponse[]): Citation[] {
    const seen = new Set<string>();
    const citations: Citation[] = [];

    for (const r of responses) {
      // Parse <cite>...</cite> tags from content
      const citeRegex = /<cite>(.*?)<\/cite>/g;
      let match;
      while ((match = citeRegex.exec(r.content)) !== null) {
        const raw = match[1];
        if (!seen.has(raw)) {
          seen.add(raw);
          citations.push(this.parseCitation(raw));
        }
      }

      // Also pull from metadata.citations if present
      if (r.metadata?.citations && Array.isArray(r.metadata.citations)) {
        for (const c of r.metadata.citations as string[]) {
          if (!seen.has(c)) {
            seen.add(c);
            citations.push(this.parseCitation(c));
          }
        }
      }
    }

    return citations;
  }

  private parseCitation(raw: string): Citation {
    const underscoreIndex = raw.indexOf('_');
    if (underscoreIndex === -1) {
      return { raw, sourceType: raw, sourceId: raw };
    }
    return {
      raw,
      sourceType: raw.substring(0, underscoreIndex),
      sourceId: raw.substring(underscoreIndex + 1),
    };
  }

  private calculateConfidence(responses: AgentResponse[]): number {
    const successful = responses.filter((r) => r.status !== 'error');
    if (successful.length === 0) return 0;
    return successful.reduce((acc, r) => acc + r.confidence, 0) / successful.length;
  }

  /**
   * T033: Calculate citation coverage — ratio of cited factual sentences
   * to total factual sentences across all successful agent responses.
   */
  private calculateCitationCoverage(responses: AgentResponse[]): number {
    let totalFactual = 0;
    let citedFactual = 0;

    for (const r of responses) {
      if (r.status === 'error' || !r.content.trim()) continue;

      const sentences = this.splitIntoSentences(r.content);
      for (const sentence of sentences) {
        if (this.isFactualSentence(sentence)) {
          totalFactual++;
          if (/<cite>/.test(sentence)) {
            citedFactual++;
          }
        }
      }
    }

    if (totalFactual === 0) return 1.0;
    return citedFactual / totalFactual;
  }

  /** Split text into sentences, avoiding false splits on abbreviations like "Dr." */
  private splitIntoSentences(text: string): string[] {
    return text
      .split(/(?<=(?:\w{3,}|>)[.!?])\s+(?=[A-Z])/)
      .filter((s) => s.trim().length > 0);
  }

  /** A sentence is factual if it contains numbers, proper nouns, or cite tags. */
  private isFactualSentence(sentence: string): boolean {
    if (/\d+/.test(sentence)) return true;
    if (/<cite>/.test(sentence)) return true;

    const clean = sentence.replace(/<cite>.*?<\/cite>/g, '').trim();
    const words = clean.split(/\s+/);
    for (let i = 1; i < words.length; i++) {
      if (/^[A-Z]/.test(words[i])) return true;
    }
    return false;
  }
}
