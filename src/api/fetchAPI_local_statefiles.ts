import { fetchApi } from "./fetchAPI";

export class fetchAPI_local_statefiles implements fetchApi {
    url: string;
    
    constructor() {
        this.url = 'url';
    }

    getWorkflows = async () => {
        const query = await fetch('/manifest.json');
        const manifest = await query.json();
        
        return fetch(manifest.statefilesIndex + "/index.json")
        .then(res => res.json())
        .then(data => data["workflows"]);
    };
    
    
    getWorkflow = async (name: string) => {
        const query = await fetch('/manifest.json');
        const manifest = await query.json();

        return fetch(manifest.statefilesIndex + "/index.json")
        .then(res => res.json())
        .then(data => data["workflow"].filter(workflow => workflow.name === name))
        .then(value => value[0])
    };

    
    getRun = async (args: {name: string, runId: number, attemptId: number}) => {
        const query = await fetch('/manifest.json');
        const manifest = await query.json();

        return fetch(manifest.statefilesIndex + "/index.json")
        .then(res => res.json())
        .then(data => data["runs"].filter(run => (run.name === args.name && run.runId === args.runId && run.attemptId === args.attemptId))[0])
        .then(val => { 
            return fetch(val.path)
                    .then(res => res.json())
        })
    };    
}