import { useMutation, useQuery } from "react-query";
import { getConfiguredFetcher } from "../api/Fetcher";
import { fetchAPI } from "../api/fetchAPI";
import { useTenant } from "./TenantProvider";


// lazy initialized
var _fetcher: fetchAPI;
function fetcher() {
    if (!_fetcher) _fetcher = getConfiguredFetcher();
    return _fetcher;
}

// The following are the React Query wrapings of the fetcher methods

export const useFetchWorkflows = () => {
    const {tenant} = useTenant();
    return useQuery({queryKey: ['workflows', tenant], queryFn: () => fetcher().getWorkflows(tenant), retry: false, staleTime: 1000 * 60 * 60 * 24}) //24h
}

export const useFetchWorkflowRuns = (workflow: string) => {
    const {tenant} = useTenant();
    return useQuery({queryKey: ['workflow',workflow, tenant], queryFn: () => fetcher().getWorkflowRuns(tenant, workflow), retry: false, staleTime: 1000 * 60 * 60 * 24}) //24h
}

export const useFetchRun = (name: string, runId: number, attemptId: number) => {
    const {tenant} = useTenant();
    return useQuery({queryKey: ['run',name,runId,attemptId, tenant], queryFn: () => fetcher().getRun({tenant, name, runId, attemptId}), retry: false, staleTime: 1000 * 60 * 60 * 24}) //24h
}

export const useFetchUsers = () => {
    const {tenant} = useTenant();
    return useQuery({queryKey: ['users', tenant], queryFn: () => fetcher().getUsers(tenant)})
}

export const useAddUser = () => {
    const {tenant} = useTenant();
    return useMutation(({email, access}: any) => fetcher().addUser(tenant,email,access));
}

export const useFetchTenants = () => {
    return useQuery({queryKey: ['tenants'], queryFn: () => fetcher().getTenants(), retry: false, staleTime: 1000 * 60 * 60 * 24}) //24h
}

export default useFetchWorkflows;