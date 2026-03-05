"""
Response aggregation for the orchestration pipeline.
Groups agent responses by domain, deduplicates citations,
computes confidence scores, and merges metadata.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List

logger = logging.getLogger(__name__)

# Domain display names keyed by agent id
DOMAIN_LABELS: Dict[str, str] = {
    "expertise_discovery": "Expertise",
    "research_output": "Research",
    "collaboration_insight": "Collaboration",
    "policy_compliance": "Policy",
}


@dataclass
class AggregatedResult:
    """Final product of response aggregation."""

    sections: Dict[str, str] = field(default_factory=dict)
    citations: List[str] = field(default_factory=list)
    confidence: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)
    agents_used: List[str] = field(default_factory=list)


class ResponseAggregator:
    """
    Aggregates raw agent responses into a single structured result.

    Pipeline:
        1. Filter out errored responses
        2. Section by domain
        3. Deduplicate citations
        4. Calculate overall confidence
        5. Merge metadata
    """

    # ------------------------------------------------------------------ #
    #  Public entry point
    # ------------------------------------------------------------------ #

    def aggregate_responses(
        self,
        responses: Dict[str, Dict],
        query: str = "",
    ) -> AggregatedResult:
        """
        Main aggregation entry point.

        Args:
            responses: Mapping of agent name -> raw response dict.
            query: The original user query (used in metadata).

        Returns:
            An AggregatedResult with sectioned content, deduplicated
            citations, confidence, and merged metadata.
        """
        successful = {
            name: resp
            for name, resp in responses.items()
            if "error" not in resp
        }

        if not successful:
            logger.warning("All agent responses contained errors")
            return AggregatedResult(
                sections={},
                citations=[],
                confidence=0.0,
                metadata={"query": query, "error": "All agents failed or timed out"},
                agents_used=[],
            )

        sections = self._section_by_domain(successful)
        all_citations = self._collect_citations(successful)
        unique_citations = self._deduplicate_citations(all_citations)
        confidence = self._calculate_confidence(successful, responses)
        metadata = self._merge_metadata(successful, query)

        result = AggregatedResult(
            sections=sections,
            citations=unique_citations,
            confidence=confidence,
            metadata=metadata,
            agents_used=list(successful.keys()),
        )

        logger.info(
            "Aggregated %d agent response(s) across %d section(s)",
            len(successful),
            len(sections),
        )
        return result

    # ------------------------------------------------------------------ #
    #  Internal helpers
    # ------------------------------------------------------------------ #

    def _section_by_domain(self, responses: Dict[str, Dict]) -> Dict[str, str]:
        """Group agent output into domain-labelled markdown sections."""
        sections: Dict[str, str] = {}

        if "expertise_discovery" in responses:
            sections["Expertise"] = self._format_expertise(
                responses["expertise_discovery"]
            )

        if "research_output" in responses:
            sections["Research"] = self._format_research(
                responses["research_output"]
            )

        if "collaboration_insight" in responses:
            sections["Collaboration"] = self._format_collaboration(
                responses["collaboration_insight"]
            )

        if "policy_compliance" in responses:
            sections["Policy"] = self._format_policy(
                responses["policy_compliance"]
            )

        # Drop empty sections
        return {k: v for k, v in sections.items() if v}

    def _deduplicate_citations(self, citations: List[str]) -> List[str]:
        """Remove exact-match duplicate citations while preserving order."""
        seen: set[str] = set()
        unique: List[str] = []
        for cite in citations:
            normalised = cite.strip()
            if normalised and normalised not in seen:
                seen.add(normalised)
                unique.append(normalised)
        return unique

    def _calculate_confidence(
        self,
        successful: Dict[str, Dict],
        all_responses: Dict[str, Dict],
    ) -> float:
        """
        Weighted-average confidence.

        Each successful response may carry its own ``confidence`` field.
        If it does, that value is used; otherwise 0.5 is assumed.
        The overall score is the mean of per-agent confidences, scaled by
        the ratio of successful to total responses.
        """
        if not all_responses:
            return 0.0

        per_agent = [
            resp.get("confidence", 0.5) for resp in successful.values()
        ]
        mean_confidence = sum(per_agent) / len(per_agent) if per_agent else 0.0
        success_ratio = len(successful) / len(all_responses)

        return round(mean_confidence * success_ratio, 4)

    def _merge_metadata(
        self,
        successful: Dict[str, Dict],
        query: str,
    ) -> Dict[str, Any]:
        """Combine metadata from all successful agent responses."""
        merged: Dict[str, Any] = {"query": query}
        per_agent: Dict[str, Any] = {}

        for name, resp in successful.items():
            agent_meta = resp.get("metadata", {})
            if agent_meta:
                per_agent[name] = agent_meta

        if per_agent:
            merged["agent_metadata"] = per_agent

        merged["agents_succeeded"] = len(successful)
        return merged

    # ------------------------------------------------------------------ #
    #  Domain formatters
    # ------------------------------------------------------------------ #

    @staticmethod
    def _format_expertise(resp: Dict) -> str:
        lines: List[str] = []
        for idx, match in enumerate(resp.get("matches", [])[:5], 1):
            lines.append(f"{idx}. **{match['name']}** ({match['department']})")
            lines.append(f"   - Expertise: {', '.join(match['expertise'][:5])}")
            score = match.get("relevance_score", 0)
            lines.append(f"   - Relevance: {score:.0%}")
            if match.get("reasoning"):
                lines.append(f"   - Why: {match['reasoning']}")
            lines.append("")
        return "\n".join(lines)

    @staticmethod
    def _format_research(resp: Dict) -> str:
        lines: List[str] = []
        pubs = resp.get("publications", [])
        if pubs:
            lines.append("### Publications\n")
            for idx, pub in enumerate(pubs[:5], 1):
                lines.append(f"{idx}. **{pub['title']}** ({pub['year']})")
                if pub.get("journal"):
                    lines.append(f"   - Journal: {pub['journal']}")
                if pub.get("citation_count"):
                    lines.append(f"   - Citations: {pub['citation_count']}")
                lines.append("")

        grants = resp.get("grants", [])
        if grants:
            lines.append("### Funding\n")
            for idx, grant in enumerate(grants[:3], 1):
                lines.append(f"{idx}. **{grant['title']}**")
                lines.append(f"   - Grant Number: `{grant['grant_number']}`")
                lines.append(f"   - Funding IC: {grant['funding_ic']}")
                if grant.get("total_funding"):
                    lines.append(f"   - Amount: ${grant['total_funding']:,}")
                lines.append("")
        return "\n".join(lines)

    @staticmethod
    def _format_collaboration(resp: Dict) -> str:
        lines: List[str] = []
        for idx, rec in enumerate(resp.get("recommendations", [])[:3], 1):
            lines.append(f"{idx}. **{rec['name']}**")
            comp = rec.get("complementary_expertise", [])
            if comp:
                lines.append(f"   - Complementary Expertise: {', '.join(comp)}")
            score = rec.get("collaboration_score", 0)
            lines.append(f"   - Match Score: {score:.0%}")
            if rec.get("reasoning"):
                lines.append(f"   - Reasoning: {rec['reasoning']}")
            lines.append("")
        return "\n".join(lines)

    @staticmethod
    def _format_policy(resp: Dict) -> str:
        lines: List[str] = []
        for policy in resp.get("relevant_policies", [])[:3]:
            lines.append(f"**{policy['title']}**")
            if "summary" in policy:
                lines.append(f"{policy['summary']}\n")
            if "requirements" in policy:
                lines.append("Requirements:")
                for req in policy["requirements"][:3]:
                    lines.append(f"- {req}")
            if "contact" in policy:
                lines.append(f"Contact: {policy['contact']}")
            lines.append("")
        return "\n".join(lines)

    # ------------------------------------------------------------------ #
    #  Helpers
    # ------------------------------------------------------------------ #

    @staticmethod
    def _collect_citations(responses: Dict[str, Dict]) -> List[str]:
        """Gather all citations from every successful response."""
        citations: List[str] = []
        for resp in responses.values():
            citations.extend(resp.get("citations", []))
        return citations

    # ------------------------------------------------------------------ #
    #  Convenience: render to flat markdown string
    # ------------------------------------------------------------------ #

    @staticmethod
    def render_markdown(result: AggregatedResult) -> str:
        """Render an AggregatedResult as a single markdown string."""
        parts: List[str] = ["# Research Collaboration Discovery Results\n"]

        section_icons = {
            "Expertise": "👥",
            "Research": "📚",
            "Collaboration": "🤝",
            "Policy": "📋",
        }

        for domain, body in result.sections.items():
            icon = section_icons.get(domain, "📌")
            parts.append(f"\n## {icon} {domain}\n")
            parts.append(body)

        if result.citations:
            parts.append("\n---\n**Sources:** " + " ".join(result.citations))

        parts.append(
            f"\n\n---\n**Summary:** Found {len(result.agents_used)} relevant "
            f"data source(s)."
        )
        return "\n".join(parts)
