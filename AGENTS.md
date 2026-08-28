# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Single-page React/TypeScript web app (Vite) that visualizes Smart Data Lake Builder (SDLB) projects: the HOCON **configuration** (data objects, actions, connections, lineage graph) and the **workflow runs** recorded in SDLB state files. The frontend is a pure static app — all data comes from a pluggable backend (local files, REST, or the Azure backend in `backend/`).

`backend/` is a separate Node package, not part of the Vite build: an Azure Functions app (Node 24) serving the SPA's REST contract, SDLB's uploads and an MCP endpoint for coding agents. It has its own `README.md`, `package.json` and tests; see the "Backend" section below.

## Commands

Requires Node 22 or later and Yarn (classic >= 1.22). `.nvmrc` pins 24 and both workflows read it, so there is one place to change it; `engines` in each `package.json` states the floor. Vite 7 is the binding constraint below that (`^20.19 || >=22.12`), and Node 20 is out of upstream support.

```bash
yarn install          # runs patch-package postinstall (see patches/)
yarn start            # vite dev server (--force), http://localhost:3000 or 5173
yarn build            # production build → build/ (not dist/)
yarn serve            # preview a build
yarn type-check       # tsc --noEmit
yarn lint             # npx eslint src (CRA config in package.json eslintConfig)
yarn test             # vitest (watch mode)
yarn test:ci          # vitest run (single pass)
yarn coverage
npx vitest run tests/graph.test.ts        # single file, no watch
npx vitest run -t 'data graph creation'   # single test by name
yarn test:e2e         # playwright, tests/e2e (starts its own dev servers)
yarn test:e2e:ui      # playwright interactive runner
npx playwright test tests/e2e/lineage.spec.ts --project hocon
```

Lint uses ESLint 9 flat config (`eslint.config.js`), rebuilt from the maintained plugins after the unmaintained CRA `react-app` config was dropped. Rules with pre-existing violations are set to `warn` and annotated with their count; `yarn lint` fails on errors only, so those 121 warnings are a visible cleanup backlog rather than a blocker.

Local data setup (needed before anything is visible): put config files in `public/config` and state files in `public/state`, then `./build_index.sh <path-to-statefiles> <path-to-configfiles>` (Python 3; creates a venv, writes JSON-Lines `index` files). `backendConfig` in `public/manifest.json` must be `local;`.

CI (`.github/workflows/build.yml`) runs `yarn install` + `yarn build` on push to master/develop and on PRs to develop; master builds bump the version on develop and create a draft release. `.github/workflows/test.yml` runs the Playwright suite on the same triggers.

### End-to-end tests (`tests/e2e`)

