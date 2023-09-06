import { getRenderableIndexes } from "@mui/x-data-grid/internals";
import { durationMillis } from "../util/WorkflowsExplorer/date";
import { compareFunc, onlyUnique } from "../util/helpers";
import { fetchAPI } from "./fetchAPI";

export class fetchAPI_local_statefiles implements fetchAPI {
    
    statePath: string = "/state";

    constructor(path: string) {
        if (path) this.statePath = path;
    }

    // cache index for reuse in getRun
    _index: Promise<any[]> | undefined;
    getIndex() {
        const indexPath = this.statePath + "/index.json";
        this._index = fetch(indexPath)
        // note that index.json is not a valid json file, but a concatenation of json objects separated by a line containing '---'.
        .then(res => res.text())
        .then(res => res.split(/^\s*\-\-\-\s*$/m)
                        .filter(obj => obj.trim().length > 0)
                        .map(obj => JSON.parse(obj)))
        .then(runs => runs.map(run => {
            // convert date strings to date
            run.runStartTime = new Date(run.runStartTime);
            run.attemptStartTime = new Date(run.attemptStartTime);
            run.runEndTime = new Date(run.runEndTime);
            run.duration = run.runEndTime.getTime() - run.attemptStartTime.getTime();
            return run;
        }))
        .then(runs => {console.log("got runs", runs); return runs})
        .catch(err => {
            console.error(`Could not load index file ${indexPath}`, err);
            throw err;
        });
        return this._index;
    }
    
    reuseIndex() {
        if (this._index) return this._index;
        else return this.getIndex()
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
                const lastNumActions = Object.values(lastRun.actionsStatus || {}).map(x => x as number).reduce((sum,x) => sum+x, 0);
                return {
                    "name": name,
                    "numRuns": runs.map(run => run.runId).filter(onlyUnique).length,
                    "numAttempts": runs.length,                    
                    "lastDuration": lastRun.duration,
                    "lastAttemptStartTime": lastRun.attemptStartTime,
                    "lastStatus": lastRun.status,
                    "lastNumActions": lastNumActions
                }
            })
        })
    };
    
    
    getWorkflowRuns = async (name: string) => {
        return this.getIndex()
        .then(data => {
            const runs = data.filter(run => run.name === name)
            return runs
        })
    };

    
    getRun = async (args: {name: string, runId: number, attemptId: number}) => {            
        return this.reuseIndex()
        .then(data => data.filter(run => (run.name === args.name && run.runId === args.runId && run.attemptId === args.attemptId))[0])
        .then(val => { 
            if (!val) console.log("getRun not found", args.name, args.runId, args.attemptId);
            return fetch(this.statePath + '/' + val.path)
                    .then(res => res.json())
        })        
    };    
}