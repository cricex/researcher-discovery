# Agent Contract Specification

All specialized agents (Teams 1, 2, 3) must implement this contract.

## Base URL Pattern

```
http://localhost:500X/api/v1/{agent_name}
```

- Team 1 (Expertise): `http://localhost:5001/api/v1/expertise`
- Team 2 (Research): `http://localhost:5002/api/v1/research`
- Team 3 (Policy): `http://localhost:5003/api/v1/policy`

## Request Format

### POST /{agent_name}

**Headers:**

```
Content-Type: application/json
Authorization: Bearer {api_key}
```

**Body:**

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

## Response Format

### Success (200 OK)

```json
{
  "agent": "agent_name",
  "query_timestamp": "ISO8601 timestamp",
  "results": {
    // Agent-specific results structure
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

### Error (4xx/5xx)

```json
{
  "error": "Error message",
  "error_code": "AGENT_TIMEOUT",
  "details": "Additional context",
  "timestamp": "ISO8601 timestamp"
}
```

## Health Check Endpoint

### GET /health

**Response (200 OK):**

```json
{
  "status": "healthy",
  "agent": "agent_name",
  "version": "1.0.0",
  "timestamp": "ISO8601 timestamp"
}
```

## Timeout Requirements

- Maximum response time: **5 seconds**
- Agents must handle graceful timeout internally
- Return partial results if possible

## Error Codes

| Code | Description |
|---|---|
| `AGENT_TIMEOUT` | Processing took > 5 seconds |
| `INVALID_REQUEST` | Malformed request body |
| `NO_RESULTS` | Query returned no results |
| `INTERNAL_ERROR` | Agent encountered an error |
