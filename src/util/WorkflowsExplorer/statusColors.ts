import { TaskStatus } from '../../types';

/**
 * Colours for SDLB action states and execution phases.
 *
 * These encode *data*, not UI chrome, so they are plain hex literals rather than Joy theme
 * tokens: the same values have to work inside CSS-in-JS, in SVG `fill` attributes (recharts,
 * see HistoryBarChart) and in MUI icon `sx` props.
 *
 * `solid` is used for the latest attempt of a run, `faded` for earlier attempts so that
 * superseded attempts recede visually. The faded values were originally produced at render
 * time by `polished`'s `lighten(0.3, solid)`; they are precomputed here so the palette is
 * readable at a glance and carries no runtime colour-maths dependency.
 */
const STATUS_COLORS: Record<TaskStatus, { solid: string; faded: string }> = {
  // Statuses that represent work in flight were never faded per attempt, so both tones match.
  PENDING: { solid: '#E5A90C', faded: '#E5A90C' },
  PREPARING: { solid: '#da99ff', faded: '#da99ff' },
  INITIALIZING: { solid: '#b5d7ff', faded: '#b5d7ff' },
  RUNNING: { solid: '#75f082', faded: '#75f082' },
  // Terminal / completed statuses fade for superseded attempts.
  PREPARED: { solid: '#a023e8', faded: '#dcaef6' },
  INITIALIZED: { solid: '#096bde', faded: '#86bbfa' },
  SUCCEEDED: { solid: '#20AF2E', faded: '#80e88a' },
  FAILED: { solid: '#EB3428', faded: '#f8b8b4' },
  SKIPPED: { solid: '#767676', faded: '#c3c3c3' },
  CANCELLED: { solid: '#00BBCE', faded: '#68f1ff' },
  UNKNOWN: { solid: '#c3c3c3', faded: '#c3c3c3' },
};

/** Neutral grey used for statuses we don't recognise, and for non-status filter swatches. */
export const NEUTRAL_COLOR = STATUS_COLORS.UNKNOWN.solid;

/**
 * Colour for an action state. `isLatestAttempt` false picks the faded tone so that earlier
 * attempts of the same run read as superseded.
 */
export function statusColor(status: string, isLatestAttempt = true): string {
  const entry = STATUS_COLORS[status?.toUpperCase() as TaskStatus];
  if (!entry) return NEUTRAL_COLOR;
  return isLatestAttempt ? entry.solid : entry.faded;
}

/** Colour for an action state, always in its solid tone. */
export function getStatusColor(status: string): string {
  return statusColor(status, true);
}

/** Colour for one of the three SDLB execution phases (see `phaseFilters` in StatusInfo). */
export function getPhasesColor(phase: string): string {
  switch (phase) {
    case 'Prepare':
      return STATUS_COLORS.PREPARED.solid;
    case 'Init':
      return STATUS_COLORS.INITIALIZED.solid;
    case 'Exec':
    default:
      return STATUS_COLORS.SKIPPED.solid;
  }
}
