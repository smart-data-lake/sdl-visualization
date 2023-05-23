import React from 'react';
import styled from 'styled-components';
import MinimalFooter, { MinimalFooterProps } from './MinimalFooter';
import MinimapFooter, { MinimapFooterProps } from './MinimapFooter';

//
// Typedef
//

type TimelineFooterProps =
  | { type: 'minimap'; props: MinimapFooterProps }
  | { type: 'minimal'; props: MinimalFooterProps };

//
// Component
//

const TimelineFooter: React.FC<TimelineFooterProps> = (props) => {
  return (
    <TimelineFooterContainer>
      <TimelineFooterLeft></TimelineFooterLeft>
      {props.type === 'minimap' ? <MinimapFooter {...props.props} /> : <MinimalFooter {...props.props} />}
    </TimelineFooterContainer>
  );
};

//
// Style
//

const TimelineFooterContainer = styled.div`
  display: flex;
  position: relative;
  height: 2.5rem;
  width: 100%;
  border-top: ${(p) => p.theme.border.mediumLight};
  margin-bottom: 1.5625rem;
`;

const TimelineFooterLeft = styled.div`
  display: inline-block;
  width: 15.3125rem;
  margin: 0.5rem 0;
  padding-right: 0.5rem;
`;

export default TimelineFooter;
