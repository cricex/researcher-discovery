/**
 * Agent Registry — registration, discovery, and capability matching.
 *
 * Agents register here. The router queries here to find matches.
 * Kaylee owns the full implementation.
 */

import { Agent, ClassifiedIntent } from '../specs/index.js';

export class AgentRegistry {
  private agents = new Map<string, Agent>();

  register(agent: Agent): void {
    if (this.agents.has(agent.id)) {
      throw new Error(`Agent "${agent.id}" is already registered`);
    }
    this.agents.set(agent.id, agent);
  }

  unregister(id: string): boolean {
    return this.agents.delete(id);
  }

  get(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  getAll(): Agent[] {
    return Array.from(this.agents.values());
  }

  /** Find agents that can handle a given intent */
  findForIntent(intent: ClassifiedIntent): Agent[] {
    return this.getAll().filter((agent) => agent.canHandle(intent));
  }

  has(id: string): boolean {
    return this.agents.has(id);
  }

  get size(): number {
    return this.agents.size;
  }
}
