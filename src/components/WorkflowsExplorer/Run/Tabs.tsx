import InboxIcon from '@mui/icons-material/Inbox';
import KeyboardDoubleArrowLeftIcon from '@mui/icons-material/KeyboardDoubleArrowLeft';
import KeyboardDoubleArrowRightIcon from '@mui/icons-material/KeyboardDoubleArrowRight';
import { Box, IconButton, Sheet, Typography } from "@mui/joy";
import Tab, { tabClasses } from '@mui/joy/Tab';
import TabList from '@mui/joy/TabList';
import TabPanel from '@mui/joy/TabPanel';
import Tabs from '@mui/joy/Tabs';
import React, { useMemo, useState } from "react";
import { ReactFlowProvider } from "react-flow-renderer";
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import GlobalStyle from "../../../GlobalStyle";
import theme from "../../../theme";
import { Row } from "../../../types";
import Attempt from "../../../util/WorkflowsExplorer/Attempt";
import { checkFiltersAvailability, stateFilters } from "../../../util/WorkflowsExplorer/StatusInfo";
import LineageTab from "../../ConfigExplorer/LineageTab";
import VirtualizedTimeline from "../Timeline/VirtualizedTimeline";
import ToolBar from "../ToolBar/ToolBar";
import ContentDrawer from './ContentDrawer';

import { SortDirection } from 'ka-table';
import DraggableDivider from "../../../layouts/DraggableDivider";
import { DAGraph } from "../../../util/ConfigExplorer/Graphs";
import { Lineage } from "../../../util/WorkflowsExplorer/Lineage";
import DataTable, { cellIconRenderer, dateRenderer, durationRenderer } from '../../ConfigExplorer/DataTable';
import { FilterParams, filterSearchText } from '../WorkflowHistory';

/**
 * This is a TypeScript function that returns a set of three React components which are rendered inside a parent component. 
 * The components are displayed inside a tabs UI component and include a timeline of events related to a specific "attempt," 
 * a table of available actions related to the attempt, and a panel for a lineage feature. 
 * The open prop is optional and can display additional content related to the timeline or table components when truthy.
 * 
 * @param {Attempt} props.attempt - The attempt for which to render the timeline, actions table, and lineage panel
 * @param {boolean} props.open - Determines whether or not the content drawer is open for the timeline and actions table components 
 * @returns A set of three React components (ToolBar, Tabs, TabPanel) rendered inside a parent component.
 */
const TabsPanels = (props: { attempt: Attempt, open?: boolean, tab?: string }) => {
    const { attempt, open, tab } = props;
    const data = attempt.rows;
	const [filterParams, setFilterParams] = useState<FilterParams>({searchMode: 'contains', searchColumn: 'step_name', additionalFilters: []})
    const [timelinePhases, setTimelinePhases] = useState(['Execution', 'Initialized', 'Prepared']);
    const navigate = useNavigate();
    const currURL = useLocation().pathname;
    
    const selData = useMemo(() => {
        if (data && data.length>0) {
			var selected = data;
			if (filterParams.searchText) {
				selected = selected.filter((row) => filterSearchText(filterParams, row));
			}
			if (filterParams.additionalFilters.length > 0) {
				selected = selected.filter(row => filterParams.additionalFilters.some(filter => filter.predicate(row)));
			}
			return selected;
		} else {
			return [];
		}
    }, [data, filterParams])

	function updateFilterParams(partialFilter: Partial<FilterParams>) {
		setFilterParams({...filterParams, ...partialFilter})
	}        

    const columns = [{
		title: 'Name',
		property: 'step_name',
	}, {
		title: 'Status',
		property: 'status',
		renderer: cellIconRenderer,
		width: '100px'
	}, {
		title: 'Start',
		property: 'started_at',
		renderer: (x) => dateRenderer(x),
		width: '175px',
        sortDirection: SortDirection.Ascend,
	}, {
		title: 'Finish',
		property: 'finished_at',
		renderer: (x) => dateRenderer(x),
		width: '175px',
	}, {
		title: 'Attempt',
		property: 'attempt_id',
		width: '80px'
	}, {
		title: 'Duration',
		property: 'duration',
		renderer: (x) => durationRenderer(x),
		width: '150px'
	}]

    return (
        <Sheet sx={{ display: 'flex', height: '100%' }}>
            <Sheet sx={{ flex: 1, display: 'flex', flexDirection: 'column', pt: '1rem', gap: '15px', width: '100%', height: '100%' }}>
                {/* Renders the ToolBar component, which contains a set of buttons that allow the user to filter the rows displayed in the actions table */}
                <ToolBar
                    data={data}
                    filterParams={filterParams}
                    updateFilterParams={updateFilterParams}
                    stateFilters={checkFiltersAvailability(data, stateFilters('status'))}
                    searchPlaceholder="Search by action name"
                    setPhases={tab == 'timeline' && attempt.runInfo.runStateFormatVersion && attempt.runInfo.runStateFormatVersion > 1 ? setTimelinePhases : undefined}
                />
                {/* Renders either an icon and message indicating that no actions were found, or the VirtualizedTimeline/Table and ContentDrawer components */}
                {selData.length === 0 ? (
                    <Sheet sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', mt: '1rem', p: '10rem', gap: '5rem', border: '1px solid lightgray', borderRadius: '0.5rem', height: '100%', }}>
                        <InboxIcon color="disabled" sx={{ scale: '5', }}/>
                        <Typography>No actions found</Typography>
                    </Sheet>
                ) : (<>
                    <TabPanel className='timeline-panel' value='timeline' sx={{p: '0px', width: '100%', height: '100%'}}>
                        <Sheet sx={{ display: 'flex', gap: '0.5rem', width: '100%', height: '100%'}} >
                            <ThemeProvider theme={theme}>
                                <GlobalStyle />
                                <Sheet
                                    onClick={() => {
                                        if (open) {
                                            navigate(`${currURL.split('timeline')[0]}timeline`);
                                        }
                                    }}
                                    sx={{ flex: '1', width: '99%', position: 'absolute', top: 0, left: 0, backgroundColor: open ? 'primary.main' : 'none', opacity: open ? [0.4, 0.4, 0.4] : [], transition: 'opacity 0.2s ease-in-out', cursor: 'context-menu' }}>
                                    <Sheet sx={{ gap: '0.5rem', height: '69vh', display: 'flex', }} >
                                        <VirtualizedTimeline run={attempt.run} rows={selData} displayPhases={timelinePhases} />
                                    </Sheet>
                                </Sheet>
                            </ThemeProvider>
                        </Sheet>
                    </TabPanel>
                    <TabPanel className='actions-table-panel' value='table' sx={{p: '0px', width: '100%', height: '100%'}}
                        onClick={() => open && navigate(`${currURL.split('table')[0]}table`)}>
                        <Sheet
                            sx={{ height: '100%', backgroundColor: open ? 'primary.main' : 'none', opacity: open ? [0.4, 0.4, 0.4] : [], transition: 'opacity 0.2s ease-in-out', cursor: 'context-menu' }}>
                            <DataTable data={selData} columns={columns} navigator={(row) => `${currURL}/${row.step_name}`} keyAttr='step_name'/>
                        </Sheet>
                    </TabPanel>
                </>)}
            </Sheet>
            {open && (
                <>
                    {/* <Sheet sx={{borderLeft: '1px solid lightgray', ml: '2rem', mr: '1rem'}}/> */}
                    <Sheet sx={{ position: 'absolute', top: 0, height: '80vh', left: '50%', display: 'flex', flexDirection: 'column', boxShadow: '-10px 30px 20px lightgray', p: '1rem' }}>
                        <ContentDrawer attempt={attempt} />
                    </Sheet>
                </>
            )}
        </Sheet>
    );
}

