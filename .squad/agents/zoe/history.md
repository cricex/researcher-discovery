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

### T011/T012 — TDD Integration & Contract Tests (2026-03-05)
- **T011 single-agent integration test** (`tests/integration/single-agent.test.ts`): Tests full pipeline (query → classify → route → dispatch → response) for "who works on autism research?". Uses a custom `TestKeywordClassifier` (matching ROUTING_RULES keywords) and a mock `expertise_discovery` agent. Basic AggregatedResponse assertions pass; OrchestrationResult assertions (sections Map, citations array, metadata.processingTimeMs, metadata.agentsInvoked) correctly FAIL — the enrichment layer doesn't exist yet.
- **T012 agent client contract tests** (`tests/agents/client.test.ts`): 6 tests covering `HttpAgentClient.callAgent()` — snake_case wire format (golden_record_ids, session_id, max_results, include_metadata), camelCase response parsing (queryTimestamp, processingTimeMs, resultCount), AgentErrorResponse on HTTP errors, AGENT_TIMEOUT on AbortError, INTERNAL_ERROR on non-JSON errors and network failures. All 6 pass because `HttpAgentClient` is already fully implemented.
- **Key pattern:** Mock `globalThis.fetch` with `vi.fn()` for HTTP testing — no need for real servers or extra deps. Restore in `afterEach` to avoid test bleed.
- **Test totals after T011/T012:** 29 tests (22 pass, 7 fail). 5 pre-existing TDD failures in `classifier.test.ts`, 2 new expected TDD failures in `single-agent.test.ts`. Zero regressions.
- **Wave 1 Cross-Team (2026-03-05T20:30):** T011 integration tests (red phase) pair with River's T010 classifier tests. T012 contract tests validate Kaylee's HttpAgentClient from Phase 2. Both tests use expanded factory helpers (createMockAgentResponse, createMockAgentRequest, createStubHttpAgent) in `tests/helpers.ts`. Zoe's tests enable Mal's B6/B7 demo script scenario validation. All wave 1 tests integrated with 11 new test cases across TDD red phase.

### T018 — Sectioned Aggregation TDD Tests (US2)
- **File:** `tests/aggregator/aggregator.test.ts` — added 9 new TDD red-phase tests for `DefaultAggregator` sectioned aggregation
- **Test coverage:** (1) single agent → single section, (2) multiple agents → grouped sections with agentsInvoked metadata, (3) citation deduplication across agents, (4) empty response graceful handling, (5) mixed empty/non-empty responses, (6) mixed success/error with error entries, (7) confidence weighted average, (8) error agents excluded from confidence, (9) metadata merging with timing and reasoning
- **Pattern:** Tests cast `AggregatedResponse` to `OrchestrationResult` to assert the enriched shape (sections Map, citations[], overallConfidence, reasoning, metadata.processingTimeMs, metadata.agentsInvoked) — same pattern as T011 integration tests
- **Results:** 3 existing tests pass, all 9 new tests fail as expected (stub aggregator returns `AggregatedResponse` without sections/citations/confidence/metadata). Zero regressions.
- **Dependency:** T021/T022 will implement sectioned aggregation in `DefaultAggregator` to make these tests pass (green phase)

### T023/T024 — Error Handling & Graceful Degradation TDD Tests (US3)
- **T023 file:** `tests/error-handling/timeout.test.ts` — 4 TDD red-phase tests for per-agent timeout handling
- **T024 file:** `tests/error-handling/degradation.test.ts` — 5 TDD red-phase tests for graceful degradation
- **T023 test coverage:** (1) slow agent timeout → partial results + AgentErrorEntry, (2) all agents timeout → status 'error' + user-friendly message, (3) AbortController enforcement → slow agent aborted before completion, (4) metadata.timedOutAgents lists which agents timed out
- **T024 test coverage:** (1) 1-of-3 agents offline → 2 agents' results + error entry, (2) malformed response → error caught + others returned, (3) empty results → handled gracefully + warning in metadata, (4) network error → captured as error entry + others proceed, (5) partial results include warnings about failed agents
- **Mock agents created:** `createFastAgent()`, `createSlowAgent(delayMs)`, `createHealthyAgent()`, `createOfflineAgent()`, `createMalformedAgent()`, `createEmptyAgent()`, `createNetworkErrorAgent()` — all inline in test files, following existing patterns
- **EnrichedResult type:** Tests cast to `EnrichedResult` extending `OrchestrationResult` with `errors: AgentErrorEntry[]`, `warnings: string[]`, and `status: string` — the fields T025-T028 need to add
- **Results:** All 9 new tests fail as expected (TDD red phase). No regressions to the existing 36 passing tests. Total test count: 55 (36 pass, 19 fail — 10 pre-existing TDD failures + 9 new).
- **Dependency:** T025-T028 will implement per-agent timeouts, error metadata enrichment, and warning propagation to make these tests pass (green phase)
- **Wave 2 Phase 4 (2026-03-05T20:58):** T023+T024 error handling and degradation TDD red-phase test suite completed. 4 timeout scenario tests written. 5 degradation & fallback tests written. All 9 tests failing as expected for TDD red phase. Ready for T025 implementation phase to turn tests green. River completed T019 multi-label classifier in parallel; both agents executed without blockers.

### T029/T030/T031 — Citation Traceability TDD Tests (US4)
- **T029 file:** `tests/aggregator/aggregator.test.ts` — added 3 TDD tests for citation deduplication under new describe block "Citation Deduplication (T029)"
- **T029 test coverage:** (1) overlapping `gold_researcher_krueger_bruce_k` from 2 agents is deduplicated, (2) deduped array contains each unique citation exactly once, (3) `metadata.citationCount` reflects deduplicated count
- **T029 results:** Tests 1 & 2 pass (existing `extractCitations()` already deduplicates). Test 3 fails — `metadata.citationCount` not yet populated.
- **T030 file:** `tests/aggregator/safety-filter.test.ts` — NEW file, 5 TDD tests for `sanitizeRankingLanguage()` and `PROHIBITED_RANKING_WORDS`
- **T030 test coverage:** (1) "best researcher" flagged/sanitized, (2) "top university" flagged, (3) "leading expert" flagged, (4) clean content passes unchanged, (5) prohibited words list includes all FR-007 words (best, top, leading, foremost, premier, preeminent, renowned, distinguished)
- **T030 results:** All 5 tests fail at import — `src/orchestrator/aggregator/safety-filter.ts` doesn't exist yet. Expected.
- **T031 file:** `tests/aggregator/aggregator.test.ts` — added 3 TDD tests under "Uncited Claim Detection (T031)"
- **T031 test coverage:** (1) uncited factual statements → `citationCoverage < 1.0`, (2) fully-cited response → `citationCoverage: 1.0`, (3) confidence warning added when `citationCoverage < 1.0`
- **T031 results:** All 3 tests fail — `metadata.citationCoverage` and `warnings` not implemented yet.
- **Overall results:** 61 tests total, 57 pass, 4 fail. 1 suite fails (safety-filter import). Zero regressions to existing 57 passing tests. All new failures are expected TDD red phase.

### Wave 3 Completion (2026-03-05T21:00:00Z)

- **T029–T031 DELIVERED:** Citation deduplication tests (T029) with 2 of 3 passing. FR-007 safety filter TDD tests (T030) all 5 written, awaiting River's implementation. Uncited claim detection tests (T031) all 3 written, awaiting metadata enrichment. 11 new tests written. 57/61 tests passing. Ready for green-phase implementation handoff.
