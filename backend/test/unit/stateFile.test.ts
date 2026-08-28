import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import {
  aggregateRunStatus,
  deriveRunEndTime,
  durationMillis,
  endAnchorOf,
  normalizeStateFile,
  runElementFacts,
  toWorkflowRun,
  writtenDataObjects,
} from '../../src/domain/stateFile.js';
import { FIXTURES } from '../../scripts/seed-fixtures.js';

/**
 * Turning a state file into the index record the SPA expects.
 *
 * The behaviour here is a port of build_index.py's getRuns(), which is the existing
 * working specification of that record, plus the normalisation Attempt.ts applies in
 * the browser - moved to ingest, so no old state-file shape ever reaches the wire.
 */

const failedAttempt = JSON.parse(
  await readFile(path.join(FIXTURES, 'shared/state/succeeded/getting-started.24.1.json'), 'utf8'),
);

describe('ISO-8601 durations', () => {
  test.each([
    ['PT3.6266377S', 3626],
    ['PT0S', 0],
    ['PT1M30S', 90_000],
    ['PT2H', 7_200_000],
    ['P1DT1S', 86_401_000],
  ])('%s is %d ms', (duration, expected) => {
    expect(durationMillis(duration)).toBe(expected);
  });

  test('an absent or unparseable duration is zero rather than NaN', () => {
    expect(durationMillis(undefined)).toBe(0);
    expect(durationMillis('nonsense')).toBe(0);
  });
});

describe('status aggregation', () => {
  const of = (...states: string[]) =>
    aggregateRunStatus(states.map((state) => ({ state }) as never));

  test('a failure outranks the successes around it', () => {
    expect(of('SUCCEEDED', 'FAILED', 'SUCCEEDED')).toBe('FAILED');
  });

  test('the fixture attempt aggregates the way build_index.py recorded it', () => {
    expect(aggregateRunStatus(Object.values(failedAttempt.actionsState))).toBe('FAILED');
  });

  test('an unknown state does not swallow the run', () => {
    expect(of('WAT')).toBe('UNKNOWN');
    expect(of('WAT', 'FAILED')).toBe('FAILED');
  });

  test('an empty run is UNKNOWN rather than a crash', () => {
    expect(aggregateRunStatus([])).toBe('UNKNOWN');
  });
});

describe('normalising older state files', () => {
  test('results[].subFeed is flattened and mainMetrics renamed', () => {
    const state = normalizeStateFile({
      actionsState: {
        a: {
          state: 'SUCCEEDED',
          results: [
            {
              subFeed: { dataObjectId: 'x', partitionValues: [{ elements: { dt: '2024' } }] },
              mainMetrics: { count: 7 },
            },
          ],
        },
      },
    } as never);

    const result = state.actionsState.a.results[0] as any;
    expect(result.subFeed).toBeUndefined();
    expect(result.dataObjectId).toBe('x');
    expect(result.metrics).toEqual({ count: 7 });
    expect(result.mainMetrics).toBeUndefined();
    expect(result.partitionValues).toEqual([{ dt: '2024' }]);
  });

  test('inputIds and outputIds given as objects become plain ids', () => {
    const state = normalizeStateFile({
      actionsState: {
        a: { state: 'SUCCEEDED', inputIds: [{ id: 'in' }], outputIds: [{ id: 'out' }], results: [] },
      },
    } as never);
    expect(state.actionsState.a.inputIds).toEqual(['in']);
    expect(state.actionsState.a.outputIds).toEqual(['out']);
  });

  test('a current state file is left alone', () => {
    const before = structuredClone(failedAttempt);
    expect(normalizeStateFile(structuredClone(failedAttempt))).toEqual(before);
  });
});

describe('what an action wrote', () => {
  test('outputIds wins when it is there', () => {
    expect(writtenDataObjects({ outputIds: ['a'], results: [{ dataObjectId: 'b' }] } as never)).toEqual(['a']);
  });

  test('older state files without outputIds fall back to the results', () => {
    // The same fallback build_index.py applies.
    expect(writtenDataObjects({ results: [{ dataObjectId: 'b' }] } as never)).toEqual(['b']);
  });
});

