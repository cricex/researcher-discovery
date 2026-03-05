# Decisions — orchestration-agent

## Decision 1.1: Intent Taxonomy Pivot to Research Domain

**Author:** River  
**Date:** 2026-03-05  
**Status:** Accepted  
**Task:** T001

### Context

The original `IntentCategory` enum was code-centric (CODE_GENERATION, CODE_REVIEW, EXPLANATION, REFACTOR, TEST_GENERATION, DOCUMENTATION, DEBUGGING). The project is pivoting to a research domain — expertise discovery, research output analysis, collaboration insights, and policy compliance.

### Decision

Replaced the `IntentCategory` enum in `src/specs/intent.ts` with research domain categories:

| Old | New |
|-----|-----|
| CODE_GENERATION | EXPERTISE_DISCOVERY |
| CODE_REVIEW | RESEARCH_OUTPUT |
| EXPLANATION | COLLABORATION_INSIGHT |
| REFACTOR | POLICY_COMPLIANCE |
| TEST_GENERATION | *(removed)* |
| DOCUMENTATION | *(removed)* |
| DEBUGGING | *(removed)* |
| GENERAL | GENERAL *(kept)* |

Added an optional `context` field to `ClassifiedIntent` carrying `goldenRecordIds`, `keywords`, and `sessionId` for richer downstream routing.

### Impact

- **Breaking change** to the shared contract (`src/specs/intent.ts`).
- `src/orchestrator/classifier/classifier.ts` only used `GENERAL` — compiles clean.
- `tests/agents/registry.test.ts` references removed members (`CODE_GENERATION`, `EXPLANATION`) — needs update by Zoe.
- Any agent `capabilities` arrays referencing old categories need updating.

### Rationale

Per Decision 1.5: IntentCategory is an enum, not a string. Changing the taxonomy is a conscious, visible act. The new categories reflect the actual domain the system is being built to serve.

---

## Decision 1.2: Agent HTTP Contract Types

**Author:** Kaylee  
**Date:** 2026-03-05  
**Status:** Accepted  
**Task:** T002

### What

Created `src/specs/agent-contract.ts` with the HTTP-level contract types for agent communication:

- `AgentErrorCode` enum — `AGENT_TIMEOUT`, `INVALID_REQUEST`, `NO_RESULTS`, `INTERNAL_ERROR`
- `AgentRequest` — inbound query with optional context and options
- `AgentContractResponse` — success payload with results, citations, and metadata
- `AgentErrorResponse` — error payload with code and details
- `AgentHealthResponse` — health-check shape

Exported via `src/specs/index.ts`.

### Why camelCase, not snake_case

The spec contract doc uses snake_case (`processing_time_ms`, `golden_record_ids`). The TypeScript types use camelCase to stay idiomatic. The HTTP client layer will handle the mapping. This keeps our internal code clean while respecting the external wire format.

### Why a separate file from `agent.ts`

`agent.ts` defines the *internal* Agent interface (what agents implement inside the orchestrator). `agent-contract.ts` defines the *external* HTTP contract (what goes over the wire). Different concerns, different consumers.

---

## Decision 1.3: Response Type Extensions

**Author:** Wash  
**Date:** 2026-03-05  
**Status:** Accepted  
**Task:** T003

### What

Extended `src/specs/response.ts` with new interfaces:

- `Citation` — citation metadata for results
- `OrchestrationResult` — aggregated response payload structure
- `AgentErrorEntry` — error detail entry with code and message

### Design Decisions

- `errorCode` remains `string` type (not enum import) to avoid coupling with parallel agent-contract work
- Maintained existing JSDoc style from codebase
- All 15 existing tests pass; clean `tsc --noEmit`

### Rationale

These interfaces support the Response Aggregator component and orchestration result shape. String errorCode allows flexibility in error classification across agent boundaries.

---

## Decision 2.1: snake_case mapping lives in HttpAgentClient, not in contract types

**Author:** Kaylee  
**Date:** 2026-03-05  
**Status:** Accepted  
**Task:** T005

### Context

The agent contract spec defines the HTTP wire format in snake_case (`query_timestamp`, `processing_time_ms`, `result_count`, etc.), but our TypeScript types in `src/specs/agent-contract.ts` use camelCase. Something has to bridge the two.

### Decision

The mapping between camelCase TypeScript types and snake_case wire format is handled **entirely inside `HttpAgentClient`** (`src/agents/client.ts`) via private helper functions (`toWireRequest`, `fromWireResponse`, `fromWireError`). The contract types themselves stay pure camelCase — no dual representations, no `@JsonProperty` annotations, no generic key-mapping utility.

### Why

- **Single responsibility:** The HTTP client is the only place that touches the wire format, so that's where the mapping belongs.
- **Type safety:** Explicit field-by-field mapping catches schema drift at compile time. A generic `camelToSnake()` utility would silently pass unknown fields and miss renames.
- **Testability:** The mapper functions are pure and easy to unit-test in isolation.

### Trade-offs

- If the wire format adds fields, the mapper functions need manual updates. This is intentional — we *want* to review new fields rather than auto-pass them.

---

## Decision 2.2: Expanded Test Helper Factories

**Author:** Zoe (Tester / DevOps)  
**Date:** 2026-03-05  
**Status:** Accepted  
**Task:** T007

### Context

With the agent-contract types (`AgentRequest`, `AgentContractResponse`) now in specs, tests need factories for these shapes. The HTTP agent integration layer is coming, and test setup for it shouldn't require inlining large object literals in every test.

### Decision

Added three new factories to `tests/helpers.ts`:

1. **`createMockAgentResponse()`** — returns a valid `AgentContractResponse` with a citations array. Useful for testing aggregation, response parsing, and HTTP agent stubs.
2. **`createMockAgentRequest()`** — returns a valid `AgentRequest`. Useful for testing request validation and HTTP client layers.
3. **`createStubHttpAgent()`** — returns a mock object with `query()` and `healthCheck()` methods matching the expected HTTP agent shape. Configurable `baseUrl`, `agentId`, and `timeout`.

Also updated `createTestIntent()` default category from `GENERAL` to `EXPERTISE_DISCOVERY` to reflect the new research domain taxonomy.

### Rationale

- Centralized factories prevent copy-paste drift across test files
- `createStubHttpAgent()` gives a ready-made stub without needing a real HTTP server or heavy mocking library
- Defaulting to EXPERTISE_DISCOVERY instead of GENERAL catches more routing edge cases in tests
