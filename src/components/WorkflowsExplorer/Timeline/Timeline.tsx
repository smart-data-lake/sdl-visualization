import { styled } from '@mui/joy/styles';
import React, { useCallback, useMemo, useState } from 'react';
import { AutoSizer, List } from 'react-virtualized';
import { Row, Run } from '../../../types';
import MinimapFooter from './Footer/MinimapFooter';
import TimelineRow from './TimelineRow';
import { LABEL_COLUMN_WIDTH, ROW_HEIGHT, SPACE_UNDER_TIMELINE, TimelineMetrics } from './constants';
import useTimelineControls from './useTimelineControls';

type TimelineProps = {
  run: Run;
  rows: Row[];
  displayPhases: string[];
};

const listStyle = { transition: 'height 0.25s' };

/**
 * Gantt-style view of a run: one virtualized row per action, over a minimap that pans and zooms
 * the visible time window.
 */
const Timeline: React.FC<TimelineProps> = ({ run, rows, displayPhases }) => {
  const { timelineControls, dispatch } = useTimelineControls(run, rows);
  const [dragging, setDragging] = useState(false);

  const timeline: TimelineMetrics = useMemo(
    () => ({
      startTime: timelineControls.min,
      endTime: timelineControls.max,
      visibleStartTime: timelineControls.timelineStart,
      visibleEndTime: timelineControls.timelineEnd,
      latestAttemptId: rows.reduce((latest, row) => Math.max(latest, row.attempt_id), 0),
    }),
    [timelineControls, rows],
  );

  const handleMove = useCallback((value: number) => dispatch({ type: 'move', value }), [dispatch]);

  // Dragging a minimap handle sets one edge of the window. Dragging an edge past its opposite
  // number, or outside the run, is ignored rather than inverting the window.
  const handleEdgeMove = useCallback(
    (which: 'left' | 'right', to: number) => {
      const { min, max, timelineStart, timelineEnd } = timelineControls;
      if (which === 'left') {
        const start = to < min ? min : to > timelineEnd - 500 ? timelineStart : to;
        dispatch({ type: 'setZoom', start, end: timelineEnd });
      } else {
        const end = to > max ? max : to < timelineStart + 500 ? timelineEnd : to;
        dispatch({ type: 'setZoom', start: timelineStart, end });
      }
    },
    [dispatch, timelineControls],
  );

  const rowRenderer = useCallback(
    ({ index, style, key }: { index: number; style: React.CSSProperties; key: string }) => (
      <div style={style} key={key}>
        <TimelineRow item={rows[index]} timeline={timeline} dragging={dragging} displayPhases={displayPhases} />
      </div>
    ),
    [rows, timeline, dragging, displayPhases],
  );

  if (rows.length === 0) return null;

  return (
    <Container>
      <AutoSizer>
        {({ height, width }) => (
          <>
            <List
              overscanRowCount={10}
              rowCount={rows.length}
              rowHeight={ROW_HEIGHT}
              rowRenderer={rowRenderer}
              height={Math.min(height - SPACE_UNDER_TIMELINE, rows.length * ROW_HEIGHT)}
              width={width}
              style={listStyle}
            />
            <div style={{ width: `${width}px` }}>
              <Footer>
                {/* Empty column keeping the minimap aligned with the bars, not the labels. */}
                <FooterLabelSpacer />
                <MinimapFooter
                  timeline={timeline}
                  rows={rows}
                  onMove={handleMove}
                  onHandleMove={handleEdgeMove}
                  onDraggingStateChange={setDragging}
                />
              </Footer>
            </div>
          </>
        )}
      </AutoSizer>
    </Container>
  );
};

const Container = styled('div')`
  display: flex;
  height: 100%;
  width: 100%;
  user-select: none;

  /* Was previously applied app-wide by a global stylesheet mounted with this component. */
  & .ReactVirtualized__List:focus {
    outline: none;
    border: none;
  }
`;

const Footer = styled('div')`
  display: flex;
  position: relative;
  width: 100%;
  height: 2.5rem;
  margin-bottom: 1.5625rem;
  border-top: 2px solid ${(p) => p.theme.vars.palette.divider};
`;

const FooterLabelSpacer = styled('div')`
  display: inline-block;
  width: ${LABEL_COLUMN_WIDTH};
  margin: 0.5rem 0;
  padding-right: 0.5rem;
`;

export default Timeline;
