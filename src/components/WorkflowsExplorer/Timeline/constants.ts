/**
 * Shared geometry for the timeline. These used to be scattered magic numbers repeated across
 * the row, footer and minimap components; the minimap viewport in particular used a different
 * time denominator than the bars it sits under, so the two drifted apart.
 */

/** Browser default font size. Users may have changed it from the usual 16px. */
function getDocumentDefaultFontSize(): number | null {
  const size = getComputedStyle(document.documentElement).fontSize;
  if (size && size.indexOf('px') > -1) {
    return parseInt(size.split('px')[0]);
  }
  return null;
}

const DEFAULT_FONT_SIZE = getDocumentDefaultFontSize();

/**
 * Scale a pixel value by the browser's font-size setting, so the timeline keeps its proportions
 * when the user has moved away from the 16px default.
 */
export function toRelativeSize(pixels: number): number {
  const multiplier = DEFAULT_FONT_SIZE ? DEFAULT_FONT_SIZE / 16 : 1;
  return pixels * multiplier;
}

/** Height of a single action row in the virtualized list. */
export const ROW_HEIGHT = toRelativeSize(28);

/** Vertical space the minimap footer occupies below the list. */
export const SPACE_UNDER_TIMELINE = toRelativeSize(80);

/** Width of the left-hand action-name column. The footer keeps a matching spacer. */
export const LABEL_COLUMN_WIDTH = '15.3125rem';

/** The minimap aggregates rows into at most this many lines - more will not fit. */
export const MINIMAP_GROUPS = 13;

/**
 * Time windows are stretched by this fraction so that a bar ending exactly at the right edge
 * does not look like it runs off the end.
 */
const VIEWPORT_EXTEND_RATIO = 0.01;

/** Length of a time window, including the small overshoot described above. */
export function extendedDuration(from: number, to: number): number {
  return (to - from) * (1 + VIEWPORT_EXTEND_RATIO);
}

/** Where `value` sits inside a window, as a percentage offset from its start. */
export function percentFromStart(value: number, from: number, duration: number): number {
  return ((value - from) / duration) * 100;
}

/** The time window the timeline is currently showing, shared by the rows and the minimap. */
export type TimelineMetrics = {
  /** Start of the whole run. */
  startTime: number;
  /** End of the whole run. */
  endTime: number;
  /**
   * Fixed zero point for the minimap's time axis: the run's first timestamp, regardless of which
   * phases are shown. `startTime` moves with the phase selection, so it cannot serve as the origin.
   */
  originTime: number;
  /** Start of the zoomed-in section the user is looking at. */
  visibleStartTime: number;
  /** End of the zoomed-in section the user is looking at. */
  visibleEndTime: number;
  /** Highest attempt id present, so earlier attempts can be drawn faded. */
  latestAttemptId: number;
};
