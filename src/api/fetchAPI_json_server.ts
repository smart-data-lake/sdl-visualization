import { fetchAPI } from "./fetchAPI";

export class fetchAPI_json_server implements fetchAPI {
    url: string;
    
    constructor(url: string) {
        this.url = url;
    }

    getWorkflows = (tenant: string) => {
        return fetch(`${this.url}/workflows`)
        .then(res => res.json())
        .then(json => json as []);
    };
    
    
    getWorkflowRuns = (tenant: string, name: string) => {
        return fetch(`${this.url}/workflow?name=${name}&tenantName=${tenant}`)
        .then(res => res.json())
        .then(data => data[0])
    };
    
    
    getRun = (args: {tenant: string, name: string, runId: number, attemptId: number}) => {
        return fetch(`${this.url}/runs?attemptId=${args.attemptId}&appConfig.applicationName=${args.name}&runId=${args.runId}&tenantName=${args.tenant}`)
        .then(res => res.json())
        .then(data => data[0])
    };  
    
    getUsers(tenant: string) {
        return new Promise((r) => r([]));
    };

    addUser(tenant: string, email: string, access: string) {
        return new Promise((r) => r({}));
    }
    
    getTenants() {
        return new Promise<string[]>(r => r([]))
    }
}