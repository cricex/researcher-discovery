# server.py
from typing import Any, List, Dict, Optional
import httpx
import os
import logging
import json
from dotenv import load_dotenv

# Import MCP libraries
try:
    from fastmcp import FastMCP
except ImportError as e:
    logging.error(f"Failed to import MCP libraries: {e}")
    raise

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(os.path.join(os.path.dirname(os.path.abspath(__file__)), "mcp-openalex.log")),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger('openalex-mcp')
logger.info("Starting OpenAlex MCP server")

# Load environment variables from .env file
load_dotenv()

# Configuration
API_NAME = "OpenAlex"
API_BASE = "https://api.openalex.org"
# Optional email for the polite pool (faster responses, no auth needed)
MAILTO = os.getenv("OPENALEX_MAILTO", "")

# Initialize FastMCP server
mcp = FastMCP(API_NAME)


class OpenAlexClient:
    """Client for interacting with the OpenAlex API"""

    def __init__(self):
        self.base_url = API_BASE
        self.default_params: Dict[str, str] = {}
        if MAILTO:
            self.default_params["mailto"] = MAILTO

    def _params(self, extra: Dict[str, Any]) -> Dict[str, Any]:
        """Merge default params with request-specific params."""
        return {**self.default_params, **extra}

    async def get(self, endpoint: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Make a GET request to the OpenAlex API."""
        url = f"{self.base_url}/{endpoint}"
        logger.info(f"GET {url} params={params}")
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, params=self._params(params))
            response.raise_for_status()
            return response.json()

    async def get_single(self, endpoint: str, entity_id: str) -> Dict[str, Any]:
        """Fetch a single entity by ID."""
        url = f"{self.base_url}/{endpoint}/{entity_id}"
        logger.info(f"GET {url}")
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, params=self._params({}))
            response.raise_for_status()
            return response.json()


# Instantiate the API client
api_client = OpenAlexClient()


# ---------------------------------------------------------------------------
# Formatting helpers
# ---------------------------------------------------------------------------

def _format_works(results: List[Dict[str, Any]], include_abstract: bool = True) -> str:
    """Format a list of works as Markdown."""
    if not results:
        return "No works found."

    parts: List[str] = []
    for i, work in enumerate(results, 1):
        title = work.get("display_name") or work.get("title") or "Untitled"
        year = work.get("publication_year", "")
        doi = work.get("doi", "")
        openalex_id = work.get("id", "")
        cited_by = work.get("cited_by_count", 0)
        work_type = work.get("type", "")
        oa = work.get("open_access", {})
        is_oa = oa.get("is_oa", False)

        # Authors
        authorships = work.get("authorships", [])
        authors = []
        for a in authorships[:10]:
            author = a.get("author", {})
            name = author.get("display_name", "")
            if name:
                authors.append(name)
        author_str = ", ".join(authors)
        if len(authorships) > 10:
            author_str += " et al."

        # Source / journal
        primary = work.get("primary_location") or {}
        source = primary.get("source") or {}
        journal = source.get("display_name", "")

        # Abstract (reconstructed from inverted index)
        abstract = ""
        if include_abstract:
            abstract_index = work.get("abstract_inverted_index")
            if abstract_index:
                abstract = _reconstruct_abstract(abstract_index)

        lines = [f"### {i}. {title}", ""]
        if openalex_id:
            oa_short = openalex_id.replace("https://openalex.org/", "")
            lines.append(f"**OpenAlex:** [{oa_short}]({openalex_id})")
        if doi:
            lines.append(f"**DOI:** [{doi}]({doi})")

        # PMID if available
        ids = work.get("ids", {})
        pmid = ids.get("pmid", "")
        if pmid:
            lines.append(f"**PMID:** [{pmid}]({pmid})")

        if author_str:
            lines.append(f"**Authors:** {author_str}")
        cite_parts = []
        if journal:
            cite_parts.append(f"*{journal}*")
        if year:
            cite_parts.append(str(year))
        if cite_parts:
            lines.append(f"**Citation:** {'; '.join(cite_parts)}")
        lines.append(f"**Cited by:** {cited_by}")
        if work_type:
            lines.append(f"**Type:** {work_type}")
        lines.append(f"**Open Access:** {'Yes' if is_oa else 'No'}")

        if abstract:
            lines.extend(["", "#### Abstract", abstract])

        # Topics
        topics = work.get("topics", [])
        if topics:
            topic_names = [t.get("display_name", "") for t in topics[:8] if t.get("display_name")]
            if topic_names:
                lines.append(f"\n**Topics:** {', '.join(topic_names)}")

        lines.extend(["", "---"])
        parts.append("\n".join(lines))

    return "\n\n".join(parts)


def _reconstruct_abstract(inverted_index: Dict[str, List[int]]) -> str:
    """Reconstruct abstract text from OpenAlex inverted index format."""
    if not inverted_index:
        return ""
    word_positions: List[tuple] = []
    for word, positions in inverted_index.items():
        for pos in positions:
            word_positions.append((pos, word))
    word_positions.sort(key=lambda x: x[0])
    return " ".join(w for _, w in word_positions)


def _format_authors(results: List[Dict[str, Any]]) -> str:
    """Format a list of authors as Markdown."""
    if not results:
        return "No authors found."

    parts: List[str] = []
    for i, author in enumerate(results, 1):
        name = author.get("display_name", "Unknown")
        openalex_id = author.get("id", "")
        orcid = author.get("orcid", "")
        works_count = author.get("works_count", 0)
        cited_by = author.get("cited_by_count", 0)
        h_index = author.get("summary_stats", {}).get("h_index", "N/A")

        # Affiliations
        affiliations = author.get("affiliations", [])
        current_affils = []
        for aff in affiliations[:3]:
            inst = aff.get("institution", {})
            inst_name = inst.get("display_name", "")
            if inst_name:
                current_affils.append(inst_name)

        lines = [f"### {i}. {name}", ""]
        if openalex_id:
            oa_short = openalex_id.replace("https://openalex.org/", "")
            lines.append(f"**OpenAlex:** [{oa_short}]({openalex_id})")
        if orcid:
            lines.append(f"**ORCID:** [{orcid}]({orcid})")
        lines.append(f"**Works:** {works_count} | **Cited by:** {cited_by} | **h-index:** {h_index}")
        if current_affils:
            lines.append(f"**Affiliations:** {', '.join(current_affils)}")

        # Top topics
        topics = author.get("topics", [])
        if topics:
            topic_names = [t.get("display_name", "") for t in topics[:5] if t.get("display_name")]
            if topic_names:
                lines.append(f"**Top topics:** {', '.join(topic_names)}")

        lines.extend(["", "---"])
        parts.append("\n".join(lines))

    return "\n\n".join(parts)


def _format_institutions(results: List[Dict[str, Any]]) -> str:
    """Format a list of institutions as Markdown."""
    if not results:
        return "No institutions found."

    parts: List[str] = []
    for i, inst in enumerate(results, 1):
        name = inst.get("display_name", "Unknown")
        openalex_id = inst.get("id", "")
        ror = inst.get("ror", "")
        country = inst.get("country_code", "")
        inst_type = inst.get("type", "")
        works_count = inst.get("works_count", 0)
        cited_by = inst.get("cited_by_count", 0)

        lines = [f"### {i}. {name}", ""]
        if openalex_id:
            oa_short = openalex_id.replace("https://openalex.org/", "")
            lines.append(f"**OpenAlex:** [{oa_short}]({openalex_id})")
        if ror:
            lines.append(f"**ROR:** [{ror}]({ror})")
        if country:
            lines.append(f"**Country:** {country}")
        if inst_type:
            lines.append(f"**Type:** {inst_type}")
        lines.append(f"**Works:** {works_count} | **Cited by:** {cited_by}")

        lines.extend(["", "---"])
        parts.append("\n".join(lines))

    return "\n\n".join(parts)


# ---------------------------------------------------------------------------
# MCP Tools
# ---------------------------------------------------------------------------

@mcp.tool()
async def search_works(
    query: str,
    max_results: int = 10,
    sort: str = "relevance_score:desc",
    publication_year: Optional[str] = None,
    open_access: Optional[bool] = None,
    work_type: Optional[str] = None,
    include_abstract: bool = True,
) -> str:
    """Search OpenAlex for scholarly works (articles, books, datasets, etc.).

    Args:
        query: Free-text search query. Searches across titles, abstracts, and
               full text where available.
               Examples: "CRISPR gene editing", "machine learning healthcare"
        max_results: Maximum number of results to return (1-100, default 10).
        sort: Sort order. Options:
              - "relevance_score:desc" (default)
              - "cited_by_count:desc"
              - "publication_date:desc"
              - "publication_date:asc"
        publication_year: Filter by year. Supports ranges:
              - "2024" (single year)
              - "2020-2024" (range)
              - ">2022" (after 2022)
        open_access: Filter to only open access works (True) or closed (False).
        work_type: Filter by type: "article", "book", "dataset", "preprint", etc.
        include_abstract: Whether to include abstracts in results (default True).

    Returns:
        Markdown-formatted list of matching works with titles, authors,
        citations, DOIs, and optionally abstracts.
    """
    try:
        max_results = max(1, min(100, max_results))
        params: Dict[str, Any] = {
            "search": query,
            "per_page": max_results,
            "sort": sort,
        }

        filters: List[str] = []
        if publication_year:
            if "-" in publication_year:
                start, end = publication_year.split("-", 1)
                filters.append(f"publication_year:{start}-{end}")
            elif publication_year.startswith(">"):
                filters.append(f"publication_year:{publication_year}")
            else:
                filters.append(f"publication_year:{publication_year}")
        if open_access is not None:
            filters.append(f"open_access.is_oa:{'true' if open_access else 'false'}")
        if work_type:
            filters.append(f"type:{work_type}")
        if filters:
            params["filter"] = ",".join(filters)

        data = await api_client.get("works", params)
        meta = data.get("meta", {})
        total = meta.get("count", 0)
        results = data.get("results", [])

        output = f"## OpenAlex Works — \"{query}\"\n\n"
        output += _format_works(results, include_abstract=include_abstract)
        output += f"\n\n*Showing {len(results)} of {total:,} total results.*"
        return output

    except httpx.HTTPStatusError as e:
        logger.error(f"OpenAlex API HTTP error: {e.response.status_code}")
        return f"OpenAlex API error: {e.response.status_code}"
    except Exception as e:
        logger.error(f"search_works failed: {str(e)}", exc_info=True)
        return f"Search failed: {str(e)}"


@mcp.tool()
async def get_work(
    work_id: str,
) -> str:
    """Get detailed information about a single work by its OpenAlex ID, DOI, or PMID.

    Args:
        work_id: The identifier for the work. Accepts:
                 - OpenAlex ID: "W2064815984"
                 - DOI: "https://doi.org/10.1126/science.1231143"
                 - PMID: "pmid:23287718"

    Returns:
        Markdown-formatted work details including title, authors, abstract,
        citations, topics, and open access status.
    """
    try:
        data = await api_client.get_single("works", work_id)
        return _format_works([data], include_abstract=True)
    except httpx.HTTPStatusError as e:
        logger.error(f"OpenAlex API HTTP error: {e.response.status_code}")
        return f"OpenAlex API error: {e.response.status_code}"
    except Exception as e:
        logger.error(f"get_work failed: {str(e)}", exc_info=True)
        return f"Failed to fetch work: {str(e)}"


@mcp.tool()
async def search_authors(
    query: str,
    max_results: int = 10,
) -> str:
    """Search OpenAlex for authors / researchers.

    Args:
        query: Author name or search terms.
               Examples: "Jennifer Doudna", "Yoshua Bengio"
        max_results: Maximum number of results (1-100, default 10).

    Returns:
        Markdown-formatted list of authors with works count, citation count,
        h-index, affiliations, and research topics.
    """
    try:
        max_results = max(1, min(100, max_results))
        params: Dict[str, Any] = {
            "search": query,
            "per_page": max_results,
        }
        data = await api_client.get("authors", params)
        meta = data.get("meta", {})
        total = meta.get("count", 0)
        results = data.get("results", [])

        output = f"## OpenAlex Authors — \"{query}\"\n\n"
        output += _format_authors(results)
        output += f"\n\n*Showing {len(results)} of {total:,} total results.*"
        return output

    except httpx.HTTPStatusError as e:
        logger.error(f"OpenAlex API HTTP error: {e.response.status_code}")
        return f"OpenAlex API error: {e.response.status_code}"
    except Exception as e:
        logger.error(f"search_authors failed: {str(e)}", exc_info=True)
        return f"Search failed: {str(e)}"


@mcp.tool()
async def get_author_works(
    author_id: str,
    max_results: int = 10,
    sort: str = "cited_by_count:desc",
    publication_year: Optional[str] = None,
) -> str:
    """Get works by a specific author.

    Args:
        author_id: The OpenAlex author ID (e.g. "A5067184382") or full URL.
        max_results: Maximum number of results (1-100, default 10).
        sort: Sort order — "cited_by_count:desc" (default), "publication_date:desc",
              "relevance_score:desc".
        publication_year: Filter by year. Supports "2024", "2020-2024", ">2022".

    Returns:
        Markdown-formatted list of the author's works.
    """
    try:
        max_results = max(1, min(100, max_results))
        # Normalize to full URL if just an ID
        if not author_id.startswith("http"):
            author_id = f"https://openalex.org/{author_id}"

        filters = [f"authorships.author.id:{author_id}"]
        if publication_year:
            filters.append(f"publication_year:{publication_year}")

        params: Dict[str, Any] = {
            "filter": ",".join(filters),
            "per_page": max_results,
            "sort": sort,
        }
        data = await api_client.get("works", params)
        meta = data.get("meta", {})
        total = meta.get("count", 0)
        results = data.get("results", [])

        output = f"## Works by Author {author_id.split('/')[-1]}\n\n"
        output += _format_works(results, include_abstract=False)
        output += f"\n\n*Showing {len(results)} of {total:,} total works.*"
        return output

    except httpx.HTTPStatusError as e:
        logger.error(f"OpenAlex API HTTP error: {e.response.status_code}")
        return f"OpenAlex API error: {e.response.status_code}"
    except Exception as e:
        logger.error(f"get_author_works failed: {str(e)}", exc_info=True)
        return f"Failed to fetch author works: {str(e)}"


@mcp.tool()
async def search_institutions(
    query: str,
    max_results: int = 10,
    country: Optional[str] = None,
    institution_type: Optional[str] = None,
) -> str:
    """Search OpenAlex for research institutions.

    Args:
        query: Institution name or search terms.
               Examples: "Harvard", "MIT", "Max Planck"
        max_results: Maximum number of results (1-100, default 10).
        country: Filter by ISO 2-letter country code (e.g. "US", "GB", "DE").
        institution_type: Filter by type: "education", "healthcare", "company",
                          "nonprofit", "government", "facility", "other".

    Returns:
        Markdown-formatted list of institutions with works count, citations,
        country, and type.
    """
    try:
        max_results = max(1, min(100, max_results))
        params: Dict[str, Any] = {
            "search": query,
            "per_page": max_results,
        }
        filters: List[str] = []
        if country:
            filters.append(f"country_code:{country.upper()}")
        if institution_type:
            filters.append(f"type:{institution_type}")
        if filters:
            params["filter"] = ",".join(filters)

        data = await api_client.get("institutions", params)
        meta = data.get("meta", {})
        total = meta.get("count", 0)
        results = data.get("results", [])

        output = f"## OpenAlex Institutions — \"{query}\"\n\n"
        output += _format_institutions(results)
        output += f"\n\n*Showing {len(results)} of {total:,} total results.*"
        return output

    except httpx.HTTPStatusError as e:
        logger.error(f"OpenAlex API HTTP error: {e.response.status_code}")
        return f"OpenAlex API error: {e.response.status_code}"
    except Exception as e:
        logger.error(f"search_institutions failed: {str(e)}", exc_info=True)
        return f"Search failed: {str(e)}"


@mcp.tool()
async def get_cited_by(
    work_id: str,
    max_results: int = 10,
    sort: str = "cited_by_count:desc",
) -> str:
    """Get works that cite a given work.

    Args:
        work_id: The OpenAlex work ID (e.g. "W2064815984") or DOI.
        max_results: Maximum number of citing works to return (1-100, default 10).
        sort: Sort order — "cited_by_count:desc" (default), "publication_date:desc".

    Returns:
        Markdown-formatted list of works that cite the specified work.
    """
    try:
        max_results = max(1, min(100, max_results))
        if not work_id.startswith("http"):
            work_id = f"https://openalex.org/{work_id}"

        params: Dict[str, Any] = {
            "filter": f"cites:{work_id}",
            "per_page": max_results,
            "sort": sort,
        }
        data = await api_client.get("works", params)
        meta = data.get("meta", {})
        total = meta.get("count", 0)
        results = data.get("results", [])

        output = f"## Works Citing {work_id.split('/')[-1]}\n\n"
        output += _format_works(results, include_abstract=False)
        output += f"\n\n*Showing {len(results)} of {total:,} citing works.*"
        return output

    except httpx.HTTPStatusError as e:
        logger.error(f"OpenAlex API HTTP error: {e.response.status_code}")
        return f"OpenAlex API error: {e.response.status_code}"
    except Exception as e:
        logger.error(f"get_cited_by failed: {str(e)}", exc_info=True)
        return f"Failed to fetch citing works: {str(e)}"


@mcp.tool()
async def test_connection() -> str:
    """Test connectivity to the OpenAlex API.

    Returns:
        A message indicating whether the OpenAlex API is reachable.
    """
    try:
        data = await api_client.get("works", {"search": "test", "per_page": 1})
        count = data.get("meta", {}).get("count", 0)
        return f"OpenAlex API is reachable. Found {count:,} works matching 'test'."
    except Exception as e:
        logger.error(f"Connection test failed: {str(e)}", exc_info=True)
        return f"Connection test failed: {str(e)}"


# Run the server when this script is executed directly
def run_server() -> None:
    transport = os.getenv("MCP_TRANSPORT", "stdio").strip().lower()
    host = os.getenv("HOST", "0.0.0.0").strip()

    try:
        port = int(os.getenv("PORT", "8000"))
    except ValueError:
        logger.warning("Invalid PORT value provided; defaulting to 8000")
        port = 8000

    if transport in {"http", "streamable-http"}:
        logger.info(f"Starting MCP server with HTTP on {host}:{port}/mcp")
        mcp.run(transport="http", host=host, port=port)
        return

    if transport == "sse":
        logger.info(f"Starting MCP server with SSE transport on {host}:{port}")
        mcp.run(transport="sse", host=host, port=port)
        return

    logger.info("Starting MCP server with stdio transport")
    mcp.run()


if __name__ == "__main__":
    run_server()
