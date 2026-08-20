import { styled } from '@mui/joy/styles';
import React from 'react';
import { TaskStatus } from '../../../../types';
import { getStatusColor } from '../../../../util/WorkflowsExplorer/statusColors';
import { extendedDuration, percentFromStart } from '../constants';

type MinimapRowProps = {
  started: number;
  finished: number;
  status: TaskStatus;
  startTime: number;
  endTime: number;
};

/** One aggregated line in the minimap, standing in for a group of action rows. */
const MinimapRow: React.FC<MinimapRowProps> = ({ started, finished, status, startTime, endTime }) => {
  const duration = extendedDuration(startTime, endTime);

  return (
    <MinimapLine
      $status={status}
      style={{
        width: `${((finished - started) / duration) * 100}%`,
        left: `${percentFromStart(started, startTime, duration)}%`,
      }}
    />
  );
};

const MinimapLine = styled('div')<{ $status: TaskStatus }>`
  position: relative;
  background: ${(p) => getStatusColor(p.$status)};
  height: 2px;
  min-height: 2px;
  margin-bottom: 1px;
  min-width: 2px;
  transition: width 0.5s, left 0.5s;
`;

export default MinimapRow;
