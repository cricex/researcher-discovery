# NIH RePORTER MCP

A Model Context Protocol [(MCP)](https://modelcontextprotocol.io/introduction) server for chatting with [NIH RePORTER](https://reporter.nih.gov/). Search for NIH-funded research projects and publications in a conversational manner.
Accompanying blog post [here](https://open.substack.com/pub/johndamask/p/building-an-mcp-server-over-nihs?r=2ee1b&utm_campaign=post&utm_medium=web&showWelcomeOnShare=true).

![img](/img/mcp-nih-reporter-claude.png)


## Features

- Search NIH-funded research projects with various criteria:
  - Fiscal years
  - Principal Investigator names
  - Organization details (name, state, city, type, department)
  - Funding amounts
  - COVID-19 response status
  - Funding mechanism
  - Institute/Center codes
  - RCDC terms
  - Date ranges
- Search publications associated with NIH projects
- Combined search functionality for both projects and publications
- Detailed project and publication information including abstracts
- Configurable result limits

## Prerequisites

- Python 3.12 or higher
- UV package manager (recommended for faster dependency installation)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd mcp-nih-reporter
```

2. Create and activate a virtual environment:
```bash
python -m venv .venv
source .venv/bin/activate  # On Windows, use `.venv\Scripts\activate`
```

3. Install dependencies using UV:
```bash
uv pip install -e .
```
## Usage

This MCP server provides access to the NIH RePORTER API through several tools:

- `search_projects`: Search for NIH-funded research projects
- `search_publications`: Search for publications associated with NIH projects
- `search_combined`: Combined search for both projects and publications
- `test_connection`: Test the API connection

You can use this MCP with any MCP-compatible client, such as:
- Claude Desktop
- Cursor
- Other MCP-enabled tools

### Example claude_desktop_config.json
```
{
  "mcpServers": {
	 "nih-reporter": {
	      "command": "<fully qualified path to>/uv",
	      "args": [
	        "run",
	        "--with",
	        "mcp[cli]",
	        "mcp",
	        "run",
	        "<fully qualified path to>/mcp-nih-reporter/mcp-nih-reporter.py"
	      ]
	    }
  }
}
```

The search results will be returned in a structured format containing project details including:
- Project title and abstract
- Principal Investigator information
- Organization details
- Funding information
- Project dates and status

## Running As A Containerized Web App

This server now supports multiple transports using environment variables:

- `MCP_TRANSPORT=stdio` (default, local desktop clients)
- `MCP_TRANSPORT=streamable-http` (recommended for cloud/containers)
- `MCP_TRANSPORT=sse` (legacy)

When running in HTTP mode, the MCP endpoint is available at:

- `http://<host>:<port>/mcp`

### Local Docker Run

Build and run locally:

```bash
docker build -t nih-reporter-mcp:local .
docker run --rm -p 8000:8000 -e MCP_TRANSPORT=streamable-http -e HOST=0.0.0.0 -e PORT=8000 nih-reporter-mcp:local
```

Then connect your MCP client to:

- `http://localhost:8000/mcp`

## Deploying To Azure Container Apps (ACA)

This repository includes an `azd` + Bicep setup (`azure.yaml` and `infra/main.bicep`) so you can provision ACA infrastructure with `azd provision`.

### 1. Initialize azd environment

From the repository root:

```bash
azd auth login
azd env new
```

### 2. Provision infrastructure with Bicep

```bash
azd provision
```

This creates:

- Resource group
- Log Analytics workspace
- Azure Container Registry (ACR)
- Container Apps environment
- Container App (`mcp`) configured for `streamable-http` on port `8000`

### 3. Deploy application image (recommended)

Provisioning creates the infrastructure and an initial placeholder image. To deploy this repo's Docker image:

```bash
azd deploy mcp
```

Or do both steps in one command:

```bash
azd up
```

### 4. Get the endpoint

```bash
azd env get-value SERVICE_MCP_URI
```

Use:

- `https://<fqdn>/mcp`

## Debugging

A log file will be created in the root folder when the MCP attempts to run in a client (e.g. Claude Desktop). Check there if you're having trouble.

## Development

The project uses:
- `httpx` for async HTTP requests
- `mcp` for the Mission Control Protocol implementation
- `python-dotenv` for environment variable management
- `uv` for dependency management

## Logging

Logs are written to `mcp-nih-reporter.log` in the project root directory. The logging level is set to INFO by default.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please make sure to update tests as appropriate and follow the existing code style.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
