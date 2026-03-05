/**
 * Response types — what comes back from agents and the aggregator.
 */

import { ClassifiedIntent, IntentCategory } from './intent.js';

export type ResponseStatus = 'success' | 'error' | 'partial';

export interface AgentResponse {
  agentId: string;
  intentCategory: IntentCategory;
  status: ResponseStatus;
  /** The agent's output content */
  content: string;
  /** How confident the agent is in its response, 0–1 */
  confidence: number;
  metadata?: Record<string, unknown>;
  error?: string;
}

export interface AggregatedResponse {
  requestId: string;
  intent: ClassifiedIntent;
  /** Individual responses from each dispatched agent */
  responses: AgentResponse[];
  /** Merged final content produced by the aggregator */
  mergedContent: string;
  status: ResponseStatus;
  timestamp: Date;
}