Playwright, in a real browser — jsdom cannot render ReactFlow (0×0 nodes) and the browser-polyfilled HOCON parser needs the real vite pipeline. `vite.config.e2e.ts` is the dev config plus a middleware that serves `tests/e2e/fixtures` for `/manifest.json`, `/config`, `/envConfig`, `/exportedConfig.json`, `/state`, `/schema` and `/description`, so tests never touch the gitignored `public/config` and `public/state`. Fixtures are a pinned copy of the [getting-started](https://github.com/smart-data-lake/getting-started) project (`fixtures/update-fixtures.sh` refreshes them); `tests/e2e/fixture.ts` names their contents.

Two Playwright projects, one per config source, each with its own dev server: `hocon` (port 3000, config parsed from HOCON files) and `exported` (port 3001, `exportedConfig.json` only — what the deployed getting-started viz uses). Handy selectors: ReactFlow nodes carry `data-id`, MUI icons render `data-testid="<Name>Icon"`, and the timeline has `tasklistlabel-*` test ids. The browser timezone is pinned to UTC in `playwright.config.ts` because run timestamps render in local time.

## Runtime configuration: public/manifest.json

Read once at startup via `useManifest` and cached (`getPersistedManifest`). Drives major app behavior, so changes there change routing and data access:

- `backendConfig`: `"<type>;<configString>"` — `local` or `rest;<BASE_URL>`. Selects the fetchAPI implementation.
- `auth`: if present, AWS Amplify/Cognito auth is configured and the app switches to **multi-tenant routing**.
- `env`: used to resolve `envConfig/{env}.conf` when parsing HOCON.
- `baseUrl`, `configSourceUrl` (template for deep links into config source files).

## Architecture

### Data access layer (`src/api`)

`fetchAPI.ts` defines one interface for everything the UI needs (workflows, runs, config, descriptions, schemas, stats, tenants/repos/envs, users). `Fetcher.ts` lazily instantiates the implementation named by `manifest.backendConfig` from a lookup table (`local` → `fetchAPI_local_statefiles`, `rest` → `fetchAPI_rest`). **Add a backend by implementing `fetchAPI` and registering it in the `fetchAPITypes` map** — nothing else needs to change.

`src/hooks/useFetchData.tsx` wraps every fetcher call in a react-query `useQuery` with a 24h `staleTime`, `retry: false`, and errors rethrown so `ErrorBoundary` catches them. Components should use these hooks, not `fetcher()` directly.

### Routing and workspace (`src/App.tsx`, `src/hooks/useWorkspace.tsx`)

Uses a **hash router**. Two routing shapes depending on whether auth is configured:

- no auth: `/`, `workflows/`, `workflows/:flowId`, `workflows/:flowId/:runIdAttempt/:tab?/:stepName?`, `config/*`
- with auth: the same content routes nested under `/:tenant/content/:repo/:env/*`, plus `/:tenant/settings/*`

`useWorkspace` derives `tenant`/`repo`/`env` **by parsing `location.pathname`** — workspace state lives in the URL, not in React state. Use its `navigateContent`/`navigateRel` helpers rather than raw `navigate` so both routing shapes keep working. Almost all fetch hooks pass `tenant/repo/env` into the query key.

### Config Explorer (`src/components/ConfigExplorer`, `src/util/ConfigExplorer`)

- `HoconParser.ts` parses HOCON over HTTP using a **patched** `@pushcorn/hocon-parser` (`patches/` adds `Context.getRegistry()` so the `file` source can be remapped to `http` in the browser). Don't bump that dependency without re-checking the patch — it is therefore pinned to an exact version in `package.json`.
- `ConfigData.ts` wraps the parsed config and eagerly builds three graphs: `fullGraph` (`DataObjectsAndActionsSep`), `dataGraph`, `actionGraph`. `InitialConfigDataLists`/`ConfigDataLists` hold sorted DataObject/Action/Connection lists and immutable filter operations (`applyContainsFilter`, `applyRegexFilter`, `applyFeedFilter`) used by the search box in `ConfigExplorer.tsx`. All three search case insensitively - the regex ones through the `i` flag, and all of them look their property up with `getPropertyByPathIgnoreCase`, so a search matches `Type:deltalake` as well as `type:DeltaLake` (`tests/configFilter.test.ts`).
- `Graphs.ts` is the graph domain model: `Node`/`Edge` base classes, `DataObject`/`ActionObject` (both are *nodes* in the newer separated model), `DAGraph` with traversal/level computation, and dagre layout helpers (`dagreLayout`, `dagreLayoutRf`). This is the file `tests/graph.test.ts` covers.
- `LineageTabUtils.tsx` converts `DAGraph` → ReactFlow nodes/edges and holds all the styling/expansion/grouping/viewport logic (node & edge colors, parent/subflow nodes, `prepareAndRenderGraph`).

**Lineage graph state is React context** (`src/hooks/useLineage.tsx`), split in two on purpose: `useLineagePanel()` holds what the surrounding config explorer needs (is the panel open, which element it shows) and changes only on navigation; `useLineageGraph()` holds the toolbar settings (graph view full/data/action, layout TB/LR, expansion, node attribute filter) which change on every toolbar click and are only read inside the panel. Keeping them apart avoids re-rendering the element list/tables on every toolbar click. `LineageProvider` is mounted above `<Routes>` in `App.tsx` so the state survives navigating away from the config explorer.

The ReactFlow instance is **not** in that state — components get it from `useReactFlow()`, and the functions in `LineageTabUtils.tsx`/`Graphs.ts` take it as a parameter, together with the graph settings they need (`lineageGraphState`). The grouping working data (connected components / subgroups and their ReactFlow counterparts) is module-level mutable state inside `LineageTabUtils.tsx`, because only imperative code there reads and writes it.

`LineageTabWithSeparateView.tsx` is the only lineage component, used by both the ConfigExplorer and the run view's graph tab (`WorkflowsExplorer/Run/Tabs.tsx`). The ConfigExplorer lets it take its `flowProps` from the panel context; the run view passes them in as `graphProps`, with a `graph` built from the state file (`WorkflowsExplorer/Lineage.ts` → `getActionGraph()`) and `runContext: true`. A `flowProps.graph` is shown **as a whole** — `prepareAndRenderGraph` takes the `prepareGraphComplete` path instead of building the neighbourhood of a center node — so there is no expansion, no center node and no graph view to switch, and the toolbar hides the buttons that would act on those. The configuration tables (`ElementTable.tsx`) pass such a graph too, to show the lineage of everything they list: `DAGraph.getSubGraph` restricted to the ids of the rows the table shows (i.e. to the current filter), taken from `configData.dataGraph` for the Data Objects tab and from `configData.actionGraph` for the Actions tab, with `graphView` naming which of the two it is — a given graph is not necessarily an action graph. They write it into the panel context on every change, the way `ElementDetails` writes the selected element, so the open panel follows the table — an empty table, and the connections tab, give an empty graph, so that the panel never keeps showing what another tab or a wider filter listed. Which toolbar buttons are shown therefore depends on two things separately: `props.graph` decides the center-node and view options, `props.configData` the grouping and node attributes, and `props.runContext` whether the panel can be closed. Everything reading a graph goes through `getGraph(props, graphView)`, so `configData` stays optional; nodes without a `jsonObject` (all run nodes) simply render less. The run view also passes `nodeStatuses`, which colours each node's border with the state its action ended up in (`statusColors.ts`, the palette the timeline and history chart use) and names that state with a status icon in the node title, so the state does not depend on the colour alone. In the config explorer the same icon shows the state of the element's last run.

The run view also passes `edgeMetrics`/`nodeMetrics`, so the graph shows **how much data flowed**. In the action graph every edge *is* one data object (`Edge.dataObjectId`, set by `getActionGraph`, which also puts it into the edge id so two actions sharing several data objects get one edge each), so an edge carries two metrics: what the source action wrote to that data object and what the target action read from it — both are labelled on the edge and both highlight with it (`selectEdge`, which lifts everything highlighted to `SELECTED_ELEMENT_Z_INDEX` so it is not hidden behind another edge or its labels). `Row` (`types.ts`) carries the same numbers as `mainInputCount`/`mainOutputCount` for the run table's two count columns, so the table can sort by them. `src/util/WorkflowsExplorer/metrics.ts` owns the two conventions of the state file: the `count` → `records_written` → `files_written` fallback, and input metrics being recorded on the *output's* result qualified with `#<inputId>` (`count#int-airports`; the reserved `count#mainInput` is ignored as it duplicates the main input's own metric). `getRunMetrics` (`WorkflowsExplorer/Lineage.ts`) also returns the metrics that have **no** edge to sit on — a data object written but never read, or read from a source no action produced — those are shown next to the node instead. `getActionGraph` leaves out edges from an action back to itself (the historization pattern reads and writes the same data object), so that data object counts as uncovered unless another action reads or writes it too.

### Workflows Explorer (`src/components/WorkflowsExplorer`, `src/util/WorkflowsExplorer`)

`Workflows` (list) → `WorkflowHistory` (runs + charts) → `Run` (single attempt, tabs: timeline / table / lineage). SDLB state files are normalized in `Attempt.ts` — `updateStateFile` migrates older state-file formats (flattening `results[].subFeed`, `mainMetrics` → `metrics`, `inputIds`/`outputIds` objects → ids), so new state-file format changes belong there. `Attempt` also fixes the **row order** used by the timeline and table: exec start, then init start, then prepare start (`compareMultiFunc`), because SDLB starts every ready action of a stage in the same millisecond and the later keys break those ties (`tests/timelineSort.test.ts`). It also derives the attempt's **end anchor** (`endAnchorOf`): for a final attempt (`isFinal`), a phase that recorded no end timestamp is measured up to the last timestamp the state file has evidence for, not up to now — otherwise a cancelled action makes a long-finished run look like it is still going. A live attempt has no anchor, so its phases keep counting up (`tests/timelineEndAnchor.test.ts`). `types.ts` holds the run/row domain model (`Row`, `TaskStatus`, `StateFile`) and derives durations from ISO-8601 strings. The timeline (`src/components/WorkflowsExplorer/Timeline/`) is a virtualized Gantt-style view adapted from Netflix Metaflow (see `Timeline/LICENSE`, which must be retained, and that folder's `README.md`). It has since been de-Metaflowed and moved onto MUI Joy; status/phase colours live in `src/util/WorkflowsExplorer/statusColors.ts` because the history chart, status icons and toolbar share them. `src/util/WorkflowsExplorer/phases.ts` maps phase names (Prepare/Init/Exec) onto the state file's timestamp fields and is the single source for both the bars and the visible time window — the timeline auto-zooms to the range the selected phases actually cover, so changing the phase filter re-fits instead of leaving empty space.

### UI conventions

MUI **Joy** (`@mui/joy`) is the primary component library with `CssVarsProvider`; `@mui/material`, `@mui/x-data-grid`, antd, recharts and react-bootstrap also appear in older code — match the surrounding file rather than unifying. For CSS-in-JS use `styled` from `@mui/joy/styles` and Joy theme tokens (`theme.vars.palette.*`, `theme.vars.fontSize.*`); `styled-components` and `polished` were removed once the timeline — their only consumer — was migrated, so don't reintroduce them. There is no custom Joy theme and no dark mode. Layout chrome lives in `src/layouts` (`RootLayout` + `Outlet`, `PageHeader`, `SideBar`, `ErrorBoundary`).

`src/archiv/` is dead/legacy code kept for reference — don't build on it.

Vite needs Node polyfills (buffer/process, `rollup-plugin-polyfill-node`, `dynamicRequireTargets` for the hocon parser) because the HOCON parser is a Node library running in the browser; changes to `vite.config.ts` around this are load-bearing.

### Backend (`backend/`)

Its own package (`cd backend && yarn install`), outside the Vite build, with its own README. What matters from the frontend's side:

- It reimplements `backend/spec/upstream-openapi.json` — the contract `src/api/fetchAPI_rest.ts` already speaks — so the SPA needs no new fetcher logic, only different credentials. `src/api/fetchAPI_azure.ts` extends `fetchAPI_rest`, which is why `fetch` and `getRequestInfo` there are `protected` rather than `private`. It also implements `getWorkflowRunsByAction`/`getWorkflowRunsByDataObject`, which the REST fetcher leaves as `TODO`, so the config explorer's "Last 5 runs" panel works against it.
- `backendConfig` is `azure;<baseUrl>[;<repo>;<env>]`. Naming a repo and env pins a single-repository deployment: no workspace switcher, flat routes, and `fetchAPI_azure.fetch` fills the scope into every query string. Omit them and the scope comes from the URL, as `useWorkspace` derives it.
- **Five pieces of logic exist twice** — `src/util/WorkflowsExplorer/metrics.ts`, `src/util/ConfigExplorer/Graphs.ts`, the filters in `src/util/ConfigExplorer/ConfigData.ts` plus `getPropertyByPathIgnoreCase`, `updateStateFile`/`endAnchorOf` in `Attempt.ts`, and `build_index.py`'s `getRuns()` — copied into `backend/src/domain/`. `backend/test/unit/parity.test.ts` imports the frontend originals and asserts both agree over the getting-started fixture, so drift fails a test rather than a user. **Change the pair together.**
- The `azure` Playwright project (port 3002) runs the same specs as `hocon` against the real backend, started by `yarn --cwd backend serve:e2e` with a throwaway Azurite and the fixtures seeded. Green there means the backend implements the contract.
- Storage is reached with the app's **managed identity**, not a key: `SDLB_STORAGE_ACCOUNT` (account name) takes precedence over `SDLB_STORAGE_CONNECTION_STRING`, which exists for Azurite. `backend/infra` sets `shared_access_key_enabled = false`, so there is no key to leak, and `network_isolation` (`none`/`firewall`/`private`) decides how reachable the endpoint is. `@azure/identity` is imported lazily in `backend/src/store/credential.ts` to keep it off the cold-start path.
- `yarn --cwd backend build` is esbuild, not `tsc` — the deployed artefact is three bundled files and a 1.3 MB `node_modules`, and `@azure/functions` is the only runtime dependency. `tsc` is a type checker there and emits nothing. `backend/test/unit/bundle.test.ts` runs the built bundle in a plain Node process, because bundling a Node service breaks in ways that only show up at runtime.

### Authentication (`src/auth`)

Amplify used to be hard-wired at three sites (`Amplify.configure` in `App.tsx`, `useAuthenticator` in `useUser`, the `authStatus` gate in `useFetchData`). Those now go through `useAuth()` from `src/auth/AuthProvider.tsx`, which picks an implementation from `manifest.auth.type`: `cognito` (the default, and what a manifest without a type means) or `databricks` (OAuth user-to-machine, authorization code with PKCE, in `databricksOAuth.ts`).

The fetchAPI classes live outside React, so they cannot read that context: the provider registers a header function in `src/auth/tokenProvider.ts` and `fetchAPI_azure.getRequestInfo` asks it per request. The Databricks redirect comes back to the app's base URL with the code in the **query** string, because the hash router owns everything after the `#`; `AuthProvider` consumes and strips it before anything else looks at the URL.

`fetchAPI` gained two optional groups: `capabilities()` (whether the backend administers users, whether it serves MCP) and the MCP token methods. Both are optional, so existing implementations are unchanged; `Settings/Setting.tsx` uses the capabilities to decide whether to show User Management, Access Token, or both. One access token serves both consumers that have no browser - an agent over MCP and an SDLB job uploading - which is why the page is not named after either.

### documentation

Write README.md in the corresponding folder.