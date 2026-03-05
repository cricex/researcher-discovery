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
