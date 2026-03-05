# Implementation Plan: Orchestration Agent

**Branch**: `001-orchestration-agent` | **Date**: 2026-03-05 | **Spec**: [specs/001-orchestration-agent/spec.md](../../specs/001-orchestration-agent/spec.md)
**Input**: Feature specification from `/specs/001-orchestration-agent/spec.md`

## Summary

Build an orchestration agent that receives natural language research queries, classifies intent via keyword matching, routes to specialized agents (Expertise Discovery, Research Output, Collaboration Insight, Policy Compliance) in parallel, and aggregates responses into a unified markdown result with `<cite>source_type_source_id</cite>` citations. The system enforces safety constraints (no ranking language, no faculty evaluation, no non-public data) and handles agent failures gracefully with partial results.

## Technical Context

**Language/Version**: TypeScript (ES2022, Node16 modules) + Python 3.12 (orchestrator core)
**Primary Dependencies**: `semantic-kernel` (Python, Microsoft Agent Framework), `httpx` (async HTTP), `vitest` (TS tests), Anthropic SDK (Claude Opus 4.6)
**Storage**: N/A (stateless orchestration; agents are external HTTP services)
**Testing**: `vitest` (TypeScript unit/integration), `pytest` (Python orchestrator)
**Target Platform**: Local development (localhost agents on ports 5001-5003)
**Project Type**: Web service / multi-agent orchestrator
**Performance Goals**: <3s single-agent, <5s multi-agent, 10+ concurrent queries
**Constraints**: 5s agent timeout, mandatory citations, no ranking language
**Scale/Scope**: Hackathon MVP — 4 specialist agents, 1 orchestrator, keyword-based routing

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Citation-First | ✅ PASS | `_aggregate_responses` collects citations from all agents, deduplicates, appends to response. Format: `<cite>source_type_source_id</cite>`. Uncited responses lower confidence score. |
| II. Safety-First Language | ✅ PASS | No ranking language in orchestrator outputs. Agent responses are passed through as-is — **TODO**: add safety filter in aggregator to catch violations from downstream agents. |
| III. Graceful Degradation | ✅ PASS | `_call_agents_parallel` catches `TimeoutException` and general errors per-agent. Partial results returned when at least one agent succeeds. |
| IV. Multi-Agent Coordination | ✅ PASS | `_classify_intent` supports multi-label classification. `asyncio.gather` dispatches agents in parallel. `_aggregate_responses` merges sections. |
| V. Simplicity and Speed | ✅ PASS | Keyword matching for intent classification (no ML model). Direct HTTP calls to agents. Dataclass-based result types. |

## Project Structure

### Documentation (this feature)

```text
specs/001-orchestration-agent/
├── spec.md                          # Feature specification (done)
├── plan.md                          # This file
├── contracts/
│   └── agent-contract-spec.md       # Agent HTTP contract (done)
└── tasks.md                         # Task breakdown (next: /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── index.ts                         # Package entry point
├── specs/                           # Typed contracts (TypeScript interfaces)
│   ├── index.ts
│   ├── agent.ts                     # AgentEndpoint, AgentId types
│   ├── intent.ts                    # Intent classification types
│   ├── pipeline.ts                  # Pipeline/routing types
│   └── response.ts                  # OrchestrationResponse, Citation, etc.
├── orchestrator/
│   ├── index.ts                     # Orchestrator exports
│   ├── orchestrator.ts              # Core orchestration logic (TypeScript)
│   ├── orchestrator.py              # Core orchestration logic (Python/SK)
│   ├── router.ts                    # Intent → agent routing
│   ├── classifier/
│   │   ├── index.ts
│   │   └── classifier.ts           # Keyword-based intent classifier
│   └── aggregator/
│       ├── index.ts
│       └── aggregator.ts           # Response aggregation + citation merge
├── agents/
│   ├── index.ts
│   └── registry.ts                  # Agent registry (endpoints, health)
├── aggregator/
│   └── index.ts                     # Top-level aggregator exports
├── classifier/
│   └── index.ts                     # Top-level classifier exports
└── ui/
    └── index.ts                     # UI entry point

tests/
├── helpers.ts                       # Shared test utilities
├── orchestrator/
│   └── orchestrator.test.ts         # Orchestrator unit tests
├── classifier/
│   └── classifier.test.ts          # Intent classification tests
├── agents/
│   └── registry.test.ts            # Agent registry tests
├── aggregator/
│   └── aggregator.test.ts          # Response aggregation tests
└── integration/
    └── wiring.test.ts              # End-to-end wiring tests
```

