/**
 * Response Aggregator — merges multiple agent responses into a single output.
 *
 * Stub implementation: concatenates content, picks worst status.
 * Wash owns the real aggregation strategy.
 */

import {
  ResponseAggregator,
  ClassifiedIntent,
  ExecutionContext,
  AgentResponse,
  AggregatedResponse,
  ResponseStatus,
} from '../../specs/index.js';

export class DefaultAggregator implements ResponseAggregator {
  async aggregate(
    intent: ClassifiedIntent,
    responses: AgentResponse[],
    context: ExecutionContext,
  ): Promise<AggregatedResponse> {
    const status = this.resolveStatus(responses);
    const mergedContent = responses
      .filter((r) => r.status !== 'error')
      .map((r) => r.content)
      .join('\n\n');

    return {
      requestId: context.requestId,
      intent,
      responses,
      mergedContent,
      status,
      timestamp: new Date(),
    };
  }

  private resolveStatus(responses: AgentResponse[]): ResponseStatus {
    if (responses.every((r) => r.status === 'success')) return 'success';
    if (responses.every((r) => r.status === 'error')) return 'error';
    return 'partial';
  }
}
