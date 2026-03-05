/**
 * Orchestrator — the main pipeline.
 *
 * Wires together: classify → route → dispatch → aggregate.
 * This is the single entry point for processing user input.
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
import { randomUUID } from 'node:crypto';

export class Orchestrator implements OrchestratorPipeline {
  constructor(
    private readonly classifier: IntentClassifier,
    private readonly router: IntentRouter,
    private readonly aggregator: ResponseAggregator,
  ) {}

  async process(input: string): Promise<AggregatedResponse> {
    const context: ExecutionContext = {
      requestId: randomUUID(),
      timestamp: new Date(),
    };

    // 1. Classify
    const intent = await this.classifier.classify(input);

    // 2. Route
    const agents = await this.router.route(intent);

    // 3. Dispatch
    const responses = await this.dispatch(intent, agents, context);

    // 4. Aggregate
    return this.aggregator.aggregate(intent, responses, context);
  }

  private async dispatch(
    intent: ClassifiedIntent,
    agents: Agent[],
    context: ExecutionContext,
  ): Promise<AgentResponse[]> {
    // Fan out to all matched agents concurrently
    const results = await Promise.allSettled(
      agents.map((agent) => agent.execute(intent, context)),
    );

    return results.map((result, i) => {
      if (result.status === 'fulfilled') return result.value;
      return {
        agentId: agents[i].id,
        intentCategory: intent.category,
        status: 'error' as const,
        content: '',
        confidence: 0,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      };
    });
  }
}
