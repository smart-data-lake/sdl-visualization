# SDLB backend and MCP server

The service behind the viewer, for the Azure deployment. One Azure Functions app
(Node 24, v4 model) serving three audiences from one process:

| audience | endpoint | contract |
|---|---|---|
| the SPA | `/api/v1/*` | `spec/upstream-openapi.json`, i.e. what `src/api/fetchAPI_rest.ts` already calls |
| SDLB jobs | `/api/v1/*` uploads | what `global.uiBackend` pushes |
| coding agents | `/mcp/{repo}/{env}` | MCP, read-only tools |

Storage is Azure Table Storage plus Blob Storage. Blob holds every file and every
large payload — state files, exported configurations, description markdown and its
images, schemas, statistics — and the tables hold only what has to be queried.

## Why the agents are on MCP and the SPA is not

They want opposite things from the same data. The SPA wants whole objects to render:
a state file with four hundred actions is exactly right for a timeline. An agent
wants a small answer to a specific question; that same state file is a context bomb.
The SPA also needs HTTP caching, binary responses and status codes, none of which
JSON-RPC gives it.

So the split is by transport, not by service. `routes/` and `mcp/` both contain only
translation; everything that knows anything lives in `services/`. Every MCP tool is
one service call and a formatter, which is why a "diagnose this run" button in the
UI would be a REST route over code that already exists.

## Running it

```bash
yarn install
yarn azurite          # in one terminal: the storage emulator
yarn seed             # push tests/e2e/fixtures through the upload API
yarn serve            # http://localhost:7071
```

`yarn serve` is a plain Node server that dispatches the same way the Function does —
Fastify for everything, the MCP handler for `/mcp/*` — so you do not need Azure
Functions Core Tools to work on it. With Core Tools installed, `yarn start` runs the
real host instead.

`yarn serve:e2e` does the lot in one process: a throwaway Azurite, the fixtures
seeded, and the server on port 7071. That is what the `azure` Playwright project
starts.

Point an MCP client at `http://localhost:7071/mcp/getting-started/dev`, or open the
Inspector:

```bash
npx @modelcontextprotocol/inspector http://localhost:7071/mcp/getting-started/dev
```

### Settings

Copy `local.settings.json.example` to `local.settings.json`.

| setting | meaning |
|---|---|
| `SDLB_STORAGE_ACCOUNT` | storage account name, reached with the managed identity. What the deployment uses |
| `SDLB_STORAGE_CONNECTION_STRING` | Azurite, locally. Ignored when `SDLB_STORAGE_ACCOUNT` is set |
| `SDLB_BLOB_CONTAINER` | container name, default `sdlb` |
| `SDLB_TENANT_NAME` | the single tenant name `GET /tenants` reports, default `PrivateTenant` |
| `SDLB_AUTH_MODE` | `databricks`, or `disabled` for local work |
| `SDLB_DATABRICKS_HOSTS` | comma-separated workspace origins that may use this deployment |
| `SDLB_AUTH_CACHE_TTL_SECONDS` | how long a verified token is trusted, default 300 |

## Authentication

A caller presents a Databricks token and says which workspace it belongs to, as
`Authorization: Bearer <token>` plus `X-Databricks-Host`. The order of the checks in
`auth/databricks.ts` matters:

1. **The host is checked against an allowlist before anything is sent to it.** An
   Entra token is issued for the Azure Databricks first-party resource rather than
   for one workspace, so a token minted for workspace A verifies against workspace B
   — the allowlist is the only thing separating them. It is also what stops the
   header being used to make this service fetch an arbitrary URL.
2. The workspace's own `scim/v2/Me` endpoint is asked who the token belongs to.
3. The `Workspaces` table may narrow a workspace to certain repositories,
   environments or a Databricks group. A workspace with no row is allowed
   everything, so a deployment that needs no rules needs no rows.
