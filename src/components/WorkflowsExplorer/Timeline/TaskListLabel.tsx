import { Tooltip } from '@mui/joy';
import { styled } from '@mui/joy/styles';
import { Link } from 'react-router-dom';
import { Row } from '../../../types';
import { formatDuration } from '../../../util/WorkflowsExplorer/format';
import { phasesOf } from '../../../util/WorkflowsExplorer/phases';
import { LABEL_COLUMN_WIDTH } from './constants';

/**
 * Combined duration of the phases the user currently has enabled, and whether any of them has no
 * end timestamp - in which case the total is a lower bound and is shown with a leading "\u2265".
 */
function totalDuration(row: Row, displayPhases: string[]): { total: number; isLowerBound: boolean } {
  return phasesOf(row)
    .filter((phase) => phase.startedAt && displayPhases.includes(phase.name))
    .reduce<{ total: number; isLowerBound: boolean }>(
      (acc, phase) => ({
        total: acc.total + (phase.duration ?? 0),
        isLowerBound: acc.isLowerBound || phase.isOpenEnded,
      }),
      { total: 0, isLowerBound: false },
    );
}

/** The left-hand column of a timeline row: the action name, and its duration. */
const TaskListLabel = (props: { item: Row; displayPhases: string[]; link?: string }) => {
  const { item, displayPhases, link } = props;
  const { total, isLowerBound } = totalDuration(item, displayPhases);

  return (
    <LabelColumn>
      <Link to={link!} relative="path" data-testid="tasklistlabel-link">
        <LabelContent>
          <Tooltip arrow title={item.step_name} enterDelay={500} enterNextDelay={500}>
            <ActionName data-testid="tasklistlabel-text">{item.step_name}</ActionName>
          </Tooltip>
          <Duration data-testid="tasklistlabel-duration">
            {isLowerBound && '\u2265 '}
            {formatDuration(total)}
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
