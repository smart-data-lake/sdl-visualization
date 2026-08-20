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
- `LineElement.tsx` - the bars themselves, one per enabled phase.
- `useTimelineControls.ts` - reducer for panning and zooming the window.
- `constants.ts` - shared geometry (row height, label column width, the time-window helpers).
- `Footer/` - the minimap: aggregated lines, the draggable viewport rectangle and its handles.
