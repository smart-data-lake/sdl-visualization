## About this component

A Gantt-style view of one run attempt: one virtualized row per SDLB action, with a bar for each
execution phase (Prepare / Init / Exec), over a minimap that pans and zooms the visible window.

### Origin and licence

The component was extracted by @zzeekk from the open-source [Metaflow UI](https://github.com/Netflix/metaflow-ui)
project, then adapted by @entouanes to model the data in SDLB state files: Metaflow "tasks" became
SDLB "actions", and its concept of "steps" was dropped since nothing in SDLB corresponds to it.
The Metaflow types were rewritten to simplify the translation, which lives in
`src/util/WorkflowsExplorer/Attempt.ts`; the resulting types are in `src/types.ts`.

**Metaflow UI is licensed under the Apache-2.0 license. The corresponding license file is provided
in this folder and must be retained.**

### How it has since diverged

The component was later simplified and brought in line with the rest of the app:

- **Styling is MUI Joy**, like every other component here. It previously used
  `styled-components` with its own theme in `src/theme` - the only place in the repo that did -
  and mounted a `createGlobalStyle` reset that restyled the *whole app* for as long as the
  timeline tab was open. Both are gone; `styled` now comes from `@mui/joy/styles` and chrome
  colours, borders and font sizes come from Joy theme tokens.
- **Status colours moved out.** `getStatusColor` / `statusColor` / `getPhasesColor` now live in
  `src/util/WorkflowsExplorer/statusColors.ts`, because the run history chart, the status icons
  and the toolbar all need them too - importing them from inside this folder made the timeline
  the app-wide colour authority by accident.
- **Metaflow scaffolding was removed**: the unused `useTaskListSettings` hook, the alternative
  "minimal" footer, step grouping, sticky step headers, the never-dispatched zoom actions, and
  props that were only ever passed a constant.

### Layout

- `Timeline.tsx` - entry point. Owns the visible window (via `useTimelineControls`) and renders
  the virtualized list plus the footer.
- `TimelineRow.tsx` - one action: its label column and its bars.
- `TaskListLabel.tsx` - the left-hand column: action name and summed duration.
- `LineElement.tsx` - the bars themselves, one per enabled phase. A phase that recorded no end timestamp is drawn
  with a faded trailing edge and no end tick, and its duration is reported as a lower bound (`≥ 4.2s`). Such a
  phase is measured up to the attempt's end anchor (`endAnchorOf` in `Attempt.ts`) rather than up to now, so an
  action that was cancelled when a sibling failed no longer appears to have run until today.
- `useTimelineControls.ts` - reducer for panning and zooming the window. The window is fitted to the range the
  *selected phases* cover (`startAndEndPointsOfPhases`), not the run's overall span, so showing only Exec does not
  leave the prepare/init period as empty space on the left. Changing the phase filter re-fits and drops any manual
  zoom; changing the row filters re-fits but keeps it. The minimap's handle labels are measured from
  `originOfRows` - the run's first timestamp - rather than from the window, so the time axis is absolute and
  stays put as phases are toggled: Prepare reads 0.0s-5.4s, Init 5.4s-8.7s, Exec 8.7s onwards.
- `constants.ts` - shared geometry (row height, label column width, the time-window helpers).
- `Footer/` - the minimap: aggregated lines, the draggable viewport rectangle and its handles. Each line is split
  per phase (`phaseSegmentsOfRows`) so its colours match the bars above it - violet under Prepare, blue under
  Init, the action's own outcome under Exec. One span per row group taking the overall status used to paint the
  prepare and init stretches green on a successful run.
