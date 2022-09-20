# Configuration and setup

## Install

### Prerequisits
A Webserver
- to serve static html, js and css files
- to serve config, envConfig and description directories 
- that allows "directory listing" for the config directory (alternatively an index.json file listing all configuration files can be created inside the config folder).

### Linux with lighttpd
Serve the application with a simple webserver called [lighttpd](https://redmine.lighttpd.net/projects/lighttpd). The server uses the configurations from the lighttpd.conf file, which has already some default configurations, but can be adapted. 

The default configuration serves the config and description directories from the parent folder, and the rest from its own directory. This allows to have a subdirectory with sdl-visualizer release files, serving the SDLB configuration of your project.

In order to start the server, do the following:
1. Install lighttpd with `sudo apt install lighttpd`.
2. Create a folder *sdl-visualizer/* on the same level as your *config/* and *description/* folders. 
3. Download the zip-file from the assets of latest release, e.g. [sdl-visualizer.zip](https://api.github.com/repos/smart-data-lake/sdl-visualization/releases/latest/sdl-visualizer.zip), and unzip it inside *sdl-visualizer/*.
4. Adapt *lighttpd.conf* to your needs. The default setup is to listen on port 5000 for http on all interfaces. For production:
    1. Use an https proxy
    2. Authentication should be put in front (e.g. oauth2-proxy)
    3. Server.bind set to 127.0.0.1.
5. Serve by executing  `lighttpd -D -f lighttpd.conf` within the unzipped folder. Note: the '-D' parameter is to start lighttpd in non-daemonized mode.


## Conventions
### Config files
The `.conf files` (theoretically also *.json* or *.properties*) are to be written in [HOCON-format](https://github.com/lightbend/config/blob/main/HOCON.md). Furthermore, they must be placed in a `config/` folder in the folder where index.html lives. Alternatively the webserver can route this path to a different directory, as done with lighthttp above.

### Environment config files
Similar to config files, create environment specific configurations in a `envConfig/` folder, one file per environment with filename convention `<environment-name>.conf`. Configure the environment to use in sdl-visualisation in manifest.json using key `"env" = "<environment-name>"`.
As environment variables are not available in sdl-visualizer (as it is executing in the browser...), you should use them only in environment configuration files and not the general configruation files in `config/`. Then you need to configure an environment for sdl-visualizer that needs no environment variables.

### Description files
The .md files must be placed within the `description/<elementType>/` folder, whereas *elementType* can be *actions*, *dataObjects* or *connections*. They must be placed in a `description/` folder in the folder where index.html live. Alternatively the webserver can route this path to a different directory, as done with lighthttp above.

The description files must be written using the Markdown Standard, e.g. [CommonMark](https://commonmark.org/), and the filename must match the element described. For example, in order to link a description file to the *airports* data object, the corresponding file must be named `description/dataObjects/airports.md`.

In order to include resources in the description file, use the complete path starting from the `description/` folder. Take for example a file *airports.md* which displays an image *photo_of_airports.png*. Even if both files (.md and .png) are in the same folder `description/dataObjects/` , the following code would not work...

```markdown
![This is the image text](photo_of_airports.png)
```

whereas this reference works fine...

```markdown
![This is the image text](description/dataObjects/photo_of_airports.png)
```

Furthermore, the parser slightly modifies Markdown files in order to add additional syntax for our description files:

The **@column** annotation is used to describe columns in a table. The syntax is:

```markdown
@column `column name (first cell)` Description of the column as text
@column `column name (second cell)` Antoher description of the column as text
```

This would render as:

|Column | Description | 
|-----|------|
|column name (first cell) | Description of the column as text |
|column name (second cell) | Antoher description of the column as text |

**IMPORTANT**: If one uses the **@column** annotation in the description files, there can be no additional Markdown between the last column description and the next header, unless the columns are closed with the **@endColumn** annotation.

    
## Build and deployment

The createRelease.sh script can be used to manually build the project and then create a *.tar* file with the necessary elements. Since this script uses the `yarn build` command, one should install yarn (for example with `sudo apt-get install yarn`) and run `yarn install` before executing the script.

## Development mode
The project was bootstrapped with [Create React App](https://create-react-app.dev/), which comes with a series of predefined default values for bundling the application. In order to develop, debug and test the application, we can use npm or yarn. We decided to use the latter for performance reasons, but the commands are basically the same:

1. Install yarn (e.g. with `sudo apt-get install yarn`)
2. Execute `yarn install` (only needed once)
3. Comment the following lines out within *node_modules\react-scripts\config\webpackDevServer.config.js*:
```javascript
    //historyApiFallback: {
      // Paths with dots should still use the history fallback.
      // See  https://github.com/facebook/create-react-app/issues/387.
    //  disableDotRule: true,
    //  index: paths.publicUrlOrPath,
    //},
```
5. Execute `yarn start` to start the application


