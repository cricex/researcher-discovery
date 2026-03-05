# Tasks: Orchestration Agent

**Input**: Design documents from `/specs/001-orchestration-agent/`
**Prerequisites**: plan.md ✅, spec.md ✅, contracts/agent-contract-spec.md ✅

**Tests**: Included — plan.md Phase 2 explicitly requires unit, integration, and contract tests.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Exact file paths included in descriptions

## Codebase Baseline

The following already exists and is functional:
- **Pipeline skeleton**: `Orchestrator` (classify → route → dispatch → aggregate) with `Promise.allSettled` fan-out
- **Router**: `DefaultRouter` filters agents by `canHandle()`, sorts by priority
- **Registry**: `AgentRegistry` with register/unregister/discovery/matching
- **Classifier**: `DefaultClassifier` — **STUB** (always returns `GENERAL` at 0.1 confidence)
- **Aggregator**: `DefaultAggregator` — **STUB** (concatenation only, no citations/sections)
- **Types**: `IntentCategory` enum uses software dev categories (CODE_GENERATION, etc.) — **must be replaced** with research domain categories
- **Tests**: 14 passing tests with `vitest` — **must be updated** for new domain types
- **UI**: Export-only stub — no implementation

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Align existing type system and project structure with the research orchestration domain

- [ ] T001 Update `IntentCategory` enum in `src/specs/intent.ts` to research domain categories: `EXPERTISE_DISCOVERY`, `RESEARCH_OUTPUT`, `COLLABORATION_INSIGHT`, `POLICY_COMPLIANCE`, `GENERAL`; and add optional `context` field (with `goldenRecordIds`, `keywords`, `sessionId`) to `ClassifiedIntent` interface
- [ ] T002 [P] Add agent contract types in `src/specs/agent-contract.ts`: `AgentRequest` (query, context, options per contracts/agent-contract-spec.md), `AgentContractResponse` (agent, query_timestamp, results, citations, metadata), `AgentErrorResponse` (error, error_code, details, timestamp), `AgentHealthResponse`, and `AgentErrorCode` enum (`AGENT_TIMEOUT`, `INVALID_REQUEST`, `NO_RESULTS`, `INTERNAL_ERROR`)
- [ ] T003 [P] Extend response types in `src/specs/response.ts`: add `Citation` interface (raw string in `<cite>source_type_source_id</cite>` format, sourceType, sourceId), add `OrchestrationResult` interface (sections map by agent name, citations array, overallConfidence number, reasoning string, metadata with processingTimeMs and agentsInvoked), and add `AgentErrorEntry` interface (agentId, errorCode, message)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Create `AgentEndpointConfig` in `src/agents/endpoints.ts` defining the 3 agent endpoints: Expertise Discovery (`http://localhost:5001/api/v1/expertise`), Research Output (`http://localhost:5002/api/v1/research`), Policy Compliance (`http://localhost:5003/api/v1/policy`); export a `DEFAULT_AGENT_ENDPOINTS` map from `AgentId` to `{ name, url, healthUrl, timeoutMs: 5000, enabled: true }`
- [ ] T005 [P] Implement HTTP agent client in `src/agents/client.ts`: class `HttpAgentClient` with `callAgent(endpoint: AgentEndpointConfig, request: AgentRequest): Promise<AgentContractResponse>` using native `fetch` with `AbortController` for 5s timeout; parse response per agent contract format; throw typed errors for timeout/HTTP failures; include `checkHealth(endpoint): Promise<AgentHealthResponse>` method
- [ ] T006 [P] Create routing rules configuration in `src/orchestrator/classifier/routing-rules.ts`: export `ROUTING_RULES` as a `Map<IntentCategory, string[]>` mapping keyword patterns to intents — `EXPERTISE_DISCOVERY`: ["who works on", "expertise in", "researchers", "faculty", "specializes in", "expert in"]; `RESEARCH_OUTPUT`: ["publications about", "papers on", "published", "research on", "studies"]; `COLLABORATION_INSIGHT`: ["collaborators", "collaboration", "funding", "grants", "partnerships"]; `POLICY_COMPLIANCE`: ["compliance", "policy", "regulations", "IRB", "ethics", "guidelines"]
- [ ] T007 [P] Update test helpers in `tests/helpers.ts`: replace all `IntentCategory.GENERAL` defaults with research domain categories; add `createMockAgentResponse()` factory that returns an `AgentContractResponse` with citations array; add `createMockAgentRequest()` factory; add `createStubHttpAgent()` that wraps `AgentEndpointConfig` with mock HTTP behavior
- [ ] T008 Update all existing test files to use new research domain `IntentCategory` values: `tests/orchestrator/orchestrator.test.ts`, `tests/classifier/classifier.test.ts`, `tests/aggregator/aggregator.test.ts`, `tests/agents/registry.test.ts`, `tests/integration/wiring.test.ts` — replace `IntentCategory.GENERAL`/`CODE_GENERATION`/etc. with `EXPERTISE_DISCOVERY`/`RESEARCH_OUTPUT`/etc.; ensure all 14 tests pass with new categories
- [ ] T009 [P] Re-export new types from `src/specs/index.ts` and `src/agents/index.ts`: add exports for `AgentRequest`, `AgentContractResponse`, `AgentErrorResponse`, `AgentHealthResponse`, `AgentErrorCode`, `Citation`, `OrchestrationResult`, `AgentErrorEntry`, `AgentEndpointConfig`, `HttpAgentClient`, `ROUTING_RULES`, `DEFAULT_AGENT_ENDPOINTS`

