import React, { useCallback, useState, useMemo } from 'react';
import { AutoSizer, List } from 'react-virtualized';
import styled from 'styled-components';
import TimelineRow from './TimelineRow';
import { useTranslation } from 'react-i18next';
import TimelineFooter from './Footer';
import { TFunction } from 'i18next';
import { toRelativeSize } from '../../../util/WorkflowsExplorer/style';
import { TasksSortBy } from './useTaskListSettings';
import { AsyncStatus, Row } from '../../../types';

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
  displayPhases: { name: string; checked: boolean }[];
};

export type TimelineMetrics = {
  startTime: number;
  endTime: number;
  visibleEndTime: number;
  visibleStartTime: number;
  sortBy: TasksSortBy;
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
  const { t } = useTranslation();

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
        t: t,
        dragging: dragging,
        displayPhases: displayPhases,
      }),
    [dragging, paramsString, rows, searchStatus, t, timeline],
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
                  props: {
                    timeline,
                    rows,
                    onMove: onMove,
                    onHandleMove: onHandleMove,
                    onDraggingStateChange: setDragging,
                  },
                }
              : {
                  type: 'minimal',
                  props: {
                    startTime: timeline.startTime,
                    visibleStartTime: timeline.visibleStartTime,
                    visibleEndtime: timeline.visibleEndTime,
                  },
                })}
          />
        </div>
      </>
    ),
    [
      dragging,
      footerType,
      onHandleMove,
      onMove,
      rowRenderer,
      rows,
      t,
      timeline,
    ],
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
  t: TFunction;
  dragging: boolean;
  displayPhases: { name: string; checked: boolean }[];
};

function getUniqueKey(index: number, row: Row) {
  const key = index;
   return key + row.task_id;
}

function createRowRenderer({
  rows,
  timeline,
  searchStatus,
  paramsString = '',
  t,
  dragging,
  displayPhases,
}: RowRendererProps) {
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
          t={t}
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