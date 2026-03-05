# Project Context

- **Owner:** msftsean
- **Project:** orchestration-agent — An orchestration agent that routes user intents to specialized agents, manages an agent registry, and aggregates responses
- **Stack:** TypeScript, Node.js
- **Work Areas:** Orchestrator Core, Intent Classifier, Agent Registry, Response Aggregator, UI, Integration Testing
- **Created:** 2026-03-05

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### 2026-03-05 — Integration & Demo Documentation

- **Integration guide:** Created `docs/INTEGRATION_GUIDE.md` documenting the agent contract for Teams 1, 2, 3. Covers POST endpoint format, request/response structure, error codes, health checks, and performance requirements. Cross-referenced with actual contract spec at `specs/001-orchestration-agent/contracts/agent-contract-spec.md` to ensure accuracy. Includes testing checklist and FAQ.
- **Demo script:** Created `docs/DEMO_SCRIPT.md` with 6-minute demo flow covering problem statement (45s), architecture overview (1m), live query execution (2.5m), technical deep dive (1m), and impact summary (45s). Includes pre-demo setup checklist, backup plans, test queries, and troubleshooting guide.
- **Key contracts documented:** Agent request format (query, context, options), response format (agent, timestamp, results, citations, metadata), health check endpoint, timeout requirements (5s max), and error codes (AGENT_TIMEOUT, INVALID_REQUEST, NO_RESULTS, INTERNAL_ERROR).
- **Wave 1 Cross-Team (2026-03-05T20:30):** B6/B7 documentation synthesizes Wave 1 parallel track outputs: Kaylee's B1 FastAPI backend architecture, Wash's B2/B3 React frontend, River's T010 classifier tests, and Zoe's T011/T012 integration tests. `INTEGRATION_GUIDE.md` enables developer onboarding across all components. `DEMO_SCRIPT.md` provides end-to-end test scenarios for validation and regression testing. Mal's docs complete the demonstration layer for Wave 1 dual-track execution.

### 2026-03-05 — Initial Architecture Scaffold

- **Pattern:** Pipeline architecture — classify → route → dispatch → aggregate. Each stage is an interface in `src/specs/pipeline.ts`, wired together by `src/orchestrator/orchestrator.ts`.
- **Shared contracts:** All types live in `src/specs/` — `intent.ts`, `agent.ts`, `response.ts`, `pipeline.ts`. Single source of truth. Every component imports from here.
- **Agent contract:** `Agent` interface requires `id`, `name`, `capabilities`, `canHandle()`, and `execute()`. Registered via `AgentRegistry` in `src/agents/registry.ts`.
- **Dispatch strategy:** `Promise.allSettled` for concurrent agent execution with graceful failure handling.
- **Module system:** ESM with Node16 resolution, `.js` extensions in imports. Vitest for testing.
- **Key paths:**
  - `src/specs/` — shared types/interfaces (the contract layer)
  - `src/orchestrator/orchestrator.ts` — main pipeline
  - `src/orchestrator/classifier/` — intent classification (River)
  - `src/orchestrator/aggregator/` — response merging (Wash)
  - `src/orchestrator/router.ts` — intent → agent routing
  - `src/agents/registry.ts` — agent registration/discovery (Kaylee)
  - `src/ui/` — user-facing interface (Wash)
- **Legacy stubs:** `src/classifier/` and `src/aggregator/` (top-level) re-export from canonical locations under `src/orchestrator/`. Don't add code there.
- **Decision record:** `.squad/decisions.md` (merged from inbox)
- **Team update:** Zoe has set up CI/CD pipeline and test infrastructure. All tests passing. Ready to build features in parallel.
