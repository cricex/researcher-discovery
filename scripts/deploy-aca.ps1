param(
    [Parameter(Mandatory = $false)]
    [string]$ResourceGroup = "rg-nih-reporter-mcp",

    [Parameter(Mandatory = $false)]
    [string]$Location = "eastus",

    [Parameter(Mandatory = $false)]
    [string]$ContainerAppName = "nih-reporter-mcp",

    [Parameter(Mandatory = $false)]
    [string]$TargetPort = "8000"
)

$ErrorActionPreference = "Stop"

Write-Host "Ensuring Azure CLI containerapp extension is installed..."
az extension add --name containerapp --upgrade | Out-Null

Write-Host "Creating or updating resource group $ResourceGroup in $Location..."
az group create --name $ResourceGroup --location $Location | Out-Null

Write-Host "Deploying Azure Container App from local source..."
az containerapp up `
    --name $ContainerAppName `
    --resource-group $ResourceGroup `
    --location $Location `
    --source . `
    --ingress external `
    --target-port $TargetPort `
    --env-vars MCP_TRANSPORT=streamable-http HOST=0.0.0.0 PORT=$TargetPort

$fqdn = az containerapp show --name $ContainerAppName --resource-group $ResourceGroup --query properties.configuration.ingress.fqdn -o tsv

Write-Host ""
Write-Host "Deployment complete."
Write-Host "MCP endpoint: https://$fqdn/mcp"
