# Feature Specification: Orchestration Agent

**Feature Branch**: `001-orchestration-agent`
**Created**: 2026-03-05
**Status**: Draft
**Input**: Hackathon project — orchestration agent that routes research queries to specialized agents

## User Scenarios & Testing

### User Story 1 — Single-Agent Query Routing (Priority: P1)

A researcher submits a natural language query about expertise (e.g., "who works on autism research?"). The orchestrator classifies the intent, routes to the Expertise Discovery agent, and returns results with citations.

**Why this priority**: Core routing is the foundational capability — nothing else works without it.

**Independent Test**: Submit "who works on autism research?" and verify the response includes researcher matches with `<cite>gold_researcher_*</cite>` citations.

**Acceptance Scenarios**:

1. **Given** a query containing "who works on", **When** submitted to the orchestrator, **Then** the Expertise Discovery agent is invoked and results include researcher names and citations.
2. **Given** a query containing "publications about", **When** submitted, **Then** the Research Output agent is invoked and results include publication titles and years.

---

### User Story 2 — Multi-Agent Query (Priority: P1)

A researcher submits a complex query that spans multiple domains (e.g., "Summarize potential collaborators, funding opportunities, and compliance steps for autism neurobiology research"). The orchestrator invokes multiple agents in parallel and aggregates results.

**Why this priority**: Multi-agent coordination is the key differentiator of this orchestrator.

**Independent Test**: Submit the multi-intent query and verify response contains sections from Expertise, Research, and Policy agents, all within 5 seconds.

**Acceptance Scenarios**:

1. **Given** a multi-intent query, **When** submitted, **Then** multiple agents are invoked in parallel and results are aggregated into sections.
2. **Given** a multi-intent query where one agent times out, **When** submitted, **Then** partial results from successful agents are returned with a warning.

---

### User Story 3 — Error Handling and Graceful Degradation (Priority: P2)

When an agent is unavailable or times out, the orchestrator returns partial results from the remaining agents with clear error context.

**Why this priority**: Reliability is critical for demo credibility, but basic routing must work first.

**Independent Test**: Shut down one agent endpoint, submit a multi-agent query, and verify partial results are returned with error metadata.

**Acceptance Scenarios**:

1. **Given** an agent that is offline, **When** a query routes to it, **Then** the response includes results from other agents and an error entry for the failed agent.
2. **Given** all agents timeout, **When** a query is submitted, **Then** a user-friendly error message is returned.

---

### User Story 4 — Citation Traceability (Priority: P2)

Every factual claim in the orchestrated response includes a citation in `<cite>source_type_source_id</cite>` format, and uncited claims are flagged.

**Why this priority**: Citation integrity is a constitutional requirement.

**Independent Test**: Submit a query and verify every fact in the response has an inline citation.

**Acceptance Scenarios**:

1. **Given** an agent response with citations, **When** aggregated, **Then** all citations are deduplicated and included in the response.
2. **Given** an agent response missing citations, **When** aggregated, **Then** a confidence warning is added to the response metadata.

---

### Edge Cases

- What happens when the query matches no intent patterns? → Default to Expertise Discovery.
- What happens when context includes invalid `golden_record_ids`? → Agents should return empty results, not errors.
- What happens when two agents return conflicting information? → Include both with citations; do not adjudicate.

## Requirements

### Functional Requirements

- **FR-001**: System MUST classify query intent using keyword matching against routing rules.
- **FR-002**: System MUST support parallel invocation of multiple specialist agents.
- **FR-003**: System MUST aggregate responses from multiple agents into a unified markdown response.
- **FR-004**: System MUST include `<cite>source_type_source_id</cite>` citations for all factual claims.
- **FR-005**: System MUST handle agent timeouts (5s max) with graceful degradation.
- **FR-006**: System MUST return structured metadata including processing time and agents called.
- **FR-007**: System MUST NOT use ranking language ("best", "top", "leading") in any output.
- **FR-008**: System MUST validate agent response schemas before aggregation.

### Key Entities

- **Query**: User's natural language research question with optional context and preferences.
- **AgentEndpoint**: Registered agent with name, URL, timeout, and enabled status.
- **OrchestrationResult**: Aggregated response with sections, citations, confidence, reasoning, and metadata.
- **Citation**: Traceable reference in `<cite>source_type_source_id</cite>` format.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Single-agent queries return results in under 3 seconds (p95).
- **SC-002**: Multi-agent queries return aggregated results in under 5 seconds (p95).
- **SC-003**: System supports 10+ concurrent queries without degradation.
- **SC-004**: 100% of factual claims in responses include citations.
- **SC-005**: Zero instances of prohibited ranking language in any response.
- **SC-006**: Partial results are returned when at least one agent succeeds (graceful degradation).
