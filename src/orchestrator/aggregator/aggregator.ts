/**
 * Response Aggregator — merges multiple agent responses into a single output.
 *
 * Produces sectioned output grouped by agent, with deduplicated citations,
 * weighted-average confidence scoring, and merged timing metadata.
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

export class DefaultAggregator implements ResponseAggregator {
  async aggregate(
    intent: ClassifiedIntent,
    responses: AgentResponse[],
    context: ExecutionContext,
  ): Promise<AggregatedResponse> {
    const status = this.resolveStatus(responses);

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
      },
    };

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
}
