# Phoenix IV Platform — Azure infrastructure skeleton (Canada Central).
#
# THIS IS A SKELETON, NOT READY TO APPLY. Needed before `terraform apply`:
#   - Azure subscription ID / tenant ID for the clinic's environment
#   - Naming convention / resource group approval from the clinic
#   - Confirmation of retention policy (affects backup config below)
#   - A privacy officer / owner to hold the Key Vault access policy
#
# Environments: this file is parameterized by `var.environment` and is meant
# to be applied separately for dev / staging / prod workspaces, each with its
# own state file and its own resource group. Dev/staging must NEVER contain
# real patient data, per the architecture review.

terraform {
  required_version = ">= 1.7.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.110"
    }
  }
}

provider "azurerm" {
  features {
    key_vault {
      purge_soft_delete_on_destroy = false # never allow accidental hard-delete of secrets
    }
  }
}

variable "environment" {
  description = "dev | staging | prod"
  type        = string
}

variable "location" {
  default = "canadacentral"
}

variable "postgres_admin_password" {
  description = "Injected via CI secret / Key Vault reference — never committed."
  type        = string
  sensitive   = true
}

resource "azurerm_resource_group" "main" {
  name     = "rg-phoenix-iv-${var.environment}"
  location = var.location
}

resource "azurerm_log_analytics_workspace" "main" {
  name                = "log-phoenix-iv-${var.environment}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  sku                 = "PerGB2018"
  retention_in_days    = 90 # audit/log retention — confirm against clinic retention policy
}

resource "azurerm_key_vault" "main" {
  name                       = "kv-phxiv-${var.environment}"
  location                   = azurerm_resource_group.main.location
  resource_group_name        = azurerm_resource_group.main.name
  tenant_id                  = data.azurerm_client_config.current.tenant_id
  sku_name                   = "standard"
  purge_protection_enabled   = true
  soft_delete_retention_days = 90
}

data "azurerm_client_config" "current" {}

resource "azurerm_postgresql_flexible_server" "main" {
  name                   = "psql-phoenix-iv-${var.environment}"
  resource_group_name    = azurerm_resource_group.main.name
  location               = azurerm_resource_group.main.location
  version                = "16"
  administrator_login    = "phoenix_admin"
  administrator_password = var.postgres_admin_password
  storage_mb             = 32768
  sku_name               = var.environment == "prod" ? "GP_Standard_D2s_v3" : "B_Standard_B1ms"
  backup_retention_days  = var.environment == "prod" ? 35 : 7
  geo_redundant_backup_enabled = var.environment == "prod" # DR requirement for prod only
  zone                   = "1"

  # No public network access in prod — app connects via private endpoint/VNet
  # integration (not modeled in this skeleton yet — Sprint 2 infra stretch goal).
}

resource "azurerm_container_app_environment" "main" {
  name                       = "cae-phoenix-iv-${var.environment}"
  location                   = azurerm_resource_group.main.location
  resource_group_name        = azurerm_resource_group.main.name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id
}

resource "azurerm_container_app" "api" {
  name                         = "ca-phoenix-iv-api-${var.environment}"
  container_app_environment_id = azurerm_container_app_environment.main.id
  resource_group_name          = azurerm_resource_group.main.name
  revision_mode                = "Single"

  template {
    container {
      name   = "api"
      image  = "REPLACE_WITH_ACR_IMAGE_REF" # set by CI on deploy, not hardcoded here
      cpu    = 0.5
      memory = "1Gi"

      env {
        name        = "DATABASE_URL"
        secret_name = "database-url"
      }
    }
  }

  secret {
    name  = "database-url"
    value = "REPLACE_VIA_KEY_VAULT_REFERENCE" # wire to Key Vault, not a literal, before real use
  }
}

output "resource_group" {
  value = azurerm_resource_group.main.name
}

output "postgres_fqdn" {
  value = azurerm_postgresql_flexible_server.main.fqdn
}
