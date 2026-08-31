# Azure Deployment

This directory contains Terraform definitions (azurerm 4.x) to deploy SDLB UI on Azure.
It creates a storage account with the data and deployment containers, a Log Analytics workspace with Application Insights, a Flex Consumption plan and the Function app, grants the app's system-assigned
identity blob access to its own storage, and creates the Static Web App the SPA is
served from (`static_site.tf`; `create_static_site = false` if it is hosted
elsewhere).

```bash
cd infra_azure
cp terraform.tfvars.example terraform.tfvars   # then edit it - it is gitignored, and auto-loaded
terraform init
terraform plan
terraform apply
```

The state is a local file (`.tfstate`, gitignored) so that a single operator can
apply from a laptop without a state store existing first. Swap the `backend "local"`
block in `versions.tf` for the commented-out `backend "azurerm" {}` and pass
`terraform init -backend-config=...` once more than one person applies.

`terraform init -backend=false` is enough for `validate` and `fmt` if you only want
to read it.

## Reaching storage

The account has **no shared key** - `shared_access_key_enabled = false` - in every
mode. That is the part worth caring about most: an account-key connection string in
an app setting is a data-plane credential that works from anywhere the endpoint
answers, so a leaked setting is a data breach whatever the network is doing. Instead
the runtime and the app both authenticate with the app's managed identity, which
holds Storage Blob Data Owner and Storage Table Data Contributor on this account and
nothing else. Queue and file are deliberately ungranted: every trigger here is HTTP.

`network_isolation` then decides how reachable the endpoint is at all:

| | endpoint | cost | what breaks |
|---|---|---|---|
| `none` (default) | public, but needs an Entra token with a data role | none | nothing |
| `firewall` | public, refuses all but the app's subnet and `management_ip_rules` | a virtual network (free) | `yarn seed` from an address not in the list |
| `private` | **switched off**; blob and table reached only through private endpoints | network + 2 private endpoints | anything outside the network, including you |

Both networked modes create a subnet delegated to `Microsoft.App/environments` and
integrate the app with it, which is what Flex Consumption requires — and the
`Microsoft.App` resource provider has to be registered in the subscription first.
Terraform itself keeps working in `private` mode, because containers are managed
through the ARM control plane rather than the data plane; the seed script does not,
because it writes actual data.

Two further choices worth knowing about:

- **Nothing is kept warm** (`always_ready_instances`, default 0). The tightest
  deadline here is SDLB's five second upload timeout, and a cold start measures at
  roughly 1.6-2.8 s: 1-2.2 s for the platform (independently measured for Node on
  Flex Consumption) plus about 0.6 s of ours. Always-ready bills its baseline memory
  continuously and forfeits the monthly free grants entirely, which is a poor trade
  against that margin - set `stagePath` in SDLB instead, which costs nothing. Raise
  it if your own measurements disagree.
- **`databricks_hosts` is a security control, not a convenience.** It is validated
  against the per-workspace URL form, and an empty list is rejected. See
  "Databricks Authentication" above for why the allowlist is the thing separating one workspace
  from another.

`terraform output uibackend_base_url` gives the `global.uiBackend.baseUrl` to
configure in SDLB, and `api_base_url` gives what goes after `azure;` in the SPA's
`manifest.json` - they are the same URL, named twice because the two things that
consume it are configured in different places.

The identity cannot be granted access to the deployment container until the app
exists to have an identity, so the app is necessarily created before it may read its
own package. The host retries; do not read the first cold start as a failure.

`infra_azure/github-deploy-backend.yml.example` is the same thing as a workflow
(`workflow_dispatch`, with a `plan_only` switch), for a repository that wants to own
the deployment: it authenticates with federated credentials — `AZURE_CLIENT_ID`,
`AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` and the three `TFSTATE_*` variables — and
keeps the state in a storage account rather than in the working tree. It is an
example rather than an installed workflow on purpose; deploying from a laptop is the
supported path.

## Shipping the code

`terraform apply` creates the app; it does not put any code in it. That is
`scripts/deploy-azure.sh`, which is the whole command-line deployment:

