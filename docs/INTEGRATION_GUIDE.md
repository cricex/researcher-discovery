# Integration Guide for Specialized Agents

## Overview

This guide is for Teams 1, 2, and 3 integrating their specialized agents with the Team 4 Orchestration Agent. The orchestrator routes user intents to your agent via a standardized HTTP contract.

---

## Agent Contract

### Base URL Pattern

All agent requests follow this URL structure:

```
http://localhost:500X/api/v1/{agent_name}
```

**Port Assignment:**
- Team 1 (Expertise): `http://localhost:5001/api/v1/expertise`
- Team 2 (Research): `http://localhost:5002/api/v1/research`
- Team 3 (Policy): `http://localhost:5003/api/v1/policy`

---

## Request Format

### POST /{agent_name}

Your agent must accept POST requests at the root endpoint with the following contract:

**Headers:**

```
Content-Type: application/json
Authorization: Bearer {api_key}
```

**Request Body:**

```json
{
  "query": "string or object",
  "context": {
    "golden_record_ids": ["researcher_id_1", "researcher_id_2"],
    "keywords": ["autism", "interventions"],
    "session_id": "optional_session_id"
  },
  "options": {
    "max_results": 10,
    "include_metadata": true
  }
}
```

**Field Descriptions:**

- `query` (required): The user's intent or question as a string or structured object
- `context.golden_record_ids` (optional): Array of specific entity IDs to prioritize
- `context.keywords` (optional): Search keywords to filter results
- `context.session_id` (optional): Session identifier for tracking
- `options.max_results` (optional): Maximum number of results to return (default: 10)
- `options.include_metadata` (optional): Whether to include metadata in response (default: true)

---

## Response Format

### Success Response (200 OK)

Your agent must return a JSON response in this format:

```json
{
  "agent": "agent_name",
  "query_timestamp": "2026-03-05T15:30:00Z",
  "results": {
    "findings": [
      {
        "id": "unique_id",
        "title": "Finding Title",
        "summary": "Brief summary",
        "relevance_score": 0.95
      }
    ]
  },
  "citations": [
    "<cite>gold_researcher_krueger_bruce_k</cite>",
    "<cite>openalex_w1974772111</cite>"
  ],
  "metadata": {
    "processing_time_ms": 123,
    "result_count": 5
  }
}
```

**Field Descriptions:**

- `agent` (required): Your agent's identifier
- `query_timestamp` (required): ISO 8601 timestamp when the query was processed
- `results` (required): Agent-specific results structure (customize as needed, but must contain findings/data)
- `citations` (required): Array of citation strings in format `<cite>source_type_source_id</cite>`
- `metadata.processing_time_ms` (required): How long the query took in milliseconds
- `metadata.result_count` (required): Number of results returned

### Error Response (4xx/5xx)

If your agent encounters an error, return:

```json
{
  "error": "Error message",
  "error_code": "AGENT_TIMEOUT",
  "details": "Additional context about the error",
  "timestamp": "2026-03-05T15:30:00Z"
}
```

**Common Error Codes:**

| Code | HTTP Status | Description |
|---|---|---|
| `AGENT_TIMEOUT` | 504 | Processing took > 5 seconds |
| `INVALID_REQUEST` | 400 | Malformed request body |
| `NO_RESULTS` | 404 | Query returned no results |
| `INTERNAL_ERROR` | 500 | Agent encountered an error |

---

## Health Check Endpoint

Your agent must implement a health check endpoint:

### GET /health

**Response (200 OK):**

```json
{
  "status": "healthy",
  "agent": "agent_name",
  "version": "1.0.0",
  "timestamp": "2026-03-05T15:30:00Z"
}
```

The orchestrator will call this endpoint to verify your agent is responsive before routing queries.

---

## Performance Requirements

- **Maximum Response Time:** 5 seconds per query
- **Graceful Timeout Handling:** If a query will take longer than 5 seconds, return partial results or a graceful error
- **Concurrent Request Support:** Be prepared to handle multiple simultaneous requests
- **Uptime Target:** 99% availability (health check failures trigger orchestrator fallback)

---

## Integration Testing Checklist

Before going live, verify:

- [ ] Health endpoint responds with 200 OK
- [ ] POST endpoint accepts the contract request format
- [ ] Response includes all required fields
- [ ] All responses include citations
- [ ] Error handling returns proper error codes
- [ ] Processing time is < 5 seconds under normal load
- [ ] Concurrent requests are handled correctly

**Test your agent locally:**

```bash
# Start your agent
python your_agent.py  # or your language's startup command

# Test health
curl http://localhost:YOUR_PORT/health

# Test a query
curl -X POST http://localhost:YOUR_PORT/api/v1/your_agent_name \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Test query",
    "context": {"keywords": ["test"]},
    "options": {"max_results": 5}
  }'
```

---

## Contact & Support

- **Orchestration Lead:** Sean Gayle
- **Slack Channel:** #team4-orchestration
- **Integration Questions:** Post in #team4-orchestration or reach out to Sean directly

---

## FAQ

**Q: What if my agent needs more than 5 seconds?**
A: Design your agent to return partial results within 5 seconds. Use caching, pre-computation, or index-based lookups to keep latency low.

**Q: Can I change the response format?**
A: The top-level contract (agent, query_timestamp, results, citations, metadata) is fixed. You can structure `results` however makes sense for your domain.

**Q: What happens if my agent is down?**
A: The orchestrator will get health check failures. It will retry briefly, then return an error to the user indicating your agent is unavailable.

**Q: Do I need to handle authentication?**
A: Check the Authorization header if provided, but the orchestrator will handle token management. Contact Sean if you need custom auth.
