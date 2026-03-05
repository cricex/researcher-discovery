"""
Intent routing with confidence scoring and multi-turn detection.

Mirrors the TypeScript ROUTING_RULES keyword patterns from
``src/orchestrator/classifier/routing-rules.ts`` so both codebases
classify the same way.  Designed as a drop-in replacement for the
inline ``_classify_intent`` / ``_determine_agent_calls`` methods
previously living in ``orchestrator.py``.

Phase 1: keyword-based.  The interface is stable enough to swap in an
NLP/ML backend later without touching downstream consumers.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

# ------------------------------------------------------------------ #
#  Keyword patterns — kept in sync with routing-rules.ts
# ------------------------------------------------------------------ #

ROUTING_RULES: Dict[str, List[str]] = {
    "expertise_discovery": [
        "who works on",
        "expertise in",
        "researchers",
        "faculty",
        "specializes in",
        "expert in",
    ],
    "research_output": [
        "publications about",
        "papers on",
        "published",
        "research on",
        "studies",
    ],
    "collaboration_insight": [
        "collaborators",
        "collaboration",
        "funding",
        "grants",
        "partnerships",
    ],
    "policy_compliance": [
        "compliance",
        "policy",
        "regulations",
        "irb",
        "ethics",
        "guidelines",
    ],
}

# Phrases / pronouns that signal a follow-up turn
_FOLLOW_UP_PHRASES: List[str] = [
    "tell me more",
    "what about",
    "how about",
    "that researcher",
    "those publications",
    "the grant",
    "and also",
    "additionally",
]

_FOLLOW_UP_PRONOUNS: List[str] = ["their", "his", "her", "they", "them"]

# Agent name → list of intent categories it can handle
_AGENT_INTENT_MAP: Dict[str, List[str]] = {
    "expertise_discovery": ["expertise_discovery"],
    "research_output": ["research_output", "funding_discovery"],
    "collaboration_insight": ["collaboration_insight"],
    "policy_compliance": ["policy_compliance"],
}

# Default fallback when no keywords match
_FALLBACK_INTENT = "expertise_discovery"


# ------------------------------------------------------------------ #
#  Data classes
# ------------------------------------------------------------------ #


@dataclass
class IntentResult:
    """Output of intent classification."""

    primary_intent: str
    secondary_intents: List[str] = field(default_factory=list)
    confidence: float = 0.0
    keywords_matched: List[str] = field(default_factory=list)
    is_multi_intent: bool = False


@dataclass
class RoutingDecision:
    """Full routing decision passed to the dispatcher."""

    agents: List[str]
    intent_result: IntentResult
    is_multi_turn: bool = False
    reasoning: str = ""


# ------------------------------------------------------------------ #
#  Router
# ------------------------------------------------------------------ #


class IntentRouter:
    """
    Keyword-based intent router with confidence scoring and multi-turn
    awareness.

    Usage::

        router = IntentRouter()
        decision = router.route("Who works on autism research?")
        print(decision.agents)          # ['expertise_discovery']
        print(decision.intent_result)   # IntentResult(...)
    """

    def __init__(
        self,
        routing_rules: Optional[Dict[str, List[str]]] = None,
        confidence_threshold: float = 0.4,
    ) -> None:
        self._rules = routing_rules or ROUTING_RULES
        self._confidence_threshold = confidence_threshold

    # ------------------------------------------------------------------ #
    #  Public API
    # ------------------------------------------------------------------ #

    def classify_intent(
        self,
        query: str,
        context: Optional[Dict] = None,
    ) -> IntentResult:
        """
        Classify *query* into one or more intent categories.

        Each category is scored by the fraction of its keyword patterns
        that appear in the query.  The highest-scoring category becomes
        ``primary_intent``; any others above the confidence threshold
        are ``secondary_intents``.

        If *context* flags the query as a follow-up, previous intents
        are carried forward with dampened confidence.
        """
        query_lower = query.lower()
        scored: List[tuple[str, float, List[str]]] = []

        for intent, keywords in self._rules.items():
            matched = [kw for kw in keywords if kw in query_lower]
            if matched:
                raw_score = len(matched) / len(keywords)
                confidence = min(0.5 + raw_score, 0.95)
                scored.append((intent, confidence, matched))

        # Carry forward previous intents on follow-ups
        if context and context.get("is_follow_up"):
            for prev_intent in context.get("previous_intents", []):
                if not any(s[0] == prev_intent for s in scored):
                    scored.append((prev_intent, 0.8, []))

        scored.sort(key=lambda s: s[1], reverse=True)

        if not scored:
            return IntentResult(
                primary_intent=_FALLBACK_INTENT,
                confidence=0.3,
                keywords_matched=[],
                is_multi_intent=False,
            )

        primary, primary_conf, primary_kw = scored[0]
        secondary = [
            s[0]
            for s in scored[1:]
            if s[1] >= self._confidence_threshold
        ]
        all_matched = list(
            dict.fromkeys(kw for _, _, kws in scored for kw in kws)
        )

        return IntentResult(
            primary_intent=primary,
            secondary_intents=secondary,
            confidence=primary_conf,
            keywords_matched=all_matched,
            is_multi_intent=len(secondary) > 0,
        )

    def detect_multi_turn(
        self,
        query: str,
        conversation_history: Optional[List[Dict]] = None,
    ) -> bool:
        """Return ``True`` when *query* appears to reference prior context."""
        query_lower = query.lower()

        if any(phrase in query_lower for phrase in _FOLLOW_UP_PHRASES):
            return True

        has_pronouns = any(p in query_lower for p in _FOLLOW_UP_PRONOUNS)
        has_history = bool(conversation_history)

        return has_pronouns and has_history

    def select_agents(self, intent_result: IntentResult) -> List[str]:
        """Map an ``IntentResult`` to a deduplicated list of agent names."""
        candidates: List[str] = []

        all_intents = [intent_result.primary_intent] + intent_result.secondary_intents
        for intent in all_intents:
            for agent_name, handled_intents in _AGENT_INTENT_MAP.items():
                if intent in handled_intents and agent_name not in candidates:
                    candidates.append(agent_name)

        # Fallback: always route to at least one agent
        if not candidates:
            candidates.append(_FALLBACK_INTENT)

        return candidates

    def route(
        self,
        query: str,
        context: Optional[Dict] = None,
        conversation_history: Optional[List[Dict]] = None,
    ) -> RoutingDecision:
        """
        Full routing pipeline: classify → detect multi-turn → select agents.

        Args:
            query: User query string.
            context: Optional dict that may contain ``is_follow_up`` and
                ``previous_intents`` keys.
            conversation_history: Previous turns for multi-turn detection.

        Returns:
            A ``RoutingDecision`` ready for the dispatcher.
        """
        is_multi_turn = self.detect_multi_turn(query, conversation_history)

        effective_context = dict(context) if context else {}
        if is_multi_turn and not effective_context.get("is_follow_up"):
            effective_context["is_follow_up"] = True
            if conversation_history:
                last_turn = conversation_history[-1]
                effective_context.setdefault(
                    "previous_intents",
                    last_turn.get("intents", []),
                )

        intent_result = self.classify_intent(query, effective_context or None)
        agents = self.select_agents(intent_result)

        parts: List[str] = []
        parts.append(f"Primary intent: {intent_result.primary_intent} "
                      f"({intent_result.confidence:.0%})")
        if intent_result.secondary_intents:
            parts.append(f"Secondary: {', '.join(intent_result.secondary_intents)}")
        if is_multi_turn:
            parts.append("Multi-turn follow-up detected")
        parts.append(f"Routing to: {', '.join(agents)}")

        reasoning = ". ".join(parts) + "."

        logger.info("🧭 %s", reasoning)

        return RoutingDecision(
            agents=agents,
            intent_result=intent_result,
            is_multi_turn=is_multi_turn,
            reasoning=reasoning,
        )