/**
 * The TabNav component renders a set of tabs that allow the user to navigate between the timeline, actions table, and lineage panel.
 * @param props {attempt: Attempt, panelOpen?: boolean}
 * @returns JSX.Element
 */
const TabNav = (props: { attempt: Attempt, panelOpen?: boolean }) => {
    const { stepName, tab } = useParams();
    const [openLineage, setOpenLineage] = useState<boolean>(false);
    const lineageRef = React.useRef<HTMLDivElement>(null);
    const { attempt, panelOpen } = props;
    const navigate = useNavigate();

    const handleChange = (_e: any, v: any) => {        
        if (stepName) navigate(`/workflows/${attempt.runInfo.workflowName}/${attempt.runInfo.runId}/${attempt.runInfo.attemptId}/${v}/${stepName}`)
        else navigate(`/workflows/${attempt.runInfo.workflowName}/${attempt.runInfo.runId}/${attempt.runInfo.attemptId}/${v}`)
    }

    const prepareGraph = (rows: Row[]) => {
        let data: { action: string, inputIds: { id: string }[], outputIds: { id: string }[] }[] = [];
        rows.forEach((row: Row) => {
            data.push({
                action: row.step_name,
                inputIds: row.inputIds ? row.inputIds : [],
                outputIds: row.outputIds ? row.outputIds : []
            })
        })

        return data;
    }

    const graph: DAGraph = new Lineage(prepareGraph(attempt.rows)).graph;

    return (
        <Sheet sx={{ display: 'flex', height: '100%', px: '1rem' }}>
            <Sheet sx={{ flex: 1, minWidth: 0, height: '100%', }}>
                <Tabs defaultValue={tab} onChange={(e, v) => handleChange(e, v)} >
                    <Box sx={{ display: 'flex', flex: 1, mt: '1rem', justifyContent: 'space-between' }}>
                        <TabList variant="plain" color="neutral">
                            <Tab value="timeline">Timeline</Tab>
                            <Tab value="table">Actions table</Tab>
                        </TabList>
                        {!openLineage ?
                            (
                                <IconButton disabled={attempt.rows[0].inputIds ? false : true} color={'primary'} size="md" variant="solid" sx={{ ml: '1rem', px: '1rem', scale: '80%' }} onClick={() => setOpenLineage(!openLineage)}>
                                    Open lineage
                                    <KeyboardDoubleArrowLeftIcon sx={{ ml: '0.5rem' }} />
                                </IconButton>
                            ) : (
                                <IconButton color={'primary'} size="md" variant="soft" sx={{ ml: '0.5rem', px: '0.5rem', scale: '80%' }} onClick={() => setOpenLineage(!openLineage)}>
                                    Close lineage
                                    <KeyboardDoubleArrowRightIcon sx={{ ml: '0.5rem' }} />
                                </IconButton>
                            )
                        }
                    </Box>
                    <TabsPanels tab={tab} attempt={attempt} open={panelOpen} />
                </Tabs>
            </Sheet>
            {openLineage && (
                <>
                    <DraggableDivider cmpRef={lineageRef} isRightCmp={true} defaultCmpWidth={500} />
                    <Sheet ref={lineageRef}>
                        <ReactFlowProvider>
                            <LineageTab graph={graph} elementName="" elementType="" />
                        </ReactFlowProvider>
                    </Sheet>
                </>
            )}
        </Sheet>
    );
}

export default TabNav;