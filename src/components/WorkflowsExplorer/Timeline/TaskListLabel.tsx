import { Tooltip } from '@mui/joy';
import { styled } from '@mui/joy/styles';
import { Link } from 'react-router-dom';
import { Row } from '../../../types';
import { formatDuration } from '../../../util/WorkflowsExplorer/format';
import { LABEL_COLUMN_WIDTH } from './constants';

/** Duration getters keyed by the phase names used in the phase filter. */
const PHASE_DURATION: Record<string, (row: Row) => number | null> = {
  Exec: (row) => row.getDuration(),
  Init: (row) => row.getDurationInit(),
  Prepare: (row) => row.getDurationPrepare(),
};

/** Combined duration of the phases the user currently has enabled. */
function totalDuration(row: Row, displayPhases: string[]): number {
  return displayPhases.reduce((sum, phase) => sum + (PHASE_DURATION[phase]?.(row) || 0), 0);
}

/** The left-hand column of a timeline row: the action name, and its duration. */
const TaskListLabel = (props: { item: Row; displayPhases: string[]; link?: string }) => {
  const { item, displayPhases, link } = props;

  return (
    <LabelColumn>
      <Link to={link!} relative="path" data-testid="tasklistlabel-link">
        <LabelContent>
          <Tooltip arrow title={item.step_name} enterDelay={500} enterNextDelay={500}>
            <ActionName data-testid="tasklistlabel-text">{item.step_name}</ActionName>
          </Tooltip>
          <Duration data-testid="tasklistlabel-duration">
            {formatDuration(totalDuration(item, displayPhases))}
          </Duration>
        </LabelContent>
      </Link>
    </LabelColumn>
  );
};

const LabelColumn = styled('div')`
  flex: 0 0 ${LABEL_COLUMN_WIDTH};
  max-width: ${LABEL_COLUMN_WIDTH};
  overflow: hidden;
  cursor: pointer;
  font-size: ${(p) => p.theme.vars.fontSize.xs};
  line-height: 1.6875rem;
  padding-left: 0.5rem;

  a {
    display: flex;
    justify-content: flex-end;
    width: 100%;
    max-width: 100%;
    color: ${(p) => p.theme.vars.palette.text.primary};
    text-decoration: none;
    white-space: nowrap;
  }
`;

const LabelContent = styled('div')`
  width: 100%;
  display: flex;
  justify-content: space-between;
`;

const ActionName = styled('div')`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Duration = styled('span')`
  padding: 0 0.25rem 0 0.5rem;
  white-space: nowrap;
`;

export default TaskListLabel;
