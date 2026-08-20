import { styled } from '@mui/joy/styles';
import React from 'react';
import { TaskStatus } from '../../../../types';
import { PhaseSegment } from '../../../../util/WorkflowsExplorer/phases';
import { getStatusColor } from '../../../../util/WorkflowsExplorer/statusColors';
import { extendedDuration, percentFromStart } from '../constants';

type MinimapRowProps = {
  /** One entry per displayed phase, aggregated over the rows this line stands for. */
  segments: PhaseSegment[];
  startTime: number;
  endTime: number;
};

/**
 * One line of the minimap, standing in for a group of action rows. It is split per phase so the
 * colours match the bars above: violet under Prepare, blue under Init, and the actions' own
 * outcome under Exec.
 */
const MinimapRow: React.FC<MinimapRowProps> = ({ segments, startTime, endTime }) => {
  const duration = extendedDuration(startTime, endTime);

  return (
    <LineTrack>
      {segments.map((segment) => (
        <LineSegment
          key={segment.phase}
          $status={segment.status}
          style={{
            left: `${percentFromStart(segment.start, startTime, duration)}%`,
            width: `${((segment.end - segment.start) / duration) * 100}%`,
          }}
        />
      ))}
    </LineTrack>
  );
};

const LineTrack = styled('div')`
  position: relative;
  height: 2px;
  min-height: 2px;
  margin-bottom: 1px;
`;

const LineSegment = styled('div')<{ $status: TaskStatus }>`
  position: absolute;
  top: 0;
  height: 100%;
  min-width: 2px;
  background: ${(p) => getStatusColor(p.$status)};
  transition: width 0.5s, left 0.5s;
`;

export default MinimapRow;
