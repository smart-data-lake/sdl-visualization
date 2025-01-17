import React, { useCallback } from 'react';
import { Run, Row } from '../../../types';
import styled from 'styled-components';
import Timeline from './Timeline';
import useTimelineControls from './useTimelineControls';


type MyTimelineProps = {
  run: Run;
  rows: Row[];
  displayPhases: string[];
};

//
// Component
//

const VirtualizedTimeline: React.FC<MyTimelineProps> = ({
  run,
  rows,
  displayPhases,
}) => {
  const { timelineControls, dispatch: timelineControlDispatch } = useTimelineControls(run, rows);

  //
  // Event handling
  //

  const footerHandleUpdate = useCallback(
    (which: 'left' | 'right', to: number) => {
      if (which === 'left') {
        timelineControlDispatch({
          type: 'setZoom',
          start:
            to < timelineControls.min
              ? timelineControls.min
              : to > timelineControls.timelineEnd - 500
              ? timelineControls.timelineStart
              : to,
          end: timelineControls.timelineEnd,
        });
      } else {
        timelineControlDispatch({
          type: 'setZoom',
          start: timelineControls.timelineStart,
          end:
            to > timelineControls.max
              ? timelineControls.max
              : to < timelineControls.timelineStart + 500
              ? timelineControls.timelineEnd
              : to,
        });
      }
    },
    [
      timelineControlDispatch,
      timelineControls.max,
      timelineControls.min,
      timelineControls.timelineEnd,
      timelineControls.timelineStart,
    ],
  );

  const handleMove = useCallback(
    (value: number) => timelineControlDispatch({ type: 'move', value: value }),
    [timelineControlDispatch],
  );
  
  return (
    <VirtualizedTimelineContainer>
        {rows.length > 0 && (
          <Timeline
            rows={rows}
            timeline={{
              startTime: timelineControls.min,
              endTime: timelineControls.max,
              visibleStartTime: timelineControls.timelineStart,
              visibleEndTime: timelineControls.timelineEnd,
              groupingEnabled: false
            }}
            onHandleMove={footerHandleUpdate}
            onMove={handleMove}
            displayPhases={displayPhases}
          />
        )}
    </VirtualizedTimelineContainer>
  );
};

//
// Style
//

const VirtualizedTimelineContainer = styled.div`
  display: flex;
  height: 100%;
  width: 100%;
  user-select: none;
`;

/* const MyVirtualizedTimelineSubContainer = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
`; */

export default VirtualizedTimeline;