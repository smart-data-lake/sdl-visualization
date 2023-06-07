import { fetchAPI_json_server } from "../api/fetchAPI_json_server";
import { useQuery } from "react-query";
import { fetchAPI_local_statefiles } from "../api/fetchAPI_local_statefiles";
import { fetchAPI_mongoDB } from "../api/fetchAPI_mongoDB";

export const api_mongo = new fetchAPI_mongoDB("http://127.0.0.1:8000/api/v1");
export const api_local = new fetchAPI_local_statefiles();
        
export const useFetchWorkflows = () => {
    return useQuery('workflows', api_local.getWorkflows);
}

export const useFetchWorkflow = (workflow: string) => {
    return useQuery('workflow', () => api_local.getWorkflow(workflow))
}

export const useFetchRun = (name: string, runId: number, attemptId: number) => {
    return useQuery('run', () => api_local.getRun({name, runId, attemptId}))
}

export default useFetchWorkflows;