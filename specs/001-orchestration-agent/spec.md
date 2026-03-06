# Feature Specification: Orchestration Agent

**Feature Branch**: `001-orchestration-agent`
**Created**: 2026-03-05
**Status**: Complete
**Stack**: TypeScript (Node.js) — Track A pipeline; Python (FastAPI) + React — Track B demo layer
**Test Suite**: 71 tests passing · TypeScript typecheck clean · 40/40 tasks complete

---

## 1. Overview

The Orchestration Agent routes natural-language research queries to specialized downstream agents, coordinates their parallel execution, and returns a unified response with citations, confidence scoring, and safety filtering.

The system is built as a **4-stage pipeline**:

```
classify → route → dispatch → aggregate
```

Each stage is a contract interface (`src/specs/pipeline.ts`) with a concrete implementation wired together by the `Orchestrator` class (`src/orchestrator/orchestrator.ts`).

---

## 2. Architecture

### 2.1 Pipeline Stages

| Stage | Interface | Responsibility |
|---|---|---|
| **Classify** | `IntentClassifier` | Converts raw input string into one or more `ClassifiedIntent` objects via keyword matching against routing rules |
| **Route** | `IntentRouter` | Maps each classified intent to registered `Agent[]` that can handle it |
| **Dispatch** | (inline in Orchestrator) | Fans out intent to all matched agents concurrently via `Promise.allSettled` with per-agent `AbortController` timeouts |
| **Aggregate** | `ResponseAggregator` | Merges `AgentResponse[]` into a single `AggregatedResponse` with sections, citations, confidence, and safety filtering |

### 2.2 Intent Taxonomy

The `IntentCategory` enum (`src/specs/intent.ts`) defines five research-domain categories:

| Enum Value | Wire Value | Description |
|---|---|---|
| `EXPERTISE_DISCOVERY` | `expertise_discovery` | "Who works on…" researcher lookup |
| `RESEARCH_OUTPUT` | `research_output` | "Publications about…" literature queries |
| `COLLABORATION_INSIGHT` | `collaboration_insight` | Collaborators, funding, grants |
| `POLICY_COMPLIANCE` | `policy_compliance` | IRB, ethics, compliance |
| `GENERAL` | `general` | Fallback when no keywords match |

### 2.3 Routing Rules

Keyword → category mapping (`src/orchestrator/classifier/routing-rules.ts`):

| Category | Example Keywords |
|---|---|
| `EXPERTISE_DISCOVERY` | "who works on", "researchers", "specializes in" |
| `RESEARCH_OUTPUT` | "publications about", "papers on", "studies" |
| `COLLABORATION_INSIGHT` | "collaborators", "funding", "grants" |
| `POLICY_COMPLIANCE` | "compliance", "IRB", "ethics" |

Queries matching no keywords fall through to `GENERAL`, which defaults to Expertise Discovery routing.

### 2.4 Agent Endpoints

Three specialist agents are registered via `DEFAULT_AGENT_ENDPOINTS` (`src/agents/endpoints.ts`):

| Agent ID | Port | Endpoint | Default Timeout |
|---|---|---|---|
| `expertise_discovery` | 5001 | `/api/v1/expertise` | 5000ms |
| `research_output` | 5002 | `/api/v1/research` | 5000ms |
| `policy_compliance` | 5003 | `/api/v1/policy` | 5000ms |

Each is defined by `AgentEndpointConfig` (id, name, url, healthUrl, timeoutMs, enabled). The `HttpAgentClient` handles camelCase ↔ snake\_case wire-format mapping and health checks.

### 2.5 Component Ownership

| Component | Location | Owner |
|---|---|---|
| Shared contracts | `src/specs/` | Mal (reviewed by all) |
| Orchestrator core | `src/orchestrator/orchestrator.ts` | Kaylee |
| Intent classifier | `src/orchestrator/classifier/` | River |
| Agent registry | `src/agents/` | Kaylee |
| Response aggregator | `src/orchestrator/aggregator/` | Wash |
| Router | `src/orchestrator/router.ts` | Kaylee |
| UI formatters | `src/ui/` | Wash |
| FastAPI backend | `src/api/main.py` | Kaylee |
| React frontend | Track B | Wash |

