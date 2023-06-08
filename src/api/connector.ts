import { fetchApi } from "./fetchAPI";

export class connector implements fetchApi {

    isLocal = async () => {
        const manifest = await fetch('manifest.json');
        const manifest_json = await manifest.json();
        return manifest_json.localSetup || !manifest_json.mongoDB;
    }
    
    getUrl = async () => {
        const manifest = await fetch('manifest.json');
        const manifest_json = await manifest.json();
        return manifest_json.mongoDB;
    }

    getWorkflows = async () => {
        if (await this.isLocal()) {
            return fetch("/state/index.json")
            .then(res => res.json())
            .then(data => data["workflows"]);
        }
        return fetch(`${await this.getUrl()}/workflows`, {mode:'cors'})
        .then(res => res.json())
        .catch(err => {
            console.log(err); 
        })
    };
    
    
    getWorkflow = async (name: string) => {
        if (await this.isLocal()) {
            return fetch("/state/index.json")
            .then(res => res.json())
            .then(data => data["workflow"].filter(workflow => workflow.name === name))
            .then(value => value[0])
        }
        return fetch(`${await this.getUrl()}/workflow?name=${name}`, {mode:'cors'})
        .then(res => res.json())
        .catch(err => {
            console.log(err)
        })
    };
    
    
    getRun = async (args: {name: string, runId: number, attemptId: number}) => {
        if (await this.isLocal()) {
            return fetch("/state/index.json")
            .then(res => res.json())
            .then(data => data["runs"].filter(run => (run.name === args.name && run.runId === args.runId && run.attemptId === args.attemptId))[0])
            .then(val => { 
                return fetch(val.path)
                      .then(res => res.json())

            })
        }
        
        return fetch(`${await this.getUrl()}/run?name=${args.name}&runId=${args.runId}&attemptId=${args.attemptId}`, {mode:'cors'})
        .then(res => res.json())
        .catch(err => {
            console.log(err)
        })
    };    
}