import { ActionsState, Run, RunInfo, StateFile, Row } from "../types"
import randomStateFile from "./randomStateFile";


export default class Attempt {
    runInfo: RunInfo; // Contains all general information
    rows: Row[];
    run: Run;
    
    constructor(stateFile?: StateFile) {  
        if (stateFile) {
            this.runInfo = this.getRunInfo(stateFile);  
            this.rows = this.getTaskRow(stateFile.actionsState).sort(this.cmp);
            this.run =  this.getRun();
        } else {
            const stateFile = randomStateFile();
            this.runInfo = this.getRunInfo(stateFile);  
            this.rows = this.getTaskRow(stateFile.actionsState).sort(this.cmp);
            this.run =  this.getRun();
        }
    }

    /**
     * Iterate through the statefile's actionsState and create a TaskRow array.
     * @returns TaskRow[]
     */
    getTaskRow(actionsState: ActionsState) {
        const taskRow : Row[] = [];
        const actionsStateEntries = Object.entries(actionsState);
        actionsStateEntries.forEach((entry) => {
            const actionName = entry[0];
            const action = entry[1];
            const taskData = new Row({
                runInfo: this.runInfo, 
                action: action, 
                actionName: actionName
            });
            taskRow.push(taskData)
        })
        return taskRow;
    }

    getRunInfo(stateFile: StateFile) {
        return {
            workflowName: stateFile.appConfig.applicationName,
            feedSel: stateFile.appConfig.feedSel,
            runId: stateFile.runId,
            runStartTime: stateFile.runStartTime,
            attemptId: stateFile.attemptId,
            attemptStartTime: stateFile.attemptStartTime,
            parallelism: stateFile.appConfig.parallelism,
            streaming: stateFile.appConfig.streaming,
            actionsState: stateFile.actionsState
        }
    }

    getRun() {
        const run : Run = {
            flow_id: this.runInfo.workflowName,
            run_number: this.runInfo.runId,
            status: 'completed',
            user: 'undefined',
            user_name: 'undefined',
            ts_epoch: Math.min(...(this.rows.flatMap(row => row.started_at!).filter(x=>x))) - 10, // start 10ms earlier
            finished_at: Math.max(...(this.rows.flatMap(row => row.finished_at!).filter(x=>x))),
            system_tags: [],
        }
        return run;
    }
    /**
     * Utility function for comparisons in the default "Array.sort()" function
     * @param a 
     * @param b 
     * @returns
     */
     private cmp(a: any, b: any) {
        if (a["started_at"] < b["started_at"]) {
            return -1;
        }
        if (a["started_at"] > b["started_at"]) {
            return 1;
        }
        return 0;
    }   
}