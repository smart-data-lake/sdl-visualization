import React from 'react';
import styled, { css } from 'styled-components';
import { Link } from 'react-router-dom';
import { getPathFor } from '../../../../util/WorkflowsExplorer/routing';
import { TFunction } from 'i18next';
import TaskListLabel from '../TaskListLabel';
import LineElement, { BoxGraphicValue } from './LineElement';
import { TimelineMetrics } from '../Timeline';
import { AsyncStatus, Row } from '../../../../types';

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
	displayPhases: { name: string; checked: boolean }[];
};



const TimelineRow: React.FC<TimelineRowProps> = ({
	item,
	timeline,
	onOpen,
	paramsString,
	sticky,
	dragging,
	displayPhases,
}) => {
	if (!item || !item) return null;
	const Element = sticky ? StickyStyledRow : StyledRow;

	const { groupingEnabled, ...lineElementMetrics } = timeline;

	return (
		<>
			<Element>
				<TaskListLabel item={item} displayPhases={displayPhases}/>
				<RowElement item={item} paramsString={paramsString} onOpen={onOpen}>
						<LineElement
							key={item.finished_at}
							timeline={lineElementMetrics}
							row={{ type: 'task', data: item }}
							isLastAttempt={true}
							duration={item.getTaskDuration()}
							startTimeOfFirstAttempt={timeline.sortBy === 'duration' ? item.started_at || 0 : undefined}
							dragging={dragging}
							displayPhases={displayPhases}
							paramsString={paramsString}
							init_ts_epoch={item.startTstmpInit}
							init_duration={item.startTstmpInit && item.endTstmpInit ? item.endTstmpInit - item.startTstmpInit : undefined}
							prepare_ts_epoch={item.startTstmpPrepare}
							prepare_duration={item.startTstmpPrepare && item.endTstmpPrepare ? item.endTstmpPrepare - item.startTstmpPrepare : undefined}
						/>
				</RowElement>
			</Element>
		</>
	);
};

const RowElement = (props: React.PropsWithChildren<{ item: Row; onOpen: () => void; paramsString?: string }>) => {
	const { item } = props;  
	return (
			<RowGraphLinkContainer
				to={`${getPathFor.task(item)}`}
				data-testid="timeline-row-graphic-container"
			>
				{props.children}
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
