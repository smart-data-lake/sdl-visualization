import { useQuery } from "react-query";

const getManifest = () => {
    return fetch('/manifest.json')
        .then(res => res.json())
        .then(data => data);
}

export const useManifest = () => {
    return useQuery('manifest', getManifest);
}