# Project Context

- **Owner:** msftsean
- **Project:** orchestration-agent — An orchestration agent that routes user intents to specialized agents, manages an agent registry, and aggregates responses
- **Stack:** TypeScript, Node.js
- **Work Areas:** Orchestrator Core, Intent Classifier, Agent Registry, Response Aggregator, UI, Integration Testing
- **Created:** 2026-03-05

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

- **T003 (2026-03-05):** Extended `src/specs/response.ts` with `Citation`, `OrchestrationResult`, and `AgentErrorEntry` interfaces. Kept `errorCode` as `string` (not an enum import) to avoid coupling with Kaylee's parallel `agent-contract.ts` work. Existing file already had JSDoc on some fields — matched that style. All 15 tests still pass, clean `tsc --noEmit`.
- **Team Updates (Phase 1 Setup):** River pivoted IntentCategory to research domain (EXPERTISE_DISCOVERY, RESEARCH_OUTPUT, COLLABORATION_INSIGHT, POLICY_COMPLIANCE, GENERAL) with new `context` field on ClassifiedIntent. Kaylee created `src/specs/agent-contract.ts` with AgentErrorCode, AgentRequest, AgentContractResponse, AgentErrorResponse, AgentHealthResponse. Spec types contracts now aligned for orchestrator implementation.
