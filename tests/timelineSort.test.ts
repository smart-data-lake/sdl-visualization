/**
 * Timeline row ordering.
 *
 * Rows are ordered by execution start, then init start, then prepare start (Attempt.ts), so that
 * actions whose exec phase begins in the same millisecond still land in a stable, meaningful
 * order. Two things used to stop that from working:
 *   1. compareMultiFunc detected ties with `===`, which is reference equality for Date objects,
 *      so a tie was never seen and the later attributes were never consulted.
 *   2. Attempt.ts named the third key 'details.startTstmpPrep'; the field is 'startTstmpPrepare',
 *      so it always read undefined.
 */
import { expect, test } from 'vitest';
import { compareMultiFunc } from '../src/util/helpers.ts';

const KEYS = ['details.startTstmp', 'details.startTstmpInit', 'details.startTstmpPrepare'];

/** Minimal stand-in for a Row, carrying only what the comparator reads. */
const row = (name: string, exec: string, init?: string, prepare?: string) => ({
  step_name: name,
  details: {
    startTstmp: new Date(exec),
    startTstmpInit: init ? new Date(init) : undefined,
    startTstmpPrepare: prepare ? new Date(prepare) : undefined,
  },
});

const order = (rows: any[]) => rows.sort(compareMultiFunc(KEYS)).map((r) => r.step_name);

test('orders rows by execution start time', () => {
  const rows = [
    row('third', '2024-03-17T22:12:30.300Z'),
    row('first', '2024-03-17T22:12:30.100Z'),
    row('second', '2024-03-17T22:12:30.200Z'),
  ];
  expect(order(rows)).toEqual(['first', 'second', 'third']);
});

test('breaks an identical exec start with the init start time', () => {
  // All three actions begin executing in the same millisecond - the realistic case, since SDLB
  // starts every ready action of a stage together.
  const sameExec = '2024-03-17T22:12:30.000Z';
  const rows = [
    row('c', sameExec, '2024-03-17T22:12:29.900Z'),
    row('a', sameExec, '2024-03-17T22:12:29.700Z'),
    row('b', sameExec, '2024-03-17T22:12:29.800Z'),
  ];
  expect(order(rows)).toEqual(['a', 'b', 'c']);
});

test('falls through to the prepare start time when exec and init both tie', () => {
  const sameExec = '2024-03-17T22:12:30.000Z';
  const sameInit = '2024-03-17T22:12:29.000Z';
  const rows = [
    row('b', sameExec, sameInit, '2024-03-17T22:12:28.500Z'),
    row('c', sameExec, sameInit, '2024-03-17T22:12:28.900Z'),
    row('a', sameExec, sameInit, '2024-03-17T22:12:28.100Z'),
  ];
  expect(order(rows)).toEqual(['a', 'b', 'c']);
});

test('rows with a missing tie-break timestamp sort last', () => {
  const sameExec = '2024-03-17T22:12:30.000Z';
  const rows = [
    row('missing-init', sameExec),
    row('has-init', sameExec, '2024-03-17T22:12:29.000Z'),
  ];
  expect(order(rows)).toEqual(['has-init', 'missing-init']);
});

test('equal on every key compares as equal, leaving the original order', () => {
  const a = row('a', '2024-03-17T22:12:30.000Z', '2024-03-17T22:12:29.000Z', '2024-03-17T22:12:28.000Z');
  const b = row('b', '2024-03-17T22:12:30.000Z', '2024-03-17T22:12:29.000Z', '2024-03-17T22:12:28.000Z');
  expect(compareMultiFunc(KEYS)(a, b)).toBe(0);
});

test('still compares plain numbers, as the run list relies on', () => {
  const runs = [
    { runId: 2, attemptId: 1 },
    { runId: 1, attemptId: 2 },
    { runId: 1, attemptId: 1 },
  ];
  expect(runs.sort(compareMultiFunc(['runId', 'attemptId']))).toEqual([
    { runId: 1, attemptId: 1 },
    { runId: 1, attemptId: 2 },
    { runId: 2, attemptId: 1 },
  ]);
});
