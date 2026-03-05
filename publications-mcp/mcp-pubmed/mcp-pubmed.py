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
        logging.FileHandler(os.path.join(os.path.dirname(os.path.abspath(__file__)), "mcp-pubmed.log")),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger('pubmed-mcp')
logger.info("Starting PubMed MCP server")

# Load environment variables from .env file
load_dotenv()

# Configuration
API_NAME = "PubMed"
API_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
# Optional API key for higher rate limits (10/sec vs 3/sec)
API_KEY = os.getenv("NCBI_API_KEY", "")
TOOL_NAME = "mcp-pubmed"
TOOL_EMAIL = os.getenv("NCBI_TOOL_EMAIL", "")

# Initialize FastMCP server
mcp = FastMCP(API_NAME)


class PubMedClient:
    """Client for interacting with the PubMed E-utilities API"""

    def __init__(self):
        self.base_url = API_BASE
        self.default_params: Dict[str, str] = {}
        if API_KEY:
            self.default_params["api_key"] = API_KEY
        if TOOL_NAME:
            self.default_params["tool"] = TOOL_NAME
        if TOOL_EMAIL:
            self.default_params["email"] = TOOL_EMAIL

    def _params(self, extra: Dict[str, Any]) -> Dict[str, Any]:
        """Merge default params with request-specific params."""
        params = {**self.default_params, **extra}
        return params

    async def esearch(
        self,
        query: str,
        retmax: int = 20,
        retstart: int = 0,
        sort: str = "relevance",
        mindate: Optional[str] = None,
        maxdate: Optional[str] = None,
        datetype: str = "pdat",
    ) -> Dict[str, Any]:
        """Search PubMed and return matching PMIDs."""
        logger.info(f"ESearch query: {query}, retmax={retmax}, sort={sort}")
        params: Dict[str, Any] = {
            "db": "pubmed",
            "term": query,
            "retmax": retmax,
            "retstart": retstart,
            "sort": sort,
            "retmode": "json",
            "usehistory": "y",
            "datetype": datetype,
        }
        if mindate:
            params["mindate"] = mindate
        if maxdate:
            params["maxdate"] = maxdate

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{self.base_url}/esearch.fcgi",
                params=self._params(params),
            )
            response.raise_for_status()
            return response.json()

    async def efetch(
        self,
        pmids: List[str],
        rettype: str = "abstract",
        retmode: str = "xml",
    ) -> str:
        """Fetch full records for a list of PMIDs. Returns XML text."""
        logger.info(f"EFetch pmids={pmids[:5]}... rettype={rettype}")
        params: Dict[str, Any] = {
            "db": "pubmed",
            "id": ",".join(str(p) for p in pmids),
            "rettype": rettype,
            "retmode": retmode,
        }
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(
                f"{self.base_url}/efetch.fcgi",
                params=self._params(params),
            )
            response.raise_for_status()
            return response.text

    async def esummary(self, pmids: List[str]) -> Dict[str, Any]:
        """Fetch document summaries for a list of PMIDs."""
        logger.info(f"ESummary pmids={pmids[:5]}...")
        params: Dict[str, Any] = {
            "db": "pubmed",
            "id": ",".join(str(p) for p in pmids),
            "retmode": "json",
            "version": "2.0",
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{self.base_url}/esummary.fcgi",
                params=self._params(params),
            )
            response.raise_for_status()
            return response.json()

    async def elink(
        self,
        pmids: List[str],
        dbfrom: str = "pubmed",
        db: str = "pmc",
        linkname: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Find linked records (e.g. PubMed → PMC full text)."""
        logger.info(f"ELink pmids={pmids[:5]}... dbfrom={dbfrom} db={db}")
        params: Dict[str, Any] = {
            "dbfrom": dbfrom,
            "db": db,
            "id": ",".join(str(p) for p in pmids),
            "retmode": "json",
        }
        if linkname:
            params["linkname"] = linkname
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{self.base_url}/elink.fcgi",
                params=self._params(params),
            )
            response.raise_for_status()
            return response.json()


# Instantiate the API client
api_client = PubMedClient()


# ---------------------------------------------------------------------------
# XML helpers – lightweight parsing without lxml dependency
# ---------------------------------------------------------------------------
import xml.etree.ElementTree as ET


def _text(el: Optional[ET.Element], default: str = "") -> str:
    """Safely extract text from an XML element."""
    if el is None:
        return default
    return (el.text or default).strip()


def _parse_articles(xml_text: str) -> List[Dict[str, Any]]:
    """Parse EFetch XML into a list of article dicts."""
    root = ET.fromstring(xml_text)
    articles: List[Dict[str, Any]] = []
    for art_el in root.findall(".//PubmedArticle"):
        medline = art_el.find("MedlineCitation")
        if medline is None:
            continue
        article = medline.find("Article")
        if article is None:
            continue

        pmid = _text(medline.find("PMID"))

        # Title
        title = _text(article.find("ArticleTitle"))

        # Abstract
        abstract_parts: List[str] = []
        abstract_el = article.find("Abstract")
        if abstract_el is not None:
            for abs_text in abstract_el.findall("AbstractText"):
                label = abs_text.get("Label", "")
                text = "".join(abs_text.itertext()).strip()
                if label:
                    abstract_parts.append(f"**{label}**: {text}")
                else:
                    abstract_parts.append(text)
        abstract = "\n\n".join(abstract_parts)

        # Authors
        authors: List[str] = []
        author_list = article.find("AuthorList")
        if author_list is not None:
            for author in author_list.findall("Author"):
                last = _text(author.find("LastName"))
                first = _text(author.find("ForeName"))
                if last:
                    authors.append(f"{last} {first}".strip())

        # Journal
        journal_el = article.find("Journal")
        journal_title = ""
        pub_year = ""
        pub_month = ""
        volume = ""
        issue = ""
        if journal_el is not None:
            journal_title = _text(journal_el.find("Title"))
            ji = journal_el.find("JournalIssue")
            if ji is not None:
                volume = _text(ji.find("Volume"))
                issue = _text(ji.find("Issue"))
                pd = ji.find("PubDate")
                if pd is not None:
                    pub_year = _text(pd.find("Year"))
                    pub_month = _text(pd.find("Month"))

        # Pagination
        pages = _text(article.find("Pagination/MedlinePgn"))

        # DOI & PMC ID
        doi = ""
        pmc_id = ""
        article_id_list = art_el.find("PubmedData/ArticleIdList")
        if article_id_list is not None:
            for aid in article_id_list.findall("ArticleId"):
                id_type = aid.get("IdType", "")
                if id_type == "doi":
                    doi = _text(aid)
                elif id_type == "pmc":
                    pmc_id = _text(aid)

        # MeSH terms
        mesh_terms: List[str] = []
        mesh_list = medline.find("MeshHeadingList")
        if mesh_list is not None:
            for mh in mesh_list.findall("MeshHeading"):
                descriptor = mh.find("DescriptorName")
                if descriptor is not None:
                    mesh_terms.append(_text(descriptor))

        # Keywords
        keywords: List[str] = []
        for kw_list in medline.findall("KeywordList"):
            for kw in kw_list.findall("Keyword"):
                keywords.append("".join(kw.itertext()).strip())

        articles.append({
            "pmid": pmid,
            "title": title,
            "abstract": abstract,
            "authors": authors,
            "journal": journal_title,
            "year": pub_year,
            "month": pub_month,
            "volume": volume,
            "issue": issue,
            "pages": pages,
            "doi": doi,
            "pmc_id": pmc_id,
            "mesh_terms": mesh_terms,
            "keywords": keywords,
        })
    return articles


def _format_articles_markdown(articles: List[Dict[str, Any]], include_abstract: bool = True) -> str:
    """Format parsed articles as Markdown."""
    if not articles:
        return "No articles found."

    parts: List[str] = [f"## PubMed Results — {len(articles)} article(s)\n"]
    for i, art in enumerate(articles, 1):
        author_str = ", ".join(art["authors"][:10])
        if len(art["authors"]) > 10:
            author_str += " et al."

        citation_parts: List[str] = []
        if art["journal"]:
            citation_parts.append(f"*{art['journal']}*")
        if art["year"]:
            yr = art["year"]
            if art["month"]:
                yr = f"{art['month']} {yr}"
            citation_parts.append(yr)
        if art["volume"]:
            vol = art["volume"]
            if art["issue"]:
                vol += f"({art['issue']})"
            citation_parts.append(vol)
        if art["pages"]:
            citation_parts.append(art["pages"])
        citation = "; ".join(citation_parts)

        lines = [
            f"### {i}. {art['title']}",
            "",
            f"**PMID:** [{art['pmid']}](https://pubmed.ncbi.nlm.nih.gov/{art['pmid']}/)",
        ]
        if art["doi"]:
            lines.append(f"**DOI:** [{art['doi']}](https://doi.org/{art['doi']})")
        if art["pmc_id"]:
            lines.append(f"**PMC:** [{art['pmc_id']}](https://www.ncbi.nlm.nih.gov/pmc/articles/{art['pmc_id']}/)")
        lines.append(f"**Authors:** {author_str}")
        lines.append(f"**Citation:** {citation}")

        if include_abstract and art["abstract"]:
            lines.extend(["", "#### Abstract", art["abstract"]])

        if art["mesh_terms"]:
            lines.append(f"\n**MeSH:** {', '.join(art['mesh_terms'][:15])}")
        if art["keywords"]:
            lines.append(f"**Keywords:** {', '.join(art['keywords'][:15])}")

        lines.append("")
        lines.append("---")
        parts.append("\n".join(lines))

    return "\n\n".join(parts)


# ---------------------------------------------------------------------------
# MCP Tools
# ---------------------------------------------------------------------------

@mcp.tool()
async def search_pubmed(
    query: str,
    max_results: int = 10,
    sort: str = "relevance",
    min_date: Optional[str] = None,
    max_date: Optional[str] = None,
    include_abstract: bool = True,
) -> str:
    """Search PubMed for articles matching a query and return formatted results.

    Args:
        query: PubMed search query. Supports standard PubMed syntax including
               field tags like [au], [ti], [mesh], [dp], Boolean operators
               (AND, OR, NOT), and filters.
               Examples:
                 - "CRISPR gene editing"
                 - "cancer immunotherapy AND 2024[dp]"
                 - "Smith J[au] AND Nature[journal]"
        max_results: Maximum number of articles to return (1-100, default 10).
        sort: Sort order — "relevance" (default), "date", "pub_date", "author", or "journal".
        min_date: Minimum publication date in YYYY/MM/DD or YYYY format.
        max_date: Maximum publication date in YYYY/MM/DD or YYYY format.
        include_abstract: Whether to include abstracts in results (default True).

    Returns:
        Markdown-formatted list of matching articles with titles, authors,
        journal info, PMIDs, DOIs, and optionally abstracts.
    """
    try:
        max_results = max(1, min(100, max_results))

        search_result = await api_client.esearch(
            query=query,
            retmax=max_results,
            sort=sort,
            mindate=min_date,
            maxdate=max_date,
        )

        esearch_result = search_result.get("esearchresult", {})
        id_list = esearch_result.get("idlist", [])
        total_count = esearch_result.get("count", "0")

        if not id_list:
            return f"No articles found for query: {query}\n(Total matches: {total_count})"

        xml_text = await api_client.efetch(pmids=id_list)
        articles = _parse_articles(xml_text)
        result = _format_articles_markdown(articles, include_abstract=include_abstract)
        result += f"\n\n*Showing {len(articles)} of {total_count} total results.*"
        return result

    except httpx.HTTPStatusError as e:
        logger.error(f"PubMed API HTTP error: {e.response.status_code} - {e.response.text}")
        return f"PubMed API error: {e.response.status_code}"
    except Exception as e:
        logger.error(f"search_pubmed failed: {str(e)}", exc_info=True)
        return f"Search failed: {str(e)}"


@mcp.tool()
async def get_article_details(
    pmids: str,
) -> str:
    """Fetch detailed information for one or more PubMed articles by PMID.

    Args:
        pmids: Comma-separated PMIDs (e.g. "12345678" or "12345678,23456789").

    Returns:
        Markdown-formatted article details including title, authors, abstract,
        journal, DOI, MeSH terms, and keywords.
    """
    try:
        pmid_list = [p.strip() for p in pmids.split(",") if p.strip()]
        if not pmid_list:
            return "Error: No valid PMIDs provided."

        xml_text = await api_client.efetch(pmids=pmid_list)
        articles = _parse_articles(xml_text)

        if not articles:
            return f"No articles found for PMIDs: {pmids}"

        return _format_articles_markdown(articles, include_abstract=True)

    except httpx.HTTPStatusError as e:
        logger.error(f"PubMed API HTTP error: {e.response.status_code} - {e.response.text}")
        return f"PubMed API error: {e.response.status_code}"
    except Exception as e:
        logger.error(f"get_article_details failed: {str(e)}", exc_info=True)
        return f"Fetch failed: {str(e)}"


@mcp.tool()
async def find_related_articles(
    pmid: str,
    max_results: int = 10,
) -> str:
    """Find articles related to a given PubMed article.

    Uses PubMed's "similar articles" algorithm to discover related literature
    based on shared MeSH terms, substances, and keyword overlap.

    Args:
        pmid: The PMID of the source article.
        max_results: Maximum number of related articles to return (1-50, default 10).

    Returns:
        Markdown-formatted list of related articles.
    """
    try:
        max_results = max(1, min(50, max_results))

        link_result = await api_client.elink(
            pmids=[pmid.strip()],
            dbfrom="pubmed",
            db="pubmed",
            linkname="pubmed_pubmed",
        )

        # Extract linked PMIDs
        linked_pmids: List[str] = []
        linksets = link_result.get("linksets", [])
        for ls in linksets:
            for lsdb in ls.get("linksetdbs", []):
                if lsdb.get("linkname") == "pubmed_pubmed":
                    for link in lsdb.get("links", [])[:max_results]:
                        linked_pmids.append(str(link))

        if not linked_pmids:
            return f"No related articles found for PMID {pmid}."

        xml_text = await api_client.efetch(pmids=linked_pmids)
        articles = _parse_articles(xml_text)
        result = f"## Articles Related to PMID {pmid}\n\n"
        result += _format_articles_markdown(articles, include_abstract=False)
        return result

    except httpx.HTTPStatusError as e:
        logger.error(f"PubMed API HTTP error: {e.response.status_code} - {e.response.text}")
        return f"PubMed API error: {e.response.status_code}"
    except Exception as e:
        logger.error(f"find_related_articles failed: {str(e)}", exc_info=True)
        return f"Failed to find related articles: {str(e)}"


@mcp.tool()
async def search_by_author(
    author: str,
    max_results: int = 10,
    sort: str = "date",
    min_date: Optional[str] = None,
    max_date: Optional[str] = None,
    additional_terms: Optional[str] = None,
) -> str:
    """Search PubMed for articles by a specific author.

    Args:
        author: Author name. Formats accepted:
                - "Smith J" (last name + first initial)
                - "Smith John" (last name + first name)
                - "Smith JA" (last name + initials)
        max_results: Maximum number of articles to return (1-100, default 10).
        sort: Sort order — "date" (default), "relevance", "pub_date".
        min_date: Minimum publication date in YYYY/MM/DD or YYYY format.
        max_date: Maximum publication date in YYYY/MM/DD or YYYY format.
        additional_terms: Optional additional search terms to combine with the
                          author search (e.g. "CRISPR" or "Nature[journal]").

    Returns:
        Markdown-formatted list of the author's articles.
    """
    query = f"{author}[au]"
    if additional_terms:
        query = f"{query} AND ({additional_terms})"

    return await search_pubmed(
        query=query,
        max_results=max_results,
        sort=sort,
        min_date=min_date,
        max_date=max_date,
        include_abstract=True,
    )


@mcp.tool()
async def get_citation_counts(
    pmids: str,
) -> str:
    """Get the number of articles that cite each given PMID.

    Args:
        pmids: Comma-separated PMIDs (e.g. "12345678,23456789").

    Returns:
        Markdown table showing each PMID, article title, and how many
        PubMed Central articles cite it.
    """
    try:
        pmid_list = [p.strip() for p in pmids.split(",") if p.strip()]
        if not pmid_list:
            return "Error: No valid PMIDs provided."

        # Get article titles via esummary
        summary = await api_client.esummary(pmid_list)
        summaries = summary.get("result", {})

        # Get citing articles via elink (pubmed → pubmed_pubmed_citedin)
        link_result = await api_client.elink(
            pmids=pmid_list,
            dbfrom="pubmed",
            db="pubmed",
            linkname="pubmed_pubmed_citedin",
        )

        # Build citation counts
        cite_map: Dict[str, int] = {}
        for ls in link_result.get("linksets", []):
            source_ids = ls.get("ids", [])
            source_id = str(source_ids[0]) if source_ids else "unknown"
            for lsdb in ls.get("linksetdbs", []):
                if lsdb.get("linkname") == "pubmed_pubmed_citedin":
                    cite_map[source_id] = len(lsdb.get("links", []))

        # Format as markdown table
        lines = [
            "## Citation Counts\n",
            "| PMID | Title | Cited By |",
            "|------|-------|----------|",
        ]
        for pmid in pmid_list:
            title = "N/A"
            if pmid in summaries and isinstance(summaries[pmid], dict):
                title = summaries[pmid].get("title", "N/A")
            count = cite_map.get(pmid, 0)
            lines.append(
                f"| [{pmid}](https://pubmed.ncbi.nlm.nih.gov/{pmid}/) "
                f"| {title} | {count} |"
            )

        return "\n".join(lines)

    except Exception as e:
        logger.error(f"get_citation_counts failed: {str(e)}", exc_info=True)
        return f"Failed to get citation counts: {str(e)}"


@mcp.tool()
async def test_connection() -> str:
    """Test connectivity to the PubMed E-utilities API.

    Returns:
        A message indicating whether the PubMed API is reachable.
    """
    try:
        result = await api_client.esearch(query="test", retmax=1)
        count = result.get("esearchresult", {}).get("count", "0")
        return f"PubMed API is reachable. Database contains {count} records matching 'test'."
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
