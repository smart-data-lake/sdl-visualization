/**
 * Where a phase with no end timestamp is taken to stop.
 *
 * An action cancelled when a sibling fails records a start but never an end. Measuring it up to
 * "now" makes a long-finished run look like it is still going: on the getting-started fixture the
 * exec axis spanned 21262 hours instead of 181 seconds. A finalised attempt is therefore bounded
 * by the last timestamp it has evidence for, while a live one still counts up to now.
 */
import { expect, test } from 'vitest';
import { endAnchorOf } from '../src/util/WorkflowsExplorer/Attempt.ts';
import { Row } from '../src/types.ts';

const d = (iso: string) => new Date(iso);
const T = {
  prepStart: '2024-03-17T22:12:21.000Z',
  prepEnd: '2024-03-17T22:12:22.000Z',
  initStart: '2024-03-17T22:12:23.000Z',
  initEnd: '2024-03-17T22:12:24.000Z',
  execStart: '2024-03-17T22:12:25.000Z',
  execEnd: '2024-03-17T22:12:30.000Z',
};

const action = (state: string, over: Record<string, unknown> = {}) => ({
  executionId: { type: 'SDLB', runId: 24, attemptId: 1 },
  state,
  duration: 'PT5S',
  msg: '',
  results: [],
  startTstmpPrepare: d(T.prepStart),
  endTstmpPrepare: d(T.prepEnd),
  startTstmpInit: d(T.initStart),
  endTstmpInit: d(T.initEnd),
  startTstmp: d(T.execStart),
  endTstmp: d(T.execEnd),
  ...over,
}) as any;

const stateFile = (actionsState: Record<string, unknown>, over: Record<string, unknown> = {}) => ({
  appConfig: { applicationName: 'app' },
  runId: 24,
  attemptId: 1,
  actionsState,
  ...over,
}) as any;

test('a finalised attempt is anchored at its last known timestamp', () => {
  const sf = stateFile({ done: action('SUCCEEDED'), cancelled: action('CANCELLED', { endTstmp: undefined }) },
    { isFinal: true });
  expect(endAnchorOf(sf)).toBe(d(T.execEnd).getTime());
});

test('an explicit runEndTime wins over the derived timestamp', () => {
  const runEnd = d('2024-03-17T22:13:00.000Z');
  const sf = stateFile({ a: action('SUCCEEDED') }, { isFinal: true, runEndTime: runEnd });
  expect(endAnchorOf(sf)).toBe(runEnd.getTime());
});

test('a live attempt has no anchor, so unfinished phases keep counting up to now', () => {
  const sf = stateFile({ a: action('RUNNING', { endTstmp: undefined }) }, { isFinal: false });
  expect(endAnchorOf(sf)).toBeUndefined();
});

test('without isFinal, liveness falls back to a status still ending in ING', () => {
  const running = stateFile({ a: action('RUNNING', { endTstmp: undefined }) });
  expect(endAnchorOf(running)).toBeUndefined();
  const settled = stateFile({ a: action('CANCELLED', { endTstmp: undefined }) });
  expect(endAnchorOf(settled)).toBe(d(T.initEnd).getTime() > d(T.execStart).getTime()
    ? d(T.initEnd).getTime()
    : d(T.execStart).getTime());
});

test('a cancelled phase is measured to the anchor, not to today', () => {
  const anchor = d(T.execEnd).getTime();
  const cancelled = new Row('app', action('CANCELLED', { endTstmp: undefined }), 'cancelled', anchor);
  // exec ran from 22:12:25 to the anchor at 22:12:30
  expect(cancelled.getDuration()).toBe(5000);
  // and without an anchor it would instead run up to now - years for a 2024 state file
  const unbounded = new Row('app', action('CANCELLED', { endTstmp: undefined }), 'cancelled');
  expect(unbounded.getDuration()!).toBeGreaterThan(5000 * 1000);
});

test('the anchor does not affect a phase that recorded its own end', () => {
  const anchor = d('2024-03-18T00:00:00.000Z').getTime();
  const row = new Row('app', action('SUCCEEDED'), 'done', anchor);
  expect(row.getDuration()).toBe(5000);
  expect(row.getDurationInit()).toBe(1000);
  expect(row.getDurationPrepare()).toBe(1000);
});

test('finished_at falls back to the anchor rather than to now', () => {
  const anchor = d(T.execEnd).getTime();
  const row = new Row('app', action('CANCELLED', { endTstmp: undefined }), 'cancelled', anchor);
  expect(row.finished_at.getTime()).toBe(anchor);
});
