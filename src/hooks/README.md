## About this folder

This folder contains the implementation of custom hooks that are used accross the app. 
- useConfig: it is mainly legacy code from the UI concept 2.0 and is responsible for fetching the configuration data to display in the configuration viewer page
- useFetchData: it contains the different hooks used to fetch the data from the backend implementation. The fetcher (or connector) is automatically selected based on the value of "manifest.json". More details about fetching are available in the README.md of the project's root.
- useManifest: it is used to read the data from "manifest.json". It will read it directly on the first time the hook is used, and will store it in a variable so that it can be directly returned upon next call