```bash
cd backend
yarn deploy                  # check, build, package, upload, wait for /health
yarn deploy --skip-checks    # same without type-check and tests
yarn deploy --package-only   # build the zip and stop, to look inside it
```

It reads `function_app_name` and `resource_group_name` from the Terraform outputs in
`infra_azure/`, so there is no app name to keep in sync by hand; `--app`,
`--resource-group` and `--subscription` (or `SDLB_FUNCTION_APP`,
`SDLB_RESOURCE_GROUP`, `SDLB_SUBSCRIPTION`) override that when the state lives
elsewhere. Sign in with `az login` first — the only credential involved is your own
Entra token.

What it uploads is assembled in a staging directory, not taken from the working
tree: `host.json`, `package.json` and `dist/` at the root of the zip, plus a
production-only install — `@azure/functions` and nothing else, because the bundle
inlines the rest. That is about 880 kB, and every cold-starting instance downloads
all of it, which is why the build is esbuild rather than `tsc` (see "What gets
deployed, and cold start"). The dev `node_modules/` is never touched.

`webdeploy_publish_basic_authentication_enabled = false`, so there is no publish
profile and no password: the script presents the Entra token `az` already holds. A
401 from the deployment step means the signed-in principal has no rights on the app,
not that a secret is missing.

It posts to the one-deploy API rather than running `az functionapp deployment source
config-zip`, which is otherwise the same thing. That command finishes by fetching a
host key to poll the app with, and host keys live in the storage account — which has
no shared key, so `az functionapp keys list` answers `Bad Request` and the command
exits non-zero *after* a successful upload. Posting to the API directly returns a
deployment id to poll, which needs no key.

Afterwards the script polls `/health` until the app answers — the first attempts
failing is normal, since a Flex Consumption cold start is 1.6-2.8 s and the role
assignment letting the app read its own package may still be propagating.

`func azure functionapp publish` also works if the Core Tools are installed, but it
runs its own build and its own dependency install, so what it ships is not what
`scripts/bundle.ts` produced.

## The frontend

`terraform output static_site_url` is where the SPA is served from, and
`../scripts/deploy-frontend-azure.sh` (`yarn deploy-azure` in the repository root)
ships a build to it. The two deployments are independent: the static site is served from the
Static Web Apps edge and never routes through this Function app, and the SPA reaches
the API cross-origin at `api_base_url`. See the root README, and the comment at the
top of `infra_azure/static_site.tf` for why no linked backend is registered.

CORS is where this bites. `@fastify/cors` in `src/app.ts` handles it for simple
requests, but **the Functions host answers every `OPTIONS` on its own, before the
worker is invoked** - so the app's CORS never sees a preflight, and only
`allowed_origins` in the Terraform can satisfy one. Every authenticated call carries
`Authorization` and `X-Databricks-Host`, neither safelisted, so all of them are
preflighted: an empty `allowed_origins` means the browser blocks the entire API while
the site itself loads fine.

It cannot be filled from the static site in the same apply - the provider silently
drops a `cors` block whose origins are unknown at plan time - so it is a second
apply, with `terraform output -raw static_site_url`. The host reads the list at
startup, so follow it with `az functionapp restart`; apply alone leaves the old list
serving.

Two related endpoints exist for the same reason. `POST /api/v1/auth/token` and
`/auth/refresh` relay the browser's OAuth code exchange to the workspace, because the
workspace's `/oidc/v1/token` sends no CORS headers at all and does not answer
preflight - see `relayTokenRequest` in `src/auth/databricks.ts` for why that is safe
to expose unauthenticated.

They are also the only routes that cannot be authenticated, and therefore the one
place a stranger can make this service call Databricks. `src/routes/rateLimit.ts` is
a fixed-window limit on them, `auth_rate_limit_per_minute` in the Terraform, refusing
with a 429 and a `Retry-After`.

The rate limiter counts in memory, so it is per address and **per instance**:
Flex Consumption spreads even strictly sequential requests across instances - measured, 42 requests landed on five instances - so at the defaults one address meets 10 x 5 = 50 requests a minute, not 10. An exact global limit needs a shared store on the path of every request, that is not worth it.