---

## 3. User Scenarios

### US-1 — Single-Agent Query Routing (P1)

A researcher submits a natural language query about expertise (e.g., "who works on autism research?"). The orchestrator classifies the intent, routes to the Expertise Discovery agent, and returns results with citations.

**Acceptance Criteria**:
1. Query containing "who works on" → Expertise Discovery agent invoked; results include researcher names and `<cite>gold_researcher_*</cite>` citations.
2. Query containing "publications about" → Research Output agent invoked; results include publication titles.

### US-2 — Multi-Agent Query (P1)

A researcher submits a complex query spanning multiple domains (e.g., "Summarize potential collaborators, funding opportunities, and compliance steps for autism neurobiology research"). The orchestrator invokes multiple agents in parallel and aggregates results into sections.

**Acceptance Criteria**:
1. Multi-intent query → multiple agents invoked in parallel; results aggregated into sections keyed by agent name.
2. Multi-intent query where one agent times out → partial results from successful agents returned with a warning.

### US-3 — Error Handling and Graceful Degradation (P2)

When an agent is unavailable or times out, the orchestrator returns partial results from the remaining agents with structured error context.

**Acceptance Criteria**:
1. Agent offline → response includes results from other agents plus an `AgentErrorEntry` for the failed agent.
2. All agents timeout → user-friendly error message: "All agents failed to respond. Please try again later."

### US-4 — Citation Traceability (P2)

Every factual claim in the orchestrated response includes a citation in `<cite>source_type_source_id</cite>` format. Uncited factual claims are flagged with warnings.

**Acceptance Criteria**:
1. Agent response with citations → all citations deduplicated and included in `OrchestrationResult.citations`.
2. Agent response missing citations for factual sentences → `citationCoverage < 1.0` and "uncited" warning added.

### Edge Cases

- **No intent match** → Defaults to `GENERAL` (Expertise Discovery routing).
- **Invalid golden\_record\_ids** → Agents return empty results, not errors.
- **Conflicting agent information** → Both included with citations; the orchestrator does not adjudicate.
- **Negative confidence from agent** → Flagged as `INVALID_RESPONSE` error.
- **Empty agent content** → Warning: `Agent "X" returned empty results`.

---

## 4. Functional Requirements

### 4.1 Requirements Matrix

| ID | Requirement | Implementation | Status |
|---|---|---|---|
| **FR-001** | Classify query intent using keyword matching against routing rules | `IntentClassifier.classify()` and `classifyMulti()` with `ROUTING_RULES` map | ✅ Complete |
| **FR-002** | Support parallel invocation of multiple specialist agents | `Promise.allSettled` in `dispatchWithTiming()` with agent deduplication across intents | ✅ Complete |
| **FR-003** | Aggregate responses into unified markdown with per-agent sections | `DefaultAggregator` produces `AggregatedResponse` with `sections: Map<string, string>` | ✅ Complete |
| **FR-004** | Include `<cite>source_type_source_id</cite>` citations for factual claims | 3-source citation extraction (content tags, JSON arrays, response metadata); deduplicated | ✅ Complete |
| **FR-005** | Handle agent timeouts with graceful degradation | Per-agent `AbortController` + `Promise.race` (150ms test / 5000ms prod configurable via `OrchestratorOptions`) | ✅ Complete |
| **FR-006** | Return structured metadata (processing time, agents invoked, timings) | `OrchestrationResult.metadata` includes `processingTimeMs`, `agentsInvoked`, `agentTimings`, `timedOutAgents`, `classifiedIntents` | ✅ Complete |
| **FR-007** | Prohibit ranking language in output | `sanitizeRankingLanguage()` safety filter strips "best", "top", "leading", "foremost", "premier", "preeminent", "renowned", "distinguished"; violations tracked in `metadata.safetyViolations` | ✅ Complete |
| **FR-008** | Validate agent response schemas before aggregation | Post-dispatch validation: negative confidence → `INVALID_RESPONSE` error; empty content → warning | ✅ Complete |