**Checkpoint**: Foundation ready — all types aligned with research domain, existing tests pass, user story implementation can now begin

---

## Phase 3: User Story 1 — Single-Agent Query Routing (Priority: P1) 🎯 MVP

**Goal**: A researcher submits a natural language query; the orchestrator classifies intent via keyword matching, routes to the correct specialist agent, and returns results with citations.

**Independent Test**: Submit "who works on autism research?" and verify the Expertise Discovery agent is invoked and the response includes researcher matches with `<cite>gold_researcher_*</cite>` citations.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T010 [P] [US1] Write classifier unit tests in `tests/classifier/classifier.test.ts`: test "who works on autism research?" maps to `EXPERTISE_DISCOVERY`; test "publications about neuroscience" maps to `RESEARCH_OUTPUT`; test "compliance steps for IRB" maps to `POLICY_COMPLIANCE`; test unknown query defaults to `EXPERTISE_DISCOVERY`; test confidence is ≥0.8 for keyword match and ≤0.2 for default fallback
- [ ] T011 [P] [US1] Write single-agent integration test in `tests/integration/single-agent.test.ts`: test full pipeline query → classify → route → dispatch → response for a single-intent query using a mock HTTP agent; verify response contains agent name, results section, and citations array; verify metadata includes `processingTimeMs` and `agentsInvoked: ["expertise_discovery"]`
- [ ] T012 [P] [US1] Write agent client contract tests in `tests/agents/client.test.ts`: test `HttpAgentClient.callAgent()` sends correct request format per contracts/agent-contract-spec.md (POST with JSON body containing query, context, options); test response parsing extracts citations and metadata; test error response parsing returns typed `AgentErrorResponse`

### Implementation for User Story 1

- [ ] T013 [US1] Implement keyword-based intent classifier in `src/orchestrator/classifier/classifier.ts`: replace stub with real logic that scans input against `ROUTING_RULES` keyword patterns; return highest-confidence match; if no keywords match, default to `EXPERTISE_DISCOVERY` per edge case spec; set confidence to 0.9 for exact keyword match, 0.5 for partial match, 0.1 for default fallback; preserve `rawInput` and extract `keywords` into `parameters`
- [ ] T014 [US1] Create `HttpAgent` adapter in `src/agents/http-agent.ts` that implements the `Agent` interface by wrapping `HttpAgentClient` and `AgentEndpointConfig`: `canHandle()` checks intent category matches the agent's registered category; `execute()` builds an `AgentRequest` from `ClassifiedIntent`, calls `HttpAgentClient.callAgent()`, and converts `AgentContractResponse` to `AgentResponse` with citations in metadata
- [ ] T015 [US1] Update `AgentRegistry` in `src/agents/registry.ts` to add a `registerEndpoint(config: AgentEndpointConfig)` convenience method that creates an `HttpAgent` and registers it; add `registerDefaults()` method that registers all agents from `DEFAULT_AGENT_ENDPOINTS`
- [ ] T016 [US1] Wire single-agent end-to-end flow in `src/orchestrator/orchestrator.ts`: ensure the dispatch step extracts citations from agent metadata and attaches them to the response; add timing instrumentation (`Date.now()` start/end) to populate `processingTimeMs` in response metadata

**Checkpoint**: User Story 1 is functional — single-intent queries route to the correct agent and return results with citations

---

## Phase 4: User Story 2 — Multi-Agent Query (Priority: P1)

