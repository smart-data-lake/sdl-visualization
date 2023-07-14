import { useQuery } from "react-query";
import { getConfiguredFetcher } from "../api/Fetcher";
import { fetchAPI } from "../api/fetchAPI";


// lazy initialized
var _fetcher: fetchAPI;
function fetcher() {
    if (!_fetcher) _fetcher = getConfiguredFetcher();
    return _fetcher;
}

// The following are the React Query wrapings of the fetcher methods

export const useFetchWorkflows = () => {
    return useQuery('workflows', () => fetcher().getWorkflows());
}

export const useFetchWorkflow = (workflow: string) => {
    return useQuery('workflow', () => fetcher().getWorkflow(workflow))
}

export const useFetchRun = (name: string, runId: number, attemptId: number) => {
    return useQuery('run', () => fetcher().getRun({name, runId, attemptId}))
}

export default useFetchWorkflows;