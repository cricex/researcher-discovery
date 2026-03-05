# Orchestration Agent — Technical Documentation

**Version:** 2.0.0
**Last Updated:** 2026-03-05
**Status:** Implementation Complete (71/71 tests passing)
**Authors:** Engineering Team (Kaylee, River, Wash, Zoe, Mal)

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Architecture](#2-architecture)
3. [Routing Rules](#3-routing-rules)
4. [Multi-Intent Classification](#4-multi-intent-classification)
5. [Error Handling](#5-error-handling)
6. [Citation Pipeline](#6-citation-pipeline)
7. [Safety Filter](#7-safety-filter)
8. [Structured Logging](#8-structured-logging)
9. [Safety Constraints](#9-safety-constraints)

---

## 1. Getting Started

### Prerequisites

- Node.js (LTS recommended)
- npm

### Install

```bash
git clone <repo-url>
cd orchestration-agent
npm install
```

### Run Tests

```bash
npm test          # Run all tests (vitest, exits on completion)
npm run test:watch  # Watch mode for development
```

All 71 tests should pass. Tests are located in `tests/` and mirror the source directory structure:

```
tests/
  orchestrator/     # Pipeline integration tests
  classifier/       # Intent classifier tests
  agents/           # Agent registry and HTTP client tests
  aggregator/       # Response aggregator tests
  integration/      # End-to-end pipeline tests
  helpers.ts        # Shared test factories (createStubAgent, createTestIntent, etc.)
```

### Type Check

```bash
npm run typecheck  # tsc --noEmit — full type checking without emitting files
npm run build      # tsc — compile TypeScript to JavaScript
```

### Start the Pipeline

The orchestrator is a TypeScript library. Wire it up programmatically:

```typescript
import { Orchestrator } from './src/orchestrator/orchestrator.js';
import { DefaultClassifier } from './src/orchestrator/classifier/classifier.js';
import { DefaultAggregator } from './src/orchestrator/aggregator/aggregator.js';
// + your IntentRouter implementation

const orchestrator = new Orchestrator(
  new DefaultClassifier(),
  router,
  new DefaultAggregator(),
  { perAgentTimeoutMs: 5000 }  // production timeout
);

const result = await orchestrator.process("Find experts in autism research");
```

A FastAPI backend is also available at `src/api/main.py` for HTTP access (see the [Integration Guide](./INTEGRATION_GUIDE.md)).

---

## 2. Architecture

### 4-Stage Pipeline

The orchestrator (`src/orchestrator/orchestrator.ts`) implements a linear pipeline. Each stage is defined as an interface in `src/specs/pipeline.ts` and is independently testable.

```
User Input (string)
       │
       ▼
┌─────────────┐
│  Classify    │  IntentClassifier.classifyMulti(input)
│              │  → ClassifiedIntent[]
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Route      │  IntentRouter.route(intent) per intent
│              │  → Agent[] (deduplicated by id)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Dispatch    │  Promise.allSettled with AbortController timeouts
│              │  → AgentResponse[] + errors + timings
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Aggregate   │  ResponseAggregator.aggregate(intent, responses, context)
│              │  → AggregatedResponse enriched with OrchestrationResult fields
└─────────────┘
```

### IntentCategory Enum

Defined in `src/specs/intent.ts`. This is the shared vocabulary for all classification and routing.

| Enum Value | String Value | Description |
|---|---|---|
| `EXPERTISE_DISCOVERY` | `expertise_discovery` | Find researchers, faculty, and domain experts |
| `RESEARCH_OUTPUT` | `research_output` | Retrieve publications, papers, and datasets |
| `COLLABORATION_INSIGHT` | `collaboration_insight` | Discover collaborators, funding, and partnerships |
| `POLICY_COMPLIANCE` | `policy_compliance` | Evaluate regulatory, ethical, and policy frameworks |
| `GENERAL` | `general` | Fallback for unclassified queries |

### Agent Endpoints

Configured in `src/agents/endpoints.ts`. Each agent runs as an independent HTTP service.

| Agent | Port | API URL | Health URL | Default Timeout |
|---|---|---|---|---|
| Expertise Discovery | 5001 | `http://localhost:5001/api/v1/expertise` | `http://localhost:5001/health` | 5000ms |
| Research Output | 5002 | `http://localhost:5002/api/v1/research` | `http://localhost:5002/health` | 5000ms |
| Policy Compliance | 5003 | `http://localhost:5003/api/v1/policy` | `http://localhost:5003/health` | 5000ms |

### Key Source Files

| File | Owner | Purpose |
|---|---|---|
| `src/specs/intent.ts` | Shared | `IntentCategory` enum, `ClassifiedIntent` interface |
| `src/specs/response.ts` | Shared | `AgentResponse`, `AggregatedResponse`, `Citation`, `OrchestrationResult` |
| `src/specs/pipeline.ts` | Shared | Pipeline stage interfaces |
| `src/specs/agent-contract.ts` | Shared | HTTP wire-format types for agent communication |
| `src/orchestrator/orchestrator.ts` | Kaylee | Main pipeline wiring |
| `src/orchestrator/classifier/classifier.ts` | River | Keyword-based intent classifier |
| `src/orchestrator/classifier/routing-rules.ts` | River | Keyword → category mapping |
| `src/orchestrator/aggregator/aggregator.ts` | Wash | Response merging, citation extraction, coverage scoring |
| `src/orchestrator/aggregator/safety-filter.ts` | Wash | FR-007 ranking language sanitizer |
| `src/agents/endpoints.ts` | Kaylee | Agent endpoint configurations |
| `src/agents/client.ts` | Kaylee | HTTP agent client (fetch + camelCase↔snake_case) |
| `src/agents/http-agent.ts` | Kaylee | `HttpAgent` adapter wrapping endpoint config |
| `src/agents/registry.ts` | Kaylee | Agent registry with `registerEndpoint()` / `registerDefaults()` |
| `src/ui/index.ts` | Wash | Markdown rendering (`formatOrchestrationResult`) |

---

## 3. Routing Rules

### Keyword Mapping

Defined in `src/orchestrator/classifier/routing-rules.ts`. The classifier performs **case-insensitive substring matching** against these keyword lists.

| IntentCategory | Keywords |
|---|---|
| `EXPERTISE_DISCOVERY` | `who works on`, `expertise in`, `researchers`, `faculty`, `specializes in`, `expert in`, `potential` |
| `RESEARCH_OUTPUT` | `publications about`, `papers on`, `published`, `research on`, `studies` |
| `COLLABORATION_INSIGHT` | `collaborators`, `collaboration`, `funding`, `grants`, `partnerships` |
| `POLICY_COMPLIANCE` | `compliance`, `policy`, `regulations`, `IRB`, `ethics`, `guidelines` |
| `GENERAL` | *(no keywords — fallback only)* |

### Classification Logic

1. The input string is lowercased.
2. Each category's keyword list is checked for substring matches.
3. Any match gives that category a confidence of **0.9**.
4. The category with the highest confidence wins.
5. If **no keywords match**, the classifier falls back to `EXPERTISE_DISCOVERY` with confidence **0.1**.

### Fallback Behavior

When no keywords match any category, the classifier returns `EXPERTISE_DISCOVERY` as the default. This ensures every query gets routed to at least one agent. The low confidence (0.1) signals that the classification is a fallback.

---

## 4. Multi-Intent Classification

### How It Works

The orchestrator calls `classifyMulti(input)` instead of `classify(input)`. This method returns **all** intent categories that have keyword matches, sorted by confidence (descending).

```typescript
// Example: "Find collaborators and check compliance guidelines"
// Returns: [
//   { category: COLLABORATION_INSIGHT, confidence: 0.9, ... },
//   { category: POLICY_COMPLIANCE, confidence: 0.9, ... }
// ]
```

### Agent Deduplication

When multiple intents match, the orchestrator routes each intent through the router independently and collects all matched agents. Agents are **deduplicated by id** using a `Map<string, Agent>` — each agent is dispatched at most once, regardless of how many intents matched it.

### Primary Intent

The first (highest-confidence) intent is designated as the **primary intent**. It is passed to `dispatchWithTiming` and used for the response's `intentCategory` field. Agents self-select via `canHandle()`, so the primary intent is mainly for metadata purposes.

### Metadata

The enriched result includes:

- `metadata.classifiedIntents: ClassifiedIntent[]` — all detected intents
- `metadata.classificationResult: ClassifiedIntent` — the primary intent

---

## 5. Error Handling

### Per-Agent Timeouts

Each agent call is wrapped with an `AbortController` and `Promise.race`:

```
agent.execute(intent, context)  vs  setTimeout(reject, timeoutMs)
```

- **Test/demo default:** `150ms` (set via `OrchestratorOptions.perAgentTimeoutMs`)
- **Production recommended:** `5000ms`
- Timed-out agents receive error code `AGENT_TIMEOUT`
- Non-timeout failures receive error code `INTERNAL_ERROR`

### Graceful Degradation

The orchestrator always returns a valid response, even when agents fail:

- **Partial results:** Successful agent responses are included; failed agents get `status: 'error'` entries in the responses array.
- **Warnings:** Human-readable degradation notes are added to `warnings[]` (e.g., `"2 agent(s) failed or were unavailable. Returning partial results."`).
- **Empty results:** Agents that return `status: 'success'` with empty content generate a warning.

### Post-Dispatch Validation

After dispatch, the orchestrator checks for:

- **Negative confidence:** Agents returning `confidence < 0` are flagged with `INVALID_RESPONSE` error code.
- **Empty content:** Agents with `status: 'success'` but empty `content` produce a warning.

### Status Determination

The orchestrator overrides the aggregator's status with its own determination:

| Condition | Status | Behavior |
|---|---|---|
| All agents succeed (or no agents matched) | `"success"` | Normal response |
| Some agents fail | `"partial"` | Partial results + warnings |
| All agents fail | `"error"` | `mergedContent` replaced with fallback: *"All agents failed to respond. Please try again later."* |

### Error Shape

Each error is an `AgentErrorEntry`:

```typescript
interface AgentErrorEntry {
  agentId: string;       // Which agent failed
  errorCode: string;     // "AGENT_TIMEOUT" | "INTERNAL_ERROR" | "INVALID_RESPONSE"
  message: string;       // Human-readable description
}
```

### Metadata

- `metadata.timedOutAgents: string[]` — IDs of agents that hit the timeout
- `metadata.agentTimings: Record<string, number>` — wall-clock ms per agent (captured for both success and failure)

---

## 6. Citation Pipeline

### Citation Extraction

Citations are extracted from three sources (checked in order for each agent response):

1. **`<cite>` tags in content:** Regex `/<cite>([^<]+)<\/cite>/g` extracts inline citations. The inner text is parsed by splitting on the first underscore: `sourceType_sourceId`.
2. **JSON-embedded citations:** If agent content is valid JSON with a `citations` array, each entry is captured with `sourceType: 'url'`.
3. **Metadata citations:** If `response.metadata.citations` is an array, each entry is captured with `sourceType: 'url'`.

All citations are deduplicated by their `raw` string using a `Set`.

### Citation Shape

```typescript
interface Citation {
  raw: string;         // Full citation string (e.g., "<cite>gold_krueger_bruce_k</cite>")
  sourceType: string;  // Extracted type (e.g., "gold", "openalex", "url")
  sourceId: string;    // Extracted ID (e.g., "krueger_bruce_k")
}
```

### Coverage Scoring

The aggregator (`DefaultAggregator`) calculates `citationCoverage` as a ratio:

```
citationCoverage = citedFactualSentences / totalFactualSentences
```

A sentence is considered **factual** if it contains:
- Numbers (`\d+`)
- Proper nouns (capitalized words after the first word)
- `<cite>` tags

A factual sentence is **cited** if it contains a `<cite>` tag.

### Uncited-Claim Warnings

When `citationCoverage < 1.0`, a warning is added to the result:

```
"Citation coverage is 67% — some factual claims are uncited"
```

### Metadata Fields

- `metadata.citationCount: number` — number of deduplicated citations
- `metadata.citationCoverage: number` — 0.0–1.0 coverage ratio

---

## 7. Safety Filter

### FR-007: Prohibited Ranking Language

Defined in `src/orchestrator/aggregator/safety-filter.ts`. The `sanitizeRankingLanguage()` function scans agent content for superlative/ranking adjectives and neutralizes them.

### Prohibited Words

```typescript
const PROHIBITED_RANKING_WORDS = [
  'best', 'top', 'leading', 'foremost',
  'premier', 'preeminent', 'renowned', 'distinguished'
];
```

### How It Works

1. The filter matches prohibited words followed by another word (potential adjective+noun pattern).
2. **Context-aware exceptions** prevent false positives:
   - Prepositions after the word (e.g., "best of", "top of") → not flagged
   - "top" preceded by a preposition (e.g., "on top of") → not flagged
   - "leading" preceded by auxiliary verbs (e.g., "is leading to") → not flagged
3. Flagged superlatives are **neutralized** by removing the prohibited word and inserting an article if needed:
   - `"the best researcher"` → `"the researcher"`
   - `"Best researcher"` (start of sentence) → `"The researcher"`

### Integration

The safety filter runs in the aggregator (`DefaultAggregator.aggregate()`) **before** section building and citation extraction. For each non-error agent response with content:

1. `sanitizeRankingLanguage(content)` is called
2. If violations are found, the content is replaced with the sanitized version
3. Violations are collected into `metadata.safetyViolations: string[]`
4. A `console.warn` is emitted for audit trail

---

## 8. Structured Logging

All pipeline stages emit structured JSON logs via `console.info` (or `console.warn` for safety violations). Each log entry includes a `requestId` for request correlation.

### Log Events

| Event | Stage | Key Fields |
|---|---|---|
| `classify` | Classification | `primaryCategory`, `primaryConfidence`, `intentsCount`, `keywordsMatched` |
| `classify_multi` | Classification (classifier-level) | `intentsDetected`, `fallback`, `categories[]` |
| `route` | Routing | `agentsMatched[]`, `agentCount` |
| `dispatch` | Dispatch (per agent) | `agentId`, `durationMs`, `success`, `errorCode` |
| `aggregate` | Aggregation | `sectionsCount`, `citationCount`, `overallConfidence`, `status`, `processingTimeMs` |

### Example Log Output

```json
{"event":"classify","requestId":"a1b2c3","primaryCategory":"expertise_discovery","primaryConfidence":0.9,"intentsCount":2,"keywordsMatched":["researchers"]}
{"event":"route","requestId":"a1b2c3","agentsMatched":["Expertise Discovery","Research Output"],"agentCount":2}
{"event":"dispatch","requestId":"a1b2c3","agentId":"expertise_discovery","durationMs":45,"success":true,"errorCode":null}
{"event":"dispatch","requestId":"a1b2c3","agentId":"research_output","durationMs":120,"success":true,"errorCode":null}
{"event":"aggregate","requestId":"a1b2c3","sectionsCount":2,"citationCount":5,"overallConfidence":0.85,"status":"success","processingTimeMs":132}
```

---

## 9. Safety Constraints

### 9.1 Prohibited Language

The orchestration agent and all specialist agents MUST NOT use ranking or superlative language when describing researchers or experts. The safety filter (see [Section 7](#7-safety-filter)) automatically neutralizes these patterns.

| Prohibited | Acceptable Alternative |
|---|---|
| "best researcher" | "active researcher in" |
| "top expert" | "has published on" |
| "#1 in the field" | "works in the area of" |
| "leading authority" | "has contributed to" |
| "most cited" | "frequently cited in the context of" |
| "foremost" | "recognized contributor to" |
| "preeminent" | "established researcher in" |

### 9.2 Neutral Descriptors

All descriptions of individuals MUST use neutral, fact-based language:

- ✅ "Dr. Chen is active in the field of computational biology and has published 12 papers on protein folding since 2020."
- ❌ "Dr. Chen is the top expert in computational biology and the leading researcher in protein folding."

### 9.3 Personal Information Boundaries

- **Permitted:** Professional affiliations, published works, publicly available research profiles, institutional email addresses listed on public faculty pages.
- **Prohibited:** Personal contact information, home addresses, private social media accounts, health information, political affiliations, or any data not directly related to professional research activities.

### 9.4 Grounding and Verifiability

- All responses MUST be grounded in verifiable data sources (publications, institutional records, public databases).
- Speculative claims about a researcher's future work, capabilities, or potential are prohibited.
- If insufficient data exists to answer a query, the agent MUST state this explicitly rather than generating plausible but unverified content.

---

*End of documentation.*
