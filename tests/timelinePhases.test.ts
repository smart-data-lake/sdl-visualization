/**
 * The time range the timeline zooms to.
 *
 * The window follows the phases that are actually displayed, not the run's overall span: showing
 * only Exec used to leave the whole prepare/init period as empty space on the left, and showing
 * only Prepare left the entire execution period empty on the right.
 */
import { expect, test } from 'vitest';
import { startAndEndPointsOfPhases } from '../src/util/WorkflowsExplorer/phases.ts';

const t = (iso: string) => new Date(iso).getTime();

/** Minimal stand-in for a Row, carrying only what phasesOf() reads. */
const row = (phases: {
  prepare?: [string, string];
  init?: [string, string];
  exec?: [string, string | null];
}) => ({
  status: 'SUCCEEDED',
  finished_at: new Date(),
  details: {
    startTstmpPrepare: phases.prepare ? new Date(phases.prepare[0]) : undefined,
    endTstmpPrepare: phases.prepare ? new Date(phases.prepare[1]) : undefined,
    startTstmpInit: phases.init ? new Date(phases.init[0]) : undefined,
    endTstmpInit: phases.init ? new Date(phases.init[1]) : undefined,
    startTstmp: phases.exec ? new Date(phases.exec[0]) : undefined,
    endTstmp: phases.exec && phases.exec[1] ? new Date(phases.exec[1]) : undefined,
  },
  getDurationPrepare: () =>
    phases.prepare ? t(phases.prepare[1]) - t(phases.prepare[0]) : null,
  getDurationInit: () => (phases.init ? t(phases.init[1]) - t(phases.init[0]) : null),
  getDuration: () =>
    phases.exec ? (phases.exec[1] ? t(phases.exec[1]) : Date.now()) - t(phases.exec[0]) : null,
}) as any;

const ACTION = {
  prepare: ['2024-03-17T22:12:20.000Z', '2024-03-17T22:12:25.000Z'] as [string, string],
  init: ['2024-03-17T22:12:26.000Z', '2024-03-17T22:12:29.000Z'] as [string, string],
  exec: ['2024-03-17T22:12:30.000Z', '2024-03-17T22:12:40.000Z'] as [string, string],
};

test('with only Exec selected, the range covers just the exec phase', () => {
  const { start, end } = startAndEndPointsOfPhases([row(ACTION)], ['Exec']);
  expect(start).toBe(t(ACTION.exec[0]));
  expect(end).toBe(t(ACTION.exec[1]));
});

test('with only Prepare selected, the range covers just the prepare phase', () => {
  const { start, end } = startAndEndPointsOfPhases([row(ACTION)], ['Prepare']);
  expect(start).toBe(t(ACTION.prepare[0]));
  expect(end).toBe(t(ACTION.prepare[1]));
});

test('with every phase selected, the range spans prepare start to exec end', () => {
  const { start, end } = startAndEndPointsOfPhases([row(ACTION)], ['Prepare', 'Init', 'Exec']);
  expect(start).toBe(t(ACTION.prepare[0]));
  expect(end).toBe(t(ACTION.exec[1]));
});

test('non-adjacent selections still bound only the selected phases', () => {
  const { start, end } = startAndEndPointsOfPhases([row(ACTION)], ['Prepare', 'Exec']);
  expect(start).toBe(t(ACTION.prepare[0]));
  expect(end).toBe(t(ACTION.exec[1]));
});

test('spans the earliest start and latest end across all rows', () => {
  const early = row({ exec: ['2024-03-17T22:12:30.000Z', '2024-03-17T22:12:35.000Z'] });
  const late = row({ exec: ['2024-03-17T22:12:31.000Z', '2024-03-17T22:12:50.000Z'] });
  const { start, end } = startAndEndPointsOfPhases([late, early], ['Exec']);
  expect(start).toBe(t('2024-03-17T22:12:30.000Z'));
  expect(end).toBe(t('2024-03-17T22:12:50.000Z'));
});

test('rows lacking the selected phase are ignored', () => {
  const withInit = row(ACTION);
  const execOnly = row({ exec: ['2024-03-17T22:11:00.000Z', '2024-03-17T22:11:05.000Z'] });
  const { start, end } = startAndEndPointsOfPhases([withInit, execOnly], ['Init']);
  expect(start).toBe(t(ACTION.init[0]));
  expect(end).toBe(t(ACTION.init[1]));
});

test('an empty selection yields an empty range, so callers can skip re-fitting', () => {
  expect(startAndEndPointsOfPhases([row(ACTION)], [])).toEqual({ start: 0, end: 0 });
});

test('no rows yields an empty range', () => {
  expect(startAndEndPointsOfPhases([], ['Exec'])).toEqual({ start: 0, end: 0 });
});

test('a phase still running extends the range to now', () => {
  const running = row({ exec: ['2024-03-17T22:12:30.000Z', null] });
  const { end } = startAndEndPointsOfPhases([running], ['Exec']);
  // duration counts up to now, so the range reaches roughly the current time
  expect(end).toBeGreaterThan(t('2024-03-17T22:12:30.000Z'));
  expect(Math.abs(end - Date.now())).toBeLessThan(5000);
});
