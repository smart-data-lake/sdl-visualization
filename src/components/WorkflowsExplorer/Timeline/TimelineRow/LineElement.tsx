import { lighten } from 'polished';
import React from 'react';
import styled, { DefaultTheme, css, keyframes } from 'styled-components';
import { Row } from '../../../../types';
import { formatDuration } from '../../../../util/WorkflowsExplorer/format';
import { getRowStatus, statusColor } from './utils';

//
// Typedef
//

type LineElementProps = {
  row: Row;
  timeline: {
    startTime: number;
    visibleEndTime: number;
    visibleStartTime: number;
  };
  grayed?: boolean;
  isLastAttempt: boolean;
  dragging: boolean;
  displayPhases: string[];
  startTimeOfFirstAttempt?: number;
  paramsString?: string;
};

export type LabelPosition = 'left' | 'right' | 'none';

//
// Component
//

const LineElement: React.FC<LineElementProps> = ({
	row,
	timeline,
	grayed,
	isLastAttempt,
	dragging,
	displayPhases,
}) => {
	const status = getRowStatus(row);
	// Extend visible area little bit to prevent lines seem like going out of bounds. Happens
	// in some cases with short end task
	const extendAmount = (timeline.visibleEndTime - timeline.visibleStartTime) * 0.01;
	const visibleDuration = timeline.visibleEndTime - timeline.visibleStartTime + extendAmount;
	
	// Legacy mechanism that used to handle pending tasks
	/* if (!boxStartTime || status === 'pending') {
		return null;
	} */

	// Calculate how much box needs to be pushed from (or to) left
	const valueFromLeft = (boxStartTime: number | undefined) => {
		if (!boxStartTime) return undefined;
		return (boxStartTime - timeline.visibleStartTime) / visibleDuration * 100;
	}
	const width = (duration: number | null | undefined, valueFromLeft: number | undefined) => {
		if (valueFromLeft == undefined) return undefined;
		return duration && status !== 'RUNNING' ? (duration / visibleDuration) * 100 : 100 - valueFromLeft;
	}


	const constructLine = (
		valueFromLeft: number | undefined, 
		width: number | undefined, 
		row: any, 
		dragging: boolean, 
		duration: any, 
		grayed: boolean | undefined, 
		status: string, 
		isLastAttempt: boolean
	) => {
		return (
			<>
				<LineElementContainer
					style={{ transform: `translateX(${valueFromLeft}%)` }}
					dragging={dragging}
					data-testid="boxgraphic-container"
				>
				<BoxGraphic
					root={row.type === 'step'}
					style={{
					width: `${width}%`,
					}}
					data-testid="boxgraphic"
					dragging={dragging}
					title={formatDuration(duration) + `${status === 'UNKNOWN' ? ` (unknown status)` : ''}`}				
				>
					<BoxGraphicLine grayed={grayed} state={status} isLastAttempt={isLastAttempt} />
					<BoxGraphicMarkerStart />
					{status !== 'RUNNING' && <BoxGraphicMarkerEnd />}
				</BoxGraphic>
				</LineElementContainer>
			</>
		)
  }


  const valueFromLeftExec = valueFromLeft(row.startTstmp);
  const widthExec = width(row.getDuration(), valueFromLeftExec);
  const displayExec = row.startTstmp && displayPhases.includes('Exec');

  const valueFromLeftInit = valueFromLeft(row.startTstmpInit);
  const widthInit = width(row.getDurationInit(), valueFromLeftInit);
  const displayInit = row.startTstmpInit && displayPhases.includes('Init');

  const valueFromLeftPrepare = valueFromLeft(row.startTstmpPrepare);
  const widthPrepare = width(row.getDurationPrepare(), valueFromLeftPrepare);
  const displayPrepare = row.startTstmpPrepare && displayPhases.includes('Prepare');

  return (
    <>
		{displayExec && constructLine(
			valueFromLeftExec,
			widthExec,
			row, 
			dragging, 
			row.getDuration(), 
			grayed, 
			status, 
			isLastAttempt
		)}
		{valueFromLeftInit && displayInit && constructLine(
			valueFromLeftInit, 
			widthInit, 
			row, 
			dragging, 
			row.getDurationInit(), 
			grayed, 
			'INITIALIZED', 
			isLastAttempt
		)}
		{valueFromLeftInit && displayPrepare && constructLine(
			valueFromLeftPrepare, 
			widthPrepare, 
			row, 
			dragging, 
			row.getDurationPrepare(), 
			grayed, 
			'PREPARED', 
			isLastAttempt
		)}
    </>
  );
};

