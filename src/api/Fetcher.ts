import { getPersistedManifest } from "../hooks/useManifest";
import { fetchAPI } from "./fetchAPI";
import { fetchAPI_local_statefiles } from "./fetchAPI_local_statefiles";
import { fetchAPI_rest } from "./fetchAPI_rest";

/**
 * The fetcher automatically finds the type of API we use based on the value of "backendConfig" in manifest.json
 * It instanciate a class that implements fetchAPI, which provides the function necessary for fetching data
 * You can add a new implementation of fetchAPI to suit your need. 
 */
const fetchAPITypes = {
    local: fetchAPI_local_statefiles,
    rest: fetchAPI_rest,
    /**
     * You can add a new fetchAPI implementation here. 
     * If it is set up in manifest, the Fetcher will find it automatically and fetch the data according to your definition of the interface's functions
     */
}

// lazy initialized
var _fetcher: fetchAPI;
export function fetcher() {
  if (!_fetcher) _fetcher = getConfiguredFetcher();
  return _fetcher;
}

function getFetcherClass(name: string) : new (configString: string, baseUrl?: string, env?: string) => fetchAPI {
    return fetchAPITypes[name];
}

function getConfiguredFetcher() {
    const manifest = getPersistedManifest();
    const [fetchType, ...rest] = manifest.backendConfig.split(';');
    return new (getFetcherClass(fetchType))(rest.join(';'), manifest.baseUrl, manifest.env);
}