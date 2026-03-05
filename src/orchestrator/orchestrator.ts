/**
 * Orchestrator — the main pipeline.
 *
 * Wires together: classify → route → dispatch → aggregate.
 * This is the single entry point for processing user input.
 *
 * The returned object satisfies both `AggregatedResponse` (for the pipeline
 * contract) and `OrchestrationResult` (for enriched citations, sections,
 * timing metadata, and confidence/reasoning).
 */

import {
  OrchestratorPipeline,
  IntentClassifier,
  IntentRouter,
  ResponseAggregator,
  AggregatedResponse,
  ExecutionContext,
  AgentResponse,
  ClassifiedIntent,
  Agent,
} from '../specs/index.js';
import type { Citation } from '../specs/response.js';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';

export class Orchestrator implements OrchestratorPipeline {
  constructor(
    private readonly classifier: IntentClassifier,
    private readonly router: IntentRouter,
    private readonly aggregator: ResponseAggregator,
  ) {}

  async process(input: string): Promise<AggregatedResponse> {
    const startTime = performance.now();

    const context: ExecutionContext = {
      requestId: randomUUID(),
      timestamp: new Date(),
    };

    // 1. Classify
    const intent = await this.classifier.classify(input);

    // 2. Route
    const agents = await this.router.route(intent);

    // 3. Dispatch (with per-agent timing)
    const { responses, agentTimings } = await this.dispatchWithTiming(
      intent,
      agents,
      context,
    );

    // 4. Aggregate
    const aggregated = await this.aggregator.aggregate(
      intent,
      responses,
      context,
    );

    // 5. Enrich with OrchestrationResult fields
    const processingTimeMs = Math.round(performance.now() - startTime);

    return Object.assign(aggregated, {
      sections: this.buildSections(agents, responses),
      citations: this.extractCitations(responses),
      overallConfidence: intent.confidence,
      reasoning: this.buildReasoning(intent, agents),
      metadata: {
        processingTimeMs,
        agentsInvoked: agents.map((a) => a.id),
        classificationResult: intent,
        agentTimings,
      },
    });
  }

  /**
   * Fan out intent to all matched agents concurrently and record
   * per-agent wall-clock timing.
   */
  private async dispatchWithTiming(
    intent: ClassifiedIntent,
    agents: Agent[],
    context: ExecutionContext,
  ): Promise<{ responses: AgentResponse[]; agentTimings: Record<string, number> }> {
    const agentTimings: Record<string, number> = {};

    const results = await Promise.allSettled(
      agents.map(async (agent) => {
        const start = performance.now();
        try {
          const response = await agent.execute(intent, context);
          agentTimings[agent.id] = Math.round(performance.now() - start);
          return response;
        } catch (error) {
          agentTimings[agent.id] = Math.round(performance.now() - start);
          throw error;
        }
      }),
    );

    const responses = results.map((result, i) => {
      if (result.status === 'fulfilled') return result.value;
      return {
        agentId: agents[i].id,
        intentCategory: intent.category,
        status: 'error' as const,
        content: '',
        confidence: 0,
        error:
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
      };
    });

    return { responses, agentTimings };
  }

  /** Map each successful response to a section keyed by agent name. */
  private buildSections(
    agents: Agent[],
    responses: AgentResponse[],
  ): Map<string, string> {
    const sections = new Map<string, string>();
    for (const response of responses) {
      if (response.status === 'error') continue;
      const agent = agents.find((a) => a.id === response.agentId);
      const key = agent?.name ?? response.agentId;
      sections.set(key, response.content);
    }
    return sections;
  }

  /**
   * Extract and deduplicate citations from all agent responses.
   *
   * Sources (checked in order):
   *  1. `<cite>sourceType_sourceId</cite>` tags in content
   *  2. `citations` array inside JSON-encoded content
   *  3. `metadata.citations` on the AgentResponse
   */
  private extractCitations(responses: AgentResponse[]): Citation[] {
    const seen = new Set<string>();
    const citations: Citation[] = [];

    const addCitation = (c: Citation): void => {
      if (!seen.has(c.raw)) {
        seen.add(c.raw);
        citations.push(c);
      }
    };

    for (const response of responses) {
      // 1. <cite> tags in content
      const citeRegex = /<cite>([^<]+)<\/cite>/g;
      let match: RegExpExecArray | null;
      while ((match = citeRegex.exec(response.content)) !== null) {
        const inner = match[1];
        const sepIdx = inner.indexOf('_');
        addCitation({
          raw: match[0],
          sourceType: sepIdx > 0 ? inner.slice(0, sepIdx) : 'unknown',
          sourceId: sepIdx > 0 ? inner.slice(sepIdx + 1) : inner,
        });
      }

      // 2. Citations embedded in JSON content
      try {
        const parsed = JSON.parse(response.content);
        if (Array.isArray(parsed?.citations)) {
          for (const c of parsed.citations) {
            const raw = String(c);
            addCitation({ raw, sourceType: 'url', sourceId: raw });
          }
        }
      } catch {
        // Content is not JSON — skip
      }

      // 3. Citations from agent response metadata
      const meta = response.metadata;
      if (meta && Array.isArray(meta.citations)) {
        for (const c of meta.citations as unknown[]) {
          const raw = String(c);
          addCitation({ raw, sourceType: 'url', sourceId: raw });
        }
      }
    }

    return citations;
  }

  /** Produce a human-readable explanation of the routing decision. */
  private buildReasoning(intent: ClassifiedIntent, agents: Agent[]): string {
    if (agents.length === 0) {
      return `No agents matched intent category '${intent.category}'.`;
    }
    const names = agents.map((a) => a.name).join(', ');
    return `Classified as '${intent.category}' (confidence: ${intent.confidence}). Routed to: ${names}.`;
  }
}
