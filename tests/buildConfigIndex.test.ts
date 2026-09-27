/**
 * Tests the state index record of scripts/buildConfigIndex.ts, against the fixture index that the
 * former build_index.py wrote from the same state files, and for the older state file format.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import { indexRecord } from '../scripts/buildConfigIndex.ts';

const STATE = 'tests/e2e/fixtures/shared/state';

test('the records match the fixture index build_index.py wrote', () => {
    const expected = readFileSync(path.join(STATE, 'index.json'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
    const files = readdirSync(path.join(STATE, 'succeeded')).map(name => `succeeded/${name}`);
    const records = files.map(file => indexRecord(JSON.parse(readFileSync(path.join(STATE, file), 'utf8')), file));
    for (const run of expected) {
        const record = records.find(r => r.runId === run.runId && r.attemptId === run.attemptId)!;
        // python kept microseconds, a Date keeps milliseconds
        expect(Date.parse(record.runEndTime as string)).toBe(Date.parse(run.runEndTime));
        expect({ ...record, runEndTime: undefined }).toEqual({ ...run, runEndTime: undefined });
    }
});

test('an older state file is read through subFeed, and the first action in the DAG selects', () => {
    const action = (state: string, inputIds: any[], dataObjectId: string, dt?: string) => ({
        state, inputIds, endTstmp: '2024-01-01T10:00:00',
        results: [{ subFeed: { dataObjectId, partitionValues: dt ? [{ elements: { dt } }] : [] } }],
    });
    const record = indexRecord({
        appConfig: { applicationName: 'app', feedSel: '.*' }, runId: 1, attemptId: 1,
        runStartTime: '2024-01-01T09:00:00', attemptStartTime: '2024-01-01T09:00:00',
        actionsState: {
            a: action('SUCCEEDED', [{ id: 'b-out' }], 'a-out', '2'),
            b: action('FAILED', [], 'b-out', '1'),
        },
    }, 'run.json');
    expect(record.status).toBe('FAILED');
    expect(record.actions).toEqual({ a: { state: 'SUCCEEDED', dataObjects: ['a-out'] }, b: { state: 'FAILED', dataObjects: ['b-out'] } });
    expect(record.selectedPartitionValues).toBe('dt=1');
    // zoneless in, zoneless out
    expect(record.runEndTime).toBe('2024-01-01T10:00:00.000');
});
