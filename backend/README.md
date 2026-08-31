# SDLB backend and MCP server

The service behind the viewer. It can run as Node process or serverless on e.g. Azure Function,
serving three audiences from one process:

| audience | endpoint | contract |
|---|---|---|
| the SPA | `/api/v1/*` | `spec/upstream-openapi.json`, i.e. what the frontend `src/api/fetchAPI_rest.ts` calls |
| SDLB jobs | `/api/v1/*` uploads | what `global.uiBackend` pushes |
| coding agents | `/mcp/{repo}/{env}` | MCP, read-only tools |

Storage is a Relational oder KV-Database and File or Blob Storage.
Blob holds every file and every large payload — state files, exported configurations, description markdown 
and its images, schemas, statistics — and the tables hold what has to be queried.

## Why the agents are on MCP and the SPA is not

They want opposite things from the same data. The SPA wants whole objects to render,
e.g. a state file with hundreds of actions for a timeline. An agent
wants a small answer to a specific question; that same state file is a context bomb.
The SPA also needs HTTP caching, binary responses and status codes, none of which
JSON-RPC is mode for.

So there are to transports, and one service. `routes/` and `mcp/` both contain only
translation; everything that knows anything lives in `services/`. Every MCP tool is
one service call and a formatter - a "diagnose this run" button in the
UI is a REST route over code that already exists.

## Running it

```bash
yarn install
yarn seed             # push tests/e2e/fixtures through the upload API
yarn serve            # http://localhost:7071
```

No emulator and no Azure account: both default to the local store, which is a SQLite file
and a directory of files under `.sdlb-data` — gitignored, and safe to delete.

`yarn serve` is a plain Node server that dispatches the same way the Function does —
Fastify for everything, the MCP handler for `/mcp/*` — so you do not need Azure
Functions Core Tools to work on it. With Core Tools installed, `yarn start` runs the
real host instead.

`yarn serve:e2e` seeds the fixtures and serves on port 7071 in one process. That is what
the `azure` Playwright project starts.

To work on the Azure driver rather than through it: `yarn serve:azurite` is the same thing
against a throwaway emulator, and `yarn azurite` starts a persistent one, for
`SDLB_STORAGE_BACKEND=azure yarn seed`.

Point an MCP client at `http://localhost:7071/mcp/getting-started/dev`, or open the
Inspector:

```bash
npx @modelcontextprotocol/inspector http://localhost:7071/mcp/getting-started/dev
```

### Settings

Copy `local.settings.json.example` to `local.settings.json`.

| setting | meaning |
|---|---|
| `SDLB_STORAGE_BACKEND` | `azure` or `local`, setting both halves of the store at once |
| `SDLB_ENTITY_STORE` / `SDLB_BLOB_STORE` | override either half on its own |
| `SDLB_STORAGE_ACCOUNT` | storage account name, reached with the managed identity. What the deployment uses; its presence alone implies `azure` |
| `SDLB_STORAGE_CONNECTION_STRING` | Azurite. Ignored when `SDLB_STORAGE_ACCOUNT` is set, and also implies `azure` |
| `SDLB_BLOB_CONTAINER` | container name, default `sdlb`, azure only |
| `SDLB_SQLITE_FILE` | default `.sdlb-data/entities.db`, local only |
| `SDLB_BLOB_ROOT` | default `.sdlb-data/blobs`, local only |
| `SDLB_TENANT_NAME` | the single tenant name `GET /tenants` reports, default `PrivateTenant`. The SPA adopts this rather than defaulting to a name of its own, so it decides the tenant segment of every URL |
| `SDLB_AUTH_MODE` | `databricks`, or `disabled` for local work |
| `SDLB_DATABRICKS_HOSTS` | comma-separated workspace origins that may use this deployment |
| `SDLB_AUTH_CACHE_TTL_SECONDS` | how long a verified token is trusted, default 300 |

## Authentication with Databricks

A caller presents a Databricks token and says which workspace it belongs to, as
`Authorization: Bearer <token>` plus `X-Databricks-Host`. The order of the checks in
`auth/databricks.ts` matters:

1. **The Databricks host is checked against an allowlist before anything is sent to it.**
   An Entra token is issued for the Azure Databricks Account rather than
   for one workspace, so a token minted for workspace A verifies against workspace B
   — the allowlist is separating them. It is also what stops the header being used to make 
   this service fetch an arbitrary URL.
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

An MCP or also an SDLB Job uses an **access token** this service issues instead
(`sdlb_…`, see `auth/mcpTokens.ts`). A Databricks user-to-machine token expires within the hour,
which makes it useless in a configuration file; it is a credential for the whole
workspace API rather than for one repository; and MCP's own rules say a server should
not accept tokens minted for another resource. An access token is scoped to one
repository and environment at the moment it is minted, so it needs no `dbxHost` and
no SCIM call. Only the hash is stored; the SPA mints, lists and revokes them under
Settings → Access Token.

They carry no groups, so the `requiredGroup` rule above applies to Databricks callers
only.

## Storage

There is no tenant dimension anywhere: the service is deployed once per tenant, so the
`tenant` parameter every operation carries is accepted for compatibility and then ignored.

`store/repositories.ts` and `store/blobs.ts` declare the store as named operations —
`listRuns`, `countRunsAndAttempts`, `listRunsTouching` — and `store/drivers/` implements
them.

Storage options are:

