/**
 * Tests the partition values shown in the two run tables: how one value and a list of them are
 * spelled, the state file formats they arrive in, and what counts as "no partition values".
 */
import { expect, test } from 'vitest';
import { Action, Row } from '../src/types.ts';
import { formatPartitionValue, formatPartitionValues, MAX_PARTITION_VALUES, selectedPartitionValues } from '../src/util/WorkflowsExplorer/partitionValues.ts';

function action(results: {dataObjectId: string, partitionValues: any[]}[]): Action {
    return {
        executionId: {type: 'SDLExecutionId', runId: 1, attemptId: 1},
        state: 'SUCCEEDED', duration: 'PT1S', msg: '',
        startTstmp: new Date(0),
        results: results.map(result => ({type: 'SparkSubFeed', ...result})),
    };
}

test('a partition value is spelled the way SDLB names it', () => {
    expect(formatPartitionValue({dt: '2024-01-01'})).toBe('dt=2024-01-01');
    expect(formatPartitionValue({dt: '2024-01-01', region: 'CH'})).toBe('dt=2024-01-01/region=CH');
});

test('the older wrapped form and a bare value are understood too', () => {
    expect(formatPartitionValue({elements: {dt: '2024-01-01'}})).toBe('dt=2024-01-01');
    expect(formatPartitionValue('animal')).toBe('animal');
    expect(formatPartitionValue(undefined)).toBe('');
});

test('the values of a cell are distinct, and a long list says how many it left out', () => {
    expect(formatPartitionValues([{dt: 'a'}, {dt: 'a'}, {dt: 'b'}])).toBe('dt=a, dt=b');
    const many = [...Array(MAX_PARTITION_VALUES + 3).keys()].map(i => ({dt: `${i}`}));
    expect(formatPartitionValues(many)).toBe('dt=0, dt=1, dt=2, dt=3, dt=4, dt=5, dt=6, dt=7, dt=8, dt=9, … (+3 more)');
});

test('an action reports the values of all its results, once', () => {
    expect(selectedPartitionValues(action([
        {dataObjectId: 'a', partitionValues: [{dt: '2024-01-01'}]},
        {dataObjectId: 'b', partitionValues: [{dt: '2024-01-01'}, {dt: '2024-01-02'}]},
    ]))).toBe('dt=2024-01-01, dt=2024-01-02');
});

test('an action that selected nothing has no value at all, so the cell stays empty', () => {
    expect(selectedPartitionValues(action([{dataObjectId: 'a', partitionValues: []}]))).toBeUndefined();
    // a non empty list of empty maps is still nothing selected
    expect(selectedPartitionValues(action([{dataObjectId: 'a', partitionValues: [{}]}]))).toBeUndefined();
    expect(formatPartitionValues(undefined)).toBe('');
});

test('the row of the action table carries the value ready to sort on', () => {
    const withValues = new Row('app', action([{dataObjectId: 'a', partitionValues: [{dt: '2024-01-01'}]}]), 'load');
    expect(withValues.selectedPartitionValues).toBe('dt=2024-01-01');
    const without = new Row('app', action([{dataObjectId: 'a', partitionValues: []}]), 'load');
    expect(without.selectedPartitionValues).toBeUndefined();
});
