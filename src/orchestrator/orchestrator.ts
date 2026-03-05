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
import type { AgentErrorEntry, Citation, ResponseStatus } from '../specs/response.js';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';

export interface OrchestratorOptions {
  perAgentTimeoutMs?: number;
}

export class Orchestrator implements OrchestratorPipeline {
  private readonly perAgentTimeoutMs: number;

  constructor(
    private readonly classifier: IntentClassifier,
    private readonly router: IntentRouter,
    private readonly aggregator: ResponseAggregator,
    options?: OrchestratorOptions,
  ) {
    this.perAgentTimeoutMs = options?.perAgentTimeoutMs ?? 150;
  }

  async process(input: string): Promise<AggregatedResponse> {
    const startTime = performance.now();

    const context: ExecutionContext = {
      requestId: randomUUID(),
      timestamp: new Date(),
    };

    // 1. Classify — multi-intent: get ALL matching intents
    const intents = await this.classifier.classifyMulti(input);
    const primaryIntent = intents[0];

    console.info(JSON.stringify({
      event: 'classify',
      requestId: context.requestId,
      primaryCategory: primaryIntent.category,
      primaryConfidence: primaryIntent.confidence,
      intentsCount: intents.length,
      keywordsMatched: primaryIntent.parameters?.keywords ?? [],
    }));

    // 2. Route — collect unique agents across all intents, deduplicate by id
    const agentMap = new Map<string, Agent>();
    for (const intent of intents) {
      const matched = await this.router.route(intent);
      for (const agent of matched) {
        if (!agentMap.has(agent.id)) {
          agentMap.set(agent.id, agent);
        }
      }
    }
    const agents = Array.from(agentMap.values());

    console.info(JSON.stringify({
      event: 'route',
      requestId: context.requestId,
      agentsMatched: agents.map(a => a.name),
      agentCount: agents.length,
    }));

    // 3. Dispatch (with per-agent timing and timeout enforcement)
    //    Pass primary intent — agents already self-select via canHandle()
    const { responses, agentTimings, errors, timedOutAgentIds } =
      await this.dispatchWithTiming(primaryIntent, agents, context);

    for (const agent of agents) {
      const durationMs = agentTimings[agent.id] ?? null;
      const agentError = errors.find(e => e.agentId === agent.id);
      console.info(JSON.stringify({
        event: 'dispatch',
        requestId: context.requestId,
        agentId: agent.id,
        durationMs,
        success: !agentError,
        errorCode: agentError?.errorCode ?? null,
      }));
    }

    // 4. Post-dispatch validation: detect malformed and empty responses
    const warnings: string[] = [];
    for (const r of responses) {
      if (r.status !== 'error' && r.confidence < 0) {
        errors.push({
          agentId: r.agentId,
          errorCode: 'INVALID_RESPONSE',
          message: `Agent "${r.agentId}" returned an invalid response (negative confidence)`,
        });
      }
      if (r.status === 'success' && r.content === '') {
        warnings.push(`Agent "${r.agentId}" returned empty results`);
      }
    }

    // 5. Determine overall status
    const failedAgentIds = new Set(errors.map((e) => e.agentId));
    const totalAgents = agents.length;
    const failedCount = failedAgentIds.size;
    let status: ResponseStatus;
    if (totalAgents === 0 || failedCount === 0) {
      status = 'success';
    } else if (failedCount >= totalAgents) {
      status = 'error';
    } else {
      status = 'partial';
    }

    if (status === 'partial') {
      warnings.push(
        `${failedCount} agent(s) failed or were unavailable. Returning partial results.`,
      );
    }

    // 6. Aggregate — pass primary intent (aggregator already builds
    //    sections, citations, confidence from the responses themselves)
    const aggregated = await this.aggregator.aggregate(
      primaryIntent,
      responses,
      context,
    );

    // 7. Enrich with OrchestrationResult fields
    const processingTimeMs = Math.round(performance.now() - startTime);

    let reasoning = this.buildReasoning(intents, agents);
    if (errors.length > 0) {
      reasoning += ` ${errors.length} agent(s) failed during execution.`;
    }

    const mergedContent =
      status === 'error'
        ? 'All agents failed to respond. Please try again later.'
        : aggregated.mergedContent;

    // Use aggregator's overallConfidence (average of successful agent
    // confidences) rather than overriding with classifier confidence.
    const aggregatedResult = aggregated as unknown as { overallConfidence?: number };
    const overallConfidence = aggregatedResult.overallConfidence ?? primaryIntent.confidence;

    const sectionsMap = this.buildSections(agents, responses);
    const citationsList = this.extractCitations(responses);

    console.info(JSON.stringify({
      event: 'aggregate',
      requestId: context.requestId,
      sectionsCount: sectionsMap.size,
      citationCount: citationsList.length,
      overallConfidence,
      status,
      processingTimeMs,
    }));

    return Object.assign(aggregated, {
      sections: sectionsMap,
      citations: citationsList,
      overallConfidence,
      reasoning,
      mergedContent,
      status,
      errors,
      warnings,
      metadata: {
        processingTimeMs,
        agentsInvoked: agents.map((a) => a.id),
        classifiedIntents: intents,
        classificationResult: primaryIntent,
        agentTimings,
        timedOutAgents: timedOutAgentIds,
      },
    });
  }

