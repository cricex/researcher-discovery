/**
 * Agent Registry — registration, discovery, and capability matching.
 *
 * Agents register here. The router queries here to find matches.
 * Kaylee owns the full implementation.
 */

import { Agent, ClassifiedIntent } from '../specs/index.js';
import type { AgentEndpointConfig } from './endpoints.js';
import { DEFAULT_AGENT_ENDPOINTS } from './endpoints.js';
import { HttpAgentClient } from './client.js';
import { HttpAgent } from './http-agent.js';

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

  /**
   * Convenience method — create an `HttpAgent` from an endpoint config
   * and register it in a single call.
   *
   * @param config - Endpoint configuration for the agent.
   * @param client - Optional HTTP client; a default instance is created if omitted.
   */
  registerEndpoint(
    config: AgentEndpointConfig,
    client?: HttpAgentClient,
  ): void {
    const httpClient = client ?? new HttpAgentClient();
    this.register(new HttpAgent(config, httpClient));
  }

  /**
   * Register all agents defined in `DEFAULT_AGENT_ENDPOINTS`.
   * Skips any agent that is already registered.
   */
  registerDefaults(): void {
    const client = new HttpAgentClient();
    for (const config of DEFAULT_AGENT_ENDPOINTS.values()) {
      if (!this.agents.has(config.id)) {
        this.register(new HttpAgent(config, client));
      }
    }
  }
}