**Goal**: A researcher submits a complex query spanning multiple domains; the orchestrator invokes multiple agents in parallel and aggregates results into sections.

**Independent Test**: Submit "Summarize potential collaborators, funding opportunities, and compliance steps for autism neurobiology research" and verify response contains sections from Expertise, Collaboration, and Policy agents, all within 5 seconds.

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T017 [P] [US2] Write multi-intent classification tests in `tests/classifier/classifier.test.ts`: test compound query "collaborators and compliance steps" returns both `COLLABORATION_INSIGHT` and `POLICY_COMPLIANCE` intents; test "publications and who works on" returns both `RESEARCH_OUTPUT` and `EXPERTISE_DISCOVERY`; test confidence for each intent in multi-label result
- [ ] T018 [P] [US2] Write response aggregation tests in `tests/aggregator/aggregator.test.ts`: test merging 3 agent responses produces sectioned output (one section per agent name); test merged metadata includes `agentsInvoked` list with all 3 agent IDs; test overall confidence equals successful agents / total agents; test aggregated citations array is the union of all agent citations

### Implementation for User Story 2

- [ ] T019 [US2] Add multi-label classification to `src/orchestrator/classifier/classifier.ts`: new method `classifyMulti(input: string): Promise<ClassifiedIntent[]>` that returns ALL matching intents (not just the best one); scan input against all routing rules and collect every match above 0.3 confidence threshold
- [ ] T020 [US2] Update `Orchestrator.process()` in `src/orchestrator/orchestrator.ts` to support multi-intent: call `classifyMulti()` to get all matching intents; collect unique agents across all intents via the router; dispatch to all matched agents in parallel via existing `Promise.allSettled`; pass full intent list to aggregator
- [ ] T021 [US2] Implement sectioned response aggregation in `src/orchestrator/aggregator/aggregator.ts`: replace stub with real logic — group agent responses by agent name into sections (Collaborators, Publications, Funding, Compliance); merge all citations across agents with deduplication; calculate `overallConfidence` as `successfulAgents / totalAgents`; generate `reasoning` string explaining which agents were invoked and why; populate `agentsInvoked` in metadata
- [ ] T022 [US2] Add `OrchestrationResult` construction in `src/orchestrator/aggregator/aggregator.ts`: build the full result object with `sections` (Map<string, string>), `citations` (Citation[]), `overallConfidence`, `reasoning`, and `metadata` ({ processingTimeMs, agentsInvoked }); update `AggregatedResponse` to include the `OrchestrationResult` or replace `mergedContent` with structured sections

**Checkpoint**: User Stories 1 AND 2 are functional — single and multi-agent queries both work independently

---

## Phase 5: User Story 3 — Error Handling and Graceful Degradation (Priority: P2)

**Goal**: When an agent is unavailable or times out, the orchestrator returns partial results from remaining agents with clear error context.

**Independent Test**: Shut down one agent endpoint (or configure a mock to timeout), submit a multi-agent query, and verify partial results are returned with error metadata for the failed agent.

### Tests for User Story 3

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T023 [P] [US3] Write timeout handling tests in `tests/orchestrator/orchestrator.test.ts`: test agent that takes >5s is aborted and error response is returned for that agent; test other agents' successful responses are still included; test response status is `partial` when at least one agent succeeds and one fails
- [ ] T024 [P] [US3] Write graceful degradation tests in `tests/integration/degradation.test.ts`: test when 1 of 3 agents is offline, response includes results from 2 agents and an `AgentErrorEntry` for the failed agent; test when ALL agents fail, response status is `error` with user-friendly message "All agents failed to respond. Please try again later."; test error entries include `agentId`, `errorCode`, and `message`

### Implementation for User Story 3

- [ ] T025 [US3] Implement per-agent `AbortController` timeout in `src/agents/client.ts`: create a fresh `AbortController` with `setTimeout(5000)` for each `callAgent()` call; catch `AbortError` and return typed `AgentErrorResponse` with `error_code: 'AGENT_TIMEOUT'`; catch network errors (fetch failures) and return `error_code: 'INTERNAL_ERROR'`
- [ ] T026 [US3] Add error metadata to orchestration result in `src/orchestrator/orchestrator.ts`: update `dispatch()` to capture error details (agentId, errorCode, message) for failed agents; attach `errors: AgentErrorEntry[]` array to the `AggregatedResponse`; set response status to `partial` if at least one agent succeeds, `error` if all fail
- [ ] T027 [US3] Implement all-agents-failed handling in `src/orchestrator/aggregator/aggregator.ts`: when all responses have `status: 'error'`, return a user-friendly `mergedContent` message; include all error entries in metadata; set `overallConfidence: 0`
- [ ] T028 [US3] Add timeout configuration to `AgentEndpointConfig` in `src/agents/endpoints.ts`: allow per-agent timeout override (default 5000ms); add `retryOnTimeout: boolean` flag (default false — YAGNI for hackathon, but the type should support it)

