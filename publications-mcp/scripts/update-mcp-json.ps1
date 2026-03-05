<#
.SYNOPSIS
    Populates .vscode/mcp.json with endpoint URLs from the azd deployment.
.DESCRIPTION
    Reads Bicep outputs via `azd env get-values` and writes the MCP server
    configuration to .vscode/mcp.json at the workspace root.
    Run this from the publications-mcp/ directory after `azd up`.
#>

$ErrorActionPreference = "Stop"

# Get azd environment values as key=value pairs
$envValues = azd env get-values 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to read azd environment. Make sure you've run 'azd up' first."
    exit 1
}

# Parse into a hashtable
$values = @{}
foreach ($line in $envValues -split "`n") {
    $line = $line.Trim()
    if ($line -match '^([A-Z_]+)="?(.*?)"?$') {
        $values[$Matches[1]] = $Matches[2]
    }
}

# Validate required outputs exist
$required = @("SERVICE_NIH_REPORTER_URI", "SERVICE_PUBMED_URI", "SERVICE_OPENALEX_URI")
foreach ($key in $required) {
    if (-not $values.ContainsKey($key)) {
        Write-Error "Missing expected output '$key'. Run 'azd up' and try again."
        exit 1
    }
}

$nihUri     = $values["SERVICE_NIH_REPORTER_URI"].TrimEnd("/") + "/mcp"
$pubmedUri  = $values["SERVICE_PUBMED_URI"].TrimEnd("/") + "/mcp"
$openalexUri = $values["SERVICE_OPENALEX_URI"].TrimEnd("/") + "/mcp"

# Build mcp.json content
$mcpJson = @{
    servers = [ordered]@{
        nihReporter = [ordered]@{
            type = "http"
            url  = $nihUri
        }
        pubmed = [ordered]@{
            type = "http"
            url  = $pubmedUri
        }
        openalex = [ordered]@{
            type = "http"
            url  = $openalexUri
        }
    }
} | ConvertTo-Json -Depth 4

# Write to .vscode/mcp.json (workspace root is one level up from publications-mcp/)
$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\.." )).Path
$vscodeDir = Join-Path $workspaceRoot ".vscode"
if (-not (Test-Path $vscodeDir)) {
    New-Item -ItemType Directory -Path $vscodeDir | Out-Null
}

$mcpJsonPath = Join-Path $vscodeDir "mcp.json"
Set-Content -Path $mcpJsonPath -Value $mcpJson -Encoding utf8
Write-Host "Updated $mcpJsonPath"
Write-Host "  nihReporter: $nihUri"
Write-Host "  pubmed:      $pubmedUri"
Write-Host "  openalex:    $openalexUri"
