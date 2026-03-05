# Project Context

- **Owner:** msftsean
- **Project:** orchestration-agent — An orchestration agent that routes user intents to specialized agents, manages an agent registry, and aggregates responses
- **Stack:** TypeScript, Node.js
- **Work Areas:** Orchestrator Core, Intent Classifier, Agent Registry, Response Aggregator, UI, Integration Testing
- **Created:** 2026-03-05

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

- **Agent HTTP contract types** live in `src/specs/agent-contract.ts`. These define the wire-format shapes (AgentRequest, AgentContractResponse, AgentErrorResponse, AgentHealthResponse) and AgentErrorCode enum. Property names are camelCase; the HTTP client layer is responsible for snake_case mapping. Spec source: `specs/001-orchestration-agent/contracts/agent-contract-spec.md`.
- The existing specs style uses JSDoc on every exported type/interface, module-level doc comments, and `.js` extensions in barrel exports. Follow this pattern for any new spec files.
- **Team Updates (Phase 1 Setup):** River pivoted IntentCategory to research domain (EXPERTISE_DISCOVERY, RESEARCH_OUTPUT, COLLABORATION_INSIGHT, POLICY_COMPLIANCE, GENERAL) with new `context` field on ClassifiedIntent. Wash extended response.ts with Citation, OrchestrationResult, AgentErrorEntry — all 15 tests passing. New shared contract contracts are aligned for orchestrator core implementation.
- **Agent endpoint config** lives in `src/agents/endpoints.ts`. `AgentEndpointConfig` interface defines connection details (id, name, url, healthUrl, timeoutMs, enabled). `DEFAULT_AGENT_ENDPOINTS` is a `Map<string, AgentEndpointConfig>` with the three known agents (expertise_discovery :5001, research_output :5002, policy_compliance :5003).
- **HTTP agent client** lives in `src/agents/client.ts`. `HttpAgentClient` class uses native `fetch` with `AbortController` timeouts. It maps camelCase TypeScript types ↔ snake_case wire format via internal `toWireRequest`/`fromWireResponse`/`fromWireError` functions. `checkHealth` never throws — returns `status: 'unhealthy'` on failure. `callAgent` throws typed `AgentErrorResponse` on timeout, HTTP errors, and network failures.
- **Team Updates (Phase 2 Foundation):** River created `src/orchestrator/classifier/routing-rules.ts` with Map<IntentCategory, string[]> for four domain categories (EXPERTISE_DISCOVERY, RESEARCH_OUTPUT, COLLABORATION_INSIGHT, POLICY_COMPLIANCE). Zoe expanded test helpers with createMockAgentResponse, createMockAgentRequest, createStubHttpAgent factories and updated registry.test.ts for new enum values — all 15 tests passing. Phase 2 foundation infrastructure complete.