4. The answer is cached for five minutes, keyed by a hash of the token *and* the
   host. Workspace SCIM allows about 255 GET/min, so this is correctness rather than
   speed. The raw token is never stored.

SDLB cannot send a second header — none of its auth modes emits one — so the
workspace host is also accepted as a `dbxHost` query parameter, which survives being
baked into the configured `baseUrl`.

Everything without a browser uses an **access token** this service issues instead
(`sdlb_…`, see `auth/mcpTokens.ts`) - a coding agent over MCP, and an SDLB job
uploading what it ran. A Databricks user-to-machine token expires within the hour,
which makes it useless in a configuration file; it is a credential for the whole
workspace API rather than for one repository; and MCP's own rules say a server should
not accept tokens minted for another resource. An access token is scoped to one
repository and environment at the moment it is minted, so it needs no `dbxHost` and
no SCIM call. Only the hash is stored; the SPA mints, lists and revokes them under
Settings → Access Token.

They carry no groups, so the `requiredGroup` rule above applies to Databricks callers
only.

## Storage layout

`scope = "{repo}|{env}"` throughout. There is no tenant dimension: the service is
deployed once per tenant, so the `tenant` parameter every operation carries is
accepted for compatibility and then ignored.

| table | PartitionKey | RowKey |
|---|---|---|
| `Workflows` | scope | workflow |
| `Runs` | scope\|workflow | `inv(runId)\|inv(attemptId)` |
| `RunElements` | scope\|`A`\|action **and** scope\|`D`\|dataObject | `inv(runId)\|inv(attemptId)\|action` |
| `ConfigVersions` | scope | version |
| `ConfigElements` | scope\|version | `elementType\|id` |
| `Elements` | scope\|elementType | id |
| `Tstamps` | scope\|`schema`\|`stats`\|element | `inv(tstamp)` |
| `Workspaces` | `WS` | workspace host |
| `McpTokens` | scope | token hash |
| `Meta` | `REPO` / `ENV\|repo` | repo / env |

Two things drive the key design, both from Table Storage:

- **It sorts only by PartitionKey then RowKey, ascending, as strings.** There is no
  `$orderby`. Newest-first therefore lives in the key: `inv(n)` in `store/keys.ts`
  turns a number into a fixed-width string that sorts backwards.
- **`$filter` has no `contains` and no `startswith`.** Only `eq/ne/gt/ge/lt/le` with
  `and/or/not`. So configuration search does not use it: the version's blob is
  cached in process and the ported filters run over it, which also gives exact
  parity with the config explorer's own search.

`RunElements` carries each attempt once per action and once per data object that
action touched. That is what makes "the last five runs of this element" a single
partition query — and it is why the action is part of its RowKey, since otherwise
two actions sharing a data object collide inside one transaction.

## Code copied from the frontend

Five pieces of logic exist twice, in `src/domain/`, and must not drift:

| here | copied from |
|---|---|
| `metrics.ts` | `src/util/WorkflowsExplorer/metrics.ts` |
| `graph.ts` | `src/util/ConfigExplorer/Graphs.ts` (without the layout and ReactFlow parts) |
| `filter.ts` | `src/util/ConfigExplorer/ConfigData.ts` and `src/util/helpers.ts` |
| `stateFile.ts` (normalisation) | `src/util/WorkflowsExplorer/Attempt.ts` |
| `stateFile.ts` (index record) | `build_index.py`'s `getRuns()` |

`test/unit/parity.test.ts` runs both implementations over the real getting-started
configuration and asserts they agree, which catches drift that mirrored test cases
would not. **Change the pair together.**

One deliberate divergence: `aggregateRunStatus` follows `build_index.py`'s priority
order, not `row.ts`'s. The two disagree — a run with one FAILED and one RUNNING
action aggregates to RUNNING in the frontend and to FAILED here — and every existing
state index was built the second way.

## Tests

