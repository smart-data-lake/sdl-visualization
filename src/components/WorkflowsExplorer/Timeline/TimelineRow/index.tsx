import React from 'react';
import styled, { css } from 'styled-components';
import { Link } from 'react-router-dom';
import { getPathFor } from '../../../utils/routing';
import { TFunction } from 'i18next';
import TaskListLabel from '../TaskListLabel';
import LineElement, { BoxGraphicValue } from './LineElement';

import { getTaskDuration } from '../../../utils/task';
import { TimelineMetrics } from '../Timeline';
import { AsyncStatus, Row } from '../../../types';

type TimelineRowProps = {
  // Row type and data
  item?: Row;
  // Overall timeline state (used to calculate dimensions)
  timeline: TimelineMetrics;
  onOpen: () => void;
  searchStatus?: AsyncStatus;
  isOpen?: boolean;
  // Flag row as sticky for some absolute stylings
  sticky?: boolean;
  paramsString?: string;
  t: TFunction;
  // Flag if we are dragging footer section. Need to remove animation in that case so rows don't seem clunky
  dragging: boolean;
};

const TimelineRow: React.FC<TimelineRowProps> = ({
  item,
  timeline,
  onOpen,
  paramsString,
  sticky,
  dragging,
}) => {
  if (!item || !item) return null;
  const Element = sticky ? StickyStyledRow : StyledRow;

  const { groupingEnabled, ...lineElementMetrics } = timeline;

  return (
    <>
      <Element>
          <TaskListLabel item={item}/>
        <RowElement item={item} paramsString={paramsString} onOpen={onOpen}>
            <LineElement
                key={item.finished_at}
                timeline={lineElementMetrics}
                row={{ type: 'task', data: item }}
                isLastAttempt={true}
                duration={getTaskDuration(item)}
                startTimeOfFirstAttempt={timeline.sortBy === 'duration' ? item.started_at || 0 : undefined}
                dragging={dragging}
                paramsString={paramsString}
              />
        </RowElement>
      </Element>
    </>
  );
};

const RowElement: React.FC<{ item: Row; onOpen: () => void; paramsString?: string }> = ({
  item,
  children,
 // paramsString,
}) => {
    return (
      <RowGraphLinkContainer
        to={`${getPathFor.task(item)}`}
        data-testid="timeline-row-graphic-container"
      >
        {children}
      </RowGraphLinkContainer>
    );
};

//
// Style
//

const StyledRow = styled.div`
  display: flex;
  width: 100%;
  min-height: 1.75rem;
  border-bottom: ${(p) => p.theme.border.thinLight};
  transition: background 0.15s;

  &:hover {
    background: ${(p) => p.theme.color.bg.blueLight};

    ${BoxGraphicValue} {
      &::after {
        background: ${(p) => p.theme.color.bg.blueLight};
      }
    }
  }
`;

const StickyStyledRow = styled(StyledRow)`
  position: absolute;
  background: ${(p) => p.theme.color.bg.white};
  top: 1;
  left: 0;
`;

const RowContainerStyles = css`
  position: relative;
  width: 100%;
  border-left: ${(p) => p.theme.border.thinLight};
  overflow-x: hidden;
`;

const RowGraphLinkContainer = styled(Link)`
  ${RowContainerStyles}
`;

export default TimelineRow;