---

## 5. Multi-Intent Support

The classifier exposes two methods:

- `classify(input)` → single `ClassifiedIntent` (primary/highest confidence)
- `classifyMulti(input)` → `ClassifiedIntent[]` (all matching intents)

**Pipeline behavior**:
1. `classifyMulti()` returns all matching intents.
2. Each intent is routed independently; matched agents are deduplicated by `agent.id`.
3. The primary intent (first / highest confidence) is passed to `dispatchWithTiming()`.
4. Agents self-select via `canHandle()` — the intent parameter is mainly used for the response's `intentCategory` field.
5. `metadata.classifiedIntents` exposes all detected intents to downstream consumers.

**Confidence ownership**: The aggregator's `overallConfidence` (average of successful agent confidences) is used instead of the classifier's confidence. This is more meaningful for multi-agent scenarios.

---

## 6. Error Handling & Timeout Enforcement

### 6.1 Per-Agent Timeout

Each agent dispatch is wrapped with `AbortController` + `Promise.race`:

```
OrchestratorOptions.perAgentTimeoutMs  (default: 150ms test, 5000ms production)
```

Timed-out agents receive error code `AGENT_TIMEOUT`. Other failures receive `INTERNAL_ERROR`.

### 6.2 Status Determination

The orchestrator overrides the aggregator's status with its own determination:

| Condition | Status | Behavior |
|---|---|---|
| All agents succeed | `"success"` | Full aggregated response |
| Some agents fail | `"partial"` | Partial results + warning message + `AgentErrorEntry[]` |
| All agents fail | `"error"` | `mergedContent` replaced with fallback message |
| Zero agents matched | `"success"` | Empty result (no agents to fail) |

### 6.3 Error Enrichment

The orchestration result includes:

- `errors: AgentErrorEntry[]` — structured per-agent errors (`AGENT_TIMEOUT`, `INTERNAL_ERROR`, `INVALID_RESPONSE`)
- `warnings: string[]` — user-visible degradation notes
- `metadata.timedOutAgents: string[]` — IDs of timed-out agents

---

## 7. Citation Pipeline

### 7.1 Citation Extraction

Citations are extracted from three sources per agent response (in order):

1. **Content tags**: `<cite>sourceType_sourceId</cite>` parsed via regex
2. **JSON content**: `citations` array in JSON-encoded content
3. **Response metadata**: `metadata.citations` array on `AgentResponse`

All citations are deduplicated by exact `raw` string match and parsed into `{ raw, sourceType, sourceId }` by splitting on the first underscore.

### 7.2 Citation Coverage Scoring

`calculateCitationCoverage()` in the aggregator:

1. Splits merged content into sentences (avoiding false splits on abbreviations like "Dr.")
2. Classifies sentences as **factual** if they contain numbers, proper nouns, or `<cite>` tags
3. Counts how many factual sentences have adjacent citations
4. Produces `citationCoverage = citedFactual / totalFactual` (1.0 if no factual content)
5. When coverage < 1.0, an "uncited-claim" warning is added to `warnings[]`

### 7.3 Citation Metadata

- `metadata.citationCount` — total deduplicated citations
- `metadata.citationCoverage` — ratio of cited factual sentences (0–1)

---

## 8. Safety Filter (FR-007)

The `sanitizeRankingLanguage()` function (`src/orchestrator/aggregator/safety-filter.ts`) enforces the prohibition on ranking language.

**Prohibited words**: `best`, `top`, `leading`, `foremost`, `premier`, `preeminent`, `renowned`, `distinguished`

**Behavior**:
- Detects adjective usage only (regex: `\b(word)\s+([a-zA-Z]\w*)`)
- Skips non-superlative contexts (e.g., "on top of", "leading to")
- Replaces flagged words by removing the adjective and preserving the noun
- Violations collected into `metadata.safetyViolations: string[]`
- Violations logged via `console.warn` for audit trail

The safety filter runs on each non-error agent's content **before** section building and citation extraction in the aggregation stage.

---

## 9. Structured Logging

All pipeline events are emitted as JSON via `console.info`:

