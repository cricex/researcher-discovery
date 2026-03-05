# Decision: Spec Document Pivot from Aspirational to Implementation-Accurate

**Author:** Kaylee
**Date:** 2026-03-05
**Status:** Proposed

## Context

The original `docs/orchestration-agent-spec.md` was a draft design specification with aspirational features (circuit breakers, retry policies, rate limiting, sequential dispatch) that were never implemented. With all 71 tests passing, the implementation is complete and the spec needed to reflect reality.

## Decision

Rewrote `orchestration-agent-spec.md` as implementation-accurate technical documentation. Removed aspirational sections (circuit breakers, retry policies, rate limiting, sequential dispatch, detailed input/output schemas with fields like `citation_style` that don't exist). Replaced with documentation of what actually exists in the codebase: multi-intent classification, AbortController timeouts, citation coverage scoring, FR-007 safety filtering, structured JSON logging.

## Team Impact

- **All:** The spec is now a reliable reference for how the system actually works, not a wishlist. If aspirational features are needed later, they should be tracked as separate issues.
- **Wash:** INTEGRATION_GUIDE.md now mentions the safety filter and citation format requirements — agent teams should be aware.
- **Mal:** The old spec's input/output schemas (OrchestrationQuery, QueryPreferences, etc.) were removed since they don't match the actual TypeScript interfaces. The real interfaces are documented inline from `src/specs/`.
