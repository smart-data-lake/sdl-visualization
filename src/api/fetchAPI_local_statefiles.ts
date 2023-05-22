import { fetchApi } from "./fetchAPI";

export class fetchAPI_local_statefiles implements fetchApi {
    url: string;
    
    constructor(url: string) {
        
        this.url = url;
    }

    getWorkflows = () => {
        return fetch(this.url)
        .then(res => res.json())
        .then(data => data["workflows"]);
    };
    
    
    getWorkflow = (name: string) => {
        return fetch(this.url)
        .then(res => res.json())
        .then(data => data["workflow"].filter(workflow => workflow.name === name))
        .then(value => value[0])
    };

    
    getRun = (args: {name: string, runId: number, attemptId: number}) => {
        return fetch(this.url)
        .then(res => res.json())
        .then(data => data["runs"].filter(run => (run.name === args.name && run.runId === args.runId && run.attemptId === args.attemptId))[0])
        .then(val => { 
            return fetch(val.path)
                    .then(res => res.json())
        })
    };    
}