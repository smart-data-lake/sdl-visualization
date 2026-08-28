terraform {
  required_version = ">= 1.9"

  required_providers {
    azurerm = {
      source = "hashicorp/azurerm"
      # azurerm_function_app_flex_consumption only exists from 4.4 onwards.
      version = "~> 4.20"
    }
  }

  # Deliberately unconfigured: the settings come from `terraform init
  # -backend-config=...`, so no storage account that only one team can reach is
  # pinned in the repository. For a local read-only look, skip it entirely with
  # `terraform init -backend=false`.
  #backend "azurerm" {}
  backend "local" {
    path = ".tfstate"
  }
}

provider "azurerm" {
  features {}

  # The storage account has no shared key, so any data-plane call the provider makes
  # has to authenticate with the deploying principal's Entra token instead.
  storage_use_azuread = true
}