```bash
yarn test:ci     # vitest; starts its own Azurite on ports 10100-10102
yarn type-check  # the build and the tests
```

| suite | what it holds in place |
|---|---|
| `test/unit/parity.test.ts` | the copies above still agree with their originals |
| `test/unit/keys.test.ts` | ordering, and the characters a key may not contain |
| `test/unit/stateFile.test.ts` | the index record, normalisation, durations |
| `test/unit/auth.test.ts` | the allowlist, the cache, and what is *not* cached |
| `test/unit/bridge.test.ts` | the Azure Functions to Fastify crossing |
| `test/conformance/spec.test.ts` | every operation of the upstream OpenAPI is routed and validates |
| `test/conformance/rest.test.ts` | the response shapes the SPA depends on |
| `test/conformance/mcp.test.ts` | the tools, driven by a real MCP client |

The upstream spec declares every response as an empty schema, so it pins paths and
parameters and nothing else. `rest.test.ts` is therefore the only thing holding the
payload contract, and it compares against `tests/e2e/fixtures/shared/state/index.json`
— which `build_index.py` produced from the same state files and the local backend
serves verbatim. Treat a failure there as a release blocker.

## Uploads, and what SDLB actually sends

Issue an **access token** in the UI - Settings, Access Token, with the repository and
environment selected - and put it in the job's environment. The same token serves an
agent over MCP and a job uploading here; it is scoped to that one repository and
environment, has no expiry unless one is asked for, and is revoked from the same
page. Only its hash is stored, so it is shown once.

```hocon
global.uiBackend {
  baseUrl = "https://<app>.azurewebsites.net/api/v1"
  tenant = PrivateTenant
  repo = getting-started
  env = dev
  authMode { type = TokenAuthMode, token = "###ENV#SDLB_UI_TOKEN###" }
  stagePath = "/tmp/sdlb-ui-stage"
}
```

`terraform output -raw api_base_url` is that `baseUrl`. `TokenAuthMode` sends
`Authorization: Bearer`, which is what this service wants, and an access token does
not expire mid-run, so `OAuthMode` buys nothing here.

Things that are easy to get wrong, and fail quietly:

- Configuration, schema and statistics are **PUT**, not POST. Only the initial state
  is POST; an action update is PATCH.
- `descriptions/list` must answer with snake_case `last_modified` and a field
  literally called `type` — SDLB camelises the response and renames `type` to
  `mediaType`. An empty response to that one endpoint makes SDLB throw.
- A non-2xx on the state insert **fails the SDLB job** unless `stagePath` is set.
- SDLB's default read timeout is **5 seconds**, and a cold start uses roughly half
  of it. **Set `stagePath`**: it turns a missed upload into a retry on the next run
  instead of a failed job, and it is free. Raising `global.uiBackend.timeouts` or
  keeping an instance warm are the more expensive answers to the same problem.

## What gets deployed, and cold start

`yarn build` runs esbuild (`scripts/bundle.ts`), not `tsc`. The output is what ships:

| | `tsc`, per file | bundled |
|---|---|---|
| `dist/` | 496 kB across ~250 files | 2.0 MB across 3 files |
| `node_modules/` | 105 MB (60 MB of it source maps) | 1.3 MB |
| process start to first response | ~664 ms | ~380 ms |

Measured with `test/bundle/harness.mjs` - a plain Node process that loads the entry
point, registers its routes and serves four requests - median of seven runs. On
Azure the gap should be wider than it is locally, because there the package is
downloaded per instance and read from a mount rather than a warm page cache.

Four things keep it there, and are worth not undoing:

- **The MCP SDK is imported lazily**, in `functions/http.ts`, only once a request is
  actually for `/mcp`. It, zod and the tools cost roughly 700 ms to load, and the
  cold start that matters is the one serving an SDLB upload with five seconds to
  answer in. `mcp/path.ts` exists so the dispatch can decide without loading them.
