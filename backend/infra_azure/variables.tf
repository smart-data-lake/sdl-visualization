variable "name" {
  description = "Name prefix for every resource, e.g. sdlb-acme. The storage account name is derived from it and must end up globally unique."
  type        = string

  validation {
    # The derived storage account name is lowercase alphanumeric, at most 24 characters.
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9-]{2,19}$", var.name))
    error_message = "name must start with a letter, contain only letters, digits and hyphens, and be 3 to 20 characters long."
  }
}

variable "resource_group_name" {
  description = "Resource group to deploy into. It must already exist."
  type        = string
}

variable "location" {
  description = "Azure region."
  type        = string
  default     = "westeurope"
}

variable "databricks_hosts" {
  description = <<-EOT
    Databricks workspace origins whose users may use this deployment.

    This is a security control, not a convenience: an Entra token is issued for the
    Azure Databricks first-party resource rather than for one workspace, so a token
    minted for workspace A verifies happily against workspace B. This list is the
    only thing separating them, and it is also what stops the X-Databricks-Host
    header being used to make the service fetch an arbitrary URL.
  EOT
  type        = list(string)

  validation {
    condition     = length(var.databricks_hosts) > 0
    error_message = "At least one workspace must be allowed, or nobody can sign in."
  }

  validation {
    condition     = alltrue([for host in var.databricks_hosts : can(regex("^https://adb-[0-9]+\\.[0-9]{1,2}\\.azuredatabricks\\.net$", host))])
    error_message = "Each host must be a per-workspace Azure Databricks origin, e.g. https://adb-1234567890.4.azuredatabricks.net - the legacy regional form is not accepted."
  }
}

variable "tenant_name" {
  description = <<-EOT
    The single tenant name GET /tenants reports, and the only place the name is
    decided: the SPA adopts this answer rather than defaulting to one of its own, so
    a URL with no tenant lands on whatever is set here.

    Changing it renames the tenant segment of every URL, so existing bookmarks stop
    resolving - they get "Tenant ... does not exist" with a way back, rather than
    silently showing the right data under the wrong name.
  EOT
  type        = string
  default     = "PrivateTenant"
}

variable "allowed_origins" {
  description = <<-EOT
    Extra origins the SPA is served from, for CORS.

    Required as soon as a browser calls the API, despite the app registering
    @fastify/cors itself: the Functions host answers every OPTIONS on its own, so the
    app's CORS never sees a preflight, and an empty list here means the host replies
    to preflights with no headers and the browser blocks every call carrying
    Authorization or X-Databricks-Host.

    Fill it from `terraform output -raw static_site_url` after the first apply, plus
    any custom domain. It cannot be derived from the static site in the same apply;
    static_site.tf says why. A change needs `az functionapp restart` to take effect.

    Never "*": the API answers with whatever the caller's Databricks token grants.
  EOT
  type        = list(string)
  default     = []
}

variable "create_static_site" {
  description = <<-EOT
    Whether to create the Static Web App the SPA is served from.

    Turn it off only when the built frontend is hosted somewhere else, and then put
    that origin in allowed_origins - otherwise the browser refuses every API call
    and the app looks broken in a way the network tab explains and nothing else does.
  EOT
  type        = bool
  default     = true
}

variable "static_site_location" {
  description = <<-EOT
    Region for the Static Web App resource. Separate from `location` because Static
    Web Apps exists in five regions and nothing else here is confined to them. It
    decides where the resource lives, not where the content is served from - that is
    Microsoft's edge either way.
  EOT
  type        = string
  default     = "westeurope"

  validation {
    condition     = contains(["westus2", "centralus", "eastus2", "westeurope", "eastasia"], var.static_site_location)
    error_message = "Static Web Apps exists only in westus2, centralus, eastus2, westeurope and eastasia."
  }
}

variable "static_site_sku" {
  description = <<-EOT
    "Free" or "Standard".

    Free is the default because nothing this app does is on the Standard side of the
    line: the frontend is a static bundle, sign-in is Databricks OAuth in the browser
    rather than anything the platform provides, and the API is the Function app on
    its own hostname. The security that matters here - CSP, HSTS, TLS, no writable
    surface - comes from staticwebapp.config.json and the platform, and is identical
    on both tiers.

    Standard buys an SLA, private endpoints and IP restrictions, a managed identity,
    password protection, more custom domains and a larger upload limit. Take it when
    the site itself has to be unreachable from the public internet, or when an SLA
    has to exist on paper.
  EOT
  type        = string
  default     = "Free"

  validation {
    condition     = contains(["Free", "Standard"], var.static_site_sku)
    error_message = "static_site_sku must be \"Free\" or \"Standard\"."
  }
}