describe('when an attempt ended', () => {
  test('the latest recorded end wins', () => {
    const end = deriveRunEndTime({
      attemptStartTime: '2024-01-01T00:00:00.000Z',
      actionsState: {
        a: { endTstmp: '2024-01-01T00:00:05.000Z' },
        b: { endTstmp: '2024-01-01T00:00:09.000Z' },
      },
    } as never);
    expect(end).toBe('2024-01-01T00:00:09.000Z');
  });

  test('an action with no end is measured as start plus duration', () => {
    const end = deriveRunEndTime({
      attemptStartTime: '2024-01-01T00:00:00.000Z',
      actionsState: { a: { startTstmp: '2024-01-01T00:00:01.000Z', duration: 'PT4S' } },
    } as never);
    expect(end).toBe('2024-01-01T00:00:05.000Z');
  });

  test('an attempt whose actions recorded nothing ends when it started, not at the epoch', () => {
    const end = deriveRunEndTime({
      attemptStartTime: '2024-01-01T00:00:00.000Z',
      actionsState: { a: {} },
    } as never);
    expect(end).toBe('2024-01-01T00:00:00.000Z');
  });
});

describe('the end anchor keeps a finished run from looking eternal', () => {
  test('a live attempt has no anchor, so its phases keep counting up', () => {
    expect(
      endAnchorOf({ isFinal: false, actionsState: { a: { state: 'RUNNING' } } } as never),
    ).toBeUndefined();
  });

  test('an attempt with a running action is treated as live even without isFinal', () => {
    expect(endAnchorOf({ actionsState: { a: { state: 'INITIALIZING' } } } as never)).toBeUndefined();
  });

  test('a finalised attempt is anchored to the last timestamp it has evidence for', () => {
    const anchor = endAnchorOf({
      isFinal: true,
      actionsState: {
        a: { state: 'SUCCEEDED', endTstmp: '2024-01-01T00:00:05.000Z' },
        b: { state: 'CANCELLED', startTstmp: '2024-01-01T00:00:03.000Z' },
      },
    } as never);
    expect(anchor).toBe(Date.parse('2024-01-01T00:00:05.000Z'));
  });
});

describe('the index record', () => {
  const run = toWorkflowRun(failedAttempt);

  test('it carries the identity and status of the attempt', () => {
    expect(run.name).toBe('getting-started');
    expect(run.runId).toBe(24);
    expect(run.attemptId).toBe(1);
    expect(run.status).toBe('FAILED');
  });

  test('it precomputes what the local backend derives client-side', () => {
    expect(run.actionsStatus).toEqual({ SUCCEEDED: 2, FAILED: 1, CANCELLED: 2 });
    expect(run.dataObjects).toHaveLength(5);
    expect(run.attemptStartTimeMillis).toBe(Date.parse(run.attemptStartTime!));
    expect(run.duration).toBeGreaterThan(0);
  });

  test('each action reports the data objects it wrote', () => {
    expect(run.actions!['historize-airports'].dataObjects).toEqual(['int-airports']);
    expect(run.actions!['historize-airports'].state).toBe('SUCCEEDED');
  });

  test('timestamps stay ISO strings; the SPA parses them itself', () => {
    expect(typeof run.attemptStartTime).toBe('string');
    expect(typeof run.runEndTime).toBe('string');
  });
});

describe('per-action facts for the element index', () => {
  const facts = runElementFacts(failedAttempt);

  test('there is one entry per action', () => {
    expect(facts).toHaveLength(Object.keys(failedAttempt.actionsState).length);
  });

  test('the failing action carries its message and its inputs', () => {
    const failed = facts.find((f) => f.state === 'FAILED')!;
    expect(failed.actionId).toBe('download-deduplicate-departures');
    expect(failed.msg).toBeTruthy();
    expect(failed.inputIds.length + failed.outputIds.length).toBeGreaterThan(0);
  });
});
