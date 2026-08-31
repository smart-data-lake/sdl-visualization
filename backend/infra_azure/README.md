# Azure Deployment

This directory contains Terraform definitions (azurerm 4.x) to deploy SDLB UI on Azure.
It creates a storage account with the data and deployment containers, a Log Analytics workspace with Application Insights, a Flex Consumption plan and the Function app, grants the app's system-assigned
identity blob access to its own storage, and creates the Static Web App the SPA is
served from (`static_site.tf`; `create_static_site = false` if it is hosted
elsewhere).

```bash
cd backend/infra_azure
cp terraform.tfvars.example terraform.tfvars   # then edit it - it is gitignored, and auto-loaded
terraform init
terraform plan
terraform apply                                # creates the app, and the site

./deploy-backend.sh                            # ships the backend into the app

terraform output -raw static_site_url          # -> allowed_origins in the tfvars
terraform apply                                # again, so the API will accept that origin
az functionapp restart -g <rg> -n <name>-funcapp

./deploy-frontend.sh --databricks-client-id <oauth-app-client-id>
```

That is the whole deployment. The apply happens **twice**, and the second one is not
optional: the site's hostname does not exist until the first one has created it, so
`allowed_origins` cannot be derived in the same pass — and without it the browser
blocks every API call while the site itself loads fine. "The frontend" below is why,
and why the restart belongs to that step.

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
configure in SDLB, and `api_base_url` gives what goes after `bundled;` in the SPA's
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

## What is in here

| | |
|---|---|
| `*.tf` | the infrastructure, applied by hand |
| `deploy-backend.sh` | ships the backend into the Function app |
| `deploy-frontend.sh` | ships the SPA into the Static Web App |
| `artifact.sh` | sourced by both: where a build is downloaded from when there is no local one |
| `staticwebapp.config.template.json` | edge headers and SPA fallback, rendered by `deploy-frontend.sh` |
| `terraform.tfvars.example` | the variables, to copy and edit |
| `github-deploy-backend.yml.example` | the same deployment as a workflow, for a repository that wants to own it |

Everything a deployment needs is therefore in this directory, and the two scripts are
the only two places outside the `.tf` files that read the Terraform outputs.

## Shipping the code

`terraform apply` creates the app and the site; it puts no code in either. That is the
two deploy scripts, in the order the block at the top of this file runs them —
`./deploy-backend.sh`, which is also `yarn
deploy` in `backend/`, and `./deploy-frontend.sh`, which is also `yarn deploy-azure` in
the repository root. Between them they are the whole command-line deployment.

Both read the Terraform outputs in this directory, so there is no app name, site name
or API URL to keep in sync by hand; `--app`/`--name`, `--resource-group` and
`--subscription` (or `SDLB_FUNCTION_APP`, `SDLB_RESOURCE_GROUP`,
`SDLB_SUBSCRIPTION`) override that when the state lives elsewhere. Sign in with `az
login` first — the only credential involved is your own Entra token.

### Where the build comes from

**Neither script builds anything by default.** They ship a build that already exists,
and look for it in this order:

| `--source` | the backend deploys | the frontend deploys |
|---|---|---|
| `auto` (default) | `../dist` if it is there, else `release` | `../../build` if it is there, else `release` |
| `local` | `../dist`, or an error | `../../build`, or an error |
| `release` | the newest **published** release's `sdl-visualizer-backend.zip` | its `sdl-visualizer.zip` |
| `develop` | the newest successful `build` run on `develop`, via nightly.link | the same |

```bash
./deploy-backend.sh                    # the working tree's build if there is one
./deploy-backend.sh --build            # run `yarn build` in ../ first, then deploy that
./deploy-backend.sh --source release   # ignore the working tree; deploy the release
./deploy-frontend.sh --source develop --databricks-client-id <id>
./deploy-frontend.sh --artifact ~/Downloads/sdl-visualizer.zip --databricks-client-id <id>
```

The two download URLs, and the artifact names they resolve through, are in
`artifact.sh`:

```
https://github.com/smart-data-lake/sdl-visualization/releases/latest/download/sdl-visualizer.zip
https://nightly.link/smart-data-lake/sdl-visualization/workflows/build/develop/sdl-visualizer.zip
```

