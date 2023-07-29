import { lighten } from 'polished';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import styled, { DefaultTheme, css, keyframes } from 'styled-components';
import { Row } from '../../../../types';
import { formatDuration } from '../../../../util/WorkflowsExplorer/format';
import { getPathFor } from '../../../../util/WorkflowsExplorer/routing';
import { TasksSortBy } from '../useTaskListSettings';
import { getLengthLabelPosition, getRowStatus, lineColor } from './utils';

//
// Typedef
//

type LineElementProps = {
  row: { type: 'task'; data: Row };
  timeline: {
    startTime: number;
    visibleEndTime: number;
    visibleStartTime: number;
    sortBy: TasksSortBy;
  };
  grayed?: boolean;
  isLastAttempt: boolean;
  duration: number | null;
  dragging: boolean;
  displayPhases: { name: string; checked: boolean }[];
  startTimeOfFirstAttempt?: number;
  paramsString?: string;
  init_duration?: number;
  init_ts_epoch?: number;
  prepare_duration?: number;
  prepare_ts_epoch?: number;
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
	duration,
	dragging,
	displayPhases,
	init_duration,
	init_ts_epoch,
	prepare_duration,
	prepare_ts_epoch,
  
  //paramsString,
}) => {
	const navigate = useNavigate();
	const status = getRowStatus(row);
	// Extend visible area little bit to prevent lines seem like going out of bounds. Happens
	// in some cases with short end task
	const extendAmount = (timeline.visibleEndTime - timeline.visibleStartTime) * 0.01;
	const visibleDuration = timeline.visibleEndTime - timeline.visibleStartTime + extendAmount;
	
	
	const _boxStartTime = (phase: string) => {
		switch (phase) {
			case 'init':
				return init_ts_epoch;
			case 'prepare':
				return prepare_ts_epoch;
			}
		return row.data.ts_epoch;
	}

	// Legacy mechanism that used to handle pending tasks
	/* if (!boxStartTime || status === 'pending') {
		return null;
	} */

	// Calculate have much box needs to be pushed from (or to) left
	const valueFromLeft = (boxStartTime: number | undefined) => {
		if (!boxStartTime) return undefined;
		return (boxStartTime - timeline.visibleStartTime) / visibleDuration * 100;
	}
	const width = (duration: number | null | undefined, valueFromLeft: number | undefined) => {
		if (!valueFromLeft) return undefined;
		return duration && status !== 'running' ? (duration / visibleDuration) * 100 : 100 - valueFromLeft;
	}


	const constructLine = (
		valueFromLeft: number | undefined, 
		width: number | undefined, 
		row: any, 
		dragging: boolean, 
		labelPosition: LabelPosition, 
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
					onClick={(e) => {
					if (row.type === 'task') {
						e.stopPropagation();
						e.preventDefault();
						navigate(`${getPathFor.attempt(row.data)}`);
					}
					}}
				>
					{(isLastAttempt || status === 'RUNNING') && (
					<RowMetricLabel duration={duration} labelPosition={labelPosition} data-testid="boxgraphic-label" />
					)}
					<BoxGraphicLine grayed={grayed} state={status} isLastAttempt={isLastAttempt} />
					<BoxGraphicMarkerStart />
					{status !== 'running' && <BoxGraphicMarkerEnd />}
				</BoxGraphic>
				</LineElementContainer>
			</>
		)
  }


  const valueFromLeftExec = valueFromLeft(_boxStartTime('exec'));
  const widthExec = width(duration, valueFromLeftExec);
  const labelPositionExec = getLengthLabelPosition(valueFromLeftExec, widthExec);
  const displayExec = displayPhases.find((phase) => phase.name === 'Execution')?.checked;

  const valueFromLeftInit = valueFromLeft(_boxStartTime('init'));
  const widthInit = width(init_duration, valueFromLeftInit);
  const displayInit = init_duration && displayPhases.find((phase) => phase.name === 'Initialized')?.checked;

  const valueFromLeftPrepare = valueFromLeft(_boxStartTime('prepare'));
  const widthPrepare = width(prepare_duration, valueFromLeftPrepare);
  const displayPrepare = prepare_duration && displayPhases.find((phase) => phase.name === 'Prepared')?.checked;

  return (
    <>
		{displayExec && constructLine(
			valueFromLeftExec,
			widthExec,
			row, 
			dragging, 
			labelPositionExec,
			duration, 
			grayed, 
			status, 
			isLastAttempt
		)}
		{valueFromLeftInit && displayInit && constructLine(
			valueFromLeftInit, 
			widthInit, 
			row, 
			dragging, 
			'none', 
			init_duration, 
			grayed, 
			'INITIALIZED', 
			isLastAttempt
		)}
		{valueFromLeftInit && displayPrepare && constructLine(
			valueFromLeftPrepare, 
			widthPrepare, 
			row, 
			dragging, 
			'none', 
			prepare_duration, 
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
  background: ${(p) => lineColor(p.theme, p.grayed || false, p.state, p.isLastAttempt)};
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
    background: ${(p) => lineColor(p.theme, p.grayed || false, p.state, p.isLastAttempt)};
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