# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Single-page React/TypeScript web app (Vite) that visualizes Smart Data Lake Builder (SDLB) projects: the HOCON **configuration** (data objects, actions, connections, lineage graph) and the **workflow runs** recorded in SDLB state files. It is a pure static frontend — all data comes from a pluggable backend (local files or REST).

## Commands

Requires Node 20 and Yarn (classic >= 1.22).

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

Note: `yarn type-check` currently reports pre-existing errors on develop.

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

- `HoconParser.ts` parses HOCON over HTTP using a **patched** `@pushcorn/hocon-parser` (`patches/` adds `Context.getRegistry()` so the `file` source can be remapped to `http` in the browser). Don't bump that dependency without re-checking the patch.
- `ConfigData.ts` wraps the parsed config and eagerly builds three graphs: `fullGraph` (`DataObjectsAndActionsSep`), `dataGraph`, `actionGraph`. `InitialConfigDataLists`/`ConfigDataLists` hold sorted DataObject/Action/Connection lists and immutable filter operations (`applyContainsFilter`, `applyRegexFilter`, `applyFeedFilter`) used by the search box in `ConfigExplorer.tsx`.
- `Graphs.ts` is the graph domain model: `Node`/`Edge` base classes, `DataObject`/`ActionObject` (both are *nodes* in the newer separated model), `DAGraph` with traversal/level computation, and dagre layout helpers (`dagreLayout`, `dagreLayoutRf`). This is the file `tests/graph.test.ts` covers.
- `LineageTabUtils.tsx` converts `DAGraph` → ReactFlow nodes/edges and holds all the styling/expansion/grouping/viewport logic (node & edge colors, parent/subflow nodes, `prepareAndRenderGraph`).

**Lineage graph state is Redux** (`src/app/store.ts`, slices under `src/util/ConfigExplorer/slice/LineageTab/`): toolbar state (`GraphViewSlice` full/data/action, `LayoutSlice` TB/LR, `GraphExpansionSlice`, `NodeAttributeFilterSlice`, `GroupingSlice`), the ReactFlow instance itself (`ReactFlowSlice`, with `serializableCheck` disabled), and `LineageTabCoreSlice` (current element props + whether the lineage panel is open). Note the store is `<Provider>`-mounted only around the `config/*` route, **and** imported as a module singleton by `Graphs.ts`/`LineageTabUtils.tsx`, which read and dispatch outside React. Keep that in mind before restructuring the store.

Two lineage components exist: `LineageTabWithSeparateView.tsx` (current, Redux-driven, used by ConfigExplorer) and the older self-contained `LineageTab.tsx`, still used by the run view (`WorkflowsExplorer/Run/Tabs.tsx`) with a `PartialDataObjectsAndActions` graph.

### Workflows Explorer (`src/components/WorkflowsExplorer`, `src/util/WorkflowsExplorer`)

`Workflows` (list) → `WorkflowHistory` (runs + charts) → `Run` (single attempt, tabs: timeline / table / lineage). SDLB state files are normalized in `Attempt.ts` — `updateStateFile` migrates older state-file formats (flattening `results[].subFeed`, `mainMetrics` → `metrics`, `inputIds`/`outputIds` objects → ids), so new state-file format changes belong there. `types.ts` holds the run/row domain model (`Row`, `TaskStatus`, `StateFile`) and derives durations from ISO-8601 strings. The timeline (`Timeline/`) is a virtualized Gantt-style view adapted from Netflix Metaflow (see `Timeline/LICENSE`).

### UI conventions

MUI **Joy** (`@mui/joy`) is the primary component library with `CssVarsProvider`; `@mui/material`, `@mui/x-data-grid`, antd, recharts and react-bootstrap also appear in older code — match the surrounding file rather than unifying. Layout chrome lives in `src/layouts` (`RootLayout` + `Outlet`, `PageHeader`, `SideBar`, `ErrorBoundary`).

`src/archiv/` is dead/legacy code kept for reference — don't build on it.

Vite needs Node polyfills (buffer/process, `rollup-plugin-polyfill-node`, `dynamicRequireTargets` for the hocon parser) because the HOCON parser is a Node library running in the browser; changes to `vite.config.ts` around this are load-bearing.
