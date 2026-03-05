# Publications MCP

A collection of [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) servers for searching biomedical research literature. Designed for conversational access to NIH-funded research projects, publications, and PubMed articles.

This project originated from [jbdamask/mcp-nih-reporter](https://github.com/jbdamask/mcp-nih-reporter) and extends it with additional MCP servers and unified Azure infrastructure.

## MCP Servers

### NIH RePORTER (`mcp-nih-reporter/`)

Search [NIH RePORTER](https://reporter.nih.gov/) for federally funded research projects and associated publications. Supports filtering by fiscal year, PI name, organization, funding amount, activity codes, institute codes, and more.

**Tools:** `search_projects`, `search_publications`, `search_combined`, `test_connection`

### PubMed (`mcp-pubmed/`)

Search [PubMed](https://pubmed.ncbi.nlm.nih.gov/) via the free NCBI E-utilities API. Find articles, retrieve details, discover related work, and look up citation counts.

**Tools:** `search_pubmed`, `get_article_details`, `find_related_articles`, `search_by_author`, `get_citation_counts`, `test_connection`

## Deployment

Both servers are deployed as Azure Container Apps using a shared Container Apps environment. Infrastructure is defined in Bicep (`infra/main.bicep`) and managed with [Azure Developer CLI (azd)](https://learn.microsoft.com/azure/developer/azure-developer-cli/).

```bash
cd publications-mcp
azd up
```

## Prerequisites

- Python 3.12+
- [UV](https://docs.astral.sh/uv/) package manager
- [Azure Developer CLI](https://learn.microsoft.com/azure/developer/azure-developer-cli/install-azd) (for deployment)

## License

See [LICENSE](mcp-nih-reporter/LICENSE).
