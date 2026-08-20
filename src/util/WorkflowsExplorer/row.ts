import { Row, TaskStatus } from '../../types';

/**
 * Find smallest and biggest time value from rows
 */
export const startAndEndExecPointsOfRows = (rows: Row[]): { start: number; end: number } => {
  const start = Math.min(...(rows.map(row => row.details.startTstmp?.getTime()).filter(x => x)));
  const end =  Math.max(...(rows.map(row => row.details.endTstmp?.getTime() || row.finished_at.getTime())));
  return {
    start: (isFinite(start) ? start : 0),
    end: (isFinite(end) ? end : 0),
  };
};

export const startAndEndOverallPointsOfRows = (rows: Row[]): { start: number; end: number } => {
  const start = Math.min(...(rows.map(row => row.started_at?.getTime())));
  const end =  Math.max(...(rows.map(row => row.finished_at?.getTime())));
  return {
    start: (isFinite(start) ? start : 0),
    end: (isFinite(end) ? end : 0),
  };
};

/**
 * Get status for group of rows.
 */
export const aggregateTaskStatus = (rows: Row[]): TaskStatus => {
  const statuses = rows.map((row) => row.status || 'UNKNOWN');  
  if (statuses.indexOf('PREPARING') > -1) return 'PREPARING';
  if (statuses.indexOf('INITIALIZING') > -1) return 'INITIALIZING';
  if (statuses.indexOf('RUNNING') > -1) return 'RUNNING';
  if (statuses.indexOf('PREPARED') > -1) return 'PREPARED';
  if (statuses.indexOf('INITIALIZED') > -1) return 'INITIALIZED';
  if (statuses.indexOf('FAILED') > -1) return 'FAILED';
  if (statuses.indexOf('SUCCEEDED') > -1) return 'SUCCEEDED';
  if (statuses.indexOf('SKIPPED') > -1) return 'SKIPPED';
  return 'UNKNOWN';
};
