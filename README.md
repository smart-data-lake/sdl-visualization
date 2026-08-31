# Overview
SDL Visualizer is a single page web application to show SDLB configuration and workflows' runs as a browsable, nice web page.

# Usage

Prerequisites
- Node.js 22 or later ([see](https://nodejs.org/en/download)). `.nvmrc` pins 24, which is what CI builds and tests on.
- Yarn. [See here](https://classic.yarnpkg.com/lang/en/docs/install/#windows-stable) for Yarn Classic or [here](https://yarnpkg.com/getting-started/install) for modern Yarn. If you prefer using Yarn Classic, be sure to use a version >= 1.22.x. 

## Developer server

To run the app in a local developer server, it suffices to clone the project, install the prerequisites and run "yarn install" and then "yarn start" command. You can then see your changes updated live as any React dev project.

> **IMPORTANT**: if you have not setup your backend, you will not be able to visualize statefiles. Please read the chapter "Backend" to learn about the different setup options.

## Build and deployement

The deployment and release of the project has been automated in github using a build.yml file. In essence, a new merge or build in the master branch will trigger the creation of a new draft release with two assets: `sdl-visualizer.zip`, this app, and `sdl-visualizer-backend.zip`, the Azure Functions package from `backend/`. Every successful build on `develop` publishes the same two as workflow artifacts, reachable without a token through [nightly.link](https://nightly.link/smart-data-lake/sdl-visualization/workflows/build/develop/sdl-visualizer.zip) - which is where the Azure deploy scripts get a build from when there is no local one.

Alternatively, the createRelease.sh script can be used to manually build the project and then create a `.tar` file with the necessary elements. Since this script uses the yarn build command, one should install yarn (for example with sudo apt-get install yarn) and run `yarn install` before executing the script.

## Production server

The single page app can be deployed as static webapp on any cloud provider. Care must be taken about the CRSF problematic for the API calls to get config and state. Usually you need to configure a basic API with your cloud provider that handles this requests.

A simple solution on Linux is using lighttpd web server to serve the web app, config files and state files. See https://github.com/smart-data-lake/sdl-visualization/tree/develop/public for details.

For Azure there is a ready-made path that needs none of this: Terraform in
`backend/infra_azure/`, and `yarn deploy-azure` to ship a build to the Static Web App
it creates. See [backend/infra_azure/README.md](backend/infra_azure/README.md).

# Backend

We defined the data format and how the data are fetched in frontend in the chapter "_Frontend > Internal logic > Workflows explorer > API and connectors_". We now explain in greater detail different way of setting up a source that can be used by the frontend.

There are three of them, chosen by the `backendConfig` field of `public/manifest.json`:

| `backendConfig` | where the data comes from | see |
|---|---|---|
| `local;` | files you put in `public/config` and `public/state`, indexed by `build_index.sh` | [Local setup](#local-setup) |
| `bundled;<baseUrl>` | the backend in `backend/`, which SDLB uploads to and agents query over MCP | [Backend and MCP server](#backend-and-mcp-server) |
| `rest;<BASE_URL>` | a REST service of your own that answers three endpoints | [REST API](#rest-api) |

## Local setup

Prerequisites:
- Python3 installed

The easiest way to quickly get started is to directly provide the config and state files in the directory `public/config` and `public/state` respectively.
Once that's done, an index has to be generated that will aggregate the statefiles and provide pointers to them. 
The frontend will simply have to read the preprocessed information in order to display them in the "workflow's" pages and help fetching the state file directly to display it in the "run" page.
The advantage is that no uploads are needed.

Once your files are placed in the correct directory, run:
````
$ ./build_index.sh <path-to-statefiles> <path-to-configfiles>"
```` 

> IMPORTANT: the current script doesn't allow for only providing `<path-to-configfiles>`. If only one argument is provided it will be considered as a `<path-to-statefiles>`)

This will generate an index for each of the file sources. The outputs are JSON-Lines files named `index` and stored in `public/state` and `public/config` respectively.

Finally you have to make sure you are using the default connector for local statefiles. Change the field `backendConfig` to `local;` in `public/manifest.json` if it is not already the case.

You should now be able to browse to `localhost:3000/` and should be greeted by the home page.

## Backend and MCP server

`backend/` holds a ready-made backend: one service that serves this app's REST
contract, receives SDLB's uploads, and exposes an MCP endpoint so coding agents can
search the configuration and analyse failed runs. It keeps state and configuration in a
database and a file or blob store, and runs either as a plain Node process or
serverless.

Set `backendConfig` to `bundled;<baseUrl>` in `public/manifest.json`, or
`bundled;<baseUrl>;<repo>;<env>` to pin the deployment to a single repository.

- [backend/README.md](backend/README.md) — running it, what it expects from SDLB,
  storage, Databricks authentication, and the MCP tools.
- [backend/infra_azure/README.md](backend/infra_azure/README.md) — the Terraform for an
  Azure deployment, and the two scripts that ship this app and the backend into it.

## REST API

Perequisites:
- A REST service with 3 endpoint for each format of data defined in the chapter "_Frontend > Internal logic > Workflow explorer_"
- *Optional*: a custom connector as defined in previous chapter that handles fetching the data by using the appropriate endpoint for the functions "getWorkflows", "getWorkflow" and "getRun"

In order to use the provided connector, it is necessary that your REST endpoints must be defined as follow:

- function: getWorkflows() → corresponding endpoint: ?`<BASE_URL>/workflows`
- function: getWorkflow(name: string) → corresponding endpoint: `<BASE_URL>/workflow?name={workflowName}`
- function: getRun(name: string, runId: number, attemptId: number) → corresponding endpoint: `<BASE_URL>/run?name={name}&runID={runId}&attemptId={attemptId}`

Where `<BASE_URL>` can be any string.

You should then change the field `backendConfig` to `rest;<BASE_URL>` in `public/manifest.json`.

You should now be able to browse to `localhost:3000/` and should be greeted by the home page.

# Other settings

In `public/manifest.json` you can set various configurations for the UI:

- `backendConfig`: `local;`, `bundled;<baseUrl>` or `rest;<BASE_URL>` - see chapter
  "[Backend](#backend)" above
- `baseUrl`: website base url if not "/"
- `env`: when parsing hocon config files, `env` is used to get the environment configuration file from `envConfig/{env}.conf`
- `configSourceUrl`: configure a url template to link to configuration source files similar to "https://github.com/smart-data-lake/getting-started/blob/master/config/{filename}#L{lineNumber}"

# Testing

## Unit tests

Vitest, see `tests/*.test.ts`:
````
$ yarn test        # watch mode
$ yarn test:ci     # single run
````

## End-to-end tests

Playwright drives the app in a real browser, see `tests/e2e/`. A real browser is
needed because the lineage graph (ReactFlow) and the HOCON parser (a Node
library polyfilled for the browser) do not work outside one.

````
$ npx playwright install chromium   # once
$ yarn test:e2e                     # run all specs
$ yarn test:e2e:ui                  # interactive runner
````

The tests do not use `public/config` and `public/state` (those hold your local
data and are gitignored). They run against the config and state files of the
[getting-started](https://github.com/smart-data-lake/getting-started) project,
committed under `tests/e2e/fixtures/` and served by a middleware in
`vite.config.e2e.ts`. Refresh them with `tests/e2e/fixtures/update-fixtures.sh`.

Two fixture variants are served, because the config can come from two sources:
`hocon` (parsed from `config/*.conf` plus `envConfig/dev.conf`, port 3000) and
`exported` (read from `exportedConfig.json` as the deployed getting-started
visualizer does, port 3001). Playwright starts both dev servers itself.
