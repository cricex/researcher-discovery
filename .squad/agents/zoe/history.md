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