**Checkpoint**: User Stories 1, 2, AND 3 are functional — the system degrades gracefully when agents fail

---

## Phase 6: User Story 4 — Citation Traceability (Priority: P2)

**Goal**: Every factual claim in the orchestrated response includes a `<cite>source_type_source_id</cite>` citation; uncited claims are flagged with a confidence warning.

**Independent Test**: Submit a query and verify every fact in the response has an inline citation; check that the response metadata includes a `citationCoverage` percentage.

### Tests for User Story 4

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T029 [P] [US4] Write citation deduplication tests in `tests/aggregator/aggregator.test.ts`: test citations from 2 agents with overlapping `<cite>gold_researcher_krueger_bruce_k</cite>` are deduplicated; test deduped citations array contains each unique citation exactly once; test citation count metadata reflects deduplicated count
- [ ] T030 [P] [US4] Write safety filter tests in `tests/aggregator/safety-filter.test.ts`: test content containing "best researcher" is flagged and sanitized; test content containing "top university" is flagged; test content containing "leading expert" is flagged; test clean content passes through unchanged; test prohibited words list includes: "best", "top", "leading", "foremost", "premier", "preeminent", "renowned", "distinguished" per FR-007
- [ ] T031 [P] [US4] Write uncited claim detection tests in `tests/aggregator/aggregator.test.ts`: test response with factual statements missing `<cite>` tags gets a `citationCoverage` below 1.0 in metadata; test fully-cited response gets `citationCoverage: 1.0`; test confidence warning is added when `citationCoverage < 1.0`

### Implementation for User Story 4

- [ ] T032 [US4] Implement citation extraction and deduplication in `src/orchestrator/aggregator/aggregator.ts`: parse `<cite>source_type_source_id</cite>` patterns from agent responses using regex; split into `sourceType` and `sourceId`; deduplicate by full citation string; return array of `Citation` objects on the `OrchestrationResult`
- [ ] T033 [US4] Implement `citationCoverage` scoring in `src/orchestrator/aggregator/aggregator.ts`: count factual sentences in merged content (sentences containing proper nouns, numbers, or specific claims); count how many have adjacent `<cite>` tags; calculate `citationCoverage = citedSentences / totalFactualSentences`; add confidence warning to metadata when coverage < 1.0
- [ ] T034 [US4] Implement ranking language safety filter in `src/orchestrator/aggregator/safety-filter.ts`: export `sanitizeRankingLanguage(content: string): { sanitized: string, violations: string[] }` that scans for prohibited words ("best", "top", "leading", "foremost", "premier", "preeminent", "renowned", "distinguished") in context of rankings; remove or neutralize violating phrases; return list of violations found; export `PROHIBITED_RANKING_WORDS` constant
- [ ] T035 [US4] Wire safety filter into aggregation pipeline in `src/orchestrator/aggregator/aggregator.ts`: call `sanitizeRankingLanguage()` on each agent's content before merging; collect all violations into response metadata `safetyViolations` array; log violations for audit trail

