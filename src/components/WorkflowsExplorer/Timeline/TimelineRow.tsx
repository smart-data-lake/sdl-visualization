import { styled } from '@mui/joy/styles';
import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { Row } from '../../../types';
import { TimelineMetrics } from './constants';
import LineElement from './LineElement';
import TaskListLabel from './TaskListLabel';

type TimelineRowProps = {
  item?: Row;
  timeline: TimelineMetrics;
  /** While the minimap is being dragged, animations are suppressed so rows don't lag behind. */
  dragging: boolean;
  displayPhases: string[];
};

/** One action of the run: its label column, and the bars for its execution phases. */
const TimelineRow: React.FC<TimelineRowProps> = ({ item, timeline, dragging, displayPhases }) => {
  const { tab, stepName } = useParams();

  if (!item) return null;

  // Both halves of the row link to the action's own view, relative to wherever we are now.
  const link = tab ? (stepName ? `../${item.step_name}` : item.step_name) : `timeline/${item.step_name}`;

  return (
    <RowContainer>
      <TaskListLabel item={item} displayPhases={displayPhases} link={link} />
      <RowGraphLink to={link} relative="path" data-testid="timeline-row-graphic-container">
        <LineElement
          row={item}
          visibleStartTime={timeline.visibleStartTime}
          visibleEndTime={timeline.visibleEndTime}
          isLastAttempt={timeline.latestAttemptId === item.attempt_id}
          dragging={dragging}
          displayPhases={displayPhases}
        />
      </RowGraphLink>
    </RowContainer>
  );
};

const RowContainer = styled('div')`
  display: flex;
  width: 100%;
  min-height: 1.75rem;
  border-bottom: 1px solid ${(p) => p.theme.vars.palette.divider};
  transition: background 0.15s;

  &:hover {
    background: ${(p) => p.theme.vars.palette.primary.softBg};
  }
`;

const RowGraphLink = styled(Link)`
  position: relative;
  width: 100%;
  border-left: 1px solid ${(p) => p.theme.vars.palette.divider};
  overflow-x: hidden;
`;

export default TimelineRow;
