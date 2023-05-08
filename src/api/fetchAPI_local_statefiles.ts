import { fetchApi } from "./fetchAPI";

export class fetchAPI_local_statefiles implements fetchApi {
    url: string;
    
    constructor(url: string) {
        this.url = url;
        this.generateHistory();
    }

    generateHistory = () => {
        console.log(this.fileExists('s', 's'))
        /* if (!fileExists(url, 'workflows')) generateWorkflows();
        if (!fileExists(url, 'workflow')) generateWorkflow(); */
    }

    fileExists = (url: string, target: string) => {
        const fs = require("fs");
        fs.readdirSync(__dirname).forEach(file => {
            console.log(file);
        });
        return false //fs.existsSync("fetchAPI_local_statefile.ts")
    }

    getWorkflows = () => {
        return fetch(`${this.url}/workflows`)
        .then(res => res.json());
    };
    
    
    getWorkflow = (name: string) => {
        return fetch(`${this.url}/workflow?name=${name}`)
        .then(res => res.json())
    };

    
    getRun = (args: {name: string, runId: number, attemptId: number}) => {
        return fetch(`${this.url}/runs?attemptId=${args.attemptId}&appConfig.applicationName=${args.name}&runId=${args.runId}`)
        .then(res => res.json())
    };    
}