| | `azureTables` + `azureBlob` | `sqlite` + `filesystem` |
|---|---|---|
| used by | the azure deployment | development, the test suite, deployment to relation DB |
| ordering | baked into the row key by `inv()` | `ORDER BY run_id DESC` |
| counting runs | scan the partition for row keys, count distinct in JS | `COUNT(DISTINCT run_id)` |
| attempts touching an element | over-read by 8x and collapse duplicates | `SELECT DISTINCT … LIMIT n` |
| an element's runs | stored once per data object it touched | stored once, plus a link table |
| the actions map | dropped past 32 768 characters | always stored |

Both pass one conformance suite per side, `test/store/*.conformance.test.ts`, which is the
same technique `parity.test.ts` uses for the frontend-copied logic: run both
implementations over the same input and assert they agree, rather than giving each its own
examples that drift. There is one difference in `descriptions/list`'s
`last_modified`, which is when the file was written.

`store/limits.ts` holds Azure's constraints and applies them to **both** drivers — the
64 KiB property cap, the 4 MB transaction body, the key character rules, the refusal of
values no backend round-trips identically. Enforcing the union everywhere is what keeps a
record written under one backend loadable under the other, and it means a violation fails
on whichever backend you happen to be running rather than only in production.

### Azure key design

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

`scope = "{repo}|{env}"`. Two things drive it, both from Table Storage:

- **It sorts only by PartitionKey then RowKey, ascending, as strings.** There is no
  `$orderby`. Newest-first therefore lives in the key: `inv(n)` in
  `drivers/azureTables/keys.ts` turns a number into a fixed-width string that sorts
  backwards. The SQLite driver has real columns and so needs none of this.
- **`$filter` has no `contains` and no `startswith`.** Only `eq/ne/gt/ge/lt/le` with
  `and/or/not`. So configuration search does not use it: the version's blob is cached in
  process and the ported filters run over it, which also gives exact parity with the config
  explorer's own search.

`RunElements` carries each attempt once per action and once per data object that action
touched. That is what makes "the last five runs of this element" a single partition query —
and it is why the action is part of its RowKey, since otherwise two actions sharing a data
object collide inside one transaction.

**`ConfigElements` and `Elements` are written and never read.** One `upsertBatch` each,
no reader; `searchText` is truncated to 30 000 characters per element on every upload and
nothing looks at it. They were built as the index for the search above and could not serve
it, for the reason above. They are kept because they are what a store that *can* answer
such a query would need — in the SQLite schema the index exists and the query would be one
statement — but nothing depends on their shape today, which also makes them the safest
place for the two drivers to differ.

### The local backend

SQLite comes from `node:sqlite`, in Node's core, so this adds no dependency; hence
`engines.node >= 24`, since it was unflagged in 23.4. It is not a way to run the deployed
service: the API is synchronous, so every call blocks the event loop, and one file is not
something a scaled-out Function app can share.

The filesystem blob driver has to arrange four things Blob Storage gives away. Writes go
to a temp file and are renamed, because `uploadData` under 256 MB is a single atomic PUT
and `writeFile` is not — and `patchState` is a read-modify-write that SDLB calls
concurrently during a run. Content types come from the file extension, which is
byte-equivalent for every caller here, and a write declaring a type its extension
contradicts is refused rather than stored under one that cannot be read back. `list()`
walks the prefix's parent and filters, because `listBlobsFlat` matches a *string* prefix
rather than a directory. And the resolved path is checked against the root.

One emulator caveat worth knowing: Azurite's overwrites are not atomic under load, where
real Blob Storage's are. With the emulator busy elsewhere, `downloadToBuffer` returns a
torn body roughly once per hundred reads, which is why the conformance suite's
atomic-overwrite case is skipped for the Azure driver — see the comment there.

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
yarn test:ci     # vitest, in parallel, ~3 s
yarn type-check  # the build and the tests
```

| suite | what it holds in place |
|---|---|
| `test/store/entities.conformance.test.ts` | both record drivers answer identically |
| `test/store/blobs.conformance.test.ts` | both blob drivers answer identically |
| `test/unit/limits.test.ts` | what the store actually accepts, measured against Azurite |
| `test/unit/parity.test.ts` | the copies above still agree with their originals |
| `test/unit/keys.test.ts` | ordering, and the characters a key or a path may not contain |
| `test/unit/stateFile.test.ts` | the index record, normalisation, durations |
| `test/unit/auth.test.ts` | the allowlist, the cache, and what is *not* cached |
| `test/unit/bridge.test.ts` | the Azure Functions to Fastify crossing |
| `test/conformance/spec.test.ts` | every operation of the upstream OpenAPI is routed and validates |
| `test/conformance/rest.test.ts` | the response shapes the SPA depends on |
| `test/conformance/mcp.test.ts` | the tools, driven by a real MCP client |

Most suites run on the local store, with a directory of their own per file
(`test/setup/store.ts`), so they need no emulator and run in parallel. Azurite is started
for the four that are about the Azure driver: the two conformance files, `limits.test.ts`
and `bundle.test.ts`. It is what `fileParallelism` used to be off for — every app-level
suite seeded the same `getting-started/dev` scope into one shared account, and two seeding
at once could let one read a half-written index, since the workflow counts are a recount
over what is stored.

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
- **Each store driver is its own chunk**, imported dynamically by
  `store/repositories.ts` and `store/blobs.ts` and loaded only when configured. That
  took the bytes parsed before the first request from 1,369 kB to 699 kB, and the entry
  load from 106 ms to 71 ms (median of seven).
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

## Azure Deployment

See [azure_infra](infra_azure/README.md) Terraform definitions and it's readme to deploy the backend and frontend to Azure serverless services.

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
