import { useQuery } from "react-query";
import { fetchAPI } from "./fetchAPI";

export class fetchAPI_local_statefiles implements fetchAPI {
    
    statePath: string = "/state";
    indexCache: Promise<any> | undefined;

    constructor(path: string) {
        if (path) this.statePath = path;
    }

    getIndex() {
        if (!this.indexCache) {
            const indexPath = this.statePath + "/index.json";
            this.indexCache = fetch(indexPath)
            .then(res => res.json())
            .catch(err => {
                console.error(`Could not load index file ${indexPath}`, err);
                throw err;
            });
        }
        return this.indexCache;
    }

    getWorkflows = async () => {
        return this.getIndex()
        .then(data => data["workflows"])
    };
    
    
    getWorkflow = async (name: string) => {
        return this.getIndex()
            .then(data => data["workflow"].filter(workflow => workflow.name === name))
            .then(value => value[0])
    };

    
    getRun = async (args: {name: string, runId: number, attemptId: number}) => {            
        return this.getIndex()
        .then(data => data["runs"].filter(run => (run.name === args.name && run.runId === args.runId && run.attemptId === args.attemptId))[0])
        .then(val => { 
            return fetch("/state/"+val.path)
                    .then(res => res.json())
        })        
    };    
}