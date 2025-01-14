import { Row, SortType, TaskStatus } from '../../types';

const takeSmallest = (a: Row): number | null =>
  a.started_at || Number.MAX_VALUE;

const takeBiggest = (a: Row): number =>
  a.finished_at || 0;

/**
 * Sort rows by smallest value
 */
const sortSmallest = (a: Row, b: Row) => {
  const aval = takeSmallest(a);
  const bval = takeSmallest(b);

  if (aval === bval) {
    return 0;
  }
  if (!aval) {
    return -1;
  } else if (!bval) {
    return 1;
  }
  return aval - bval;
};

/**
 * Find smallest and biggest time value from rows
 */
export const startAndEndExecPointsOfRows = (rows: Row[]): { start: number; end: number } => {
  const start = Math.min(...(rows.map(row => row.startTstmp!).filter(x => x)));
  const end =  Math.max(...(rows.map(row => row.endTstmp!).filter(x => x)));
  return {
    start: (isFinite(start) ? start : 0),
    end: (isFinite(end) ? end : 0),
  };
};

export const startAndEndOverallPointsOfRows = (rows: Row[]): { start: number; end: number } => {
  const start = Math.min(...(rows.map(row => row.startTstmpPrepare || row.startTstmpInit || row.startTstmp!).filter(x => x)));
  const end =  Math.max(...(rows.map(row => row.endTstmp || row.startTstmp || row.endTstmpInit || row.startTstmpInit || row.endTstmpPrepare || row.startTstmpPrepare!).filter(x => x)));
  return {
    start: (isFinite(start) ? start : 0),
    end: (isFinite(end) ? end : 0),
  };
};

/**
 * Find longest duration from rows
 */
export const getLongestRowDuration = (rows: Row[]): number => {
  return rows.reduce((val, item) => {
      const t : Row = item;
      return t.duration && t.duration > val ? t.duration : val;
  }, 0);
};

/**
 * Get status for group of rows.
 */
export const getTaskLineStatus = (rows: Row[]): TaskStatus => {
  const statuses = rows.map((row) => {
    return row.status || 'UNKNOWN';
  });
  if (statuses.indexOf('RUNNING') > -1) return 'RUNNING';
  if (statuses.indexOf('FAILED') > -1) return 'FAILED';
  if (statuses.indexOf('SKIPPED') > -1) return 'SKIPPED';
  if (statuses.indexOf('PREPARED') > -1) return 'PREPARED';
  if (statuses.indexOf('INITIALIZED') > -1) return 'INITIALIZED';
  return 'SUCCEEDED';
};

/**
 * Get current step name	
 */
export const getCurrentStepName = (rows: Row[]): string =>
  rows.find((row) => row.status === 'RUNNING')?.step_name || '';


export const sortRows = (rows: any, sortType: SortType) => {
	if(sortType === 'start time asc') return rows.sort(startTimeAsc)
	if(sortType === 'start time desc') return rows.sort(startTimeDesc)
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
