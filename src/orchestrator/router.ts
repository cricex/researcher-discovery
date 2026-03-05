/**
 * Intent Router — given a classified intent, finds matching agents.
 *
 * Uses the AgentRegistry to discover agents, then filters by capability.
 * Agents are sorted by priority (highest first).
 */

import { IntentRouter, ClassifiedIntent, Agent } from '../specs/index.js';
import { AgentRegistry } from '../agents/index.js';

export class DefaultRouter implements IntentRouter {
  constructor(private readonly registry: AgentRegistry) {}

  async route(intent: ClassifiedIntent): Promise<Agent[]> {
    const agents = this.registry.getAll();
    return agents
      .filter((agent) => agent.canHandle(intent))
      .sort((a, b) => {
        const aPriority = this.getMaxPriority(a, intent);
        const bPriority = this.getMaxPriority(b, intent);
        return bPriority - aPriority;
      });
  }

  private getMaxPriority(agent: Agent, intent: ClassifiedIntent): number {
    const matching = agent.capabilities.filter(
      (c) => c.intentCategory === intent.category,
    );
    if (matching.length === 0) return 0;
    return Math.max(...matching.map((c) => c.priority ?? 0));
  }
}
