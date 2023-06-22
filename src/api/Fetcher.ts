import { getPersistedManifest } from "../hooks/useManifest";
import { fetchAPI } from "./fetchAPI";
import { fetchAPI_local_statefiles } from "./fetchAPI_local_statefiles";
import { fetchAPI_rest } from "./fetchAPI_rest";

const fetchAPITypes = {
    local: fetchAPI_local_statefiles,
    rest: fetchAPI_rest,
}

function getFetcherClass(name: string) : new (url: string) => fetchAPI {
    return fetchAPITypes[name];
}

export function getConfiguredFetcher() {
    const manifest = getPersistedManifest();
    const fetchType = manifest.backendConfig.split(';')[0];
    const url = manifest.backendConfig.split(';')[1];
    return new (getFetcherClass(fetchType))(url);    
}