**Checkpoint**: All 4 user stories are functional — citations are deduplicated, uncited claims are flagged, ranking language is filtered

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T036 [P] Add structured logging throughout the pipeline in `src/orchestrator/orchestrator.ts`: log intent classification result, agents matched, dispatch timing per agent, aggregation summary; use `console.info` with structured JSON format for hackathon (no logging library needed per YAGNI)
- [ ] T037 [P] Implement basic UI query form and response display in `src/ui/index.ts`: export a `formatOrchestrationResult(result: OrchestrationResult): string` function that renders sections as markdown with citation footnotes; export a `formatQuerySummary(intent: ClassifiedIntent[], agentsInvoked: string[]): string` for the agent timeline display
- [ ] T038 [P] Update documentation in `docs/orchestration-agent-spec.md`: add "Getting Started" section with instructions to register agents and submit queries; document the routing rules and agent contract; add architecture diagram showing classify → route → dispatch → aggregate flow
- [ ] T039 Run full test suite validation: execute `npm test` and verify all existing + new tests pass; verify TypeScript compilation with `npm run typecheck`; confirm no lint errors
- [ ] T040 Performance validation: write a timing test in `tests/integration/performance.test.ts` that verifies single-agent queries complete in <3s and multi-agent queries complete in <5s using mock agents with simulated latency (200ms per agent)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup (Phase 1) completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2)
- **User Story 2 (Phase 4)**: Depends on Foundational (Phase 2); benefits from US1 classifier (T013) but can be developed independently
- **User Story 3 (Phase 5)**: Depends on Foundational (Phase 2); enhances US1/US2 dispatch logic
- **User Story 4 (Phase 6)**: Depends on Foundational (Phase 2); enhances US2 aggregator
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Phase 2 — No dependencies on other stories
- **User Story 2 (P1)**: Can start after Phase 2 — Builds on classifier from US1 (T013) but testable independently with stubs
- **User Story 3 (P2)**: Can start after Phase 2 — Enhances dispatch from US1/US2 but testable independently
- **User Story 4 (P2)**: Can start after Phase 2 — Enhances aggregator from US2 but testable independently

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Types/contracts before implementations
- Client/adapter before orchestrator integration
- Core implementation before integration wiring
- Story complete before moving to next priority

### Parallel Opportunities

- T002 + T003 can run in parallel (different files, no dependencies)
- T004 + T005 + T006 + T007 + T009 can run in parallel within Phase 2
- All test tasks within a phase marked [P] can run in parallel
- Once Phase 2 completes, US1 and US2 can start in parallel (different components)
- US3 and US4 can run in parallel once their prerequisite aggregator/dispatch code exists
- All Phase 7 tasks marked [P] can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all US1 tests in parallel (write-first, should FAIL):
Task T010: "Classifier unit tests in tests/classifier/classifier.test.ts"
Task T011: "Single-agent integration test in tests/integration/single-agent.test.ts"
Task T012: "Agent client contract tests in tests/agents/client.test.ts"

# Then implement — T013 and T014 can start in parallel:
Task T013: "Keyword-based classifier in src/orchestrator/classifier/classifier.ts"
Task T014: "HttpAgent adapter in src/agents/http-agent.ts"

# Then wire together (depends on T013 + T014):
Task T015: "Update AgentRegistry in src/agents/registry.ts"
Task T016: "Wire end-to-end flow in src/orchestrator/orchestrator.ts"
```

## Parallel Example: User Story 2

```bash
# Launch all US2 tests in parallel:
Task T017: "Multi-intent classification tests in tests/classifier/classifier.test.ts"
Task T018: "Response aggregation tests in tests/aggregator/aggregator.test.ts"

# Then implement — T019 and T021 touch different files:
Task T019: "Multi-label classification in src/orchestrator/classifier/classifier.ts"
Task T021: "Sectioned aggregation in src/orchestrator/aggregator/aggregator.ts"

# Then wire (depends on T019 + T021):
Task T020: "Update Orchestrator.process() in src/orchestrator/orchestrator.ts"
Task T022: "OrchestrationResult construction in aggregator"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational (T004–T009) — CRITICAL, blocks all stories
3. Complete Phase 3: User Story 1 (T010–T016)
4. **STOP and VALIDATE**: Submit "who works on autism research?" — verify Expertise Discovery agent is invoked with citations
5. Deploy/demo if ready — this is a working hackathon MVP

### Incremental Delivery

1. Setup + Foundational → Foundation ready (research domain types, agent client, routing rules)
2. Add User Story 1 → Test independently → **MVP Demo** (single-agent routing works)
3. Add User Story 2 → Test independently → **Enhanced Demo** (multi-agent with sections)
4. Add User Story 3 → Test independently → **Reliable Demo** (handles failures gracefully)
5. Add User Story 4 → Test independently → **Trustworthy Demo** (citations verified, safety enforced)
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (classifier + routing)
   - Developer B: User Story 2 (multi-intent + aggregation)
3. After US1 + US2 merge:
   - Developer A: User Story 3 (error handling)
   - Developer B: User Story 4 (citations + safety)
4. Stories integrate independently via shared types

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Tests MUST fail before implementing (TDD approach per plan.md Phase 2)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Existing 14 tests must continue passing throughout (T008 updates them for new domain)
- No external dependencies needed — uses native `fetch` (Node 18+) and pure TypeScript
- Python orchestrator (`src/orchestrator/orchestrator.py`) is a reference implementation, not modified by these tasks
