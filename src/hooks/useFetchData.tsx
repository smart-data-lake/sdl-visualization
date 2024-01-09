import { useMutation, useQuery } from "react-query";
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
    return useQuery({queryKey: 'workflows', queryFn: () => fetcher().getWorkflows(), retry: false, staleTime: 1000 * 60 * 60 * 24}) //24h
}

export const useFetchWorkflowRuns = (workflow: string) => {
    return useQuery({queryKey: ['workflow',workflow], queryFn: () => fetcher().getWorkflowRuns(workflow), retry: false, staleTime: 1000 * 60 * 60 * 24}) //24h
}

export const useFetchRun = (name: string, runId: number, attemptId: number) => {
    return useQuery({queryKey: ['run',name,runId,attemptId], queryFn: () => fetcher().getRun({name, runId, attemptId}), retry: false, staleTime: 1000 * 60 * 60 * 24}) //24h
}

export const useFetchUsers = (tenant: string) => {
    return useQuery({queryKey: ['users', tenant], queryFn: () => fetcher().getUsers(tenant)})
}

export const useAddUser = () => {
    return useMutation(({tenant, email, access}: any) => fetcher().addUser(tenant,email,access));
}

export default useFetchWorkflows;