### CI/CD (already configured)

```text
.github/workflows/
├── squad-ci.yml                     # Main CI: Node 22, tsc --noEmit, vitest run
└── ... (11 additional squad workflows)
```

## Implementation Phases

### Phase 0: Research & Validation (COMPLETE)

- [x] Agent contract defined (HTTP POST, JSON payloads, citation format)
- [x] Routing rules established (keyword → agent mapping)
- [x] Performance targets set (<3s single, <5s multi)
- [x] Safety constraints codified in constitution
- [x] Python orchestrator prototype written with Semantic Kernel

### Phase 1: Core TypeScript Implementation

**Goal**: Get the TypeScript orchestrator working end-to-end with mock agents.

1. **Intent Classifier** (`src/orchestrator/classifier/classifier.ts`)
   - Implement keyword-based intent classification per routing rules
   - Support multi-label classification for compound queries
   - Return within 200ms budget
   - Map intents to agent IDs: `expertise_discovery`, `research_output`, `collaboration_insight`, `policy_compliance`

2. **Agent Registry** (`src/agents/registry.ts`)
   - Register agent endpoints with name, URL, timeout, enabled status
   - Health check support (GET /health)
   - Mock vs. real agent endpoint configuration
   - Agent discovery and listing

3. **Response Aggregator** (`src/orchestrator/aggregator/aggregator.ts`)
   - Merge responses from multiple agents into sections (Collaborators, Publications, Funding, Compliance)
   - Deduplicate citations across agents
   - Calculate overall confidence (successful agents / total agents)
   - Generate reasoning explanation
   - **Safety filter**: scan for prohibited ranking language before returning

4. **Orchestrator Core** (`src/orchestrator/orchestrator.ts`)
   - Wire classifier → registry → parallel HTTP calls → aggregator
   - 5-second per-agent timeout with `AbortController`
   - Graceful degradation on partial failure
   - Structured `OrchestrationResult` output

5. **Router** (`src/orchestrator/router.ts`)
   - Map classified intents to agent endpoints from registry
   - Deduplicate agent calls for overlapping intents
   - Format agent-specific payloads per contract spec

### Phase 2: Testing

**Goal**: All 15 existing smoke tests pass + add contract and safety tests.

1. **Unit Tests**
   - Classifier: verify keyword → intent mapping for all routing rules
   - Registry: agent registration, lookup, health check
   - Aggregator: section merging, citation dedup, confidence calculation
   - Safety: verify ranking language detection and rejection

2. **Integration Tests**
   - Full pipeline: query → classify → route → aggregate
   - Timeout handling with mock delayed agents
   - Partial failure scenarios (1 of 3 agents down)
   - Multi-intent query dispatches to multiple agents

3. **Contract Tests**
   - Agent request payload matches contract spec
   - Agent response parsing handles all fields
   - Error response parsing (AGENT_TIMEOUT, INVALID_REQUEST, etc.)

### Phase 3: UI Integration

**Goal**: Basic UI to submit queries and view orchestrated results.

- Query input form
- Real-time agent status indicators
- Formatted markdown response display
- Citation highlighting
- Agent invocation timeline visualization

## Complexity Tracking

> No constitution violations detected. All components follow YAGNI and simplicity principles.

| Decision | Rationale |
|----------|-----------|
| Keyword matching over ML classifier | Hackathon speed — sufficient for known routing rules, no model training needed |
| Python + TypeScript dual implementation | Python for Semantic Kernel / Claude integration, TypeScript for the typed orchestrator and tests |
| Flat agent registry over service discovery | Only 4 agents on known ports — no need for Consul/etcd |
| In-memory citation tracking over database | Stateless request-response model, no persistence needed |
