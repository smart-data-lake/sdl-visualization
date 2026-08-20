import { Row, TaskStatus } from '../../types';
import { aggregateStatuses } from './row';

/**
 * The SDLB execution phases of an action, in the order they run. The names are the ones the
 * phase filter shows (see `phaseFilters` in StatusInfo).
 */
export const PHASES = ['Prepare', 'Init', 'Exec'] as const;

export type Phase = {
  name: (typeof PHASES)[number];
  /** Undefined when the state file recorded no such phase for this action. */
  startedAt?: Date;
  /**
   * Milliseconds. Bounded by the attempt's end anchor, so this is a lower bound rather than an
   * exact figure when `isOpenEnded` is set.
   */
  duration: number | null;
  /**
   * The phase started but recorded no end timestamp - either it is still running, or the attempt
   * ended without one being written. Either way the duration is "at least", not "exactly".
   */
  isOpenEnded: boolean;
  status: string;
};

/** A row's status, falling back to a start/finish inference when the state file has none. */
export function getRowStatus(row: Row): string {
  return row.status || (row.finished_at ? 'SUCCEEDED' : 'RUNNING');
}

/**
 * The phases of one action, in render order. This is the single place that maps a phase name onto
 * the state file's timestamp fields - both the bars and the timeline's zoom range read it, so
 * they cannot drift apart.
 */
export function phasesOf(row: Row): Phase[] {
  return [
    {
      name: 'Exec',
      startedAt: row.details.startTstmp,
      duration: row.getDuration(),
      isOpenEnded: !!row.details.startTstmp && !row.details.endTstmp,
      status: getRowStatus(row),
    },
    {
      name: 'Init',
      startedAt: row.details.startTstmpInit,
      duration: row.getDurationInit(),
      isOpenEnded: !!row.details.startTstmpInit && !row.details.endTstmpInit,
      status: row.details.endTstmpInit ? 'INITIALIZED' : 'INITIALIZING',
    },
    {
      name: 'Prepare',
      startedAt: row.details.startTstmpPrepare,
      duration: row.getDurationPrepare(),
      isOpenEnded: !!row.details.startTstmpPrepare && !row.details.endTstmpPrepare,
      status: row.details.endTstmpPrepare ? 'PREPARED' : 'PREPARING',
    },
  ];
}

/**
 * The time span actually covered by the given phases across all rows.
 *
 * The timeline zooms to this rather than to the run's overall span: with only Exec selected, the
 * run's prepare and init period holds no bars and would otherwise show as empty space at the
 * left - and with only Prepare selected, the whole execution period would be empty space at the
 * right. Returns `{start: 0, end: 0}` when the selection covers nothing.
 */
export function startAndEndPointsOfPhases(
  rows: Row[],
  displayPhases: readonly string[],
): { start: number; end: number } {
  let start = Infinity;
  let end = -Infinity;

  rows.forEach((row) =>
    phasesOf(row).forEach((phase) => {
      if (!phase.startedAt || !displayPhases.includes(phase.name)) return;
      const from = phase.startedAt.getTime();
      start = Math.min(start, from);
      // `duration` already runs up to now for an unfinished phase, matching how its bar is drawn.
      end = Math.max(end, from + (phase.duration ?? 0));
    }),
  );

  return { start: isFinite(start) ? start : 0, end: isFinite(end) ? end : 0 };
}

/**
 * The run's own starting point: the earliest timestamp of any phase, which is the first prepare
 * timestamp whenever the actions have one.
 *
 * Deliberately independent of the phase selection. The minimap's handle labels are measured from
 * here, so the time axis stays put when phases are toggled - otherwise "0.0s" would silently mean
 * "start of exec" with only Exec shown, and the axis would shift under the user.
 */
export function originOfRows(rows: Row[]): number {
  return startAndEndPointsOfPhases(rows, PHASES).start;
}

export type PhaseSegment = {
  phase: Phase['name'];
  start: number;
  end: number;
  status: TaskStatus;
};

/**
 * One span per displayed phase across a set of rows, carrying that phase's aggregated status.
 *
 * The minimap draws these instead of a single span per row group, so its colours line up with the
 * bars above it: the stretch under Prepare reads violet and the stretch under Init blue, because
 * those phases carry the PREPARED/INITIALIZED statuses, while the exec stretch keeps the action's
 * real outcome. Previously one span covered every displayed phase and took the actions' overall
 * status, painting the prepare and init stretches green on a successful run.
 */
export function phaseSegmentsOfRows(rows: Row[], displayPhases: readonly string[]): PhaseSegment[] {
  return PHASES.filter((name) => displayPhases.includes(name))
    .map((name) => {
      const phases = rows
        .map((row) => phasesOf(row).find((phase) => phase.name === name))
        .filter((phase): phase is Phase => !!phase && !!phase.startedAt);
      if (phases.length === 0) return undefined;

      const starts = phases.map((phase) => phase.startedAt!.getTime());
      return {
        phase: name,
        start: Math.min(...starts),
        end: Math.max(...phases.map((phase, i) => starts[i] + (phase.duration ?? 0))),
        status: aggregateStatuses(phases.map((phase) => phase.status)),
      };
    })
    .filter((segment): segment is PhaseSegment => !!segment);
}
