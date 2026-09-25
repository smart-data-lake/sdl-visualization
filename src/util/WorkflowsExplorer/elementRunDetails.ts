import { Action, StateFile } from '../../types';
import { FlowMetric, getOutputMetric } from './metrics';
import { formatPartitionValues, selectedPartitionValues } from './partitionValues';

/**
 * What one action of one run did with one element, for the "Last 5 runs" panel of the config explorer (issue #133).
 * The run table shows the same per action (metrics.ts, partitionValues.ts); here it is per element.
 */
export interface ElementRunDetails {
    /** actions: what the execution mode selected; data objects: the partition values written */
    partitionValues?: string;
    /** actions only: the state an incremental execution mode kept, per input */
    incrementalState?: string;
    /** data objects only: what was written to it */
    outputMetric?: FlowMetric;
    /** data objects only: the action that wrote it */
    actionId?: string;
}

/** The incremental execution mode's state of an action, one `<dataObjectId>: <state>` per input. */
export function formatDataObjectsState(action: Action | undefined): string | undefined {
    const entries = (action?.dataObjectsState || []).filter(entry => entry?.state !== undefined && entry.state !== '');
    if (entries.length === 0) return undefined;
    return entries.map(entry => `${entry.dataObjectId}: ${entry.state}`).join(', ');
}

export function actionRunDetails(stateFile: StateFile | undefined, actionId: string): ElementRunDetails | undefined {
    const action = stateFile?.actionsState?.[actionId];
    if (!action) return undefined;
    return { partitionValues: selectedPartitionValues(action), incrementalState: formatDataObjectsState(action) };
}

/** One entry per action that wrote the data object; none if the run only read it. */
export function dataObjectRunDetails(stateFile: StateFile | undefined, dataObjectId: string): ElementRunDetails[] {
    return Object.entries(stateFile?.actionsState || {})
        .filter(([, action]) => (action.results || []).some(result => result.dataObjectId === dataObjectId))
        .map(([actionId, action]) => ({
            actionId,
            partitionValues: formatPartitionValues(action.results
                .filter(result => result.dataObjectId === dataObjectId)
                .flatMap(result => result.partitionValues || [])) || undefined,
            outputMetric: getOutputMetric(action, dataObjectId),
        }));
}

/** One entry per action of the run that touched the element, i.e. at most one for an action. */
export function elementRunDetails(stateFile: StateFile | undefined, elementType: string, elementName: string): ElementRunDetails[] {
    if (elementType === 'actions') {
        const details = actionRunDetails(stateFile, elementName);
        return details ? [details] : [];
    }
    if (elementType === 'dataObjects') return dataObjectRunDetails(stateFile, elementName);
    return [];
}
