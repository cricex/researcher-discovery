# Project Context

- **Owner:** msftsean
- **Project:** orchestration-agent — An orchestration agent that routes user intents to specialized agents, manages an agent registry, and aggregates responses
- **Stack:** TypeScript, Node.js
- **Work Areas:** Orchestrator Core, Intent Classifier, Agent Registry, Response Aggregator, UI, Integration Testing
- **Created:** 2026-03-05

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

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
