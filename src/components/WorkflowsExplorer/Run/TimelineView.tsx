import { Sheet } from "@mui/joy";
import { useEffect, useState } from "react";
import { ThemeProvider } from 'styled-components';
import GlobalStyle from "../../../GlobalStyle";
import theme from "../../../theme";
import { Row, Run } from "../../../types";
import { phaseFilters } from "../../../util/WorkflowsExplorer/StatusInfo";
import { getPhasesColor } from "../Timeline/TimelineRow/utils";
import VirtualizedTimeline from "../Timeline/VirtualizedTimeline";
import FilterMenu from "../ToolBar/FilterMenu";
import useLocalStorageState from "../../../hooks/useLocalStorageState";

export const TimelineView = (props: {  run: Run, rows: Row[], stepName?: string, setToolbarElements: (lrElements: [JSX.Element?, JSX.Element?]) => void}) => {

    const [phases, setPhases] = useLocalStorageState('run.phases', ['Exec']);

    useEffect(() => {
        props.setToolbarElements([
            <FilterMenu title='Select Phases' filters={phaseFilters} setFilters={filters => setPhases(filters.map(f => f.name))} filterInit={phaseFilters.map(f => phases.some(p => p === f.name))} colorMap={getPhasesColor}/>,
            undefined
        ]);
    }, [])

    return <Sheet sx={{ flex: 1, width: '100%', height: '100%', backgroundColor: props.stepName ? 'primary.main' : 'none', opacity: props.stepName ? [0.4, 0.4, 0.4] : []}} >
        <ThemeProvider theme={theme}>
            <GlobalStyle />
            <VirtualizedTimeline run={props.run} rows={props.rows} displayPhases={phases} />
        </ThemeProvider>
    </Sheet>
}