/*
  The SDLB backend: one Function app, one storage account, one Application Insights.

  Flex Consumption rather than plain Consumption: Linux Consumption is retiring, is
  getting no new language versions, and stops at Node 22.

  No always-ready instance by default. The tightest deadline on this service is
  SDLB's five second upload timeout, and a cold start measures at roughly 1.6-2.8 s
  end to end - see the always_ready_instances variable for the breakdown and for
  what turning it on actually costs.

  The storage account holds two unrelated things - the runtime's own bookkeeping and
  this service's tables and blobs. They share an account for simplicity; split them
  if the operational noise ever matters.
*/

locals {
  # Storage account names are lowercase alphanumeric and at most 24 characters.
  storage_name = substr(lower(replace("${var.name}stg", "-", "")), 0, 24)

  blob_container       = "sdlb"
  deployment_container = "deployment"

  tags = merge(var.tags, {
    application = "sdlb-backend"
  })
}

data "azurerm_resource_group" "this" {
  name = var.resource_group_name
}

/* --------------------------------------------------------------------- storage */

resource "azurerm_storage_account" "this" {
  name                     = local.storage_name
  resource_group_name      = data.azurerm_resource_group.this.name
  location                 = var.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  account_kind             = "StorageV2"

  min_tls_version                 = "TLS1_2"
  https_traffic_only_enabled      = true
  allow_nested_items_to_be_public = false

  /*
    No shared key, in any mode. This is the part that matters most: an account-key
    connection string in an app setting is a data-plane credential that works from
    anywhere the endpoint answers, so a leaked setting is a data breach whatever the
    network says. With the key gone, both the runtime and the app authenticate with
    the app's managed identity and a caller needs an Entra token holding a role on
    this account. See src/store/credential.ts.
  */
  shared_access_key_enabled = false

  public_network_access_enabled = !local.private

  dynamic "network_rules" {
    for_each = local.firewalled ? [1] : []
    content {
      default_action = "Deny"
      # AzureServices covers the platform's own access to the deployment container.
      bypass                     = ["AzureServices"]
      ip_rules                   = var.management_ip_rules
      virtual_network_subnet_ids = azurerm_subnet.functions[*].id
    }
  }

  tags = local.tags
  lifecycle {
    ignore_changes = [tags["business_line"], tags["project_code"], tags["project_name"], tags["team"]]
  }
}

# State files, exported configurations, description markdown and its images,
# schemas and statistics. Everything large lives here; the tables only index it.
resource "azurerm_storage_container" "data" {
  name                  = local.blob_container
  storage_account_id    = azurerm_storage_account.this.id
  container_access_type = "private"
}

# Where the Functions host reads its deployment package from.
resource "azurerm_storage_container" "deployment" {
  name                  = local.deployment_container
  storage_account_id    = azurerm_storage_account.this.id
  container_access_type = "private"
}

/* ------------------------------------------------------------------ telemetry */

# Classic Application Insights is retired, so the workspace is not optional.
resource "azurerm_log_analytics_workspace" "this" {
  name                = "${var.name}-logs"
  resource_group_name = data.azurerm_resource_group.this.name
  location            = var.location
  sku                 = "PerGB2018"
  retention_in_days   = var.log_retention_days

  tags = local.tags
  lifecycle {
    ignore_changes = [tags["business_line"], tags["project_code"], tags["project_name"], tags["team"]]
  }
}

resource "azurerm_application_insights" "this" {
  name                = "${var.name}-insights"
  resource_group_name = data.azurerm_resource_group.this.name
  location            = var.location
  workspace_id        = azurerm_log_analytics_workspace.this.id
  application_type    = "web"

  tags = local.tags
  lifecycle {
    ignore_changes = [tags["business_line"], tags["project_code"], tags["project_name"], tags["team"]]
  }
}

/* ------------------------------------------------------------------- function */

resource "azurerm_service_plan" "this" {
  name                = "${var.name}-plan"
  resource_group_name = data.azurerm_resource_group.this.name
  location            = var.location
  os_type             = "Linux"
  sku_name            = "FC1"

  tags = local.tags
  lifecycle {
    ignore_changes = [tags["business_line"], tags["project_code"], tags["project_name"], tags["team"]]
  }
}

