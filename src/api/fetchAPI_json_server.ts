import { fetchApi } from "./fetchAPI";

export class fetchAPI_json_server implements fetchApi {
    url: string;
    
    constructor(url: string) {
        this.url = url;
    }

    getWorkflows = async () => {
        const response = await fetch(`${this.url}/workflows`)
        const data: any = await response.json();
        return data;
    };
    
    
    getWorkflow = async (name: string) => {
        const response = await fetch(`${this.url}/workflow?name=${name}`)
        const data: any = await response.json();
        return data;
    };
    
    
    getRun = async (args: {name: string, runId: number, attemptId: number}) => {
        const response = await fetch(`${this.url}/runs?attemptId=${args.attemptId}&appConfig.applicationName=${args.name}&runId=${args.runId}`)
        const data: any = await response.json();
        return data;
    };

    
}