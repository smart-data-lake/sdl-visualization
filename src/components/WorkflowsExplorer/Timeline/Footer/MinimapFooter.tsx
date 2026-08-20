import { styled } from '@mui/joy/styles';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Row, TaskStatus } from '../../../../types';
import { aggregateTaskStatus, startAndEndExecPointsOfRows } from '../../../../util/WorkflowsExplorer/row';
import { MINIMAP_GROUPS, TimelineMetrics } from '../constants';
import MinimapActiveSection from './MinimapActiveSection';
import MinimapRow from './MinimapRow';

export type MinimapFooterProps = {
  timeline: TimelineMetrics;
  rows: Row[];
  /** Pan the visible window by a number of milliseconds. */
  onMove: (change: number) => void;
  /** Move one edge of the visible window to an absolute timestamp. */
  onHandleMove: (which: 'left' | 'right', to: number) => void;
  onDraggingStateChange: (dragging: boolean) => void;
};

type LineData = { start: number; end: number; status: TaskStatus };

/** Overview strip under the timeline, with a draggable window for panning and zooming. */
const MinimapFooter: React.FC<MinimapFooterProps> = ({
  timeline,
  onMove,
  onHandleMove,
  rows,
  onDraggingStateChange,
}) => {
  const container = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState({ dragging: false, start: 0 });
  const [handleDrag, setHandleDrag] = useState<{ dragging: boolean; which: 'left' | 'right' }>({
    dragging: false,
    which: 'left',
  });

  const isDragging = drag.dragging || handleDrag.dragging;

  const handleMove = (clientX: number) => {
    if (!container.current) return;

    if (handleDrag.dragging) {
      const rect = container.current.getBoundingClientRect();
      const position = (clientX - rect.left) / rect.width;
      onHandleMove(handleDrag.which, timeline.startTime + (timeline.endTime - timeline.startTime) * position);
    } else if (drag.dragging) {
      const movement = (clientX - drag.start) / container.current.clientWidth;
      setDrag({ ...drag, start: clientX });
      onMove((timeline.endTime - timeline.startTime) * movement);
    }
  };

  const startMove = (clientX: number) => setDrag({ ...drag, dragging: true, start: clientX });
  const stopMove = () => setDrag({ dragging: false, start: 0 });

  const startHandleDrag = (which: 'left' | 'right') => {
    setHandleDrag({ dragging: true, which });
    setDrag({ ...drag, dragging: false });
  };

  const stopHandleDrag = () => {
    if (handleDrag.dragging) setHandleDrag({ ...handleDrag, dragging: false });
  };

  const stopAll = () => {
    stopHandleDrag();
    stopMove();
  };

  // Rows are bucketed into a fixed number of lines, since more than that will not fit.
  const lines: LineData[] = useMemo(() => {
    const perGroup = Math.ceil(rows.length / MINIMAP_GROUPS);
    const groups: Row[][] = [];
    for (let i = 0; i < Math.min(rows.length, MINIMAP_GROUPS); i++) {
      groups.push(rows.slice(perGroup * i, perGroup * i + perGroup));
    }
    return groups
      .map((group) => ({ status: aggregateTaskStatus(group), ...startAndEndExecPointsOfRows(group) }))
      .filter((line) => line.start !== 0 && line.end !== 0);
  }, [rows]);

  useEffect(() => {
    onDraggingStateChange(isDragging);
  }, [isDragging, onDraggingStateChange]);

  return (
    <>
      <FooterContent>
        <MinimapActiveSection
          timeline={timeline}
          dragging={isDragging}
          startMove={startMove}
          startHandleMove={startHandleDrag}
        />
        <LineContainer ref={container}>
          {lines.map((line) => (
            <MinimapRow
              key={`${line.start}-${line.end}-${line.status}`}
              startTime={timeline.startTime}
              endTime={timeline.endTime}
              started={line.start}
              finished={line.end}
              status={line.status}
            />
          ))}
        </LineContainer>
      </FooterContent>

      {/*
       * While dragging, a transparent full-screen layer catches the pointer so the gesture
       * survives leaving the minimap. Touch moves go through handleMove() like mouse moves do;
       * they used to be handed a raw clientX where a millisecond delta was expected, which made
       * touch panning jump to the far end of the run.
       */}
      {isDragging && (
        <DragCatcher
          onMouseMove={(e) => handleMove(e.clientX)}
          onTouchMove={(e) => handleMove(e.touches[0].clientX)}
          onMouseLeave={stopAll}
          onMouseUp={stopAll}
          onTouchEnd={stopAll}
        />
      )}
    </>
  );
};

const FooterContent = styled('div')`
  position: relative;
  flex: 1;
  background: ${(p) => p.theme.vars.palette.background.level1};
  border-bottom: 1px solid ${(p) => p.theme.vars.palette.divider};
  height: 3.0625rem;
`;

const LineContainer = styled('div')`
  display: flex;
  flex-direction: column;
  justify-content: center;

  position: absolute;
  overflow: hidden;
  top: 0;
  left: 0;
  width: 100%;
  height: 2.5625rem;

  pointer-events: none;
`;

const DragCatcher = styled('div')`
  position: fixed;
  width: 100%;
  height: 100%;
  left: 0;
  top: 0;
  z-index: 10;
`;

export default MinimapFooter;
