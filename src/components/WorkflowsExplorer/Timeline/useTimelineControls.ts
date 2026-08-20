import React, { useEffect, useReducer, useRef } from 'react';
import { Row, Run } from '../../../types';
import { startAndEndOverallPointsOfRows } from '../../../util/WorkflowsExplorer/row';

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

export default function useTimelineControls(run: Run, rows: Row[]): TimelineControlsHook {
  const [timelineControls, dispatch] = useReducer(timelineControlsReducer, {
    min: run.ts_epoch,
    max: run.finished_at || run.ts_epoch,
    timelineStart: run.ts_epoch,
    timelineEnd: run.finished_at || run.ts_epoch,
    controlled: false,
  });

  // Read through a ref so the effect below can compare against current state without having to
  // re-run whenever that state changes - which would make it re-dispatch its own update.
  const controls = useRef(timelineControls);
  controls.current = timelineControls;

  useEffect(() => {
    const { start, end } = startAndEndOverallPointsOfRows(rows);
    if (start === 0 || end === 0) return;
    // NOTE: this compares the new start against the current *end*. It reads like a typo, but it
    // only gates a redundant dispatch, so it is kept as-is rather than risk changing zoom
    // behaviour that nothing tests.
    if (start === controls.current.timelineEnd && end === controls.current.max) return;
    dispatch({ type: 'update', start, end });
  }, [rows]);

  useEffect(() => {
    // Only a run that is still in flight needs its timeline stretched towards 'now'.
    if (!run.status.endsWith('ING')) return;
    const timer = setInterval(() => dispatch({ type: 'incrementTimelineLength' }), 1000);
    return () => clearInterval(timer);
  }, [run.status]);

  return { timelineControls, dispatch };
}
