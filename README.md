# Overview
SDL Visualizer is a single page web application to show SDLB configuration and workflows' runs as a browsable, nice web page.

# Configuration and setup
SDL Visualizer can parse and resolve SDLB configuration files and state files in the Browser by using a corresponding Javascript library. This is done when loading the URL in the browser and might take some time for large configurations.

## Install

### Prerequisits
You need to have installed the following in your environment before begining:
- NodeJS version 16 ([see](https://nodejs.dev/en/download/))
- Yarn ([see](https://classic.yarnpkg.com/lang/en/docs/install/#windows-stable))
- Python3

### Development mode
#### Intro
For testing the app in a development mode (i.e. locally) you will first have to **install the prerequisits**. We will then use the script `setup.sh` to take care the the installation of dependencies and the generation of index and summaries used by the app to navigate your config and statefiles.

#### Files
Place all your config and state files (no matter your file structure) into the directory `public/config` and `public/state`

#### Auto-setup
Make the script `setup.sh` executable by running the following in the project's directory:
````
$ chmod u+x setup.sh
````
Then run the following to finnish setting up:
````
$ ./setup.sh
````
Finally to start the local development server run:
````
$ yarn start
````