# Orchestration Agent Specification

**Version:** 1.0.0
**Last Updated:** 2026-03-05
**Status:** Draft
**Authors:** Engineering Team

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Capabilities](#2-capabilities)
3. [Input Schema](#3-input-schema)
4. [Output Schema](#4-output-schema)
5. [Routing Rules](#5-routing-rules)
6. [Citation Requirements](#6-citation-requirements)
7. [Error Handling](#7-error-handling)
8. [Performance Targets](#8-performance-targets)
9. [Safety Constraints](#9-safety-constraints)

---

## 1. Purpose

The Orchestration Agent serves as the central coordinator for routing research queries to a suite of specialized downstream agents. It is responsible for receiving user queries, classifying intent, dispatching work to the appropriate specialist agents, and aggregating their responses into a unified result.

### Specialist Agents

| Agent | Responsibility |
|---|---|
| **Expertise Discovery Agent** | Identifies researchers, teams, and individuals with domain expertise relevant to the query. |
| **Research Output Agent** | Retrieves publications, papers, datasets, and other scholarly outputs related to the query. |
| **Policy Compliance Agent** | Evaluates queries and results against organizational, regulatory, and ethical policy frameworks. |

### Core Responsibilities

- **Receive** structured user queries via a well-defined input schema.
- **Classify** query intent to determine which specialist agent(s) should handle the request.
- **Dispatch** work to one or more specialist agents, supporting both parallel and sequential execution strategies.
- **Aggregate** responses from multiple agents into a single, coherent result with unified citations.
- **Monitor** agent health, response times, and error rates to ensure reliable operation.

---

## 2. Capabilities

### 2.1 Intent Classification and Routing

The orchestration agent analyzes incoming queries using keyword matching and intent classification to determine the most appropriate specialist agent(s). Classification operates within a 200ms budget and supports multi-label classification for queries that span multiple agent domains.

### 2.2 Multi-Agent Orchestration

Supports two execution strategies:

- **Parallel Dispatch:** When a query maps to multiple independent agents, requests are dispatched concurrently to minimize latency. Results are collected and merged upon completion.
- **Sequential Dispatch:** When agent outputs depend on one another (e.g., expertise discovery feeds into research output filtering), requests are chained in a defined order.

### 2.3 Response Aggregation and Synthesis

Agent results are merged into a single response object. Duplicate information is deduplicated, conflicting data is flagged, and all results are attributed to their source agent with individual confidence scores.

### 2.4 Citation Management

All factual claims in aggregated responses are traced back to their source citations. The orchestration agent maintains a unified citation index across all agent responses, normalizes citation formats, and deduplicates references.

### 2.5 Error Recovery and Fallback Handling

The agent implements graceful degradation. If a specialist agent fails or times out, partial results from successful agents are still returned. Circuit breakers prevent cascading failures from unhealthy agents. Fallback routing directs queries to alternative agents when the primary target is unavailable.

### 2.6 Performance Monitoring

Runtime telemetry is collected for every request, including:

- Per-agent response latency
- Intent classification confidence scores
- Error and timeout rates
- Throughput and concurrency metrics
- Circuit breaker state transitions

---

## 3. Input Schema

All queries to the orchestration agent conform to the following TypeScript interface:

```typescript
interface OrchestrationQuery {
  /** The user's research question or request. */
  query: string;

  /** Additional context to refine routing and agent behavior. */
  context?: QueryContext;

  /** User preferences for response formatting and content. */
  preferences?: QueryPreferences;

  /** Session identifier for multi-turn conversations. */
  session_id?: string;
}

interface QueryContext {
  /** The research domain or field (e.g., "machine learning", "genomics"). */
  domain?: string;

  /** Constraints to apply to the search (e.g., date ranges, institutions). */
  constraints?: Record<string, string | number | boolean>;

  /** Results from prior queries in the same session, used for refinement. */
  prior_results?: string[];
}

interface QueryPreferences {
  /** Desired response format. Defaults to "detailed". */
  response_format?: "summary" | "detailed" | "raw";

  /** Maximum number of results to return per agent. Defaults to 10. */
  max_results?: number;

  /** Citation style for the response. Defaults to "apa". */
  citation_style?: "apa" | "mla" | "chicago" | "ieee";

  /** BCP 47 language tag for the response. Defaults to "en". */
  language?: string;
}
```

### Required Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `query` | `string` | **Yes** | The user's research question. Must be non-empty and no longer than 2000 characters. |
| `context` | `QueryContext` | No | Domain, constraints, and prior results for refined routing. |
| `preferences` | `QueryPreferences` | No | Response formatting and content preferences. |
| `session_id` | `string` | No | UUID v4 identifier linking queries in a multi-turn conversation. |

---

## 4. Output Schema

All responses from the orchestration agent conform to the following TypeScript interface:

```typescript
interface OrchestrationResponse {
  /** Unique identifier for this response (UUID v4). */
  response_id: string;

  /** Echo of the original query string for traceability. */
  query_echo: string;

  /** Markdown-formatted response with inline citations. */
  response: string;

  /** Identifiers of the specialist agents that were invoked. */
  agents_invoked: AgentId[];

  /** Array of results returned by specialist agents. */
  results: AgentResult[];

  /** Aggregated and deduplicated citations from all agent results. */
  citations: Citation[];

  /** Overall confidence score for the aggregated response (0.0 to 1.0). */
  confidence: number;

  /** Explanation of routing decisions and agent selection rationale. */
  reasoning: string;

  /** Metadata about the orchestration process. */
  metadata: ResponseMetadata;

  /** Partial failures or warnings encountered during processing. */
  errors?: OrchestrationError[];
}

type AgentId = "expertise_discovery" | "research_output" | "policy_compliance";

interface AgentResult {
  /** Identifier of the specialist agent that produced this result. */
  source_agent: AgentId;

  /** Confidence score for this result (0.0 to 1.0). */
  confidence: number;

  /** The agent's response content. */
  content: string;

  /** Structured data payload, if applicable. */
  data?: Record<string, unknown>;

  /** Indices into the top-level citations array for claims in this result. */
  citation_indices: number[];
}

interface Citation {
  /** Unique citation identifier within this response (e.g., "cite_001"). */
  id: string;

  /** Classification of the citation source (e.g., "gold_researcher", "publication", "policy_document"). */
  source_type: string;

  /** Identifier of the cited source (e.g., "krueger_bruce_k"). */
  source_id: string;

  /** List of author names. */
  authors: string[];

  /** Title of the cited work. */
  title: string;

  /** Publication year. */
  year: number;

  /** Publication venue, journal, or source name. */
  source: string;

  /** Digital Object Identifier, if available. */
  doi?: string;

  /** URL to the cited work, if available. */
  url?: string;
}

interface ResponseMetadata {
  /** Total end-to-end processing time in milliseconds. */
  processing_time_ms: number;

  /** Number of specialist agents that were called. */
  agents_called: number;

  /** List of specialist agents that were consulted. */
  agents_consulted: AgentId[];

  /** The routing decision made by the intent classifier. */
  routing_decision: RoutingDecision;

  /** ISO 8601 timestamp of when the response was generated. */
  timestamp: string;
}

interface RoutingDecision {
  /** The classified intent category. */
  intent: string;

  /** Confidence of the intent classification (0.0 to 1.0). */
  confidence: number;

  /** The routing rule that was matched. */
  matched_rule: string;

  /** Whether fallback routing was used. */
  fallback_used: boolean;
}

interface OrchestrationError {
  /** The agent or component that encountered the error. */
  source: string;

  /** Machine-readable error code. */
  code: string;

  /** Human-readable error message. */
  message: string;

  /** Whether the error is recoverable (partial results may still be available). */
  recoverable: boolean;
}
```

### Response Status Semantics

| Scenario | `results` | `errors` | HTTP Status |
|---|---|---|---|
| All agents succeed | Populated | `undefined` | `200 OK` |
| Partial agent failure | Partial | Populated | `207 Multi-Status` |
| All agents fail | Empty `[]` | Populated | `502 Bad Gateway` |
| Invalid input | Empty `[]` | Populated | `400 Bad Request` |
| Rate limited | Empty `[]` | Populated | `429 Too Many Requests` |

---

## 5. Routing Rules

### 5.1 Intent-to-Agent Mapping

The orchestration agent classifies queries into intent categories and routes them to the appropriate specialist agent(s).

| Intent Category | Trigger Keywords / Patterns | Target Agent(s) |
|---|---|---|
| **Expertise Lookup** | "who works on", "expert in", "researcher", "who studies", "specialist in", "find someone who" | Expertise Discovery |
| **Research Discovery** | "papers on", "publications", "research about", "studies on", "literature on", "findings about" | Research Output |
| **Policy Check** | "compliant with", "policy", "regulation", "allowed to", "legal", "ethical", "approved" | Policy Compliance |
| **Comparative Analysis** | "compare", "difference between", "contrast", "versus", "how does X relate to Y" | Expertise Discovery + Research Output (parallel) |
| **Compliance-Aware Research** | "publish on [topic] under [policy]", "research within guidelines" | Research Output → Policy Compliance (sequential) |

### 5.2 Routing Decision Table

```
┌─────────────────────────┬──────────────────────┬────────────────────────┬──────────────┐
│ Input Signal            │ Classification       │ Agent(s)               │ Strategy     │
├─────────────────────────┼──────────────────────┼────────────────────────┼──────────────┤
│ "who works on NLP"      │ Expertise Lookup     │ Expertise Discovery    │ Single       │
│ "papers on CRISPR"      │ Research Discovery   │ Research Output        │ Single       │
│ "is this GDPR compliant"│ Policy Check         │ Policy Compliance      │ Single       │
│ "compare X and Y"       │ Comparative Analysis │ Expertise + Research   │ Parallel     │
│ "research under policy" │ Compliance-Aware     │ Research → Policy      │ Sequential   │
│ (ambiguous / unknown)   │ Fallback             │ All agents             │ Parallel     │
└─────────────────────────┴──────────────────────┴────────────────────────┴──────────────┘
```

### 5.3 Fallback Routing

When intent classification confidence falls below **0.6**, the orchestration agent applies fallback routing:

1. **Broadcast:** Dispatch the query to all available specialist agents in parallel.
2. **Best-effort aggregation:** Merge responses and let the user assess relevance.
3. **Low-confidence flag:** Set `routing_decision.fallback_used = true` and include the classification confidence in metadata.
4. **Logging:** Emit a telemetry event for ambiguous queries to support future classifier training.

---

## 6. Citation Requirements

### 6.1 Core Rules

1. **All factual claims MUST include citations.** Any statement of fact—researcher affiliations, publication details, policy interpretations—must reference a verifiable source.
2. **No unsourced assertions.** Agent responses that contain factual claims without citations MUST be flagged with a confidence warning (`confidence < 0.5`) in the aggregated result.

### 6.2 Inline Citation Format

Use bracketed author-year notation inline:

```
Dr. Smith has published extensively on neural architecture search [Smith et al., 2024].
```

When multiple citations support a claim, list them together:

```
Recent advances in protein folding [Jumper et al., 2021; Lin et al., 2023] have
accelerated drug discovery pipelines.
```

### 6.3 Full Citation Format

Each entry in the `citations` array MUST include the following fields:

| Field | Required | Description |
|---|---|---|
| `id` | **Yes** | Unique citation identifier (e.g., `"cite-1"`). |
| `authors` | **Yes** | List of author names in "LastName, FirstName" format. |
| `title` | **Yes** | Title of the cited work. |
| `year` | **Yes** | Publication year. |
| `source` | **Yes** | Journal, conference, institutional report, or data source. |
| `doi` | No | Digital Object Identifier, if available. |
| `url` | No | Direct URL to the work, if available. |

### 6.4 Citation Validation

The orchestration agent performs the following validation on citations before including them in the response:

- **Completeness check:** All required fields must be present.
- **Deduplication:** Citations from multiple agents referencing the same work are merged into a single entry.
- **Index integrity:** All `citation_indices` in agent results must reference valid entries in the top-level `citations` array.

---

## 7. Error Handling

### 7.1 Timeout Policy

| Scope | Timeout | Behavior |
|---|---|---|
| Individual agent call | **3 seconds** | Cancel the agent call and mark as timed out. |
| Total orchestration | **5 seconds** | Return all results collected so far; mark incomplete agents as errors. |
| Intent classification | **200 milliseconds** | Fall back to keyword-based routing if classification times out. |

### 7.2 Agent Failure and Graceful Degradation

When a specialist agent fails, the orchestration agent:

1. **Returns partial results.** Successful agent responses are included in the `results` array.
2. **Reports the failure.** An `OrchestrationError` entry is added to the `errors` array with the failing agent, error code, and a human-readable message.
3. **Preserves response structure.** The response schema remains valid regardless of how many agents fail.

### 7.3 Retry Policy

| Parameter | Value |
|---|---|
| Maximum retries | **2** |
| Backoff strategy | Exponential with jitter |
| Initial delay | 100ms |
| Maximum delay | 1 second |
| Retryable errors | Timeouts, 5xx responses, connection resets |
| Non-retryable errors | 4xx responses, validation failures |

### 7.4 Circuit Breaker

A circuit breaker is implemented per specialist agent to prevent cascading failures:

| State | Condition | Behavior |
|---|---|---|
| **Closed** | Normal operation | Requests are forwarded to the agent. |
| **Open** | Failure rate exceeds **50%** over a **60-second** sliding window (minimum 10 requests) | Requests are immediately failed without calling the agent. An `OrchestrationError` with code `CIRCUIT_OPEN` is returned. |
| **Half-Open** | After a **30-second** cooldown period | A single probe request is sent. If it succeeds, the circuit closes. If it fails, the circuit reopens. |

### 7.5 Rate Limiting and Backpressure

- **Inbound rate limit:** 100 requests per second per client, enforced via token bucket.
- **Queue depth:** Maximum 500 pending requests. Requests beyond this limit receive `429 Too Many Requests`.
- **Backpressure signal:** When queue depth exceeds 80% capacity (400 requests), the agent begins shedding low-priority requests and returns a `Retry-After` header.

---

## 8. Performance Targets

### 8.1 Latency

| Metric | Target | Percentile |
|---|---|---|
| End-to-end response time | **< 5 seconds** | p95 |
| End-to-end response time | **< 2 seconds** | p50 |
| Individual agent response | **< 3 seconds** | p95 |
| Individual agent response | **< 1 second** | p50 |
| Intent classification | **< 200 milliseconds** | p99 |

### 8.2 Throughput

| Metric | Target |
|---|---|
| Concurrent requests | **≥ 100** |
| Sustained throughput | **≥ 50 requests/second** |
| Burst throughput | **≥ 200 requests/second** (for up to 10 seconds) |

### 8.3 Availability

| Metric | Target |
|---|---|
| Uptime | **99.9%** (≤ 8.76 hours downtime/year) |
| Mean time to recovery (MTTR) | **< 5 minutes** |
| Planned maintenance windows | **< 4 hours/month**, scheduled during off-peak hours |

### 8.4 Observability

The following metrics MUST be emitted for every request:

- `orchestration.request.duration_ms` — Total request duration.
- `orchestration.agent.<name>.duration_ms` — Per-agent call duration.
- `orchestration.intent.classification_ms` — Intent classification latency.
- `orchestration.intent.confidence` — Classification confidence score.
- `orchestration.circuit_breaker.<name>.state` — Circuit breaker state per agent.
- `orchestration.errors.count` — Error count by type and source.

---

## 9. Safety Constraints

### 9.1 Prohibited Language

The orchestration agent and all specialist agents MUST NOT use ranking or superlative language when describing researchers or experts. The following patterns are explicitly prohibited:

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

### 9.5 Content Filtering

The orchestration agent applies content filtering at both the input and output stages:

- **Input filtering:** Queries that attempt to elicit harmful, biased, or discriminatory outputs are rejected with error code `CONTENT_POLICY_VIOLATION`.
- **Output filtering:** Agent responses are scanned for biased language, unsupported claims, and prohibited content patterns before aggregation.
- **Audit logging:** All filtered content events are logged for review, including the original content, the filter rule triggered, and the action taken.

---

*End of specification.*
