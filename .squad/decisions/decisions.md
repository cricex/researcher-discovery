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

---

## Decision 3.1: FastAPI API Layer Setup

**Author:** Kaylee (Backend Dev)  
**Date:** 2026-03-05  
**Status:** Implemented  
**Task:** B1  

### Context

The project has a Python orchestrator at `src/orchestrator/orchestrator.py` that routes queries to specialized agents. We need an HTTP API layer so the React frontend can talk to it.

### Decisions

#### Import strategy: sys.path manipulation

The `src/` directory has no `__init__.py` files — it's not a proper Python package. Rather than restructuring the entire tree (which would touch files owned by other team members), `src/api/main.py` adds `src/` to `sys.path` at import time so `from orchestrator.orchestrator import Orchestrator` resolves. This is contained to a single line and doesn't require changes outside `src/api/`.

#### Pydantic v2 + FastAPI lifespan

Used `model_dump()` instead of deprecated `dict()` (Pydantic v2). Used `lifespan` async context manager instead of deprecated `@app.on_event("startup")`/`@app.on_event("shutdown")`. This avoids deprecation warnings and follows current best practices.

#### Orchestrator instantiation deferred to lifespan

The global `orchestrator` is created during the FastAPI lifespan startup, not at module import time. This ensures proper async initialization and clean shutdown via `orchestrator.close()`.

#### CORS origins: 3000 + 5173

Allows both Create React App (port 3000) and Vite (port 5173) dev servers. Matches the UI decision space left to Wash.

### What This Does NOT Decide

- Production deployment strategy (e.g., Gunicorn workers, Docker)
- Authentication / authorization on API endpoints
- Persistent session storage (currently in-memory dict)
- Whether the TypeScript orchestrator or the Python orchestrator is the "primary" — API wraps the Python one for now

---

## Decision 3.2: React Frontend Stack (B2+B3)

**Author:** Wash  
**Date:** 2026-03-05  
**Status:** Implemented  
**Task:** B2, B3  

### Context

Needed a frontend UI for the orchestration agent. Reference implementation provided with full component code. UI technology choice was explicitly left to Wash (see decisions.md §1.7 "What's NOT Decided Yet").

### Decision

- **Framework:** React 19 + TypeScript via Vite (react-ts template)
- **Styling:** Tailwind CSS v3 with custom Azure-themed color palette
- **HTTP:** axios for API calls to the FastAPI backend at `localhost:8000`
- **Icons:** lucide-react (tree-shakeable, consistent with the reference)
- **Markdown:** react-markdown for rendering agent responses
- **Skipped:** framer-motion, recharts — not critical for MVP, keeps bundle lean

### Key Choices

1. **Tailwind v3 over v4:** Pinned `tailwindcss@3` because v4 dropped the `@tailwind` directive syntax and `tailwind.config.js` — the reference code uses v3 patterns.
2. **Typed orchestration flow state:** Reference used `any` for `orchestrationFlow` state — replaced with proper interface to catch shape mismatches at compile time.
3. **Error handling:** Used `unknown` + type assertion instead of `any` in catch blocks per strict TypeScript conventions.

### Impact

- Frontend lives in `frontend/` — separate package.json, independent build
- Build produces ~362KB JS (116KB gzipped) — reasonable for an internal tool
- Connects to backend at `http://localhost:8000` — will need CORS config on the FastAPI side