variable "network_isolation" {
  description = <<-EOT
    How reachable the storage account is. A ladder, cheapest first.

    - "none" (default): the storage endpoint is reachable from the internet, but
      there is no key to reach it with - shared-key access is disabled and the app
      authenticates with its managed identity, so a caller needs an Entra token
      holding a data role on this account. Costs nothing.

    - "firewall": as above, plus the endpoint refuses everything except the
      function app's subnet and any management_ip_rules. Needs a virtual network,
      which is free; the endpoint still exists publicly but answers nobody else.

    - "private": the public endpoint is switched off entirely and the account is
      reached only through private endpoints for blob and table. The strongest, and
      the only one where "reachable from the internet" is simply false. Costs a
      virtual network plus two private endpoints.

    Both "firewall" and "private" mean nothing outside the network can touch the
    data - including `yarn seed`, and including you, from a laptop. Add your address
    to management_ip_rules ("firewall" only) or run from inside the network.
  EOT
  type        = string
  default     = "firewall"

  validation {
    condition     = contains(["none", "firewall", "private"], var.network_isolation)
    error_message = "network_isolation must be \"none\", \"firewall\" or \"private\"."
  }
}

variable "management_ip_rules" {
  description = "Public addresses or CIDRs allowed through the storage firewall, for seeding and inspection. Only used when network_isolation is \"firewall\"."
  type        = list(string)
  default     = []
}

variable "vnet_address_space" {
  description = "Address space of the virtual network created for network_isolation \"firewall\" or \"private\"."
  type        = string
  default     = "10.60.0.0/22"
}

variable "functions_subnet_prefix" {
  description = "Subnet the function app integrates with. Delegated to Microsoft.App/environments, as Flex Consumption requires."
  type        = string
  default     = "10.60.0.0/24"
}

variable "private_endpoints_subnet_prefix" {
  description = "Subnet holding the storage private endpoints. Only used when network_isolation is \"private\"."
  type        = string
  default     = "10.60.1.0/24"
}

variable "always_ready_instances" {
  description = <<-EOT
    Instances kept permanently warm. Default 0 - measure before raising it.

    The budget that matters is SDLB's uploader, which gives up after five seconds
    and, unless the job sets stagePath, fails the job rather than the request. The
    measured cold start fits inside it with room to spare: independent measurement
    puts Node on Flex Consumption at 1-2.2 s, and this app adds about 0.6 s of its
    own (module load, Fastify construction, the first table round trip) - so roughly
    1.6-2.8 s against a 5 s budget.

    Always-ready is not free in either sense: the baseline memory is billed
    continuously whether or not anything runs, and enabling it forfeits the monthly
    free grants entirely. Prefer setting stagePath in SDLB, which costs nothing and
    turns a missed upload into a retry on the next run.

    Raise it if measurement here says otherwise, or if a deployment cannot tolerate
    the occasional slow start.
  EOT
  type        = number
  default     = 0
}

variable "maximum_instance_count" {
  description = "Upper bound on scale-out."
  type        = number
  default     = 5
}

variable "instance_memory_in_mb" {
  description = "Memory per instance. 2048 is the Flex Consumption default."
  type        = number
  default     = 512
}

variable "auth_cache_ttl_seconds" {
  description = "How long a verified Databricks token is trusted. Kept short so a revoked token stops working quickly, and long enough that workspace SCIM (about 255 GET/min) is not the bottleneck."
  type        = number
  default     = 300
}

variable "auth_rate_limit_per_minute" {
  description = <<-EOT
    Requests per minute, per address, allowed on the routes that cannot be
    authenticated - the OAuth relay at /api/v1/auth/*, which is the one place a
    stranger can make this service call Databricks.

    Counted in memory, so it is per address *per instance*, and Flex Consumption
    spreads even sequential requests across instances - so what a caller actually
    meets is this times maximum_instance_count. At the defaults that is 10 x 5 = 50
    requests a minute from one address.

    Deliberate: an exact global limit needs a shared store, and this is a brake on
    traffic rather than a door. See src/routes/rateLimit.ts.

    Generous against a person, who signs in once and refreshes about hourly and may
    share an address with a whole office. Ungenerous against a script.
  EOT
  type        = number
  default     = 10
}

variable "log_retention_days" {
  description = "Retention of the Log Analytics workspace behind Application Insights."
  type        = number
  default     = 30
}

variable "tags" {
  description = "Tags applied to every resource."
  type        = map(string)
  default     = {}
}
