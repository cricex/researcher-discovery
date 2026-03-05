# Demo Script — Orchestration Agent

## Overview

This document provides step-by-step instructions for demonstrating the Team 4 Orchestration Agent system. The demo is designed for a 6-minute presentation showcasing how the system routes complex research queries to specialized agents and synthesizes coherent responses.

---

## Pre-Demo Setup Checklist

Complete these steps **at least 5 minutes before the demo starts:**

- [ ] FastAPI backend running on `http://localhost:8000`
- [ ] React frontend running on `http://localhost:5173`
- [ ] Team 1 (Expertise) agent running on `http://localhost:5001`
- [ ] Team 2 (Research) agent running on `http://localhost:5002`
- [ ] Team 3 (Policy) agent running on `http://localhost:5003`
- [ ] Browser open to `http://localhost:5173` (UI page loaded, ready to query)
- [ ] Orchestrator health check passing: `curl http://localhost:8000/health`

### Quick Startup Commands

```bash
# Terminal 1: FastAPI Backend
cd orchestration-agent
npm run dev:backend  # or: python -m uvicorn main:app --reload --port 8000

# Terminal 2: React Frontend
npm run dev:frontend  # or: cd frontend && npm run dev

# Terminal 3: Team 1 (Expertise Agent)
# In separate terminal, navigate to team 1 repo
python agent.py --port 5001

# Terminal 4: Team 2 (Research Agent)
python agent.py --port 5002

# Terminal 5: Team 3 (Policy Agent)
python agent.py --port 5003
```

---

## Demo Flow (6 Minutes Total)

### **Segment 1: Problem Statement (45 seconds)**

**Narrative:**

"Dr. Krueger at UMB has a complex research idea: linking autism neurobiology to culturally responsive early interventions in underserved communities. To move forward, she needs:

1. **Expertise Discovery** — Who are the collaborators and thought leaders in this space?
2. **Funding Opportunities** — What grants and funding mechanisms exist?
3. **Compliance Guidance** — What regulatory and ethical frameworks apply?

No single database or team can answer all three questions. She'd normally spend hours piecing together fragmented information. The orchestration agent solves this by routing her single query to all three specialized teams simultaneously."

**Visual Aid:** 
- Show the user interface at `http://localhost:5173`
- Point out the query input area at the top

**Time:** 45 seconds

---

### **Segment 2: Architecture Overview (1 minute)**

**Narrative:**

"Under the hood, here's how it works:"

**Show the architecture diagram** (printed or on screen):

```
┌──────────────────────────────────────────────┐
│     User Interface (React, :5173)             │
└─────────────────────┬────────────────────────┘
                      │
        ┌─────────────▼────────────────┐
        │  Orchestration Agent         │
        │  (FastAPI, :8000)            │
        │                              │
        │  1. Intent Classifier ──────┐│
        │  2. Intent Router ───────────││
        │  3. Dispatcher ──────────────│├─ Pipeline
        │  4. Response Aggregator ────┘│
        └──────────┬──┬──┬─────────────┘
                   │  │  │
      ┌────────────┘  │  └──────────────┐
      │               │                  │
      ▼               ▼                  ▼
 ┌─────────┐  ┌─────────┐        ┌──────────┐
 │ Team 1  │  │ Team 2  │        │ Team 3   │
 │Expertise│  │Research │        │ Policy   │
 │:5001    │  │:5002    │        │:5003     │
 └─────────┘  └─────────┘        └──────────┘
```

**Key Points to Highlight:**

1. **Single Entry Point:** The user writes one query in natural language
2. **Intent Classification:** The orchestrator understands what the query is asking for
3. **Parallel Dispatch:** Instead of calling agents sequentially, all three are called at the same time
4. **Response Synthesis:** Results are merged into one coherent, cited response

**Time:** 1 minute

---

### **Segment 3: Live Demo — Test Query (2.5 minutes)**

**Setup:**
- Have the UI open in the browser
- Cursor ready in the query input field
- All agents confirmed running and healthy

**Query to Run:**

```
Summarize potential collaborators, funding opportunities, and compliance steps for my research idea: Linking autism neurobiology to culturally responsive early interventions in underserved communities.
```

**Execution Steps:**

1. **Paste/Type the query** into the text input
2. **Hit Enter or click "Submit"**
3. **Watch the live orchestration flow** (right panel should show):
   - Spinning loader: "Classifying intent..."
   - Agents being called: "Calling Expertise Agent...", "Calling Research Agent...", etc.
   - Progress indicators: "Processing in parallel..."
4. **Results appear** with:
   - Expertise findings (collaborators, thought leaders)
   - Research findings (funding mechanisms, grant programs)
   - Policy findings (compliance frameworks, ethical requirements)
5. **Citations appear** below each result section (clickable, links back to source)

