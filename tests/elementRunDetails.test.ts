/**
 * The per element details of the config explorer's "Last 5 runs" panel (issue #133): what an
 * action's execution mode selected and kept, what was written to a data object.
 */
import { expect, test } from 'vitest';
import { Action, StateFile } from '../src/types.ts';
import { elementRunDetails, formatDataObjectsState } from '../src/util/WorkflowsExplorer/elementRunDetails.ts';

function action(results: any[], extra: Partial<Action> = {}): Action {
    return {
        executionId: {type: 'SDLExecutionId', runId: 1, attemptId: 1},
        state: 'SUCCEEDED', duration: 'PT1S', msg: '',
        startTstmp: new Date(0),
        results: results.map(result => ({type: 'SparkSubFeed', partitionValues: [], ...result})),
        ...extra,
    };
}

function stateFile(actionsState: Record<string, Action>): StateFile {
    return {actionsState} as unknown as StateFile;
}

const run = stateFile({
    'historize-airports': action(
        [{dataObjectId: 'int-airports', partitionValues: [{dt: '2024-01-01'}], metrics: {count: 42, 'count#stg-airports': 40, rows_inserted: 2}}],
        {dataObjectsState: [{dataObjectId: 'stg-airports', state: '{"updated_at":"2024-01-01"}'}]}),
    'download-airports': action([{dataObjectId: 'stg-airports', metrics: {files_written: 1}}]),
});

test('an action shows what its execution mode selected and the incremental state it kept', () => {
    expect(elementRunDetails(run, 'actions', 'historize-airports')).toEqual([{
        partitionValues: 'dt=2024-01-01',
        incrementalState: 'stg-airports: {"updated_at":"2024-01-01"}',
    }]);
    expect(elementRunDetails(run, 'actions', 'download-airports')).toEqual([{partitionValues: undefined, incrementalState: undefined}]);
});

test('a data object shows the partition values and the output metric of the action writing it', () => {
    const [details, ...others] = elementRunDetails(run, 'dataObjects', 'int-airports');
    expect(others).toEqual([]);
    expect(details?.partitionValues).toBe('dt=2024-01-01');
    expect(details?.outputMetric?.value).toBe(42);
    expect(details?.actionId).toBe('historize-airports');
    // the qualified metric belongs to the input, not to this output
    expect(details?.outputMetric?.all.map(m => m.name)).toEqual(['count', 'rows_inserted']);
});

test('a data object written by several actions of one run has one entry per action, each with its own metric', () => {
    const shared = stateFile({
        'load-ch': action([{dataObjectId: 'int-sales', partitionValues: [{country: 'CH'}], metrics: {count: 10}}]),
        'load-de': action([{dataObjectId: 'int-sales', partitionValues: [{country: 'DE'}], metrics: {records_written: 20}}]),
    });
    expect(elementRunDetails(shared, 'dataObjects', 'int-sales').map(d => [d.actionId, d.partitionValues, d.outputMetric?.value]))
        .toEqual([['load-ch', 'country=CH', 10], ['load-de', 'country=DE', 20]]);
});

test('a run that did not touch the element, or only read it, has no details', () => {
    expect(elementRunDetails(run, 'actions', 'other')).toEqual([]);
    expect(elementRunDetails(run, 'dataObjects', 'ext-airports')).toEqual([]);
    expect(elementRunDetails(undefined, 'dataObjects', 'int-airports')).toEqual([]);
});

test('an empty incremental state is no state', () => {
    expect(formatDataObjectsState(action([], {dataObjectsState: []}))).toBeUndefined();
    expect(formatDataObjectsState(action([], {dataObjectsState: [{dataObjectId: 'a', state: ''}]}))).toBeUndefined();
});
