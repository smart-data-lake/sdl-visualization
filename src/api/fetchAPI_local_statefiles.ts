import { durationMicro } from "../util/WorkflowsExplorer/date";
import { compareFunc, onlyUnique } from "../util/helpers";
import { fetchAPI } from "./fetchAPI";

export class fetchAPI_local_statefiles implements fetchAPI {
    
    statePath: string = "/state";

    constructor(path: string) {
        if (path) this.statePath = path;
    }

    _index: Promise<any[]> | undefined;
    getIndex() {
        if (!this._index) {
            const indexPath = this.statePath + "/index.json";
            this._index = fetch(indexPath)
            .then(res => res.json())
            .then(json => json as any[])
            .then(runs => runs.map(run => {
                // convert date strings to date
                run.runStartTime = new Date(run.runStartTime);
                run.attemptStartTime = new Date(run.attemptStartTime);
                run.duration = durationMicro(run.duration);
                return run;
            }))
            .catch(err => {
                console.error(`Could not load index file ${indexPath}`, err);
                throw err;
            });
        }
        return this._index;
    }

    groupByWorkflowName(data: any[]) {
        return data.reduce((group: {[key: string]: any[]}, run) => {
            if (!group[run.name]) group[run.name] = [];
            group[run.name].push(run);
            return group;
        }, {});
    }

    getWorkflows = async () => {
        return this.getIndex()
        .then(data => {
            const workflows = this.groupByWorkflowName(data);
            return Object.entries(workflows).map(([name,runs]) => {
                const lastRun = runs.sort(compareFunc("attemptStartTime"))[runs.length - 1];
                return {
                    "name": name,
                    "numRuns": runs.map(run => run.runId).filter(onlyUnique).length,
                    "numAttempts": runs.length,                    
                    "lastDuration": lastRun.duration,
                    "lastAttemptStartTime": lastRun.attemptStartTime,
                    "lastStatus": lastRun.status
                }
            })
        })
    };
    
    
    getWorkflow = async (name: string) => {
        return this.getIndex()
        .then(data => {
            const runs = data.filter(run => run.name === name)
            const lastRun = runs.sort(compareFunc("attemptStartTime"))[runs.length - 1];
            return {
                "name": name,
                "numRuns": runs.map(run => run.runId).filter(onlyUnique).length,
                "numAttempts": runs.length,
                "lastDuration": lastRun.duration,
                "lastAttemptStartTime": lastRun.attemptStartTime,
                "lastStatus": lastRun.status,
                "runs": runs
            }
        })
    };

    
    getRun = async (args: {name: string, runId: number, attemptId: number}) => {            
        return this.getIndex()
        .then(data => data.filter(run => (run.name === args.name && run.runId === args.runId && run.attemptId === args.attemptId))[0])
        .then(val => { 
            return fetch("/state/"+val.path)
                    .then(res => res.json())
        })        
    };    
}