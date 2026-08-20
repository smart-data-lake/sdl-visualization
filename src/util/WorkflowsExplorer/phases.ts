import { Row } from '../../types';

/**
 * The SDLB execution phases of an action, in the order they run. The names are the ones the
 * phase filter shows (see `phaseFilters` in StatusInfo).
 */
export const PHASES = ['Prepare', 'Init', 'Exec'] as const;

export type Phase = {
  name: (typeof PHASES)[number];
  /** Undefined when the state file recorded no such phase for this action. */
  startedAt?: Date;
  /** Milliseconds; for a phase still in flight this counts up to now. */
  duration: number | null;
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
      status: getRowStatus(row),
    },
    {
      name: 'Init',
      startedAt: row.details.startTstmpInit,
      duration: row.getDurationInit(),
      status: row.details.endTstmpInit ? 'INITIALIZED' : 'INITIALIZING',
    },
    {
      name: 'Prepare',
      startedAt: row.details.startTstmpPrepare,
      duration: row.getDurationPrepare(),
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
export function startAndEndPointsOfPhases(rows: Row[], displayPhases: string[]): { start: number; end: number } {
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
