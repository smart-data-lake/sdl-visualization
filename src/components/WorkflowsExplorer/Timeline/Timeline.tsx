import React, { useCallback, useMemo, useState } from 'react';
import { AutoSizer, List } from 'react-virtualized';
import styled from 'styled-components';
import { AsyncStatus, Row } from '../../../types';
import { toRelativeSize } from '../../../util/WorkflowsExplorer/style';
import TimelineFooter from './Footer';
import TimelineRow from './TimelineRow';

const listStyle = { transition: 'height 0.25s' };

//
// Typedef
//
type TimelineProps = {
  rows: Row[];
  timeline: TimelineMetrics;
  searchStatus?: AsyncStatus;
  footerType?: 'minimal' | 'minimap';
  paramsString?: string;
  customMinimumHeight?: number;
  onHandleMove?: (which: 'left' | 'right', to: number) => void;
  onMove?: (change: number) => void;
  displayPhases: string[];
};

export type TimelineMetrics = {
  startTime: number;
  endTime: number;
  visibleEndTime: number;
  visibleStartTime: number;
  groupingEnabled: boolean;
};

//
// Component
//

export const SPACE_UNDER_TIMELINE = (type: 'minimal' | 'minimap'): number =>
  type === 'minimap' ? toRelativeSize(80) : toRelativeSize(38);
export const ROW_HEIGHT = toRelativeSize(28);

const Timeline: React.FC<TimelineProps> = ({
  rows,
  timeline,
  searchStatus,
  footerType = 'minimap',
  paramsString = '',
  customMinimumHeight = 31.25,
  onHandleMove = () => null,
  onMove = () => null,
  displayPhases,
}) => {

  // Name of sticky header (if should be visible)
  const [dragging, setDragging] = useState(false);
  //
  // Event handling
  //

  const rowRenderer = useMemo(
    () =>
      createRowRenderer({
        rows,
        timeline,
        searchStatus,
        paramsString,
        dragging: dragging,
        displayPhases: displayPhases,
      }),
    [dragging, paramsString, rows, searchStatus, timeline, displayPhases],
  );

  const autosizerContents = useCallback(
    ({height, width}) => (
      <>
        <List
          overscanRowCount={rows.length}
          rowCount={rows.length}
          rowHeight={ROW_HEIGHT}
          rowRenderer={rowRenderer}
          height={
            height - SPACE_UNDER_TIMELINE(footerType) > rows.length * ROW_HEIGHT
              ? rows.length * ROW_HEIGHT
              : height - SPACE_UNDER_TIMELINE(footerType)
          }
          width={width}
          style={listStyle}
        />

        <div style={{ width: width + 'px' }}>
          <TimelineFooter
            {...(footerType === 'minimap'
              ? {
                  type: 'minimap',
                  props: { timeline, rows, onMove: onMove, onHandleMove: onHandleMove, onDraggingStateChange: setDragging },
                }
              : {
                  type: 'minimal',
                  props: { startTime: timeline.startTime, visibleStartTime: timeline.visibleStartTime, visibleEndtime: timeline.visibleEndTime },
                })}
          />
        </div>
      </>
    ),
    [ dragging, footerType, onHandleMove, onMove, rowRenderer, rows, timeline, displayPhases ],
  );

  return (
    <ListContainer customMinHeight={customMinimumHeight}>
      <AutoSizer>{autosizerContents}</AutoSizer>
    </ListContainer>
  );
};

//
// Utils
//

type RowRendererProps = {
  rows: Row[];
  timeline: TimelineMetrics;
  searchStatus?: AsyncStatus;
  paramsString: string;
  dragging: boolean;
  displayPhases: string[];
};

function getUniqueKey(index: number, row: Row) {
  const key = index;
   return key + row.task_id;
}

function createRowRenderer({ rows, timeline, searchStatus, paramsString = '', dragging, displayPhases }: RowRendererProps) {
  return ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const row = rows[index];
    return (
      <div style={style} key={getUniqueKey(index, row)}>
        <TimelineRow
          item={row}
          timeline={timeline}
          searchStatus={searchStatus}
          onOpen={() => null}
          paramsString={paramsString}
          dragging={dragging}
          displayPhases={displayPhases}
        />
      </div>
    );
  };
}

//
// Style
//

const ListContainer = styled.div<{ customMinHeight: number }>`
    width: 100%;  
    height: 100%;
`;

export default Timeline;