`releases/latest/download` serves the newest **published** release, and
`.github/workflows/build.yml` creates them as drafts — so a release nobody has
published yet answers 404, and `--source develop` is the answer until someone does.
nightly.link is there because GitHub's own artifact download needs a token; it hands
out the same bytes without one, and artifacts expire, so a long-idle branch 404s too.
A downloaded file that is not a zip is rejected before anything is unpacked from it,
because an HTML error page saved under a `.zip` name is the failure that looks most
like success.

`--build` exists for the edit-and-deploy loop and runs only the build — not
`type-check`, `lint` or the tests, which the workflow runs on every push and are not
this script's job. It shells out to `yarn build` and `yarn package` in `backend/`, and
to `yarn build` in the repository root: the build belongs to the package being built,
not to the deployment. `--artifact PATH` takes a zip or a directory, for a build that
came from somewhere else entirely.

### What the workflow publishes

`build.yml` has a `build-backend` job, and it knows nothing about this directory: it
runs `yarn build` and then `yarn package`, and uploads the result as
`sdl-visualizer-backend`. The build is not part of the deployment, and does not want to
be.

The artifact holds the *contents* of the package, not a zip of it, so the
`sdl-visualizer-backend.zip` that a download produces is directly deployable — which
is exactly what `--source release` and `--source develop` do with it. Changing an
artifact name in `build.yml` changes the release asset name and the nightly link with
it, so those names and `artifact.sh` move together.

### The backend package

What gets uploaded is *not* the working tree, and this script does not decide what is
in it: `yarn package` in `backend/` (`../scripts/package.ts`) assembles the package, and
`build.yml` calls that same script — so there is one definition of a package, in the
backend, rather than two staging implementations that agree for as long as somebody
remembers to keep them agreeing. What goes into one, and why it is as small as it is, is
"What gets deployed, and cold start" in [../README.md](../README.md).

This script's share of the work is what then happens to it: zip the assembled tree and
post it. `--stage-dir` shows the tree, `--package-only` stops before the upload.
Whatever the source, it is checked for `host.json`, `package.json`, `dist/http.js` and
`node_modules/@azure/functions` first — a package missing any of them uploads
successfully and then registers no routes, which looks like an infrastructure problem
from the outside.

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
`deploy-frontend.sh` (`yarn deploy-azure` in the repository root) ships a build to it.
The two deployments are independent: the static site is served from the Static Web Apps
edge and never routes through this Function app - it is deliberately not attached as a
linked backend, so the SPA reaches the API cross-origin at `api_base_url` and `/api` on
the static host is a plain 404. The comment at the top of `static_site.tf` is why.

`--databricks-client-id` is the OAuth application users sign in with, and is required:
without it the deployed app sends no token and the backend answers 401 to everything,
so the script refuses before it downloads or prepares anything. `--no-auth` overrides
that, for standing a site up before its OAuth app exists.

Three things it does that are worth knowing:

- **It prepares the upload in a staging directory**, never in `build/`. A downloaded
  artifact has to land somewhere anyway, and the two files written below would
  otherwise be left behind in the working tree, where the next `yarn start` would
  serve them. `--stage-dir` names it; `--package-only` stops there.
- **`config/`, `envConfig/`, `description/`, `schema/` and `state/` never reach it.**
  Vite copies all of `public/` into the build, and those are where a developer keeps
  the project they browse locally — most of it gitignored, all of it somebody's real
  data. An `azure` deployment reads none of them; that data comes from the API. They
  are skipped rather than copied and then deleted, because `public/state` can be
  gigabytes. `build.yml` leaves the same directories out of its artifact.
- **It writes `manifest.json` and renders `staticwebapp.config.template.json`.** The
  manifest is read once at startup and decides the backend, the routing shape and the
  identity provider, so the deployed copy has to say `bundled;<api_base_url>` where
  `public/manifest.json` says `local;` — it is written from `apply`'s output rather
  than committed so the two cannot drift, and the build's own manifest is the base so
  a downloaded artifact is configured from the file that shipped with it. The template
  sets the CSP, HSTS and the SPA fallback at the edge, and is substituted rather than
  committed whole because two of the CSP origins — the API and the Databricks
  workspaces — are only known after `apply`. A surviving `__PLACEHOLDER__` would ship
  a CSP that silently blocks every API call, so the rendered file is checked for them.

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
serving. `deploy-frontend.sh` sends a preflight of its own once the upload is done and
says so if the origin is still missing, because from a browser this failure looks
nothing like a CORS problem - the page loads, and every request fails.

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