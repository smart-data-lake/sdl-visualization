/*
  Network isolation for the storage account, when network_isolation asks for it.

  Nothing here exists in the default "none" mode. What makes "none" defensible is
  not the network: it is that the account has no shared key, so reaching the
  endpoint is not the same as being able to read it. These resources close the
  remaining gap - the endpoint answering strangers at all.

  Flex Consumption needs the integration subnet delegated to
  Microsoft.App/environments, and the Microsoft.App resource provider registered in
  the subscription. Registration is not something Terraform should do on your
  behalf, so it is a prerequisite, not a resource.
*/

locals {
  networked  = var.network_isolation != "none"
  private    = var.network_isolation == "private"
  firewalled = var.network_isolation == "firewall"

  # privatelink.* rather than the public suffix: the private endpoint's A record
  # has to win over the CNAME the public name resolves to.
  private_dns_zones = local.private ? {
    blob  = "privatelink.blob.core.windows.net"
    table = "privatelink.table.core.windows.net"
  } : {}
}

resource "azurerm_virtual_network" "this" {
  count               = local.networked ? 1 : 0
  name                = "${var.name}-vnet"
  resource_group_name = data.azurerm_resource_group.this.name
  location            = var.location
  address_space       = [var.vnet_address_space]

  tags = local.tags
  lifecycle {
    ignore_changes = [tags["business_line"], tags["project_code"], tags["project_name"], tags["team"]]
  }
}

resource "azurerm_subnet" "functions" {
  count                = local.networked ? 1 : 0
  name                 = "functions"
  resource_group_name  = data.azurerm_resource_group.this.name
  virtual_network_name = azurerm_virtual_network.this[0].name
  address_prefixes     = [var.functions_subnet_prefix]

  # Service endpoints are what let the storage firewall recognise this subnet in
  # "firewall" mode. Harmless in "private" mode, where private endpoints carry the
  # traffic instead.
  service_endpoints = ["Microsoft.Storage"]

  delegation {
    name = "flex-consumption"
    service_delegation {
      name    = "Microsoft.App/environments"
      actions = ["Microsoft.Network/virtualNetworks/subnets/join/action"]
    }
  }
}

resource "azurerm_subnet" "private_endpoints" {
  count                = local.private ? 1 : 0
  name                 = "private-endpoints"
  resource_group_name  = data.azurerm_resource_group.this.name
  virtual_network_name = azurerm_virtual_network.this[0].name
  address_prefixes     = [var.private_endpoints_subnet_prefix]
}

/* ------------------------------------------------------------- private DNS */

resource "azurerm_private_dns_zone" "storage" {
  for_each            = local.private_dns_zones
  name                = each.value
  resource_group_name = data.azurerm_resource_group.this.name

  tags = local.tags
  lifecycle {
    ignore_changes = [tags["business_line"], tags["project_code"], tags["project_name"], tags["team"]]
  }
}

resource "azurerm_private_dns_zone_virtual_network_link" "storage" {
  for_each              = local.private_dns_zones
  name                  = "${var.name}-${each.key}"
  resource_group_name   = data.azurerm_resource_group.this.name
  private_dns_zone_name = azurerm_private_dns_zone.storage[each.key].name
  virtual_network_id    = azurerm_virtual_network.this[0].id

  tags = local.tags
  lifecycle {
    ignore_changes = [tags["business_line"], tags["project_code"], tags["project_name"], tags["team"]]
  }
}

/* -------------------------------------------------------- private endpoints */

/*
  One per subresource. Blob carries the state files, configurations, descriptions,
  schemas and statistics, and also the deployment package the host pulls on start.
  Table carries every index. Queue and file are deliberately absent: every trigger
  in this app is HTTP, so the runtime needs neither, and each endpoint costs money.
  Adding a Durable Functions trigger later would mean adding the queue one.
*/
resource "azurerm_private_endpoint" "storage" {
  for_each            = local.private_dns_zones
  name                = "${var.name}-${each.key}-pe"
  resource_group_name = data.azurerm_resource_group.this.name
  location            = var.location
  subnet_id           = azurerm_subnet.private_endpoints[0].id

  private_service_connection {
    name                           = "${var.name}-${each.key}"
    private_connection_resource_id = azurerm_storage_account.this.id
    subresource_names              = [each.key]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = each.key
    private_dns_zone_ids = [azurerm_private_dns_zone.storage[each.key].id]
  }

  tags = local.tags
  lifecycle {
    ignore_changes = [tags["business_line"], tags["project_code"], tags["project_name"], tags["team"]]
  }
}
