# Decision: Multi-Intent Dispatch Strategy

**Author:** Kaylee  
**Date:** 2026-03-05  
**Status:** Proposed  
**Tasks:** T020–T022

## Context

T020 required wiring `classifyMulti()` into the orchestrator. The key design question was how to handle `dispatchWithTiming` which takes a single `ClassifiedIntent` — but multi-intent produces multiple.

## Decision

**Primary-intent dispatch:** The orchestrator calls `classifyMulti()` to get all intents, routes each through the router to collect agents (deduplicated by id), then passes the primary (first/highest-confidence) intent to `dispatchWithTiming`. Agents self-select via `canHandle()` so the intent parameter is mainly used for the response's `intentCategory` field.

**Aggregator owns confidence:** `overallConfidence` now comes from the aggregator (average of successful agent confidences) instead of the orchestrator overriding with the classifier's confidence. This is more meaningful for multi-agent scenarios.

**Metadata expansion:** The enriched result now includes `classifiedIntents: ClassifiedIntent[]` alongside the existing `classificationResult` (which is the primary intent). Downstream consumers can inspect all detected intents.

## Alternatives Considered

- **Per-intent dispatch:** Each agent receives the specific intent it was matched against. More correct semantically but significantly more complex — would require refactoring `dispatchWithTiming` and tracking intent-to-agent mappings. Deferred until agents actually need intent-specific behavior in `execute()`.

## Team Impact

- **River:** No classifier changes needed. `classifyMulti()` works as-is.
- **Wash:** No aggregator changes needed. `DefaultAggregator` already satisfies T021/T022.
- **Zoe:** Three test mock classifiers updated with `classifyMulti` — any new test classifiers need it too.
- **All:** If agents start needing per-intent dispatch (e.g., different query parameters per intent), we'll need to revisit the dispatch strategy.
