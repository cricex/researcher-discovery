# Project Context

- **Owner:** msftsean
- **Project:** orchestration-agent — An orchestration agent that routes user intents to specialized agents, manages an agent registry, and aggregates responses
- **Stack:** TypeScript, Node.js
- **Work Areas:** Orchestrator Core, Intent Classifier, Agent Registry, Response Aggregator, UI, Integration Testing
- **Created:** 2026-03-05

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

- **T001 — Intent taxonomy pivot to research domain (2026-03-05):** Replaced code-centric `IntentCategory` values (CODE_GENERATION, CODE_REVIEW, EXPLANATION, REFACTOR, TEST_GENERATION, DOCUMENTATION, DEBUGGING) with research domain categories (EXPERTISE_DISCOVERY, RESEARCH_OUTPUT, COLLABORATION_INSIGHT, POLICY_COMPLIANCE). GENERAL was kept. Added optional `context` field to `ClassifiedIntent` with `goldenRecordIds`, `keywords`, and `sessionId`. This is a breaking change — downstream tests referencing removed enum members need updating (specifically `tests/agents/registry.test.ts`). The classifier itself (`src/orchestrator/classifier/classifier.ts`) only used `GENERAL` so it compiled clean.
- **Key file:** `src/specs/intent.ts` is the single source of truth for intent taxonomy (per Decision 1.1 in `.squad/decisions.md`).
- **tsconfig excludes tests:** `tsconfig.json` excludes `tests/` — so `tsc --noEmit` won't catch test-file breakage. Vitest catches it at runtime instead.
- **Team Updates (Phase 1 Setup):** Kaylee created `src/specs/agent-contract.ts` with AgentErrorCode, AgentRequest, AgentContractResponse, AgentErrorResponse, AgentHealthResponse types (camelCase properties with HTTP client handling snake_case mapping). Wash extended `src/specs/response.ts` with Citation, OrchestrationResult, AgentErrorEntry interfaces. All 15 response tests passing. New IntentCategory values are EXPERTISE_DISCOVERY, RESEARCH_OUTPUT, COLLABORATION_INSIGHT, POLICY_COMPLIANCE, GENERAL.
- **T006 — Routing rules configuration (2026-03-05):** Created `src/orchestrator/classifier/routing-rules.ts` exporting `ROUTING_RULES` as `Map<IntentCategory, string[]>`. Maps four intent categories to lowercase keyword patterns for Phase 1 substring-based classification. GENERAL is deliberately excluded — it's the fallback. Added re-export to `src/orchestrator/classifier/index.ts` barrel. JSDoc notes these are replaceable by NLP/ML later. Clean compile; no new test failures (pre-existing `registry.test.ts` failure is the known T001 breakage).
- **Team Updates (Phase 2 Foundation):** Kaylee created `src/agents/endpoints.ts` with AgentEndpointConfig interface and DEFAULT_AGENT_ENDPOINTS Map for three research domain agents (ports 5001-5003). Kaylee created `src/agents/client.ts` with HttpAgentClient using native fetch, AbortController timeouts, and camelCase↔snake_case mapping. Zoe expanded test helpers with three new factories and updated registry.test.ts — all 15 tests passing. Phase 2 foundation infrastructure complete.
