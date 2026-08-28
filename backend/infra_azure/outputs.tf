output "resource_group_name" {
  description = "Resource group the deployment lives in. Read by scripts/deploy-azure.sh."
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
    What to configure as global.uiBackend.baseUrl in SDLB.

    The workspace host is baked in as a query parameter because SDLB cannot send a
    second header - none of its auth modes emits one - and sttp appends its own
    parameters, so one already in the URL survives. Replace the placeholder with the
    workspace the job's token belongs to.
  EOT
  value       = "https://${azurerm_function_app_flex_consumption.this.default_hostname}/api/v1?dbxHost=${length(var.databricks_hosts) > 0 ? var.databricks_hosts[0] : "<workspace>"}"
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
  description = "Name of the Static Web App. Read by scripts/deploy-frontend-azure.sh."
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
