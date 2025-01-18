import InboxIcon from '@mui/icons-material/Inbox';
import KeyboardDoubleArrowLeftIcon from '@mui/icons-material/KeyboardDoubleArrowLeft';
import KeyboardDoubleArrowRightIcon from '@mui/icons-material/KeyboardDoubleArrowRight';
import { Box, IconButton, Sheet, Typography } from "@mui/joy";
import Tab from '@mui/joy/Tab';
import TabList from '@mui/joy/TabList';
import TabPanel from '@mui/joy/TabPanel';
import Tabs from '@mui/joy/Tabs';
import React, { useMemo, useState } from "react";
import { useParams } from 'react-router-dom';
import { Row } from "../../../types";
import Attempt from "../../../util/WorkflowsExplorer/Attempt";
import { checkFiltersAvailability, Filter, stateFilters } from "../../../util/WorkflowsExplorer/StatusInfo";
import LineageTab from '../../ConfigExplorer/LineageTab/LineageTab';
import ToolBar from "../ToolBar/ToolBar";
import ContentDrawer from './ContentDrawer';

import { useWorkspace } from '../../../hooks/useWorkspace';
import DraggableDivider from "../../../layouts/DraggableDivider";
import { PartialDataObjectsAndActions } from "../../../util/ConfigExplorer/Graphs";
import { onlyUnique } from '../../../util/helpers';
import { Lineage } from "../../../util/WorkflowsExplorer/Lineage";
import { filterByGroup, FilterParams, filterSearchText } from '../WorkflowHistory';
import { TableView } from './TableView';
import { TimelineView } from './TimelineView';

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
const TabsPanels = (props: { attempt: Attempt }) => {
    const { attempt } = props;
    const data = attempt.timelineRows;
    var {tab, stepName} = useParams();
	const [filterParams, setFilterParams] = useState<FilterParams>({searchMode: 'contains', searchColumn: 'step_name', additionalFilters: []})
    const [[additionalLeftToolbarElements, additionalRightToolbarElements], setAdditionalToolbarElements] = useState<[JSX.Element?, JSX.Element?]>([]);
    tab = tab || 'timeline';

    const selData = useMemo(() => {
        if (data && data.length>0) {
			var selected = data;
			if (filterParams.searchText) {
				selected = selected.filter((row) => filterSearchText(filterParams, row));
			}
			if (filterParams.additionalFilters.length > 0) {
				selected = filterByGroup(filterParams.additionalFilters, selected);
			}
			return selected;
		} else {
			return [];
		}
    }, [data, filterParams])

    const attemptFilterDefs = data.map(r => r.attempt_id).filter(onlyUnique)
    .map(id => new Filter('attempt', id.toString(), row => row['attempt_id'] === id))
    const timelineRun = useMemo(() => {
        const attemptActiveFilters = filterParams.additionalFilters.filter(f => f.group === 'attempt');
        return attempt.getTimelineRun(attemptActiveFilters);    
    }, [data, filterParams]);

	function updateFilterParams(partialFilter: Partial<FilterParams>) {
		setFilterParams({...filterParams, ...partialFilter})
	}      

    return (
        <Sheet sx={{ display: 'flex', height: '100%', width: '100%' }}>
            <Sheet sx={{ flex: 1, display: 'flex', flexDirection: 'column', pt: '1rem', gap: '15px', width: '100%', height: '100%' }}>
                {/* Renders the ToolBar component, which contains a set of buttons that allow the user to filter the rows displayed in the actions table */}
                <ToolBar
                    data={data}
                    filterParams={filterParams}
                    updateFilterParams={updateFilterParams}
                    stateFilters={checkFiltersAvailability(data, stateFilters('status'))}
                    attemptFilters={attemptFilterDefs}
                    searchPlaceholder="Search by action name"
                    leftElements={additionalLeftToolbarElements}
                    rightElements={additionalRightToolbarElements}
                />
                {/* Renders either an icon and message indicating that no actions were found, or the VirtualizedTimeline/Table and ContentDrawer components */}
                {selData.length === 0 ? (
                    <Sheet sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', mt: '1rem', p: '10rem', gap: '5rem', border: '1px solid lightgray', borderRadius: '0.5rem', height: '100%', }}>
                        <InboxIcon color="disabled" sx={{ scale: '5', }}/>
                        <Typography>No actions found</Typography>
                    </Sheet>
                ) : (<>
                    <TabPanel className='timeline-panel' value='timeline' sx={{p: '0px', width: '100%', height: '100%'}}>
                        <TimelineView run={timelineRun} rows={selData} stepName={stepName} setToolbarElements={setAdditionalToolbarElements} />
                    </TabPanel>
                    <TabPanel className='actions-table-panel' value='table' sx={{p: '0px', width: '100%', height: '100%'}}>
                        <TableView rows={selData} stepName={stepName} setToolbarElements={setAdditionalToolbarElements} />
                    </TabPanel>
                </>)}
            </Sheet>
            {stepName && (
                <>
                    {/* <Sheet sx={{borderLeft: '1px solid lightgray', ml: '2rem', mr: '1rem'}}/> */}
                    <Sheet sx={{ position: 'absolute', top: 0, height: '80vh', left: '60%', width: '40%', display: 'flex', flexDirection: 'column', boxShadow: '-10px 30px 20px lightgray', p: '1rem' }}>
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
const TabNav = (props: { attempt: Attempt }) => {
    const { tab, stepName } = useParams();
    const [openLineage, setOpenLineage] = useState<boolean>(false);
    const lineageRef = React.useRef<HTMLDivElement>(null);
    const { attempt } = props;
	const {navigateRel} = useWorkspace();

    const setSelectedTab = (_e: any, v: any) => (tab && stepName ? navigateRel(`../../${v}`) : (tab ? navigateRel(`../${v}`) : navigateRel(`${v}`))); 

    const prepareGraph = (rows: Row[]) => {
        let data: { action: string, inputIds: string[], outputIds: string[] }[] = [];
        rows.forEach((row: Row) => {
            data.push({
                action: row.step_name,
                inputIds: row.details.inputIds || [],
                outputIds: row.details.outputIds || []
            })
        })

        return data;
    }

    const graph: PartialDataObjectsAndActions = useMemo(() => {
        return new Lineage(prepareGraph(attempt.timelineRows)).graph
    }, [attempt]);

    return (
        <Sheet sx={{ display: 'flex', height: '100%', px: '1rem' }}>
            <Sheet sx={{ flex: 1, minWidth: '500px', height: '100%', }}>
                <Tabs value={tab || 'timeline'} onChange={(e, v) => setSelectedTab(e, v)} >
                    <Box sx={{ display: 'flex', flex: 1, mt: '1rem', justifyContent: 'space-between' }}>
                        <TabList variant="plain" color="neutral">
                            <Tab value="timeline">Timeline</Tab>
                            <Tab value="table">Actions table</Tab>
                        </TabList>
                        {!openLineage ?
                            (
                                <IconButton disabled={!attempt.timelineRows[0].details.inputIds} color={'primary'} size="md" variant="solid" sx={{ ml: '1rem', px: '1rem', scale: '80%' }} onClick={() => setOpenLineage(!openLineage)}>
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
                    <TabsPanels attempt={attempt} key={`${attempt.appName}.${attempt.runId}.${attempt.attemptId}`}/>
                </Tabs>
            </Sheet>
            {openLineage && (
                <>
                    <DraggableDivider id="workflow-lineage" cmpRef={lineageRef} isRightCmp={true} defaultCmpWidth={500} />
                    <Sheet ref={lineageRef}>
                            <LineageTab graph={graph} elementName="" elementType="actions" />
                    </Sheet>
                </>
            )}
        </Sheet>
    );
}

export default TabNav;