import React, { useEffect, useMemo, useReducer, useRef } from 'react';
import { Row, Run } from '../../../types';
import { startAndEndPointsOfPhases } from '../../../util/WorkflowsExplorer/phases';

/**
 * State machine for the timeline's visible window. `min`/`max` bound the whole run; the
 * `timelineStart`/`timelineEnd` pair is the slice currently on screen.
 */
export type TimelineControlsState = {
  /** Earliest timestamp in the run - the start of the timeline. */
  min: number;
  /** Latest timestamp in the run - the end of the timeline. */
  max: number;
  /** Start of the visible section. */
  timelineStart: number;
  /** End of the visible section. */
  timelineEnd: number;
  /** Set once the user has zoomed in, so incoming updates don't reset their view. */
  controlled: boolean;
};

export type TimelineAction =
  // Re-fit the timeline to a new overall range, preserving any zoom the user has applied.
  | { type: 'update'; start: number; end: number }
  // Pan the visible window (negative moves backwards).
  | { type: 'move'; value: number }
  // Re-fit to a new range and discard any zoom, so the window shows exactly that range.
  | { type: 'refit'; start: number; end: number }
  // Set the visible window directly, from a minimap handle drag.
  | { type: 'setZoom'; start: number; end: number }
  // Extend the timeline to 'now' while a run is still in flight.
  | { type: 'incrementTimelineLength' };

function startOutOfBounds(state: TimelineControlsState, change: number): boolean {
  return state.timelineStart + change < state.min;
}

function endOutOfBounds(state: TimelineControlsState, change: number): boolean {
  return state.timelineEnd + change > state.max;
}

function pan(state: TimelineControlsState, change: number): TimelineControlsState {
  return { ...state, timelineStart: state.timelineStart + change, timelineEnd: state.timelineEnd + change };
}

export function timelineControlsReducer(
  state: TimelineControlsState,
  action: TimelineAction,
): TimelineControlsState {
  switch (action.type) {
    case 'update': {
      // Nothing to do if the bounds already match; returning the same state skips a re-render.
      if (state.min === action.start && state.max === action.end) return state;
      if (state.controlled) {
        // Keep the user's zoom, only clamping it into the new overall range.
        const end = state.max > action.end ? state.max : action.end;
        return {
          ...state,
          min: action.start,
          max: action.end,
          timelineStart: action.start > state.timelineStart ? action.start : state.timelineStart,
          timelineEnd: end < state.timelineEnd ? end : state.timelineEnd,
        };
      }
      return { ...state, min: action.start, max: action.end, timelineStart: action.start, timelineEnd: action.end };
    }

    case 'refit':
      return {
        min: action.start,
        max: action.end,
        timelineStart: action.start,
        timelineEnd: action.end,
        controlled: false,
      };

    case 'move': {
      if (!startOutOfBounds(state, action.value) && !endOutOfBounds(state, action.value)) {
        return pan(state, action.value);
      }
      // Panning past either edge parks the window against that edge instead.
      const visibleLength = state.timelineEnd - state.timelineStart;
      return {
        ...state,
        timelineStart: startOutOfBounds(state, action.value) ? state.min : state.max - visibleLength,
        timelineEnd: endOutOfBounds(state, action.value) ? state.max : state.min + visibleLength,
      };
    }

    case 'setZoom': {
      const timelineStart = Math.min(action.start, action.end);
      const timelineEnd = Math.max(action.start, action.end);
      return {
        ...state,
        timelineStart,
        timelineEnd,
        // Zooming back out to (almost) the full range hands control back to auto-fitting.
        controlled: timelineEnd - timelineStart < (state.max - state.min) * 0.97,
      };
    }

    case 'incrementTimelineLength': {
      const now = new Date().getTime();
      return { ...state, max: now, timelineEnd: state.controlled ? state.timelineEnd : now };
    }
  }
}

export type TimelineControlsHook = {
  timelineControls: TimelineControlsState;
  dispatch: React.Dispatch<TimelineAction>;
};

export default function useTimelineControls(
  run: Run,
  rows: Row[],
  displayPhases: string[],
): TimelineControlsHook {
  // Seed straight from the phases on screen, so the first render is already zoomed to the range
  // that has bars rather than briefly showing the run's full span.
  const [timelineControls, dispatch] = useReducer(timelineControlsReducer, undefined, () => {
    const { start, end } = startAndEndPointsOfPhases(rows, displayPhases);
    const min = start || run.ts_epoch;
    const max = end || run.finished_at || run.ts_epoch;
    return { min, max, timelineStart: min, timelineEnd: max, controlled: false };
  });

  // Compare the phase selection by content: the filter menu hands down a fresh array on mount
  // even when nothing was toggled.
  const phaseKey = useMemo(() => [...displayPhases].sort().join(','), [displayPhases]);
  const fittedPhases = useRef(phaseKey);

  useEffect(() => {
    const { start, end } = startAndEndPointsOfPhases(rows, displayPhases);
    if (start === 0 || end === 0) return;

    if (fittedPhases.current !== phaseKey) {
      // The phase selection decides which part of the run holds bars at all, so zoom to the new
      // non-empty range rather than leave empty space at one end.
      fittedPhases.current = phaseKey;
      dispatch({ type: 'refit', start, end });
    } else {
      // Only the rows changed (a search or attempt filter): re-fit the bounds but leave any zoom
      // the user has set in place.
      dispatch({ type: 'update', start, end });
    }
    // displayPhases is covered by phaseKey, which compares it by content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, phaseKey]);

  useEffect(() => {
    // Only a run that is still in flight needs its timeline stretched towards 'now'.
    if (!run.status.endsWith('ING')) return;
    const timer = setInterval(() => dispatch({ type: 'incrementTimelineLength' }), 1000);
    return () => clearInterval(timer);
  }, [run.status]);

  return { timelineControls, dispatch };
}
