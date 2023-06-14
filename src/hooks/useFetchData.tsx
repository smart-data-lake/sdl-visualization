import { useQuery } from "react-query";
import { Fetcher } from "../api/Fetcher";


export const fetcher = new Fetcher();

export const useFetchWorkflows = () => {
    return useQuery('workflows', () => fetcher.getWorkflows());
}

export const useFetchWorkflow = (workflow: string) => {
    return useQuery('workflow', () => fetcher.getWorkflow(workflow))
}

export const useFetchRun = (name: string, runId: number, attemptId: number) => {
    return useQuery('run', () => fetcher.getRun({name, runId, attemptId}))
}

export default useFetchWorkflows;