"""
Main Orchestration Agent using Microsoft Agent Framework
Routes queries to specialized agents and aggregates responses
"""

import os
import asyncio
import httpx
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from datetime import datetime
import logging

# Microsoft Agent Framework imports
import semantic_kernel as sk
from semantic_kernel.connectors.ai.anthropic import AnthropicChatCompletion

# Internal imports
from orchestrator.aggregator import ResponseAggregator

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class AgentEndpoint:
    """Agent endpoint configuration"""
    name: str
    url: str
    timeout: int = 5
    enabled: bool = True


@dataclass
class OrchestrationResult:
    """Result from orchestration"""
    response: str
    agents_invoked: List[str]
    citations: List[str]
    confidence: float
    reasoning: str
    metadata: Dict[str, Any]


class Orchestrator:
    """
    Main orchestration agent that routes queries to specialized agents
    and aggregates their responses.
    """

    def __init__(self, anthropic_api_key: str = None, use_mock_agents: bool = True):
        """
        Initialize orchestrator.

        Args:
            anthropic_api_key: API key for Claude Opus 4.6
            use_mock_agents: If True, use mock agents on localhost
        """
        self.api_key = anthropic_api_key or os.getenv("ANTHROPIC_API_KEY")
        self.use_mock_agents = use_mock_agents

        # Initialize Semantic Kernel
        self.kernel = sk.Kernel()

        # Add Claude Opus 4.6 as the LLM service
        if self.api_key:
            self.kernel.add_service(
                AnthropicChatCompletion(
                    service_id="claude_opus",
                    ai_model_id="claude-opus-4-20250514",
                    api_key=self.api_key
                )
            )
            logger.info("✅ Initialized with Claude Opus 4.6")
        else:
            logger.warning("⚠️ No Anthropic API key provided, LLM features disabled")

        # Initialize agent registry
        self.agent_registry = self._init_agent_registry()

        # HTTP client for agent calls
        self.http_client = httpx.AsyncClient(timeout=5.0)

        # Response aggregator
        self.aggregator = ResponseAggregator()

        # Citation tracking
        self.citations = []

        logger.info("✅ Orchestrator initialized")

    def _init_agent_registry(self) -> Dict[str, AgentEndpoint]:
        """Initialize registry of agent endpoints."""
        if self.use_mock_agents:
            return {
                "expertise_discovery": AgentEndpoint(
                    name="expertise_discovery",
                    url="http://localhost:5001/api/v1/expertise"
                ),
                "research_output": AgentEndpoint(
                    name="research_output",
                    url="http://localhost:5001/api/v1/research"
                ),
                "collaboration_insight": AgentEndpoint(
                    name="collaboration_insight",
                    url="http://localhost:5001/api/v1/collaboration"
                ),
                "policy_compliance": AgentEndpoint(
                    name="policy_compliance",
                    url="http://localhost:5001/api/v1/policy"
                )
            }
        else:
            # Real agent endpoints (Teams 1-3)
            return {
                "expertise_discovery": AgentEndpoint(
                    name="expertise_discovery",
                    url="http://localhost:5001/api/v1/expertise"
                ),
                "research_output": AgentEndpoint(
                    name="research_output",
                    url="http://localhost:5002/api/v1/research"
                ),
                "collaboration_insight": AgentEndpoint(
                    name="collaboration_insight",
                    url="http://localhost:5002/api/v1/collaboration"
                ),
                "policy_compliance": AgentEndpoint(
                    name="policy_compliance",
                    url="http://localhost:5003/api/v1/policy"
                )
            }

    async def route_query(self, user_query: str, context: Dict = None) -> OrchestrationResult:
        """
        Main orchestration method: classify intent, route to agents, aggregate.

        Args:
            user_query: Natural language query from user
            context: Optional context from enrichment layer

        Returns:
            OrchestrationResult with aggregated response
        """
        logger.info(f"🎯 Orchestrating query: {user_query[:50]}...")

        start_time = datetime.now()

        # Step 1: Classify intent
        intents = self._classify_intent(user_query)
        logger.info(f"   Classified intents: {intents}")

        # Step 2: Route to appropriate agents
        agent_calls = self._determine_agent_calls(intents)
        logger.info(f"   Calling agents: {[a.name for a in agent_calls]}")

        # Step 3: Execute agent calls in parallel
        agent_responses = await self._call_agents_parallel(agent_calls, user_query, context)

        # Step 4: Aggregate responses
        aggregated = self.aggregator.aggregate_responses(agent_responses, user_query)
        response_text = ResponseAggregator.render_markdown(aggregated)

        # Step 5: Build result
        processing_time = (datetime.now() - start_time).total_seconds() * 1000

        result = OrchestrationResult(
            response=response_text,
            agents_invoked=[a.name for a in agent_calls],
            citations=aggregated.citations,
            confidence=aggregated.confidence,
            reasoning=f"Called {len(agent_responses)} agent(s). "
                      f"{len(aggregated.agents_used)} responded successfully.",
            metadata={
                **aggregated.metadata,
                "processing_time_ms": processing_time,
                "agents_called": len(agent_calls),
            }
        )

        logger.info(f"✅ Orchestration complete in {processing_time:.0f}ms")
        return result

    def _classify_intent(self, query: str) -> List[str]:
        """Classify query intent to determine which agents to call."""
        query_lower = query.lower()
        intents = []

        # Expertise discovery patterns
        if any(term in query_lower for term in
               ["who works on", "expertise", "researcher", "faculty", "who at"]):
            intents.append("expertise_discovery")

        # Research output patterns
        if any(term in query_lower for term in
               ["publication", "paper", "research output", "published"]):
            intents.append("research_output")

        # Funding/grants patterns
        if any(term in query_lower for term in
               ["grant", "funding", "nih", "award", "r01"]):
            intents.append("funding_discovery")

        # Collaboration patterns
        if any(term in query_lower for term in
               ["collaborate", "team", "partner", "work with"]):
            intents.append("collaboration_insight")

        # Policy patterns
        if any(term in query_lower for term in
               ["policy", "compliance", "irb", "coi", "requirement", "disclosure"]):
            intents.append("policy_compliance")

        # Default to expertise if no clear intent
        if not intents:
            intents.append("expertise_discovery")

        return intents

    def _determine_agent_calls(self, intents: List[str]) -> List[AgentEndpoint]:
        """Map intents to agent endpoints."""
        agents = []

        for intent in intents:
            if intent == "expertise_discovery" and "expertise_discovery" in self.agent_registry:
                agents.append(self.agent_registry["expertise_discovery"])

            elif intent in ["research_output", "funding_discovery"] and "research_output" in self.agent_registry:
                agents.append(self.agent_registry["research_output"])

            elif intent == "collaboration_insight" and "collaboration_insight" in self.agent_registry:
                agents.append(self.agent_registry["collaboration_insight"])

            elif intent == "policy_compliance" and "policy_compliance" in self.agent_registry:
                agents.append(self.agent_registry["policy_compliance"])

        # Deduplicate
        seen = set()
        unique_agents = []
        for agent in agents:
            if agent.name not in seen:
                seen.add(agent.name)
                unique_agents.append(agent)

        return unique_agents

    async def _call_agents_parallel(self, agents: List[AgentEndpoint],
                                     query: str, context: Dict = None) -> Dict[str, Dict]:
        """Call multiple agents in parallel."""
        async def call_one_agent(agent: AgentEndpoint) -> tuple:
            try:
                payload = {"query": query}

                if context:
                    payload["context"] = context

                # Format agent-specific payloads
                if agent.name == "expertise_discovery":
                    payload = {
                        "keywords": context.get("keywords", []) if context else self._extract_keywords(query)
                    }
                elif agent.name == "research_output":
                    payload = {
                        "researcher_id": context.get("golden_record_ids", [None])[0] if context else None,
                        "query_type": "all"
                    }
                elif agent.name == "collaboration_insight":
                    payload = {
                        "researcher_id": context.get("golden_record_ids", [None])[0] if context else "krueger_bruce_k",
                        "research_area": query
                    }
                elif agent.name == "policy_compliance":
                    payload = {
                        "policy_question": query
                    }

                response = await self.http_client.post(agent.url, json=payload)
                response.raise_for_status()

                logger.info(f"   ✅ {agent.name} responded in {response.elapsed.total_seconds():.2f}s")
                return agent.name, response.json()

            except httpx.TimeoutException:
                logger.warning(f"   ⚠️ {agent.name} timed out")
                return agent.name, {"error": "timeout"}
            except Exception as e:
                logger.error(f"   ❌ {agent.name} failed: {e}")
                return agent.name, {"error": str(e)}

        tasks = [call_one_agent(agent) for agent in agents]
        results = await asyncio.gather(*tasks)

        return {name: response for name, response in results}

    def _extract_keywords(self, query: str) -> List[str]:
        """Extract keywords from query (simple version)."""
        keywords = []
        domain_terms = [
            "autism", "neurodevelopment", "interventions", "culturally responsive",
            "community", "underserved", "disparities", "grants", "funding"
        ]
        query_lower = query.lower()
        for term in domain_terms:
            if term in query_lower:
                keywords.append(term)
        return keywords

    async def close(self):
        """Cleanup resources."""
        await self.http_client.aclose()


async def main():
    """Test the orchestrator."""
    orchestrator = Orchestrator(use_mock_agents=True)

    # Test query (Test Script 6)
    query = "Summarize potential collaborators, funding opportunities, and compliance steps for autism neurobiology research"

    try:
        result = await orchestrator.route_query(query)

        print("\n" + "=" * 60)
        print("ORCHESTRATION RESULT")
        print("=" * 60)
        print(f"\nQuery: {query}")
        print(f"\nAgents Invoked: {result.agents_invoked}")
        print(f"Confidence: {result.confidence:.0%}")
        print(f"Reasoning: {result.reasoning}")
        print(f"\nResponse:\n{result.response}")
        print(f"\nCitations: {len(result.citations)}")
        print(f"Processing Time: {result.metadata['processing_time_ms']:.0f}ms")
        print("=" * 60)
    finally:
        await orchestrator.close()


if __name__ == "__main__":
    asyncio.run(main())
