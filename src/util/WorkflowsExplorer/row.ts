import { Row, SortType, TaskStatus } from '../../types';

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



export const sortRows = (rows: any, sortType: SortType) => {
	if(sortType === 'start time asc') return rows.sort(startTimeAsc)
	if(sortType === 'start time desc') return rows.sort(startTimeDesc)
	if(sortType === 'duration asc') return rows.sort(durationAsc)
	if(sortType === 'duration desc') return rows.sort(durationDesc)
	return rows;
}

/**
     * Utility function for comparisons in the default "Array.sort()" function
     * @param a 
     * @param b 
     * @returns
     */
export function startTimeAsc(a: Row, b: Row) {
	if (a.started_at < b.started_at) {
		return -1;
	}
	if (a.started_at > b.started_at) {
		return 1;
	}
	return 0;
}
/**
     * Utility function for comparisons in the default "Array.sort()" function
     * @param a 
     * @param b 
     * @returns
     */
export function startTimeDesc(a: Row, b: Row) {
	if (a.started_at < b.started_at) {
		return 1;
	}
	if (a.started_at > b.started_at) {
		return -1;
	}
	return 0;
}

/**
     * Utility function for comparisons in the default "Array.sort()" function
     * @param a 
     * @param b 
     * @returns
     */
export function durationAsc(a: Row, b: Row) {
	if (a.duration < b.duration) {
		return -1;
	}
	if (a.duration > b.duration) {
		return 1;
	}
	return 0;
}
export function durationDesc(a: Row, b: Row) {
	if (a.duration < b.duration) {
		return 1;
	}
	if (a.duration > b.duration) {
		return -1;
	}
	return 0;
}
