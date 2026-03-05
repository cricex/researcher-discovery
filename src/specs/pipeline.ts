/**
 * Pipeline contract — defines the orchestration stages.
 *
 * Flow: classify → route → dispatch → aggregate
 *
 * Each stage is independently testable. The Orchestrator wires them together.
 */

import { ClassifiedIntent } from './intent.js';
import { Agent, ExecutionContext } from './agent.js';
import { AgentResponse, AggregatedResponse } from './response.js';

/** Classifier: raw input → typed intent */
export interface IntentClassifier {
  classify(input: string): Promise<ClassifiedIntent>;
  classifyMulti(input: string): Promise<ClassifiedIntent[]>;
}

/** Router: intent → matching agents */
export interface IntentRouter {
  route(intent: ClassifiedIntent): Promise<Agent[]>;
}

/** Dispatcher: fans out intent to agents, collects responses */
export interface AgentDispatcher {
  dispatch(
    intent: ClassifiedIntent,
    agents: Agent[],
    context: ExecutionContext,
  ): Promise<AgentResponse[]>;
}

/** Aggregator: merges multiple agent responses into one */
export interface ResponseAggregator {
  aggregate(
    intent: ClassifiedIntent,
    responses: AgentResponse[],
    context: ExecutionContext,
  ): Promise<AggregatedResponse>;
}

/** The full pipeline interface the orchestrator exposes */
export interface OrchestratorPipeline {
  process(input: string): Promise<AggregatedResponse>;
}
