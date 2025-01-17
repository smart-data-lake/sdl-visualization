import { Link } from 'react-router-dom';
import styled, { css } from 'styled-components';
import { Row } from '../../../types';
import { formatDuration } from '../../../util/WorkflowsExplorer/format';
import { colorByStatus } from '../../../util/WorkflowsExplorer/style';

//
// Component
//

const TaskListLabel = (props: {item: Row, displayPhases: string[], link?: string}) => {
  const { item, displayPhases, link } = props  

  const getTotalDuration = () => {
    let duration = 0;

    displayPhases.forEach((phase) => {
      switch (phase) {
        case 'Exec':
          duration += item.duration;
          break;
        case 'Init':
          duration += item.endTstmpInit && item.startTstmpInit ? item.endTstmpInit - item.startTstmpInit : 0;
          break;
        case 'Prepare':
          duration += item.endTstmpPrepare && item.startTstmpPrepare ? item.endTstmpPrepare - item.startTstmpPrepare : 0;
          break;
        default:
          break;
      }
    });
    
    return duration
  }

  return (
    <RowLabel type={'task'} isOpen={false} group={false} status={item.status}>
        <Link to={link!} relative='path' data-testid="tasklistlabel-link">
          <RowLabelContent>
            <RowLabelTaskName
              data-testid="tasklistlabel-text"
              title={`${item.step_name}`}
            >
              <RowTaskName>
                {getTaskLabel(item)}
              </RowTaskName>
            </RowLabelTaskName>
            <RowDuration data-testid="tasklistlabel-duration">
              {formatDuration(getTotalDuration())}
            </RowDuration>
          </RowLabelContent>
        </Link>
      
    </RowLabel>
  );
};

function getTaskLabel(item: Row): string {
  return item.getTaskId();
}

export default TaskListLabel;

//
// Style
//

const RowLabel = styled.div<{ type: 'step' | 'task'; isOpen?: boolean; group?: boolean; status: string }>`
  flex: 0 0 15.3125rem;
  max-width: 15.3125rem;
  overflow: hidden;
  cursor: pointer;
  font-size: ${(p) => (p.type === 'task' ? '0.75rem' : '0.875rem')};
  font-weight: ${(p) => (p.type === 'step' ? '600' : 'normal')};
  line-height: 1.6875rem;
  border-left: 2px solid ${(p) => colorByStatus(p.theme, p.status)};
  padding-left: ${(p) => (p.group ? '0' : '0.5rem')};

  a {
    display: flex;
    width: 100%;
    color: ${(p) => p.theme.color.text.dark};
    text-decoration: none;
    max-width: 100%;
    padding-left: ${(p) => (p.group ? '2.5rem' : '0rem')};
    white-space: nowrap;

    ${(p) =>
      !p.group
        ? css`
            display: flex;
            justify-content: flex-end;
          `
        : ''}
  }

  i {
    line-height: 0px;
  }
`;

const RowDuration = styled.span`
  padding: 0 0.25rem 0 0.5rem;
  white-space: nowrap;
`;

const RowLabelContent = styled.div<{ type?: 'step' }>`
  // In case of step row, lets remove icon width from total width so it aligns nicely
  width: ${(p) => (p.type === 'step' ? 'calc(100% - 30px)' : '100%')};
  display: flex;
  justify-content: space-between;
`;

const RowLabelTaskName = styled.div`
  display: flex;
  overflow: hidden;
`;

const RowTaskName = styled.div`
  overflow: hidden;

  text-overflow: ellipsis;
`;


