import { genActionStyle } from "antd/es/alert/style";
import { ActionsState, Run as TimelineRun, RunInfo, StateFile, Row } from "../../types"
import { compareFunc } from "../helpers";


export function updateStateFile(data: any): StateFile {
    if (data.actionsState) {
        Object.entries(data.actionsState).forEach((entry) => {
            const name = entry[0];
            var action: any = entry[1];
            // move attributes from actionsState.<action>.results[].subFeed one level up
            if (action.results && action.results.length > 0 && action.results[0].subFeed) {
                const results = action.results.map(result => {
                    const resultNew = {...result, ...result.subFeed}
                    delete resultNew['subFeed'];
                    return resultNew;
                })
                action.results = results;
            }
            // remove id in actionsState[].inputIds & outputIds
            if (action.inputIds && action.inputIds.length > 0 && action.inputIds[0].id) {
                action.inputIds = action.inputIds.map( e => e.id || e );
            }
            if (action.outputIds && action.outputIds.length > 0 && action.outputIds[0].id) {
                action.outputIds = action.outputIds.map( e => e.id );
            }
            // overwrite entry
            data.actionsState[name] = action;
        })
    }
    console.log(data.actionsState);
    return data;
}

export default class Attempt {
    appName: string;
    runId: number;
    attemptId: number;
    details: StateFile; // Contains all general information
    timelineRows: Row[];
    timelineRun: TimelineRun;
    
    constructor(stateFile: StateFile) {  
        if (stateFile) {
            this.appName = stateFile.appConfig.applicationName;
            this.runId = stateFile.runId;
            this.attemptId = stateFile.attemptId;
            this.details = stateFile;  
            this.timelineRows = this.getTimelineRows(stateFile.actionsState).sort(compareFunc('started_at'));
            this.timelineRun =  this.getTimelineRun();
        } else {
            throw new Error("Error: no statefile found");
        }
    }

    /**
     * Iterate through the statefile's actionsState and create a TaskRow array.
     * @returns TaskRow[]
     */
    getTimelineRows(actionsState: ActionsState) {
        const rows : Row[] = [];
        const actionsStateEntries = Object.entries(actionsState);
        actionsStateEntries.forEach((entry) => {
            const actionName = entry[0];
            const action = entry[1];
            const row = new Row(this.details.appConfig.applicationName, action, actionName);
            rows.push(row)
        })
        return rows;
    }

    getTimelineRun() {
        const run : TimelineRun = {
            flow_id: this.details.appConfig.applicationName,
            run_number: this.details.runId,
            status: 'completed',
            user: 'undefined',
            user_name: 'undefined',
            ts_epoch: new Date(this.details.runStartTime).getTime() - 10, // start 10ms earlier
            finished_at: Math.max(...(this.timelineRows.flatMap(row => row.finished_at!).filter(x=>x))),
            system_tags: [],
        }
        return run;
    }  
}