- **Code splitting is on**, so that stays true after bundling. Without it esbuild
  inlines the dynamic import into the entry chunk and the parse cost comes back;
  `test/unit/bundle.test.ts` asserts the MCP packages are absent from `http.js`.
- **`@azure/functions` is the only runtime dependency.** Everything else is a
  devDependency, because the bundle inlines it - which is why the production install
  is 1.3 MB. The Functions library has to stay external: it reaches for
  `@azure/functions-core`, which only the host provides, and bundling it breaks
  function registration silently, leaving an app with no routes.
- **Fastify is built once at module scope** and memoised, so only the first request
  after a cold start pays for it.

Two smaller choices: names are kept through minification (`keepNames`), so an
Application Insights stack trace still says which function threw - measurably free -
and source maps are **not** shipped, because they are four times the size of the
code and Node ignores them without `--enable-source-maps`. Build with
`SDLB_SOURCEMAP=1 yarn build` when you need them.

Bundling a Node service is where pino, Fastify's plugin loading and the Azure SDKs
usually break, and none of it shows up until the code runs. `test/unit/bundle.test.ts`
builds with the production configuration and executes the result in a separate
plain-Node process; it caught exactly one real problem, `Dynamic require of "net" is
not supported`, which is why the bundle carries a `createRequire` banner.

## Deploying it

`infra_azure/` is Terraform (azurerm 4.x). It creates a storage account with the
data and deployment containers, a Log Analytics workspace with Application Insights,
a Flex Consumption plan and the Function app, grants the app's system-assigned
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

### Reaching storage

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

`terraform output storage_reachable_from_internet` says which you got.

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
  "Authentication" above for why the allowlist is the thing separating one workspace
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

### Shipping the code

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

### The frontend

`terraform output static_site_url` is where the SPA is served from, and
`../scripts/deploy-frontend-azure.sh` (`yarn deploy-azure` in the repository root)
ships a
build to it. The two deployments are independent: the static site is served from the
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

It counts in memory, so it is per address **per instance**, and that multiplication
is real rather than theoretical: Flex Consumption spreads even strictly sequential
requests across instances - measured, 42 requests landed on five - so at the defaults
one address meets 10 x 5 = 50 requests a minute, not 10. That is deliberate. An exact
global limit needs a shared store on the path of every request, and what this
prevents is a stranger generating traffic through us, not a stranger getting in; the
allowlist and the workspace do that. The tables are already there if an exact limit
is ever wanted.

## MCP

The 2026-07-28 protocol has no sessions, so the endpoint is stateless by
construction, which suits Azure Functions: `responseMode: 'json'` means one JSON body
per request and nothing long-lived to be cut off by the load balancer's 230-second
limit. What that gives up is progress notifications; sampling and elicitation still
work, because they are answered by a result the client retries.

`/mcp` deliberately does not go through Fastify. The SDK's handler is already
`(Request) => Promise<Response>` and Azure's request object is fetch-shaped, so the
Function dispatches to it directly.

Tools are read-only by design: they diagnose and suggest, and the agent applies
anything it decides to in the user's own working copy.

| | |
|---|---|
| `search_config` | the config explorer's three search modes, verbatim |
| `get_config_element` | one element, its description, its neighbours, its last run |
| `find_similar_dataobjects` | what to copy, so a new element follows the house style |
| `list_config_patterns` | how this repository does things, grouped and counted |
| `get_lineage` | the neighbourhood of an element as an edge list |
| `list_runs` | attempts, by workflow, action or data object |
| `get_run_summary` | timings and *only* the actions that did not succeed |
| `get_action_result` | one action in full, with the whole exception |
| `compare_runs` | what changed since it last worked |
| `diagnose_run` | the six calls above, composed, with upstream blame and schema drift |
| `get_dataobject_schema` / `get_dataobject_stats` / `diff_schema` | recorded schemas and statistics |
| `list_scopes` | which repositories and environments this deployment serves |
