import { ActionsState, Row, StateFile, Run as TimelineRun } from "../../types";
import { compareFunc } from "../helpers";
import { Filter } from "./StatusInfo";

/**
 * Update old state files to current format
 */
export function updateStateFile(data: any): StateFile {
    if (data.actionsState) {
        Object.entries(data.actionsState).forEach((entry) => {
            const name = entry[0];
            var action: any = entry[1];
            // move attributes from actionsState.<action>.results[].subFeed one level up
            // rename actionsState.<action>.results[].mainMetrics -> metrics
            // remove elements in actionsState.<action>.results[].partitionValues
            if (action.results && action.results.length > 0 && action.results[0].subFeed) {
                const results = action.results.map(result => {
                    const resultNew = {...result, ...result.subFeed}
                    delete resultNew['subFeed'];
                    resultNew['metrics'] = resultNew['mainMetrics'];
                    delete resultNew['mainMetrics']
                    resultNew['partitionValues'] = resultNew['partitionValues'].map( e => e.elements || e );
                    return resultNew;
                })
                action.results = results;
            }        
            // remove id in actionsState[].inputIds & outputIds
            if (action.inputIds && action.inputIds.length > 0 && action.inputIds[0].id) {
                action.inputIds = action.inputIds.map( e => e.id || e );
            }
            if (action.outputIds && action.outputIds.length > 0 && action.outputIds[0].id) {
                action.outputIds = action.outputIds.map( e => e.id || e );
            }
            // overwrite entry
            data.actionsState[name] = action;
        })
    }
    return data;
}

export default class Attempt {
    appName: string;
    runId: number;
    attemptId: number;
    details: StateFile; // Contains all general information
    timelineRows: Row[];
    
    constructor(stateFile: StateFile) {  
        if (stateFile) {
            this.appName = stateFile.appConfig.applicationName;
            this.runId = stateFile.runId;
            this.attemptId = stateFile.attemptId;
            this.details = stateFile;  
            this.timelineRows = this.getTimelineRows(stateFile.actionsState).sort(compareFunc('started_at'));
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

    getTimelineRun(filters: Filter[]): TimelineRun {
        const activeTimelineRows = (filters.length>0 ? this.timelineRows.filter(row => filters.some(f => f.predicate(row))) : this.timelineRows);
        return {
            flow_id: this.details.appConfig.applicationName,
            run_number: this.details.runId,
            status: 'completed',
            user: 'undefined',
            user_name: 'undefined',
            ts_epoch:  Math.min(...(activeTimelineRows.flatMap(row => row.started_at!).filter(x=>x))) - 10, // start 10ms earlier
            finished_at: Math.max(...(activeTimelineRows.flatMap(row => row.finished_at!).filter(x=>x))),
            system_tags: [],
        }
    }  
}