  /**
   * Fan out intent to all matched agents concurrently with per-agent
   * timeout enforcement via AbortController + Promise.race.
   */
  private async dispatchWithTiming(
    intent: ClassifiedIntent,
    agents: Agent[],
    context: ExecutionContext,
  ): Promise<{
    responses: AgentResponse[];
    agentTimings: Record<string, number>;
    errors: AgentErrorEntry[];
    timedOutAgentIds: string[];
  }> {
    const agentTimings: Record<string, number> = {};
    const errors: AgentErrorEntry[] = [];
    const timedOutAgentIds: string[] = [];

    const results = await Promise.allSettled(
      agents.map(async (agent) => {
        const start = performance.now();
        const controller = new AbortController();
        let timeoutId: ReturnType<typeof setTimeout>;

        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            controller.abort();
            reject(
              new Error(
                `Agent "${agent.id}" timed out after ${this.perAgentTimeoutMs}ms`,
              ),
            );
          }, this.perAgentTimeoutMs);
        });

        try {
          const response = await Promise.race([
            agent.execute(intent, context),
            timeoutPromise,
          ]);
          clearTimeout(timeoutId!);
          agentTimings[agent.id] = Math.round(performance.now() - start);
          return response;
        } catch (error) {
          clearTimeout(timeoutId!);
          agentTimings[agent.id] = Math.round(performance.now() - start);
          throw error;
        }
      }),
    );

    const responses: AgentResponse[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const agent = agents[i];

      if (result.status === 'fulfilled') {
        responses.push(result.value);
      } else {
        const errorMessage =
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason);

        const isTimeout = errorMessage.includes('timed out');
        if (isTimeout) {
          timedOutAgentIds.push(agent.id);
          errors.push({
            agentId: agent.id,
            errorCode: 'AGENT_TIMEOUT',
            message: errorMessage,
          });
        } else {
          errors.push({
            agentId: agent.id,
            errorCode: 'INTERNAL_ERROR',
            message: errorMessage,
          });
        }

        responses.push({
          agentId: agent.id,
          intentCategory: intent.category,
          status: 'error',
          content: '',
          confidence: 0,
          error: errorMessage,
        });
      }
    }

    return { responses, agentTimings, errors, timedOutAgentIds };
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
  private buildReasoning(intents: ClassifiedIntent[], agents: Agent[]): string {
    if (agents.length === 0) {
      const categories = intents.map((i) => i.category).join(', ');
      return `No agents matched intent category '${categories}'.`;
    }
    const names = agents.map((a) => a.name).join(', ');
    if (intents.length === 1) {
      const intent = intents[0];
      return `Classified as '${intent.category}' (confidence: ${intent.confidence}). Routed to: ${names}.`;
    }
    // Multi-intent: list all detected categories
    const categories = intents.map((i) => `${i.category} (${i.confidence})`).join(', ');
    return `Detected ${intents.length} intents: ${categories}. Routed to: ${names}.`;
  }
}
