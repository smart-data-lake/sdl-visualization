/*
  Where the SPA is served from.

  Azure Static Web Apps rather than the storage account's static website feature.
  The storage option is a public blob container behind a URL: no control over
  response headers, so no CSP and no HSTS; no SPA fallback routing; no managed
  certificate on a custom domain; and it could not be this account anyway, which has
  public access and shared keys switched off on purpose. Static Web Apps serves the
  same files from Microsoft's edge, takes its headers and routing from the
  staticwebapp.config.json that ships with the content, renews its own certificate,
  and exposes nothing writable.

  Static content is served by the edge, not by the Functions host - that is true of
  Static Web Apps generally. What is a choice here is that the Function app is *not*
  attached as a linked backend
  (azurerm_static_web_app_function_app_registration is deliberately absent). A link
  would proxy /api/* on this hostname through to the Function app, adding a hop and
  putting SWA's own route and auth rules in front of every API call. Instead the SPA
  calls the Function app at its own absolute URL - manifest.backendConfig, which is
  "azure;<api_base_url>" - and /api on the static host stays a plain 404.

  Nothing is wired to GitHub either: no repository_url, so there is no build the
  platform runs on push. Content is pushed by scripts/deploy-frontend-azure.sh with
  a deployment token fetched at the time it runs.
*/

resource "azurerm_static_web_app" "this" {
  count               = var.create_static_site ? 1 : 0
  name                = "${var.name}-web"
  resource_group_name = data.azurerm_resource_group.this.name
  location            = var.static_site_location

  sku_tier = var.static_site_sku
  sku_size = var.static_site_sku

  # Preview environments only exist for pull requests from a linked repository, and
  # there is no linked repository. Off is less a setting than a statement: there is
  # no second, less watched hostname serving this app.
  preview_environments_enabled = false

  # staticwebapp.config.json travels with the content and is what sets the CSP, the
  # MIME types and the SPA fallback. Letting it take effect is the whole point of
  # shipping it.
  configuration_file_changes_enabled = true

  tags = local.tags
  lifecycle {
    ignore_changes = [tags["business_line"], tags["project_code"], tags["project_name"], tags["team"]]
  }
}

/*
  The site's origin is deliberately not fed into the Function app's CORS rule.

  It reads as the obvious wiring - the hostname exists right here - but the azurerm
  provider drops a site_config cors block entirely when any of its origins is
  unknown at plan time, and plans the app as a no-op. The rule would never be
  written, and nothing would say so. Terraform can only do this in a second apply,
  once the hostname is in state.

  So this is a two-step deployment, and the second step is not optional: the
  Functions host answers OPTIONS itself, before the app is invoked, so the app's own
  @fastify/cors never sees a preflight and an empty allowed_origins means the
  browser blocks every authenticated call. After the first apply:

    terraform output -raw static_site_url          # put it in allowed_origins
    terraform apply
    az functionapp restart -g <rg> -n <name>-funcapp

  The restart matters - the host reads the CORS list at startup and apply alone
  leaves it serving the old one.
*/
