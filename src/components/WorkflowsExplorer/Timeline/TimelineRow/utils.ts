import { lighten } from 'polished';
import { DefaultTheme } from 'styled-components';
import { Step, Row } from '../../../../types';
import { StepRowData } from '../useTaskData';
import { LabelPosition } from './LineElement';
import defaultTheme from '../../../../theme';

/**
 * Finds place for duration label in timeline. Default right, if not space left, if no space then none.
 * @param fromLeft % value from left of timeline
 * @param width Width of given element
 * @returns Position where label should be positioned
 */
export function getLengthLabelPosition(fromLeft: number | undefined, width: number | undefined): LabelPosition {
  if (!(fromLeft && width)) return 'none';
  if (fromLeft + width < 90) {
    return 'right';
  } else if (fromLeft + width > 90 && fromLeft > 10) {
    return 'left';
  }

  return 'none';
}

export function getStepDuration(step: Step, status: string, calculatedDuration: number): number {
  if (status === 'running') {
    return Date.now() - step.ts_epoch;
  }

  return step.duration && step.duration > calculatedDuration ? step.duration : calculatedDuration;
}

export function getRowStatus(
  row: { type: 'step'; data: Step; rowObject: StepRowData } | { type: 'task'; data: Row },
): string {
  if (row.type === 'step') {
    return row.rowObject.status;
  } else {
    if (row.data.status) {
      return row.data.status;
    } else {
      return row.data.finished_at ? 'SUCCEEDED' : 'RUNNING';
    }
  }
}

export function getPhasesColor(phase: string): string {
  switch (phase) {
    case 'Prepare':
      return defaultTheme.color.bg.violet; 
    case 'Init':
      return defaultTheme.color.bg.blue;
    case 'Exec':
      return defaultTheme.color.bg.dark;     
  }
  return defaultTheme.color.bg.dark;
}

export function statusColor(theme: DefaultTheme, grayed: boolean, state: string, isFirst: boolean): string {
  if (grayed) {
    return '#c7c7c7';
  } else {
    switch (state.toUpperCase()) {
      case 'SUCCEEDED':
        return !isFirst ? lighten(0.3, defaultTheme.color.bg.green) : defaultTheme.color.bg.green;
      case 'RUNNING':
        return defaultTheme.color.bg.greenLight;
      case 'PENDING':
        return defaultTheme.color.bg.yellow;
      case 'FAILED':
        return !isFirst ? lighten(0.3, defaultTheme.color.bg.red) : defaultTheme.color.bg.red;
      case 'SKIPPED':
        return !isFirst ? lighten(0.3, defaultTheme.color.bg.dark) : defaultTheme.color.bg.dark;
      case 'CANCELLED':
        return !isFirst ? lighten(0.3, defaultTheme.color.bg.teal) : defaultTheme.color.bg.teal;          
      case 'INITIALIZED':
        return !isFirst ? lighten(0.3, defaultTheme.color.bg.blue) : defaultTheme.color.bg.blue;
      case 'PREPARED':
        return !isFirst ? lighten(0.3, defaultTheme.color.bg.violet) : defaultTheme.color.bg.violet;
      default:
        return lighten(0.3, defaultTheme.color.bg.dark);
    }
  }
}

export function getStatusColor(status: string): string {
  return statusColor(defaultTheme, false, status, true);
}
