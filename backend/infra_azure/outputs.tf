output "resource_group_name" {
  description = "Resource group the deployment lives in. Read by deploy-backend.sh."
  value       = data.azurerm_resource_group.this.name
}

output "function_app_name" {
  description = "Name of the Function app, for `func azure functionapp publish` or the deploy workflow."
  value       = azurerm_function_app_flex_consumption.this.name
}

output "hostname" {
  description = "Default hostname of the Function app."
  value       = azurerm_function_app_flex_consumption.this.default_hostname
}

output "api_base_url" {
  description = "What to put after \"azure;\" in the SPA's manifest.json backendConfig."
  value       = "https://${azurerm_function_app_flex_consumption.this.default_hostname}/api/v1"
}

output "mcp_base_url" {
  description = "MCP endpoint. An agent connects to <mcp_base_url>/{repo}/{env}."
  value       = "https://${azurerm_function_app_flex_consumption.this.default_hostname}/mcp"
}

output "uibackend_base_url" {
  description = <<-EOT
    What to configure as global.uiBackend.baseUrl in SDLB. The same URL as
    api_base_url, named separately because the two things that consume it are
    configured in different places.

    Plain, with no dbxHost: a job authenticates with an access token minted in the
    UI under Settings -> Access Token, which is already scoped to one repository and
    environment and so never has to name a workspace. The backend still accepts a
    Databricks token with ?dbxHost=<workspace> appended - SDLB can send no second
    header - but that is a credential for the whole workspace API and is not what
    this deployment expects.
  EOT
  value       = "https://${azurerm_function_app_flex_consumption.this.default_hostname}/api/v1"
}

output "storage_account_name" {
  description = "Storage account holding the tables and blobs."
  value       = azurerm_storage_account.this.name
}

output "storage_reachable_from_internet" {
  description = "Whether the storage endpoint answers from outside. False only with network_isolation = \"private\"; in \"firewall\" mode it exists but refuses everyone not allowed."
  value       = azurerm_storage_account.this.public_network_access_enabled
}

output "storage_shared_key_enabled" {
  description = "Always false: the app and the runtime authenticate with the managed identity, so no key exists to be leaked in an app setting."
  value       = azurerm_storage_account.this.shared_access_key_enabled
}

output "static_site_name" {
  description = "Name of the Static Web App. Read by deploy-frontend.sh."
  value       = one(azurerm_static_web_app.this[*].name)
}

output "static_site_url" {
  description = "Where the SPA is served from. This is the URL to open."
  value       = try("https://${azurerm_static_web_app.this[0].default_host_name}", null)
}

output "databricks_hosts" {
  description = "Workspaces allowed to use this deployment. The frontend deploy script puts them in the page's connect-src, since the browser talks to them directly during sign-in."
  value       = var.databricks_hosts
}
