/* -------------------------------------------------------------- live updates */

/*
  Azure Web PubSub carries the "this run changed" notifications to the browser, so the
  run view updates without polling the Function app. Browsers connect to it directly,
  hence its public endpoint stays on in every network_isolation mode; the app reaches it
  with its identity, as local auth is off. See the Live updates section of backend/README.md.
*/
resource "azurerm_web_pubsub" "this" {
  count               = var.live_updates ? 1 : 0
  name                = "${var.name}-wps"
  resource_group_name = data.azurerm_resource_group.this.name
  location            = var.location
  sku                 = var.web_pubsub_sku
  capacity            = 1

  local_auth_enabled            = false
  public_network_access_enabled = true

  identity {
    type = "SystemAssigned"
  }

  tags = local.tags
  lifecycle {
    ignore_changes = [tags["business_line"], tags["project_code"], tags["project_name"], tags["team"]]
  }
}

resource "azurerm_web_pubsub_hub" "sdlb" {
  count         = var.live_updates ? 1 : 0
  name          = "sdlb"
  web_pubsub_id = azurerm_web_pubsub.this[0].id
  # connections need a token minted by POST /api/v1/live/register
  anonymous_connections_enabled = false
}

resource "azurerm_role_assignment" "function_web_pubsub" {
  count                = var.live_updates ? 1 : 0
  scope                = azurerm_web_pubsub.this[0].id
  role_definition_name = "Web PubSub Service Owner"
  principal_id         = azurerm_function_app_flex_consumption.this.identity[0].principal_id
  principal_type       = "ServicePrincipal"
}

locals {
  live_update_settings = var.live_updates ? {
    "SDLB_WEBPUBSUB_ENDPOINT" = "https://${azurerm_web_pubsub.this[0].hostname}"
    "SDLB_WEBPUBSUB_HUB"      = azurerm_web_pubsub_hub.sdlb[0].name
  } : {}
}
