targetScope = 'resourceGroup'

@minLength(1)
@maxLength(64)
@description('Name of the azd environment. Used in generated resource names and tags.')
param environmentName string

@minLength(1)
@description('Primary Azure region for all resources.')
param location string

@description('Optional Azure Container Registry name override.')
param containerRegistryName string = ''

@description('Optional Container Apps environment name override.')
param containerAppsEnvironmentName string = ''

@description('Optional Log Analytics workspace name override.')
param logAnalyticsWorkspaceName string = ''

@description('The startup image for initial provisioning.')
param containerImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

@description('Container ingress target port.')
param containerPort int = 8000

@description('CPU allocated per replica.')
param containerCpu string = '0.5'

@description('Memory allocated per replica.')
param containerMemory string = '1Gi'

@description('Minimum number of replicas.')
param minReplicas int = 0

@description('Maximum number of replicas.')
param maxReplicas int = 3

// ---------- Naming ----------
var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))
var tags = {
  'azd-env-name': environmentName
}

var workspaceName = !empty(logAnalyticsWorkspaceName)
  ? logAnalyticsWorkspaceName
  : take('law${replace(environmentName, '-', '')}${resourceToken}', 63)
var acrName = !empty(containerRegistryName)
  ? containerRegistryName
  : take('acr${replace(environmentName, '-', '')}${resourceToken}', 50)
var managedEnvName = !empty(containerAppsEnvironmentName)
  ? containerAppsEnvironmentName
  : take('cae-${environmentName}-${take(resourceToken, 6)}', 32)
var pullIdentityName = take('id-${environmentName}-acr-${take(resourceToken, 6)}', 128)

var nihReporterAppName = take('ca-${environmentName}-nih-${take(resourceToken, 4)}', 32)
var pubmedAppName = take('ca-${environmentName}-pm-${take(resourceToken, 4)}', 32)
var openalexAppName = take('ca-${environmentName}-oax-${take(resourceToken, 4)}', 32)

// ---------- Shared infrastructure ----------
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: workspaceName
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  tags: tags
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false
    publicNetworkAccess: 'Enabled'
  }
}

resource pullIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: pullIdentityName
  location: location
  tags: tags
}

resource containerAppsEnvironment 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: managedEnvName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

resource acrPullAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(containerRegistry.id, pullIdentity.id, 'AcrPull')
  scope: containerRegistry
  properties: {
    principalId: pullIdentity.properties.principalId
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      '7f951dda-4ed3-4680-a7ca-43fe172d538d'
    )
    principalType: 'ServicePrincipal'
  }
}

// ---------- NIH RePORTER Container App ----------
resource nihReporterApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: nihReporterAppName
  location: location
  tags: union(tags, {
    'azd-service-name': 'nih-reporter'
  })
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${pullIdentity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: containerAppsEnvironment.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: containerPort
        transport: 'auto'
      }
      registries: [
        {
          server: containerRegistry.properties.loginServer
          identity: pullIdentity.id
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'nih-reporter'
          image: containerImage
          env: [
            {
              name: 'MCP_TRANSPORT'
              value: 'streamable-http'
            }
            {
              name: 'HOST'
              value: '0.0.0.0'
            }
            {
              name: 'PORT'
              value: string(containerPort)
            }
          ]
          resources: {
            cpu: json(containerCpu)
            memory: containerMemory
          }
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
      }
    }
  }
  dependsOn: [
    acrPullAssignment
  ]
}

// ---------- PubMed Container App ----------
resource pubmedApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: pubmedAppName
  location: location
  tags: union(tags, {
    'azd-service-name': 'pubmed'
  })
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${pullIdentity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: containerAppsEnvironment.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: containerPort
        transport: 'auto'
      }
      registries: [
        {
          server: containerRegistry.properties.loginServer
          identity: pullIdentity.id
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'pubmed'
          image: containerImage
          env: [
            {
              name: 'MCP_TRANSPORT'
              value: 'streamable-http'
            }
            {
              name: 'HOST'
              value: '0.0.0.0'
            }
            {
              name: 'PORT'
              value: string(containerPort)
            }
          ]
          resources: {
            cpu: json(containerCpu)
            memory: containerMemory
          }
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
      }
    }
  }
  dependsOn: [
    acrPullAssignment
  ]
}

// ---------- OpenAlex Container App ----------
resource openalexApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: openalexAppName
  location: location
  tags: union(tags, {
    'azd-service-name': 'openalex'
  })
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${pullIdentity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: containerAppsEnvironment.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: containerPort
        transport: 'auto'
      }
      registries: [
        {
          server: containerRegistry.properties.loginServer
          identity: pullIdentity.id
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'openalex'
          image: containerImage
          env: [
            {
              name: 'MCP_TRANSPORT'
              value: 'streamable-http'
            }
            {
              name: 'HOST'
              value: '0.0.0.0'
            }
            {
              name: 'PORT'
              value: string(containerPort)
            }
          ]
          resources: {
            cpu: json(containerCpu)
            memory: containerMemory
          }
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
      }
    }
  }
  dependsOn: [
    acrPullAssignment
  ]
}

// ---------- Outputs ----------
output AZURE_LOCATION string = location
output AZURE_RESOURCE_GROUP string = resourceGroup().name
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = containerRegistry.properties.loginServer
output AZURE_CONTAINER_REGISTRY_NAME string = containerRegistry.name
output AZURE_CONTAINER_APPS_ENVIRONMENT_ID string = containerAppsEnvironment.id
output AZURE_CONTAINER_ENVIRONMENT_NAME string = containerAppsEnvironment.name

output SERVICE_NIH_REPORTER_NAME string = nihReporterApp.name
output SERVICE_NIH_REPORTER_URI string = 'https://${nihReporterApp.properties.configuration.ingress.fqdn}'

output SERVICE_PUBMED_NAME string = pubmedApp.name
output SERVICE_PUBMED_URI string = 'https://${pubmedApp.properties.configuration.ingress.fqdn}'

output SERVICE_OPENALEX_NAME string = openalexApp.name
output SERVICE_OPENALEX_URI string = 'https://${openalexApp.properties.configuration.ingress.fqdn}'