| Event | Fields |
|---|---|
| `classify` | `requestId`, `primaryCategory`, `primaryConfidence`, `intentsCount`, `keywordsMatched` |
| `route` | `requestId`, `agentsMatched`, `agentCount` |
| `dispatch` | `requestId`, `agentId`, `durationMs`, `success`, `errorCode` |
| `aggregate` | `requestId`, `sectionsCount`, `citationCount`, `overallConfidence`, `status`, `processingTimeMs` |

---

## 10. UI Formatting

Two formatting functions in `src/ui/index.ts`:

- **`formatOrchestrationResult(result)`**: Renders sections as `## AgentName` headings, converts `<cite>raw</cite>` tags to footnote references `[N]`, appends metadata block (confidence, processing time, agents), and adds a `### References` section with numbered footnotes.
- **`formatQuerySummary(intents, agentsInvoked)`**: Lists all classified intents with confidence percentages and raw input; lists all invoked agent IDs.

---

## 11. Key Entities

| Entity | Interface | Location |
|---|---|---|
| Intent taxonomy | `IntentCategory` enum, `ClassifiedIntent` | `src/specs/intent.ts` |
| Agent contract | `Agent`, `AgentCapability`, `ExecutionContext` | `src/specs/agent.ts` |
| Responses | `AgentResponse`, `AggregatedResponse`, `ResponseStatus` | `src/specs/response.ts` |
| Orchestration result | `OrchestrationResult`, `Citation`, `AgentErrorEntry` | `src/specs/response.ts` |
| Pipeline contracts | `IntentClassifier`, `IntentRouter`, `AgentDispatcher`, `ResponseAggregator`, `OrchestratorPipeline` | `src/specs/pipeline.ts` |
| Agent HTTP contract | `AgentRequest`, `AgentContractResponse`, `AgentErrorResponse`, `AgentHealthResponse` | `src/specs/agent-contract.ts` |
| Agent endpoints | `AgentEndpointConfig`, `DEFAULT_AGENT_ENDPOINTS` | `src/agents/endpoints.ts` |
| Orchestrator options | `OrchestratorOptions` | `src/orchestrator/orchestrator.ts` |

---

## 12. Track B: Python Demo Layer

A parallel Python/React implementation provides the demo interface:

- **FastAPI backend** (`src/api/main.py`): Wraps a Python `Orchestrator` class with endpoints for query processing (`POST /api/v1/query`), session management, agent listing, and WebSocket orchestration (`WS /ws/orchestration`). Uses Pydantic v2 and lifespan context manager.
- **Python aggregator** (`src/orchestrator/aggregator.py`): `ResponseAggregator` class with domain-based sectioning, confidence-weighted averaging, citation deduplication, and `render_markdown()` output.
- **React frontend**: Vite dev server (port 3000/5173) with CORS configured for local development.

---

## 13. Success Criteria

| ID | Criterion | Validation |
|---|---|---|
| **SC-001** | Single-agent queries < 3 seconds (p95) | Performance test validated |
| **SC-002** | Multi-agent queries (3 agents) < 5 seconds (p95) | Performance test validated |
| **SC-003** | 100% of factual claims include citations | `citationCoverage` scoring + uncited-claim warnings |
| **SC-004** | Zero prohibited ranking language in output | `sanitizeRankingLanguage` safety filter on all content |
| **SC-005** | Partial results returned when ≥1 agent succeeds | Status determination: `"partial"` with warnings |
| **SC-006** | 71 tests passing, TypeScript typecheck clean | CI: `vitest run` + `tsc --noEmit` |

---

## 14. Test Structure

```
tests/
├── orchestrator/    — pipeline integration tests
├── classifier/      — intent classifier tests
├── agents/          — agent registry + HTTP client tests
├── aggregator/      — response aggregator tests
├── integration/     — end-to-end pipeline tests
└── helpers.ts       — shared factories (createStubAgent, createTestIntent, createTestContext)
```

**71 tests** covering: single-agent routing, multi-intent dispatch, timeout enforcement, graceful degradation, citation extraction/coverage, safety filtering, schema validation, and UI formatting.
