import React from 'react';
import VirtualizedTimeline from './VirtualizedTimeline';
import { ThemeProvider } from 'styled-components';
import GlobalStyle from '../../GlobalStyle';
import '../../theme/font/roboto.css'
import theme from '../../theme';
import Attempt from '../../utils/Attempt';

type TimelineComponentProps = {
    attempt: Attempt;
};
const TimelineComponent: React.FC<TimelineComponentProps> = ({attempt}) => {
    return (
        <ThemeProvider theme={theme}>
        <GlobalStyle />
            <VirtualizedTimeline run={attempt.run} rows={attempt.rows}/>
        </ThemeProvider>
    );
};

export default TimelineComponent;
