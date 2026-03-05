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
