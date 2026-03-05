/**
 * Agent contract — what any agent must implement to register
 * with the orchestrator and receive dispatched intents.
 */

import { ClassifiedIntent, IntentCategory } from './intent.js';
import { AgentResponse } from './response.js';

export interface AgentCapability {
  /** Which intent category this agent handles */
  intentCategory: IntentCategory;
  /** Human-readable description of what the agent does for this category */
  description: string;
  /** Higher priority agents are preferred when multiple can handle an intent (default: 0) */
  priority?: number;
}

export interface ExecutionContext {
  /** Unique ID for this request, shared across the pipeline */
  requestId: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface Agent {
  readonly id: string;
  readonly name: string;
  readonly capabilities: AgentCapability[];

  /** Fast check — can this agent handle the given intent? */
  canHandle(intent: ClassifiedIntent): boolean;

  /** Execute the intent and return a response */
  execute(intent: ClassifiedIntent, context: ExecutionContext): Promise<AgentResponse>;
}
