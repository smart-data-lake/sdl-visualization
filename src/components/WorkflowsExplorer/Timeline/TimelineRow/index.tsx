import React from 'react';
import { Link, useParams } from 'react-router-dom';
import styled, { css } from 'styled-components';
import { AsyncStatus, Row } from '../../../../types';
import TaskListLabel from '../TaskListLabel';
import { TimelineMetrics } from '../Timeline';
import LineElement, { BoxGraphicValue } from './LineElement';

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
	// Flag if we are dragging footer section. Need to remove animation in that case so rows don't seem clunky
	dragging: boolean;
	displayPhases: string[];
};



const TimelineRow: React.FC<TimelineRowProps> = ({
	item,
	timeline,
	paramsString,
	sticky,
	dragging,
	displayPhases,
}) => {
	if (!item) return null;
	const Element = sticky ? StickyStyledRow : StyledRow;
    const {tab, stepName} = useParams();
	const link = tab ? (stepName ? `../${item.step_name}` : item.step_name) : `timeline/${item.step_name}`;

	return (
		<>
			<Element>
				<TaskListLabel item={item} displayPhases={displayPhases} link={link}/>
				<RowElement link={link}>
					<LineElement
						key={`${item.flow_id}.${item.run_number}.${item.attempt_id}.${item.step_name}`}
						timeline={timeline}
						row={item}
						isLastAttempt={true}
						startTimeOfFirstAttempt={item.started_at || 0}
						dragging={dragging}
						displayPhases={displayPhases}
						paramsString={paramsString}
					/>
				</RowElement>
			</Element>
		</>
	);
};

const RowElement = (props: React.PropsWithChildren<{ link?: string }>) => {
	const { link } = props;  
	return (
			<RowGraphLinkContainer to={link!} relative='path' data-testid="timeline-row-graphic-container">
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
