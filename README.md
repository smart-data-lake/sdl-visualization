# Overview
SDL Visualizer is a single page web application to show SDLB configuration and workflows' runs as a browsable, nice web page.

# Usage

Prerequisites
- NodeJS version 16 ([see](https://nodejs.dev/en/download/))
- Yarn ([see](https://classic.yarnpkg.com/lang/en/docs/install/#windows-stable))

## Developer server

To run the app in a local developer server, it suffices to clone the project, install the prerequisites and run the "yarn start" command. You can then see your changes updated live as any React dev project.

> **IMPORTANT**: if you have not setup your backend, you will not be able to visualize statefiles. Please read the chapter "Backend" to learn about the different setup options.

## Build and deployement

The deployment and release of the project has been automated in github using a build.yml file. In essence, a new merge or build in the master branch will trigger the creation of a new release and its corresponding `.zip` and `.tar` files.

Alternatively, the createRelease.sh script can be used to manually build the project and then create a `.tar` file with the necessary elements. Since this script uses the yarn build command, one should install yarn (for example with sudo apt-get install yarn) and run `yarn install` before executing the script.


# Backend

We defined the data format and how the data are fetched in frontend in the chapter "_Frontend > Internal logic > Workflows explorer > API and connectors_". We now explain in greater detail different way of setting up a source that can be used by the frontend.

## Local setup

Prerequisites:
- Python3 installed


The easiest way to quickly get started is to directly provide the config and state files in the directory `public/config` and `public/state` respectively. Once that's done, we can generate an index that will aggregate the statefiles and provide pointers to them. The frontend will simply have to read the preprocessed information in order to display them in the "workflow's" pages and help fetching the state file directly to display it in the "run" page.

Once your files are placed in the correct directory, run:
````
$ ./build_index.sh <path-to-statefiles> <path-to-configfiles>"
```` 

> IMPORTANT: the current script doesn't allow for only providing `<path-to-configfiles>`. If only one argument is provided it will be considered as a `<path-to-statefiles>`)

This will generate an index for each of the file sources. The outputs are JSON files named `index.json` and stored in `public/state` and `public/config` respectively.

Finally you have to make sure you are using the default connector for local statefiles. Change the field `backendConfig` to `local` in `public/manifest.json` if it is not already the case.

You should now be able to browse to `localhost:3000/` and should be greeted by the home page.

## REST API

Perequisites:
- A REST service with 3 endpoint for each format of data defined in the chapter "_Frontend > Internal logic > Workflow explorer_"
- *Optional*: a custom connector as defined in previous chapter that handles fetching the data by using the appropriate endpoint for the functions "getWorkflows", "getWorkflow" and "getRun"

In order to use the provided connector, it is necessary that your REST endpoints must be defined as follow:

- function: getWorkflows() → corresponding endpoint: ?`<BASE_URL>/workflows`
- function: getWorkflow(name: string) → corresponding endpoint: `<BASE_URL>/workflow?name={workflowName}`
- function: getWorkflows(name: string, runId: number, attemptId: number) → corresponding endpoint: `<BASE_URL>/run?name={name}&runID={runId}&attemptId={attemptId}`

Where `<BASE_URL>` can be any string.

You should then change the field `backendConfig` to `rest;<BASE_URL>` in `public/manifest.json`.

You should now be able to browse to `localhost:3000/` and should be greeted by the home page.

# Other settings

In `public/manifest.json` you can set various configurations for the UI:

- `backendConfig`: see chapter "Backend" above"
- `baseUrl`: website base url if not "/"
- `env`: when parsing hocon config files, `env` is used to get the environment configuration file from `envConfig/{env}.conf`
- `configSourceUrl`: configure a url template to link to configuration source files similar to "https://github.com/smart-data-lake/getting-started/blob/master/config/{filename}#L{lineNumber}"
