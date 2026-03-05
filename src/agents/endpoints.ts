/**
 * Agent endpoint configuration — connection details for external agent services.
 *
 * Each agent exposes an HTTP API and a health-check endpoint. This module
 * defines the shape of that configuration and provides sensible defaults
 * for the three known agents in the system.
 */

/** Default timeout for agent HTTP calls, in milliseconds. */
const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Configuration for a single agent's HTTP endpoint.
 */
export interface AgentEndpointConfig {
  /** Unique agent identifier (e.g. `'expertise_discovery'`). */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** Base URL for the agent's main API endpoint. */
  url: string;
  /** URL for the agent's health-check endpoint. */
  healthUrl: string;
  /** Request timeout in milliseconds. @defaultValue 5000 */
  timeoutMs: number;
  /** Whether this agent is active and should receive traffic. */
  enabled: boolean;
}

/**
 * Default endpoint configurations for the three known agents.
 *
 * Keyed by `AgentEndpointConfig.id` so callers can look up a config in O(1).
 */
export const DEFAULT_AGENT_ENDPOINTS: Map<string, AgentEndpointConfig> = new Map([
  [
    'expertise_discovery',
    {
      id: 'expertise_discovery',
      name: 'Expertise Discovery',
      url: 'http://localhost:5001/api/v1/expertise',
      healthUrl: 'http://localhost:5001/health',
      timeoutMs: DEFAULT_TIMEOUT_MS,
      enabled: true,
    },
  ],
  [
    'research_output',
    {
      id: 'research_output',
      name: 'Research Output',
      url: 'http://localhost:5002/api/v1/research',
      healthUrl: 'http://localhost:5002/health',
      timeoutMs: DEFAULT_TIMEOUT_MS,
      enabled: true,
    },
  ],
  [
    'policy_compliance',
    {
      id: 'policy_compliance',
      name: 'Policy Compliance',
      url: 'http://localhost:5003/api/v1/policy',
      healthUrl: 'http://localhost:5003/health',
      timeoutMs: DEFAULT_TIMEOUT_MS,
      enabled: true,
    },
  ],
]);
