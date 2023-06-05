import { fetchApi } from "./fetchAPI";

export class fetchAPI_mongoDB implements fetchApi {
    url: string;
    
    constructor(url: string) {
        this.url = url;
    }

    getWorkflows = () => {
        return fetch(`${this.url}/workflows`)
        .then(res => res.json())
        .then(data => {console.log(data); return data});
    };
    
    
    getWorkflow = (name: string) => {
        return fetch(`${this.url}/workflow?name=${name}`)
        .then(res => res.json())
        .then(data => data[0])
    };
    
    
    getRun = (args: {name: string, runId: number, attemptId: number}) => {
        return fetch(`${this.url}/runs?name=${args.name}&runId=${args.runId}&attemptId=${args.attemptId}`)
        .then(res => res.json())
        .then(data => data[0])
    };    
}