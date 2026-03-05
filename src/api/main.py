"""
FastAPI Backend for Orchestration Agent
Exposes REST API for React frontend
"""

import sys
import os
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
import uuid
from datetime import datetime

# Add src/ to Python path so orchestrator package resolves
_src_dir = str(Path(__file__).resolve().parent.parent)
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

from orchestrator.orchestrator import Orchestrator, OrchestrationResult

# ---------------------------------------------------------------------------
# Globals (populated during lifespan)
# ---------------------------------------------------------------------------
orchestrator: Orchestrator = None  # type: ignore[assignment]

# Active WebSocket connections for real-time updates
active_connections: List[WebSocket] = []

# In-memory session storage (use Redis in production)
sessions: Dict[str, List[Dict]] = {}


# ---------------------------------------------------------------------------
# Lifespan (replaces deprecated on_event startup/shutdown)
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    global orchestrator
    orchestrator = Orchestrator(use_mock_agents=True)
    print("🚀 Orchestration Agent API starting...")
    print("📍 Swagger docs: http://localhost:8000/docs")
    print("📍 React frontend: http://localhost:3000")
    yield
    await orchestrator.close()
    print("👋 Orchestration Agent API shutting down...")


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Orchestration Agent API",
    description="Multi-agent orchestration service for research collaboration discovery",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Pydantic request / response models
# ---------------------------------------------------------------------------
class QueryRequest(BaseModel):
    query: str
    session_id: Optional[str] = None
    include_reasoning: bool = True


class QueryResponse(BaseModel):
    query_id: str
    session_id: str
    query: str
    response: str
    agents_invoked: List[str]
    citations: List[str]
    confidence: float
    reasoning: str
    metadata: Dict[str, Any]
    timestamp: str


class AgentStatus(BaseModel):
    agent_name: str
    status: str  # querying, processing, complete, error
    response_time_ms: Optional[float] = None
    error: Optional[str] = None


class OrchestrationFlow(BaseModel):
    query: str
    intents: List[str]
    agents_called: List[str]
    agent_statuses: List[AgentStatus]
    current_step: str
    progress: float


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/")
async def root():
    """Health check and API info"""
    return {
        "service": "Orchestration Agent API",
        "version": "1.0.0",
        "status": "healthy",
        "endpoints": {
            "query": "/api/v1/query",
            "session": "/api/v1/session/{session_id}",
            "health": "/health",
        },
    }


@app.get("/health")
async def health_check():
    """Detailed health check"""
    agent_health = {}
    for agent_name, agent in orchestrator.agent_registry.items():
        agent_health[agent_name] = {
            "enabled": agent.enabled,
            "url": agent.url,
            "timeout": agent.timeout,
        }

    return {
        "status": "healthy",
        "orchestrator": "operational",
        "agents": agent_health,
        "timestamp": datetime.now().isoformat(),
    }


@app.post("/api/v1/query", response_model=QueryResponse)
async def query_orchestrator(request: QueryRequest):
    """
    Main query endpoint — orchestrate across agents.

    Example:
        POST /api/v1/query
        {
            "query": "Who at UMB works on autism interventions?",
            "session_id": "optional-session-id",
            "include_reasoning": true
        }
    """
    try:
        query_id = str(uuid.uuid4())
        session_id = request.session_id or str(uuid.uuid4())

        result: OrchestrationResult = await orchestrator.route_query(request.query)

        response = QueryResponse(
            query_id=query_id,
            session_id=session_id,
            query=request.query,
            response=result.response,
            agents_invoked=result.agents_invoked,
            citations=result.citations,
            confidence=result.confidence,
            reasoning=result.reasoning if request.include_reasoning else "",
            metadata=result.metadata,
            timestamp=datetime.now().isoformat(),
        )

        # Store in session history
        if session_id not in sessions:
            sessions[session_id] = []
        sessions[session_id].append(response.model_dump())

        return response

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Orchestration failed: {str(e)}")


@app.get("/api/v1/session/{session_id}")
async def get_session_history(session_id: str):
    """Get conversation history for a session"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "session_id": session_id,
        "query_count": len(sessions[session_id]),
        "history": sessions[session_id],
    }


@app.delete("/api/v1/session/{session_id}")
async def delete_session(session_id: str):
    """Delete a session"""
    if session_id in sessions:
        del sessions[session_id]
        return {"message": f"Session {session_id} deleted"}
    raise HTTPException(status_code=404, detail="Session not found")


@app.get("/api/v1/agents")
async def list_agents():
    """List all available agents and their status"""
    agents = []
    for name, agent in orchestrator.agent_registry.items():
        agents.append({
            "name": name,
            "url": agent.url,
            "enabled": agent.enabled,
            "timeout": agent.timeout,
        })
    return {"agents": agents}


@app.websocket("/ws/orchestration")
async def websocket_orchestration(websocket: WebSocket):
    """
    WebSocket endpoint for real-time orchestration updates.
    Sends agent status updates as they happen.
    """
    await websocket.accept()
    active_connections.append(websocket)

    try:
        while True:
            data = await websocket.receive_json()
            query = data.get("query")

            if not query:
                await websocket.send_json({"error": "No query provided"})
                continue

            # Send initial status
            await websocket.send_json({
                "type": "started",
                "message": "Orchestration started",
                "query": query,
            })

            # Classify intents
            intents = orchestrator._classify_intent(query)
            await websocket.send_json({
                "type": "intents_classified",
                "intents": intents,
            })

            # Determine agents
            agent_calls = orchestrator._determine_agent_calls(intents)
            await websocket.send_json({
                "type": "agents_determined",
                "agents": [a.name for a in agent_calls],
            })

            # Notify client we're calling agents
            await websocket.send_json({
                "type": "calling_agents",
                "count": len(agent_calls),
            })

            # Execute full orchestration
            result = await orchestrator.route_query(query)

            # Send final result
            await websocket.send_json({
                "type": "complete",
                "result": {
                    "response": result.response,
                    "agents_invoked": result.agents_invoked,
                    "citations": result.citations,
                    "confidence": result.confidence,
                    "reasoning": result.reasoning,
                    "metadata": result.metadata,
                },
            })

    except WebSocketDisconnect:
        active_connections.remove(websocket)


# ---------------------------------------------------------------------------
# Standalone entry-point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
