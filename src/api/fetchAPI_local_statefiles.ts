import { fetchAPI } from "./fetchAPI";

export class fetchAPI_local_statefiles implements fetchAPI {
    
    config: {
        backendConfig: string;
        statefilesIndex: string;
        congigfilesIndex: string;
    }

    constructor(config: {
        backendConfig: string;
        statefilesIndex: string;
        congigfilesIndex: string;
    }) {
        this.config = config;
    }

    getWorkflows = async () => {
            return fetch((this.config.statefilesIndex ? this.config.statefilesIndex : "/state") + "/index.json")
            .then(res => res.json())
            .then(data => data["workflows"])
            .catch(err => console.log("Not able to find local statefiles", err));
        
    };
    
    
    getWorkflow = async (name: string) => {
            return fetch((this.config.statefilesIndex ? this.config.statefilesIndex : "/state") + "/index.json")
            .then(res => res.json())
            .then(data => data["workflow"].filter(workflow => workflow.name === name))
            .then(value => value[0])
            .catch(err => console.log("Not able to find local statefiles", err));
    };

    
    getRun = async (args: {name: string, runId: number, attemptId: number}) => {            
        return fetch((this.config.statefilesIndex ? this.config.statefilesIndex : "/state") + "/index.json")
        .then(res => res.json())
        .then(data => data["runs"].filter(run => (run.name === args.name && run.runId === args.runId && run.attemptId === args.attemptId))[0])
        .then(val => { 
            return fetch("/state/"+val.path)
                    .then(res => res.json())
        })
        .catch(err => console.log("Not able to find local statefiles", err))
        
    };    
}