import { useQuery } from "react-query";

export interface Manifest {
    // config string for connecting to workflow backend api. Pattern is '<backendType>;<configString>'.
    // Currently supported backend types are local and rest, see also fetchAPITypes.
    backendConfig: string; 
    // website base url if not "/"
    baseUrl?: string; 
    // environment
    env?: string;
    // config source file url template: {filename} and {lineNumber} will be replaced by corresponding config element origin in 'raw config' section of Configuration viewer.
    configSourceUrl?: string;
    
    auth: any;
}

/**
 * Provide the app configuration (Manifest) to nested code, 
 * avoiding lots of useManifest hooks and passing the manifest to the corresponding place where it's needed.
 */
var _persistedManifest: Manifest;
export function getPersistedManifest() {
    if (!_persistedManifest) throw Error("Oops, manifest is not yet read. Please take care that useManifest is executed before this code! Hint: useQuery(..., enabled=!manifestIsLoading)...");
    return _persistedManifest;
}

const getManifest = () => {
    return fetch('manifest.json')
        .then(res => {
            if (!res.ok) throw new Error(res.statusText);
            return res.json();
        })
        .then(data => {
            _persistedManifest = data as Manifest;
            return _persistedManifest;
        })
}

export const useManifest = () => {
    return useQuery({ queryKey: 'manifest', queryFn: getManifest, retry: false, staleTime: 1000 * 60 * 60 * 24 }) //24h
}
