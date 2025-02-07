import { Sheet, Typography } from "@mui/joy";
import Tab from '@mui/joy/Tab';
import TabList from '@mui/joy/TabList';
import TabPanel from '@mui/joy/TabPanel';
import Tabs from '@mui/joy/Tabs';
import { useMemo, useState } from "react";
import { useParams } from 'react-router-dom';
import { Row } from "../../../types";
import Attempt from "../../../util/WorkflowsExplorer/Attempt";
import { checkFiltersAvailability, Filter, stateFilters } from "../../../util/WorkflowsExplorer/StatusInfo";
import ToolBar from "../ToolBar/ToolBar";
import ContentDrawer from './ContentDrawer';

import useLocalStorageState from '../../../hooks/useLocalStorageState';
import { useWorkspace } from '../../../hooks/useWorkspace';
import { PartialDataObjectsAndActions } from "../../../util/ConfigExplorer/Graphs";
import { onlyUnique } from '../../../util/helpers';
import { Lineage } from "../../../util/WorkflowsExplorer/Lineage";
import LineageTab from "../../ConfigExplorer/LineageTab/LineageTab";
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
const TabsPanels = (props: { attempt: Attempt, tab: string }) => {
    const { attempt, tab } = props;
    const data = attempt.timelineRows;
    const params = useParams();
	const [filterParams, setFilterParams] = useState<FilterParams>({searchMode: 'contains', searchColumn: 'step_name', additionalFilters: []})
    const [[additionalLeftToolbarElements, additionalRightToolbarElements], setAdditionalToolbarElements] = useState<[JSX.Element?, JSX.Element?]>([]);

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

    const attemptFilterDefs = useMemo(() => {
        return data.map(r => r.attempt_id).filter(onlyUnique)
        .map(id => new Filter('attempt', id.toString(), row => row['attempt_id'] === id))
    }, [data])
    const timelineRun = useMemo(() => {
        const attemptActiveFilters = filterParams.additionalFilters;
        const timelineRun = attempt.getTimelineRun(attemptActiveFilters);    
        console.log("timelineRun", timelineRun)
        return timelineRun;
    }, [data, filterParams]);

	function updateFilterParams(partialFilter: Partial<FilterParams>) {
		setFilterParams({...filterParams, ...partialFilter})
	}

    const graph: PartialDataObjectsAndActions = useMemo(() => {
        let data: { action: string, inputIds: string[], outputIds: string[] }[] = [];
        attempt.timelineRows.forEach((row: Row) => {
            data.push({
                action: row.step_name,
                inputIds: row.details.inputIds || [],
                outputIds: row.details.outputIds || []
            })
        })
        return new Lineage(data).graph
    }, [attempt]);

    return (<>
        <Sheet sx={{ flex: 1, display: 'flex', flexDirection: 'column', mt: '1rem', mb: '1rem', width: '100%', height: '100%', overflow: 'hidden' }}>
            {tab !== "graph" && 
                <ToolBar data={data} filterParams={filterParams} updateFilterParams={updateFilterParams} searchPlaceholder="Search by action name"
                    stateFilters={checkFiltersAvailability(data, stateFilters('status'))} attemptFilters={attemptFilterDefs}                
                    leftElements={additionalLeftToolbarElements} rightElements={additionalRightToolbarElements}
                />
            }
            {selData.length === 0 && <Typography>No actions found</Typography>}
            {selData.length > 0 && <>
                <TabPanel className='content-panel' value='timeline' sx={{height: '100%', width: '100%', overflow: 'hidden'}}>
                    <TimelineView run={timelineRun} rows={selData} stepName={params.stepName} setToolbarElements={setAdditionalToolbarElements} />
                </TabPanel>
                <TabPanel className='content-panel' value='table' sx={{height: '100%', width: '100%', overflow: 'hidden'}}>
                    <TableView rows={selData} stepName={params.stepName} setToolbarElements={setAdditionalToolbarElements} />
                </TabPanel>
                <TabPanel className='content-panel' value='graph' sx={{height: '100%', width: '100%', overflow: 'hidden', paddingTop: '0'}}>
                    <LineageTab elementName="" elementType="" graph={graph} key={params.toString()}/>
                </TabPanel>
            </>}
        </Sheet>
        {params.stepName &&
            <Sheet sx={{ position: 'absolute', background: 'white', zIndex: 999, top: 0, height: '80vh', left: '60%', width: '40%', display: 'flex', flexDirection: 'column', boxShadow: '-10px 20px 20px lightgray', p: '1rem' }}>
                <ContentDrawer attempt={attempt} />
            </Sheet>
        }
    </>);
}

/**
 * The TabNav component renders a set of tabs that allow the user to navigate between the timeline, actions table, and lineage panel.
 * @param props {attempt: Attempt, panelOpen?: boolean}
 * @returns JSX.Element
 */
const TabNav = (props: { attempt: Attempt }) => {
    var params = useParams();
    const { attempt } = props;
	const {navigateContent} = useWorkspace();
    const [defaultTab, setDefaultTab] = useLocalStorageState("run.tab", "timeline");
    var tab = params.tab || defaultTab;

    function setSelectedTab(_e: any, v: any) {
        setDefaultTab(v);
        navigateContent(`workflows/${params.flowId}/${params.runIdAttempt}/${v}`);
    }

    return (
        <Tabs value={tab} onChange={(e, v) => setSelectedTab(e, v)} sx={{flex: 1, display: "flex", flexDirection: "column", width: '100%', height: '100%', overflow: 'hidden'}} >
            <TabList variant="plain" color="neutral">
                <Tab value="timeline">Timeline</Tab>
                <Tab value="table">Table</Tab>
                <Tab value="graph">Graph</Tab>
            </TabList>
            <TabsPanels attempt={attempt} key={`${attempt.appName}.${attempt.runId}.${attempt.attemptId}`} tab={tab}/>
        </Tabs>
    );
}

export default TabNav;