import { fetchAPI_json_server } from "../api/fetchAPI_json_server";
import { useQuery } from "react-query";
import { fetchAPI_local_statefiles } from "../api/fetchAPI_local_statefiles";
import { connector } from "../api/connector";
import { fetchAPI_mongoDB } from "../api/fetchAPI_mongoDB";


export const connector_mongo = new fetchAPI_mongoDB("http://127.0.0.1:8000/api/v1");
export const connect = new connector();

        
export const useFetchWorkflows = () => {
    return useQuery('workflows', () => connect.getWorkflows());
}

export const useFetchWorkflow = (workflow: string) => {
    return useQuery('workflow', () => connect.getWorkflow(workflow))
}

export const useFetchRun = (name: string, runId: number, attemptId: number) => {
    return useQuery('run', () => connect.getRun({name, runId, attemptId}))
}

export default useFetchWorkflows;