import { styled } from '@mui/joy/styles';
import React from 'react';
import { formatDuration } from '../../../../util/WorkflowsExplorer/format';
import { TimelineMetrics, extendedDuration, percentFromStart } from '../constants';
import MinimapHandle from './MinimapHandle';

type ActiveSectionProps = {
  timeline: TimelineMetrics;
  dragging: boolean;
  startMove: (value: number) => void;
  startHandleMove: (which: 'left' | 'right') => void;
};

/**
 * The draggable rectangle showing which slice of the run the rows above are displaying.
 * It shares `extendedDuration` with the minimap lines so the two stay aligned - previously it
 * used the raw span and drifted slightly against the bars it sits under.
 */
const MinimapActiveSection: React.FC<ActiveSectionProps> = ({ timeline, dragging, startMove, startHandleMove }) => {
  const duration = extendedDuration(timeline.startTime, timeline.endTime);
  const width = ((timeline.visibleEndTime - timeline.visibleStartTime) / duration) * 100;
  const left = percentFromStart(timeline.visibleStartTime, timeline.startTime, duration);

  return (
    <ActiveSection
      $dragging={dragging}
      style={{ width: `${width}%`, left: `${left}%` }}
      onMouseDown={(e) => startMove(e.clientX)}
      onTouchStart={(e) => startMove(e.touches[0].clientX)}
    >
      {/*
        * Both labels are measured from the run's first timestamp, not from the start of the
        * window, so the axis reads the same whichever phases are selected. formatDuration already
        * renders 0 as '0.0s' and clamps negatives.
        */}
      <MinimapHandle
        which="left"
        isZoomed={width < 20}
        label={formatDuration(timeline.visibleStartTime - timeline.originTime)}
        onDragStart={() => startHandleMove('left')}
      />
      <MinimapHandle
        which="right"
        isZoomed={width < 20}
        stackText={width + left > 90}
        label={formatDuration(timeline.visibleEndTime - timeline.originTime)}
        onDragStart={() => startHandleMove('right')}
      />
    </ActiveSection>
  );
};

const ActiveSection = styled('div')<{ $dragging: boolean }>`
  position: relative;
  height: 3.0625rem;
  background: ${(p) => p.theme.vars.palette.background.surface};
  border-left: 1px solid ${(p) => p.theme.vars.palette.divider};
  border-right: 1px solid ${(p) => p.theme.vars.palette.divider};
  border-bottom: 0.5rem solid ${(p) => p.theme.vars.palette.divider};
  cursor: grab;
  transition: ${(p) => (p.$dragging ? 'none' : '0.5s left, 0.5s width')};
`;

export default MinimapActiveSection;
