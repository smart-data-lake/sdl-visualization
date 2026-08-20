import { Row, TaskStatus } from '../../types';

export const startAndEndOverallPointsOfRows = (rows: Row[]): { start: number; end: number } => {
  const start = Math.min(...(rows.map(row => row.started_at?.getTime())));
  const end =  Math.max(...(rows.map(row => row.finished_at?.getTime())));
  return {
    start: (isFinite(start) ? start : 0),
    end: (isFinite(end) ? end : 0),
  };
};

/**
 * Statuses in the order they win when several are combined: anything still in progress outranks
 * anything settled, and a failure outranks a success. CANCELLED and PENDING used to be missing,
 * so a group of only-cancelled actions aggregated to UNKNOWN and rendered grey.
 */
const STATUS_PRIORITY: TaskStatus[] = [
  'PREPARING',
  'INITIALIZING',
  'RUNNING',
  'PREPARED',
  'INITIALIZED',
  'FAILED',
  'CANCELLED',
  'SUCCEEDED',
  'SKIPPED',
  'PENDING',
];

/** Single status standing in for a set of them. */
export const aggregateStatuses = (statuses: string[]): TaskStatus => {
  const present = statuses.map((status) => (status || 'UNKNOWN').toUpperCase());
  return STATUS_PRIORITY.find((status) => present.includes(status)) ?? 'UNKNOWN';
};

/**
 * Get status for group of rows.
 */
export const aggregateTaskStatus = (rows: Row[]): TaskStatus =>
  aggregateStatuses(rows.map((row) => row.status));
