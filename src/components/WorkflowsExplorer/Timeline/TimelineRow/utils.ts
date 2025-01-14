import { lighten } from 'polished';
import { DefaultTheme } from 'styled-components';
import { Row } from '../../../../types';
import defaultTheme from '../../../../theme';

export function getRowStatus(row: Row) {
  if (row.status) {
    return row.status;
  } else {
    return row.finished_at ? 'SUCCEEDED' : 'RUNNING';
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