// Container for duration value
const RowMetricLabel: React.FC<{
  duration: null | number;
  labelPosition: LabelPosition;
  'data-testid'?: string;
}> = ({ duration, labelPosition, ...rest }) =>
  labelPosition === 'none' ? null : (
    <BoxGraphicValue position={labelPosition} {...rest}>
      {duration ? formatDuration(duration, 1) : ''}
    </BoxGraphicValue>
  );

//
// Style
//

const LineElementContainer = styled.div<{ dragging: boolean }>`
  width: 100%;
  transition: ${(p) => (p.dragging ? 'none' : '0.5s transform')};
`;

export const BoxGraphicValue = styled.div<{ position: LabelPosition }>`
  position: absolute;
  left: ${({ position }) => (position === 'right' ? '100%' : 'auto')};
  right: ${({ position }) => (position === 'left' ? '100%' : 'auto')};
  padding: 0 0.625rem;
  top: 1px;
  line-height: 1.625rem;
  font-size: 0.75rem;
  white-space: nowrap;

  &::after {
    content: '';
    transition: background 0.15s;
    position: absolute;
    width: 100%;
    height: 0.375rem;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    z-index: -1;
    background: rgba(255, 255, 255, 0.8);
  }
`;

const BoxGraphic = styled.div<{ root: boolean; dragging: boolean }>`
  position: absolute;
  cursor: pointer;
  color: ${(p) => p.theme.color.text.dark};
  min-width: 0.3125rem;
  height: 1.6875rem;
  line-height: 1.6875rem;
  transition: ${(p) => (p.dragging ? 'none' : '0.5s width')};
`;

const UnkownAnimation = (theme: DefaultTheme) => keyframes`
  0%, 100% { background: ${lighten(0.4, theme.color.bg.dark)} }
  50% { background: ${theme.color.bg.dark} }
`;

const UnkownMoveAnimation = keyframes`
  0%, 100% { transform: translateX(-100%) }
  50% { transform: translateX(100%) }
`;

const BoxGraphicLine = styled.div<{ grayed?: boolean; state: string; isLastAttempt: boolean }>`
  position: absolute;
  background: ${(p) => statusColor(p.theme, p.grayed || false, p.state, p.isLastAttempt)};
  width: 100%;
  height: 0.375rem;
  top: 50%;
  transform: translateY(-50%);
  transition: background 0.15s;
  overflow: hidden;

  ${(p) =>
    p.state === 'refining' &&
    css`
      animation: 5s ${UnkownAnimation(p.theme)} infinite;
      &::after {
        content: '';
        position: absolute;
        width: 100%;
        height: 200%;
        background: rgb(255, 255, 255, 0.8);
        background: linear-gradient(
          90deg,
          rgba(255, 255, 255, 0) 0%,
          rgba(255, 255, 255, 0.5) 50%,
          rgba(255, 255, 255, 0) 100%
        );
        top: -50%;
        left: 0;
        animation: 5s ${UnkownMoveAnimation} infinite ease-in-out;
      }
    `}

  &:hover {
    background: ${(p) => statusColor(p.theme, p.grayed || false, p.state, p.isLastAttempt)};
  }
`;

const BoxGraphicMarker = css`
  height: 0.1875rem;
  width: 1px;
  background: ${(p) => p.theme.color.bg.dark};
  position: absolute;
  bottom: 0;
`;

const BoxGraphicMarkerStart = styled.div`
  ${BoxGraphicMarker};
  left: 0;
`;

const BoxGraphicMarkerEnd = styled.div`
  ${BoxGraphicMarker};
  right: 0;
`;

export default LineElement;