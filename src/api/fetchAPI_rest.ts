import { fetchAPI } from "./fetchAPI";

export class fetchAPI_rest implements fetchAPI {
    url: string;
    
    constructor(url: string) {
        this.url = url;
    }

    getWorkflows = () => {
        return fetch(`${this.url}/workflows`, {mode:'cors'})
        .then(res => res.json())
    };
    
    
    getWorkflow = (name: string) => {
        return fetch(`${this.url}/workflow?name=${name}`, {mode:'cors'})
        .then(res => res.json())
    };
    
    
    getRun = (args: {name: string, runId: number, attemptId: number}) => {
        return fetch(`${this.url}/run?name=${args.name}&runId=${args.runId}&attemptId=${args.attemptId}`, {mode:'cors'})
        .then(res => res.json())
    };   
}