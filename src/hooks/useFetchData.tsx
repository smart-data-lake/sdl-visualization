import { fetchAPI_json_server } from "../api/fetchAPI_json_server";
import { useQuery } from "react-query";

export const api = new fetchAPI_json_server("http://localhost:3001");

export const useFetchWorkflows = () => {
    return useQuery('workflows', api.getWorkflows);
}

export const useFetchWorkflow = (workflow: string) => {
    return useQuery('workflow', () => api.getWorkflow(workflow))
}

export const useFetchRun = (name: string, runId: number, attemptId: number) => {
    return useQuery('run', () => api.getRun({name, runId, attemptId}))
}

export default useFetchWorkflows;