**Live Observations to Call Out:**

- "Notice all three agents respond at roughly the same time — they're running in parallel, not waiting for each other"
- "The citations are automatically extracted and verified — researchers can trace claims back to primary sources"
- "The response is synthesized into a coherent narrative, not just concatenated results"

**If Something Goes Wrong (Backup):**
- If an agent is unresponsive, the orchestrator will timeout gracefully and show which agent failed
- Still show the results from the agents that did respond
- Transition to the backup plan (see section below)

**Time:** 2.5 minutes

---

### **Segment 4: Technical Deep Dive (1 minute)**

**Narrative:**

"Let me show you what's happening under the hood..."

**Show FastAPI Swagger Documentation:**

1. Open `http://localhost:8000/docs` in a new browser tab
2. Scroll to the `/orchestrate` endpoint
3. Click "Try it out"
4. Show the request body structure (query, context, options)
5. Highlight the response structure (agent, timestamp, results, citations, metadata)

**Key Technical Points:**

- **WebSocket Support:** The demo showed real-time status updates. Behind the scenes, the orchestrator sends WebSocket events as each stage completes
- **Graceful Failure:** If one agent times out, the others' results are still returned
- **Concurrent Processing:** Uses `Promise.allSettled` to fan out to agents and wait for all to complete
- **Citation Integrity:** Each result is tagged with its source; citations are verified before returning

**Optional: Show Code**

If the audience is technical, you can flip to the code and highlight:
- `src/orchestrator/orchestrator.ts` — the main pipeline
- `src/orchestrator/router.ts` — how intents are routed to agents
- `src/orchestrator/aggregator/` — how responses are merged

**Time:** 1 minute

---

### **Segment 5: Impact & Wrap-Up (45 seconds)**

**Narrative:**

"Here's what this enables:

**Before:** Researchers manually search expertise databases, funding databases, and compliance wikis. Multiple searches, stitching together fragments.

**After:** One question. One coherent answer with citations. Confidence scores. Links to primary sources.

**Scale:** We designed this for all UMB researchers. Dr. Krueger's research process now looks like this for any complex, cross-domain question.

**Future:** We're planning to add more agent types (industry partnerships, publication trends, data availability) — the system scales."

**Final Slide/Takeaway:**

"Questions?"

**Time:** 45 seconds

---

## Test Queries (Alternative/Backup)

If the primary query times out or doesn't work as expected, use one of these alternatives:

### Query A: Shorter, More Focused
```
Find experts in autism interventions and recent funding opportunities for early childhood research.
```

### Query B: Policy-Only
```
What are the IRB and ethical guidelines for research on vulnerable populations?
```

### Query C: Funding-Focused
```
List major funding sources for neurobiology research and their application deadlines.
```

---

## Backup Plan

If the live demo fails completely (agents down, network issues, etc.):

### Option 1: Screen Recording
- Pre-record a successful demo run (video file saved locally)
- Play the recording instead of live demo
- Pause to explain key moments
- **Timing:** Still fits in 2.5 minutes

### Option 2: Mock Data Snapshot
- Have a JSON file with pre-computed agent responses ready
- Show the UI with the mock data pre-loaded
- Walk through the response as if the live query just completed
- **Timing:** 2 minutes

### Option 3: Slides Only
- Fall back to architecture and data slides
- Show static screenshots of the UI
- Skip the live query segment, extend technical deep dive
- **Timing:** Slightly shorter demo (~5 minutes), still covers all key points

---

## Troubleshooting

### Agents Not Responding

```bash
# Check if agents are running
curl http://localhost:5001/health
curl http://localhost:5002/health
curl http://localhost:5003/health

# All should return 200 OK with {"status": "healthy", ...}
```

### FastAPI Backend Not Accessible

```bash
# Check if backend is running
curl http://localhost:8000/health

# If not, restart:
cd orchestration-agent
npm run dev:backend
```

### React Frontend Not Loaded

```bash
# Check if frontend is running on :5173
# Look for errors in the browser console (F12)
# Refresh the page (Ctrl+R or Cmd+R)
```

### Query Hangs / No Response

- Wait up to 10 seconds (backend timeout is 5s per agent + overhead)
- If still no response, check orchestrator logs (terminal running FastAPI)
- If one agent is down, try a query that only needs the other two (e.g., "Query B" above)

---

## Post-Demo Notes

- **Duration:** Actual demo runs 5-7 minutes depending on agent response times
- **Confidence:** This demo showcases core orchestration logic. Advanced features (filtering, ranked results, explanation generation) are in development
- **Next Steps for Teams 1-3:** Integration documentation is in `docs/INTEGRATION_GUIDE.md`
- **Questions:** Reach out to Sean Gayle (#team4-orchestration on Slack)
