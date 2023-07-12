# Overview
SDL Visualizer is a single page web application to show SDLB configuration and workflows' runs as a browsable, nice web page.

# Configuration and setup
SDL Visualizer can parse and resolve SDLB configuration files and state files in the Browser by using a corresponding Javascript library. This is done when loading the URL in the browser and might take some time for large configurations.

## Development mode

### Prerequisites
You need to have installed the following in your environment before begining:
- NodeJS version 16 ([see](https://nodejs.dev/en/download/))
- Yarn ([see](https://classic.yarnpkg.com/lang/en/docs/install/#windows-stable))
- Python3

### How to use?
#### Intro
For testing the app in a development mode (i.e. locally) you will first have to **install the prerequisits**. There are different ways to provide the data for the UI to visualize. Currently the ready-to-use solution that helps you to quickly get started with the UI is using a local setup. The following will provide a description on how to get started with it. 
> Note: you can implement your own connector to the UI! For this have a look at `src/api` and the different interfaces we use to feed the data to the UI

#### Prepare your files
You will first need to build an index for your statefiles. This preprocessing step makes the finding and fetching of your statefiles by the UI efficient. You will have to run the script `build_index.sh` and provide the location of your statefile collection and config file collection as arguments. The script will skip building the index if you are not providing the paths. For the local development server to be able to access your files you should place your configuration files in `public/config` and your statefiles in `public/state` (note that you do not need internal directory structure for the script to work). Once you're setup with your files, you can run: 
````
./build_index.sh <path-to-statefiles> <path-to-configfiles>
````


#### Start the development server
Just run `yarn start` to spin the local development server

