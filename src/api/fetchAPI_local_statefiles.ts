import { compareFunc, onlyUnique } from "../util/helpers";
import { fetchAPI } from "./fetchAPI";

export class fetchAPI_local_statefiles implements fetchAPI {
    
    statePath: string = "./state";

    constructor(path: string) {
        if (path) this.statePath = path;
    }

    getUsers(tenant: string) {
        return new Promise((r) => r([]));
    };

    // cache index for reuse in getRun
    _index: Promise<any[]> | undefined;
    getIndex() {
        const indexPath = this.statePath + "/index.json";
        this._index = fetch(indexPath)
        // note that index.json is json lines file
        .then(res => res.text())
        .then(res => res.split("\n")
                        .filter(obj => obj.trim().length > 0)
                        .map(obj => JSON.parse(obj)))
        .then(runs => runs
            .map(run => {
                // convert date strings to date
                run.runStartTime = new Date(run.runStartTime);
                run.attemptStartTime = new Date(run.attemptStartTime);
                run.attemptStartTimeMillis = new Date(run.attemptStartTime).getTime(); // needed for HistoBarChart
                run.runEndTime = new Date(run.runEndTime);
                run.duration = run.runEndTime.getTime() - run.attemptStartTime.getTime();
                // precalc count by status
                run.actionsStatus = Object.values((run.actions || {}) as object)
                .map(action => action.state)
                .reduce((group: {[key: string]: number}, state) => {
                    if (!group[state]) group[state] = 1;
                    else group[state] += 1;
                    return group;
                }, {})
                // precalc list of dataObjects written
                run.dataObjects = Object.values((run.actions || {}) as object)
                .map(action => action.dataObjects).flat()
                return run;
            })
        )
        .then(runs => {console.log(`got ${runs.length} runs`); return runs})
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

    getWorkflows = async (tenant: string, repo: string, env: string) => {
        return this.reuseIndex()
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
    
    
    getWorkflowRuns = async (tenant: string, repo: string, env: string, application: string) => {
        return this.reuseIndex()
        .then(data => {
            const runs = data
            .filter(run => run.name === application)
            .sort(compareFunc('attemptStartTime'));
            return runs
        })
    };


    getWorkflowRunsByAction = async (name: string) => {
        return this.reuseIndex()
        .then(data => {
            const runs = data
            .filter(run => Object.keys(run.actions || {}).some(x => x === name))
            .sort(compareFunc('attemptStartTime'));
            return runs
        })
    };        

    getWorkflowRunsByDataObject = async (name: string) => {
        return this.reuseIndex()
        .then(data => {
            const runs = data
            .filter(run => (run.dataObjects as any[]).some(x => x === name))
            .sort(compareFunc('attemptStartTime'));
            return runs
        })
    };    
    
    getRun = async (args: {tenant: string, repo: string, env: string, application: string, runId: number, attemptId: number}) => {            
        return this.reuseIndex()
        .then(data => data.filter(run => (run.name === args.application && run.runId === args.runId && run.attemptId === args.attemptId))[0])
        .then(val => { 
            if (!val) console.log("getRun not found", args.application, args.runId, args.attemptId);
            return fetch(this.statePath + '/' + val.path)
                    .then(res => res.json())
        })        
    };

    clearCache = () => {
        this._index = undefined;
    };
    
    addUser(tenant: string, email: string, access: string) {
        return new Promise((r) => r({}));
    }

    getTenants() {
        return new Promise<string[]>(r => r([]))
    }

    getRepos(tenant: string): Promise<any[]> {
        return new Promise((r) => r([]));
    }
  
    getEnvs(tenant: string, repo: string): Promise<any[]> {
        return new Promise((r) => r([]));
    }
}