# Squad Decisions

## Active Decisions

### 1. Architecture Decision: Initial Project Structure

**Author:** Mal  
**Date:** 2026-03-05  
**Status:** Accepted

#### Context

We need a scaffolded TypeScript project that lets Kaylee, River, and Wash start building in parallel without stepping on each other. The system routes user intents to specialized agents and merges their responses.

#### Decisions

##### 1.1 Shared Contracts First (`src/specs/`)

All types, interfaces, and enums live in `src/specs/`. Every component imports from here. Nobody defines their own `AgentResponse` or `ClassifiedIntent` — there's one source of truth.

**Files:**
- `intent.ts` — `IntentCategory` enum, `ClassifiedIntent` interface
- `agent.ts` — `Agent`, `AgentCapability`, `ExecutionContext` interfaces
- `response.ts` — `AgentResponse`, `AggregatedResponse`, `ResponseStatus`
- `pipeline.ts` — `IntentClassifier`, `IntentRouter`, `AgentDispatcher`, `ResponseAggregator`, `OrchestratorPipeline` interfaces

##### 1.2 Pipeline Pattern: classify → route → dispatch → aggregate

The orchestrator (`src/orchestrator/orchestrator.ts`) is a pipeline with four stages. Each stage is an interface in `src/specs/pipeline.ts`. The Orchestrator class wires them together but delegates all real work.

- **Classifier** receives raw string, returns `ClassifiedIntent`
- **Router** receives intent, queries registry, returns `Agent[]`
- **Dispatcher** fans out intent to agents concurrently via `Promise.allSettled`
- **Aggregator** merges `AgentResponse[]` into `AggregatedResponse`

##### 1.3 Component Ownership

| Component | Location | Owner |
|---|---|---|
| Shared contracts | `src/specs/` | Mal (reviewed by all) |
| Orchestrator core | `src/orchestrator/orchestrator.ts` | Mal / Kaylee |
| Intent classifier | `src/orchestrator/classifier/` | River |
| Agent registry | `src/agents/` | Kaylee |
| Response aggregator | `src/orchestrator/aggregator/` | Wash |
| Router | `src/orchestrator/router.ts` | Kaylee |
| UI | `src/ui/` | Wash |

##### 1.4 Agent Interface Contract

Any agent must implement `Agent` from `src/specs/agent.ts`:
- `id` and `name` (readonly)
- `capabilities: AgentCapability[]` — declares what intents it handles
- `canHandle(intent)` — fast boolean check
- `execute(intent, context)` — async, returns `AgentResponse`

##### 1.5 IntentCategory is an Enum, Not a String

Using an enum (`IntentCategory`) instead of free-form strings. Catches typos at compile time. New categories require a conscious change to the shared contract.

##### 1.6 Concurrent Dispatch with Graceful Failure

`Promise.allSettled` for agent dispatch. If one agent throws, others still return. Failed agents get `status: 'error'` in the response array. Aggregator decides what to do with mixed results.

##### 1.7 Vitest for Testing, Node16 Module Resolution

Kept the existing vitest setup. Using `"module": "Node16"` with `.js` extensions in imports (standard ESM). Tests go in `tests/`.

##### 1.8 Legacy Stubs Redirected

Pre-existing stubs at `src/classifier/` and `src/aggregator/` (wrong locations) now re-export from the canonical `src/orchestrator/classifier/` and `src/orchestrator/aggregator/`. This prevents import confusion.

#### What's NOT Decided Yet

- How the classifier actually works (NLP strategy — River's call)
- Aggregation strategy beyond simple concatenation (Wash's call)
- Agent lifecycle management (health checks, timeouts — future work)
- UI technology choice (Wash's call)
- Persistence / state management

---

### 2. CI/CD Setup Decisions

**Author:** Zoe (Tester / DevOps)  
**Date:** 2026-03-05  
**Status:** Active

#### Test Runner: Vitest

**Decision:** Use Vitest as the project test runner.

**Why:**
- Native TypeScript support — no extra transpile config needed
- Fast execution (15 tests in <1s)
- Modern, actively maintained, aligned with the Vite ecosystem
- Great DX: watch mode, clear error output, built-in assertions
- Node.js built-in test runner was the alternative, but lacks native TS support without `--experimental-strip-types` flags that add friction

#### CI Workflow

**Decision:** Single `build-and-test` job with three quality gates:
1. `npm ci` — reproducible installs from lockfile
2. `npx tsc --noEmit` — full type checking (catches type errors the test runner won't)
3. `npx vitest run` — run all tests

**Triggers:** Push to `main`/`dev`/`insider`, PRs to `dev`/`preview`/`main`/`insider`.

**Caching:** npm cache via `actions/setup-node` cache option for fast installs.

#### Test Structure

**Decision:** Mirror source directory structure under `tests/`:
- `tests/orchestrator/` — orchestrator pipeline tests
- `tests/classifier/` — intent classifier tests
- `tests/agents/` — agent registry tests
- `tests/aggregator/` — response aggregator tests
- `tests/integration/` — end-to-end pipeline tests
- `tests/helpers.ts` — shared test factories and fixtures

**Why:** Keeps tests colocated with the areas they test. Integration tests are separate because they cross component boundaries.

#### Test Helpers Pattern

**Decision:** Centralize test factories in `tests/helpers.ts`:
- `createStubAgent()` — creates a full Agent implementation for testing
- `createTestIntent()` — creates a ClassifiedIntent with defaults
- `createTestContext()` — creates an ExecutionContext with defaults

**Why:** The spec interfaces (Agent, ClassifiedIntent, etc.) require multiple fields. Factories prevent test boilerplate and ensure consistency.

#### Package.json Scripts

- `npm test` → `vitest run` (CI-friendly, exits after running)
- `npm run test:watch` → `vitest` (dev-friendly, watches for changes)
- `npm run typecheck` → `tsc --noEmit`
- `npm run build` → `tsc`

---

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
