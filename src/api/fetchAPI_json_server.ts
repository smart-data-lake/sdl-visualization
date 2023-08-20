import { fetchAPI } from "./fetchAPI";

export class fetchAPI_json_server implements fetchAPI {
    url: string;
    
    constructor(url: string) {
        this.url = url;
    }

    getWorkflows = () => {
        return fetch(`${this.url}/workflows`)
        .then(res => res.json())
        .then(json => json as []);
    };
    
    
    getWorkflow = (name: string) => {
        return fetch(`${this.url}/workflow?name=${name}`)
        .then(res => res.json())
        .then(data => data[0])
    };
    
    
    getRun = (args: {name: string, runId: number, attemptId: number}) => {
        return fetch(`${this.url}/runs?attemptId=${args.attemptId}&appConfig.applicationName=${args.name}&runId=${args.runId}`)
        .then(res => res.json())
        .then(data => data[0])
    };    
}