resource "azurerm_function_app_flex_consumption" "this" {
  name                = "${var.name}-funcapp"
  resource_group_name = data.azurerm_resource_group.this.name
  location            = var.location
  service_plan_id     = azurerm_service_plan.this.id

  storage_container_type      = "blobContainer"
  storage_container_endpoint  = "${azurerm_storage_account.this.primary_blob_endpoint}${azurerm_storage_container.deployment.name}"
  storage_authentication_type = "SystemAssignedIdentity"

  runtime_name = "node"
  # Node 24 is GA on Functions v4 until April 2028; Node 20 has already dropped off
  # the supported list. The "Node 22 is the last version on Linux Consumption" note
  # does not apply here - this is Flex Consumption.
  runtime_version = "24"

  instance_memory_in_mb                          = var.instance_memory_in_mb
  maximum_instance_count                         = var.maximum_instance_count
  webdeploy_publish_basic_authentication_enabled = false

  https_only = true

  # Outbound integration, so the app can reach a firewalled or private endpoint.
  virtual_network_subnet_id = one(azurerm_subnet.functions[*].id)

  dynamic "always_ready" {
    for_each = var.always_ready_instances > 0 ? [1] : []
    content {
      name           = "http"
      instance_count = var.always_ready_instances
    }
  }

  identity {
    type = "SystemAssigned"
  }

  site_config {
    application_insights_connection_string = azurerm_application_insights.this.connection_string
    minimum_tls_version                    = "1.2"
    health_check_path                      = "/health"
    health_check_eviction_time_in_min      = 2

    /*
      Required once a browser talks to this app, and easy to think optional because
      the app registers @fastify/cors itself. It is not: the Functions host answers
      every OPTIONS request on its own, before the worker is invoked, so the app's
      CORS never sees a preflight. With no origins here the host replies 204 with no
      headers, and the browser blocks any request carrying Authorization or
      X-Databricks-Host - which is every authenticated call.

      Literal origins only. This cannot be fed from
      azurerm_static_web_app.default_host_name: when any element is unknown at plan
      time the provider drops the whole block and plans the app as a no-op, so the
      rule would silently never be written. See the note in static_site.tf.

      The host reads this at startup, so a change needs a restart to take effect -
      `az functionapp restart` - and terraform apply alone will not do it.
    */
    dynamic "cors" {
      for_each = length(var.allowed_origins) > 0 ? [1] : []
      content {
        allowed_origins     = var.allowed_origins
        support_credentials = false
      }
    }
  }

  app_settings = {
    # The runtime reaches its own storage through the app's identity, not a key.
    "AzureWebJobsStorage__accountName" = azurerm_storage_account.this.name

    # The account name, not a connection string: the app builds its own clients from
    # the managed identity, so there is no key here to leak. See store/credential.ts.
    "SDLB_STORAGE_ACCOUNT" = azurerm_storage_account.this.name
    "SDLB_BLOB_CONTAINER"  = azurerm_storage_container.data.name

    "SDLB_TENANT_NAME"                = var.tenant_name
    "SDLB_AUTH_MODE"                  = "databricks"
    "SDLB_DATABRICKS_HOSTS"           = join(",", var.databricks_hosts)
    "SDLB_AUTH_CACHE_TTL_SECONDS"     = tostring(var.auth_cache_ttl_seconds)
    "SDLB_AUTH_RATE_LIMIT_PER_MINUTE" = tostring(var.auth_rate_limit_per_minute)
  }

  tags = local.tags
  lifecycle {
    # The hidden-link tag is Azure's own, added when Application Insights is
    # connected; left unignored, every apply plans to remove it and the portal
    # immediately puts it back.
    ignore_changes = [
      tags["business_line"], tags["project_code"], tags["project_name"], tags["team"],
      tags["hidden-link: /app-insights-resource-id"],
    ]
  }

  # The role assignment below needs the identity, which only exists once the app
  # does - so the app is necessarily created before it may read its own deployment
  # container. The host retries, and the first successful start may lag the apply by
  # a minute. Nothing to fix; just do not read the first cold start as a failure.
  depends_on = [azurerm_storage_container.deployment]
}

/* ------------------------------------------------------------------ identity */

/*
  With no shared key on the account, these role assignments are the only way in -
  for the runtime and for the app alike.

  Blob covers three things: the deployment container the host pulls its package
  from, the AzureWebJobsStorage bookkeeping, and this service's own state files,
  configurations, descriptions, schemas and statistics. Table covers every index.

  Queue and file are deliberately absent - every trigger here is HTTP, so the
  runtime needs neither. Adding a queue or Durable trigger later means adding
  Storage Queue Data Contributor and a queue private endpoint.
*/
locals {
  storage_roles = {
    blob  = "Storage Blob Data Owner"
    table = "Storage Table Data Contributor"
  }
}

resource "azurerm_role_assignment" "function_storage" {
  for_each             = local.storage_roles
  scope                = azurerm_storage_account.this.id
  role_definition_name = each.value
  principal_id         = azurerm_function_app_flex_consumption.this.identity[0].principal_id
  principal_type       = "ServicePrincipal"
}
