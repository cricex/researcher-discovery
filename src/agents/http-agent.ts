/**
 * HTTP Agent adapter — bridges the Agent interface with the HTTP client layer.
 *
 * Wraps an `AgentEndpointConfig` and `HttpAgentClient` so that external
 * HTTP-based agents can be registered and dispatched through the orchestrator
 * pipeline like any other `Agent` implementation.
 */

import type {
  Agent,
  AgentCapability,
  ExecutionContext,
} from '../specs/agent.js';
import type { ClassifiedIntent } from '../specs/intent.js';
import { IntentCategory } from '../specs/intent.js';
import type { AgentResponse } from '../specs/response.js';
import type { AgentRequest } from '../specs/agent-contract.js';
import type { AgentEndpointConfig } from './endpoints.js';
import { HttpAgentClient } from './client.js';

/** Map an endpoint config id to its corresponding IntentCategory. */
const CATEGORY_MAP: Record<string, IntentCategory> = {
  expertise_discovery: IntentCategory.EXPERTISE_DISCOVERY,
  research_output: IntentCategory.RESEARCH_OUTPUT,
  collaboration_insight: IntentCategory.COLLABORATION_INSIGHT,
  policy_compliance: IntentCategory.POLICY_COMPLIANCE,
};

/**
 * An `Agent` backed by an external HTTP service.
 *
 * Delegates execution to `HttpAgentClient.callAgent()` and translates the
 * wire-format `AgentContractResponse` into the pipeline's `AgentResponse`.
 */
export class HttpAgent implements Agent {
  readonly id: string;
  readonly name: string;
  readonly capabilities: AgentCapability[];

  private readonly category: IntentCategory;

  constructor(
    private readonly config: AgentEndpointConfig,
    private readonly client: HttpAgentClient,
  ) {
    this.id = config.id;
    this.name = config.name;
    this.category = CATEGORY_MAP[config.id] ?? IntentCategory.GENERAL;
    this.capabilities = [
      {
        intentCategory: this.category,
        description: `Handles ${this.category} intents via ${config.name}`,
      },
    ];
  }

  /** Returns true when the intent's category matches this agent's category. */
  canHandle(intent: ClassifiedIntent): boolean {
    return intent.category === this.category;
  }

  /** Dispatch the intent to the external agent over HTTP. */
  async execute(
    intent: ClassifiedIntent,
    _context: ExecutionContext,
  ): Promise<AgentResponse> {
    const request: AgentRequest = {
      query: intent.rawInput,
      context: intent.context,
      options: { maxResults: 10, includeMetadata: true },
    };

    try {
      const response = await this.client.callAgent(this.config, request);

      return {
        agentId: this.config.id,
        intentCategory: intent.category,
        status: 'success',
        content: JSON.stringify(response.results),
        confidence: 1.0,
        metadata: {
          citations: response.citations,
          processingTimeMs: response.metadata?.processingTimeMs,
        },
      };
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'error' in err
            ? String((err as { error: unknown }).error)
            : String(err);

      return {
        agentId: this.config.id,
        intentCategory: intent.category,
        status: 'error',
        content: '',
        confidence: 0,
        error: message,
      };
    }
  }
}
