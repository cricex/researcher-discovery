# Orchestration Agent Constitution

## Core Principles

### I. Citation-First (NON-NEGOTIABLE)

Every factual claim produced by any agent MUST have a traceable citation. Uncited facts trigger a warning in logs and are flagged in the response. Citation format: `<cite>source_type_source_id</cite>`. Valid source types: `gold_researcher`, `openalex`, `nih_reporter`, `umb_policy`.

### II. Safety-First Language

- **NO ranking language**: "best", "top", "ranked", "leading" are prohibited in all agent outputs.
- **NO faculty evaluation**: "excellent researcher", "poor performance", or any subjective quality judgments.
- **NO non-public data**: SSN, salary, private communications, or any personally identifiable information beyond professional context.
- All responses must use neutral descriptors: "active in", "has published on", "works in the area of".

### III. Graceful Degradation

The orchestration agent must always return a response. Partial results are preferred over total failure. If an agent times out or fails, continue with remaining agents and include error context in the response.

### IV. Multi-Agent Coordination

Queries may invoke one or more specialist agents in parallel. The orchestrator classifies intent, dispatches to the appropriate agents, and aggregates results into a unified response with deduplicated citations.

### V. Simplicity and Speed

Start simple, avoid over-engineering. Hackathon velocity — working software over comprehensive documentation. YAGNI principles apply.

## Routing Rules

| Query Pattern | Agent(s) | Confidence |
|---|---|---|
| "who works on", "expertise in", "researchers" | Expertise Discovery | High |
| "publications", "papers", "research output" | Research Output | High |
| "grants", "funding", "NIH" | Research Output | High |
| "collaborate", "team", "partners" | Collaboration Insight | High |
| "policy", "compliance", "IRB", "COI" | Policy Compliance | High |
| Multi-intent (e.g., "collaborators AND funding") | Multiple agents | High |

## Citation Requirements

- **Mandatory**: Every factual claim MUST have a citation.
- **Format**: `<cite>source_type_source_id</cite>`
- **Source Types**: `gold_researcher`, `openalex`, `nih_reporter`, `umb_policy`
- **Validation**: Uncited facts trigger warning in logs.

## Error Handling

| Scenario | Action |
|---|---|
| Agent timeout (5s) | Continue with partial results, log warning |
| Empty response | Exclude from aggregation, try next agent |
| All agents fail | Return user-friendly error message with suggestions |
| Malformed data | Validate schema, retry once, then fallback to mock |

## Performance Requirements

| Metric | Target |
|---|---|
| Single-agent query | < 3 seconds |
| Multi-agent query | < 5 seconds |
| Concurrent queries supported | 10+ |

## Safety Constraints

- **NO ranking language**: "best", "top", "ranked", "leading"
- **NO faculty evaluation**: "excellent researcher", "poor performance"
- **NO non-public data**: SSN, salary, private communications
- **Citations MANDATORY**: All facts must be traceable

## Governance

This constitution supersedes all other development practices for the Orchestration Agent project. Amendments require documented rationale and team approval. All PRs and code reviews must verify compliance with these principles — particularly citation requirements and safety constraints.

**Version**: 1.0.0 | **Ratified**: 2026-03-05 | **Last Amended**: 2026-03-05
