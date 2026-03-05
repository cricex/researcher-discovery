# Project Context

- **Owner:** msftsean
- **Project:** orchestration-agent — An orchestration agent that routes user intents to specialized agents, manages an agent registry, and aggregates responses
- **Stack:** TypeScript, Node.js
- **Work Areas:** Orchestrator Core, Intent Classifier, Agent Registry, Response Aggregator, UI, Integration Testing
- **Created:** 2026-03-05

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### CI/CD & Test Infrastructure (2026-03-05)
- **Test runner:** Vitest — configured in `vitest.config.ts`, run via `npm test`
- **CI workflow:** `.github/workflows/squad-ci.yml` — typecheck + test on push/PR
- **Test structure:** `tests/{orchestrator,classifier,agents,aggregator,integration}/`
- **Test helpers:** `tests/helpers.ts` — `createStubAgent()`, `createTestIntent()`, `createTestContext()`
- **Source architecture:** Specs live in `src/specs/` (interfaces + types), implementations in `src/orchestrator/`, `src/agents/`
- **Key classes:** `Orchestrator` (takes classifier, router, aggregator), `AgentRegistry`, `DefaultClassifier`, `DefaultAggregator`, `DefaultRouter`
- **Orchestrator constructor:** `new Orchestrator(classifier, router, aggregator)` — no config object
- **Registry API:** `register()`, `get()`, `getAll()`, `findForIntent()`, `has()`, `.size` — NOT `list()`
- **Pipeline flow:** classify → route → dispatch → aggregate (all async)
- **Decisions file:** `.squad/decisions.md` (merged from inbox)
- **Team update:** Mal has established the foundational architecture with clear component ownership. Project ready for River, Kaylee, and Wash to build in parallel.

### Test Helpers & IntentCategory Migration (T007/T008)
- **IntentCategory enum updated:** Old values (CODE_GENERATION, CODE_REVIEW, EXPLANATION, REFACTOR, TEST_GENERATION, DOCUMENTATION, DEBUGGING) replaced with research domain categories (EXPERTISE_DISCOVERY, RESEARCH_OUTPUT, COLLABORATION_INSIGHT, POLICY_COMPLIANCE, GENERAL)
- **Test helpers expanded:** `tests/helpers.ts` now has 6 factories: `createStubAgent()`, `createTestIntent()` (defaults to EXPERTISE_DISCOVERY), `createTestContext()`, `createMockAgentResponse()`, `createMockAgentRequest()`, `createStubHttpAgent()`
- **New types imported:** `AgentRequest` and `AgentContractResponse` from `src/specs/agent-contract.ts`
- **Only `registry.test.ts` had old enum references** — other test files used GENERAL which survived the migration unchanged
- **Migration impact was minimal** because the DefaultClassifier always returns GENERAL, so most tests were already enum-safe

### Agent Infrastructure & Phase 2 Foundation (T004/T005/T006)
- **Agent endpoint config** lives in `src/agents/endpoints.ts`: `AgentEndpointConfig` interface with connection details, `DEFAULT_AGENT_ENDPOINTS` Map<string, AgentEndpointConfig> with three agents (expertise_discovery :5001, research_output :5002, policy_compliance :5003)
- **HTTP agent client** created in `src/agents/client.ts`: `HttpAgentClient` class with native fetch, AbortController timeouts, field-by-field camelCase↔snake_case mapping (toWireRequest/fromWireResponse/fromWireError), checkHealth never throws
- **Routing rules** created in `src/orchestrator/classifier/routing-rules.ts`: `ROUTING_RULES` Map<IntentCategory, string[]> for four domain categories with Phase 1 substring-based keyword patterns
- **Team Coordination (Phase 2):** Kaylee completed T004/T005 (endpoints + HTTP client). River completed T006 (routing rules). Zoe completed T007/T008 (test helpers + registry fixes). All 15 tests passing; clean TypeScript compilation. Phase 2 foundation infrastructure delivered.
