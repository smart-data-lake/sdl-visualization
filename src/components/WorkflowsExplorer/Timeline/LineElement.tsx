import { Tooltip } from '@mui/joy';
import { styled } from '@mui/joy/styles';
import React from 'react';
import { Row } from '../../../types';
import { formatDuration } from '../../../util/WorkflowsExplorer/format';
import { phasesOf } from '../../../util/WorkflowsExplorer/phases';
import { statusColor } from '../../../util/WorkflowsExplorer/statusColors';
import { extendedDuration, percentFromStart } from './constants';

type LineElementProps = {
  row: Row;
  visibleStartTime: number;
  visibleEndTime: number;
  isLastAttempt: boolean;
  /** While the minimap is being dragged, animations are suppressed so rows don't lag behind. */
  dragging: boolean;
  displayPhases: string[];
};

/** The bars on a single timeline row - one per execution phase the user has enabled. */
const LineElement: React.FC<LineElementProps> = ({
  row,
  visibleStartTime,
  visibleEndTime,
  isLastAttempt,
  dragging,
  displayPhases,
}) => {
  const visibleDuration = extendedDuration(visibleStartTime, visibleEndTime);

  return (
    <>
      {phasesOf(row).map(({ name, startedAt, duration, status, isOpenEnded }) => {
        // A phase is drawn only if the state file recorded a start for it and it is enabled.
        if (!startedAt || !displayPhases.includes(name)) return null;

        const fromLeft = percentFromStart(startedAt.getTime(), visibleStartTime, visibleDuration);
        // A phase that never finished runs to the right edge of the visible window.
        const width = duration ? (duration / visibleDuration) * 100 : 100 - fromLeft;

        return (
          <BarContainer
            key={name}
            style={{ transform: `translateX(${fromLeft}%)` }}
            $dragging={dragging}
            data-testid="boxgraphic-container"
          >
            {/*
             * The tooltip anchors to the bar itself, not to BarContainer: the container spans the
             * full row width, so anchoring there pushed the tooltip far to the right of the bar.
             */}
            <Tooltip
              arrow
              title={`${name}: ${isOpenEnded ? '\u2265 ' : ''}${formatDuration(duration)}`}
              enterDelay={500}
              enterNextDelay={500}
            >
              <Bar style={{ width: `${width}%` }} $dragging={dragging} data-testid="boxgraphic">
                <BarLine $status={status} $isLastAttempt={isLastAttempt} $openEnded={isOpenEnded} />
                <BarTickStart />
                {/* The end tick marks a known stopping point, so a phase without one omits it. */}
                {!isOpenEnded && <BarTickEnd />}
              </Bar>
            </Tooltip>
          </BarContainer>
        );
      })}
    </>
  );
};

const BarContainer = styled('div')<{ $dragging: boolean }>`
  width: 100%;
  transition: ${(p) => (p.$dragging ? 'none' : '0.5s transform')};
`;

const Bar = styled('div')<{ $dragging: boolean }>`
  position: absolute;
  cursor: pointer;
  color: ${(p) => p.theme.vars.palette.text.primary};
  min-width: 0.3125rem;
  height: 1.6875rem;
  line-height: 1.6875rem;
  transition: ${(p) => (p.$dragging ? 'none' : '0.5s width')};
`;

const BarLine = styled('div')<{ $status: string; $isLastAttempt: boolean; $openEnded: boolean }>`
  position: absolute;
  background: ${(p) => statusColor(p.$status, p.$isLastAttempt)};
  width: 100%;
  height: 0.375rem;
  top: 50%;
  transform: translateY(-50%);
  transition: background 0.15s;
  overflow: hidden;

  /* No end was recorded, so the bar trails off rather than stopping at a definite edge. */
  ${(p) =>
    p.$openEnded
      ? `mask-image: linear-gradient(to right, #000 55%, transparent 100%);
         -webkit-mask-image: linear-gradient(to right, #000 55%, transparent 100%);`
      : ''}
`;

/** Thin ticks marking the exact start and end of a phase, under the coloured bar. */
const BarTick = styled('div')`
  height: 0.1875rem;
  width: 1px;
  background: ${(p) => p.theme.vars.palette.text.tertiary};
  position: absolute;
  bottom: 0;
`;

const BarTickStart = styled(BarTick)`
  left: 0;
`;

const BarTickEnd = styled(BarTick)`
  right: 0;
`;

export default LineElement;
