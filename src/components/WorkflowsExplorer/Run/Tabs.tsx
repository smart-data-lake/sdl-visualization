import React, { useState } from "react";
import Tabs from '@mui/joy/Tabs';
import TabList from '@mui/joy/TabList';
import Tab, { tabClasses } from '@mui/joy/Tab';
import TabPanel from '@mui/joy/TabPanel';
import { Box, Typography } from "@mui/joy";
import Attempt from "../../../util/WorkflowsExplorer/Attempt";
import TableOfActions from "./ActionsTable";
import { ThemeProvider } from 'styled-components';
import ContentDrawer from './ContentDrawer';
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import theme from "../../../theme";
import GlobalStyle from "../../../GlobalStyle";
import VirtualizedTimeline from "../Timeline/VirtualizedTimeline";
import { Row } from "../../../types";
import ToolBar from "../ToolBar/ToolBar";
import InboxIcon from '@mui/icons-material/Inbox';
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { DataGrid } from "@mui/x-data-grid";
import { getISOString } from "../../../util/WorkflowsExplorer/date";
import { formatDuration } from "../../../util/WorkflowsExplorer/format";

export const defaultDrawerWidth = 600;


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
const TabsPanels = (props : {attempt: Attempt, open?: boolean}) => {
    const { attempt, open } = props;
    const defaultRows = attempt.rows;
    const [rows, setRows] = useState<Row[]>(defaultRows);
    const navigate = useNavigate();
    const currURL = useLocation().pathname;

    /**
   * Updates the rows displayed in the table of actions.
   *
   * @param {Row[]} rows - The updated array of rows
   * @returns void
   */
    const updateRows = (rows: Row[]) => {
        setRows(rows);
    }

    // Defines an array of filters that can be used to filter the rows displayed in the actions table.
    const filters = [
        {name: 'Succeeded', fun: (rows: Row[]) => {return rows.filter(row => row.status === 'completed')}},
        {name: 'Unknown', fun: (rows: Row[]) => {return rows.filter(row => row.status === 'unknown')}},
        {name: 'Failed', fun: (rows: Row[]) => {return rows.filter(row => row.status === 'failed')}}
    ];
    
    const columns = [
        { field: 'step_name', headerName: 'Step Name', flex: 1 },
        { field: 'status', headerName: 'Step Name', flex: 1 },
        { field: 'task_id', headerName: 'Step Name', flex: 1 },
        { field: 'started_at', headerName: 'Step Name', flex: 1 },
        { field: 'finished_at', headerName: 'Step Name', flex: 1 },
        { field: 'duration', headerName: 'Step Name', flex: 1 },
    ];

    const formatRow = () => {
        return rows.map(row => {
            return {
                id: row.step_name,
                step_name: row.step_name,
                status: row.status,
                task_id: row.task_id,
                started_at: getISOString(new Date(row.started_at || 0)),
                finished_at: getISOString(new Date(row.finished_at || 0)),
                duration: formatDuration(row.duration || 0),
                flow_id: row.flow_id,
                run_number: row.run_number,

            }
        })
    }
    
    return ( 
        <>
            {/* Renders the ToolBar component, which contains a set of buttons that allow the user to filter the rows displayed in the actions table */}
            <ToolBar 
                controlledRows={defaultRows} 
                updateRows={updateRows} 
                filters={filters}
                searchColumn={"step_name"}
                style="horizontal"
            />
            {/* Renders either an icon and message indicating that no actions were found, or the VirtualizedTimeline/Table and ContentDrawer components */}
            {rows.length === 0 ? (
                <>
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'center',
                            p: '10rem',
                            gap: '5rem',
                            border: '1px solid lightgray',
                            borderRadius: '0.5rem',
                        }}
                    >
                        <InboxIcon sx={{
                            scale: '5',
                        }}/>
                        <Typography>
                            No actions found
                        </Typography>
                    </Box>
                </>
            ) : (
                <>
                    <TabPanel className='timeline-panel' value={0} sx={{ py: '1rem' }}>
                        <PanelGroup direction="horizontal">
                            <Box 
                                sx={{
                                    display: 'flex',
                                    flexDirection: 'row',
                                    height: '70vh',
                                    overflow: 'auto',
                                    minWidth: '100%',
                                    border: '1px solid lightgray',
                                    borderRadius: '0.5rem',
                                    p:'2rem'
                                }}
                            >
                                <Panel
                                    collapsible={false}
                                    order={1}
                                    minSize={30}
                                >
                                    <ThemeProvider theme={theme}>
                                    <GlobalStyle />
                                        <VirtualizedTimeline run={attempt.run} rows={rows}/>
                                    </ThemeProvider>
                                </Panel>
                                {open && (
                                    <>
                                        <PanelResizeHandle >
                                            <Box
                                                sx={{
                                                    mx: '1rem',
                                                    overflow: 'auto',
                                                    border: '1px solid',
                                                    borderColor: 'divider',
                                                }}
                                                />
                                        </PanelResizeHandle >
                                        <Panel 
                                            collapsible={false} 
                                            order={2}
                                            defaultSize={30}
                                            minSize={30}
                                        >
                                            <ContentDrawer attempt={attempt}/>
                                        </Panel>
                                    </>
                                )}
                            </Box>
                        </PanelGroup> 
                    </TabPanel>
                    <TabPanel className='actions-table-panel' value={1} sx={{ py: '1rem' }}>
                        <PanelGroup direction="horizontal">
                            <Box 
                                sx={{
                                    display: 'flex',
                                    flexDirection: 'row',
                                    minWidth: '100%',
                                    height: '70vh',
                                    border: '1px solid lightgray',
                                    borderRadius: '0.5rem',
                                    p:'2rem'
                                }}
                            >
                                    <Panel
                                        collapsible={false}
                                        order={1}
                                        minSize={30}
                                    >
                                        <DataGrid 
                                            onRowClick={(row) => {
                                                //console.log(row.row);
                                                //console.log(`/workflows/${row.row.flow_id}/${row.row.run_number}/${row.row.task_id}/table/${row.row.step_name}`);
                                                navigate(`/workflows/${row.row.flow_id}/${row.row.run_number}/${row.row.task_id}/table/${row.row.step_name}`)
                                            }}
                                            density={'compact'} 
                                            rows={formatRow()} 
                                            columns={columns} 
                                            autoPageSize
                                        />
                                    </Panel>
                                    {open && (
                                    <>
                                        <PanelResizeHandle >
                                            <Box
                                                sx={{
                                                    mx: '1rem',
                                                    overflow: 'auto',
                                                    border: '1px solid',
                                                    borderColor: 'divider',
                                                }}   
                                            />
                                        </PanelResizeHandle >
                                        <Panel 
                                            collapsible={false} 
                                            order={2} 
                                            defaultSize={30}
                                            minSize={30}
                                        > 
                                            <ContentDrawer attempt={attempt}/>
                                        </Panel>
                                    </>
                                )}
                            </Box>
                        </PanelGroup>
                    </TabPanel>
                    <TabPanel value={2} sx={{ py: '1rem' }}>
                        <b>Lineage</b> tab panel
                    </TabPanel>
                </>
            )}
        </> 
    );
}

/**
 * The TabNav component renders a set of tabs that allow the user to navigate between the timeline, actions table, and lineage panel.
 * @param props {attempt: Attempt, panelOpen?: boolean}
 * @returns JSX.Element
 */
const TabNav = (props : {attempt: Attempt, panelOpen?: boolean}) => {
    const { stepName, tab } = useParams();
    const [value, setValue] = React.useState(tab === 'timeline' ? 0: 1);
    const { attempt, panelOpen } = props;
    const navigate =  useNavigate();

    const handleChange = (_e : any, v: any) => {
        setValue(typeof v === 'number' ? v : 0);
        navigate(`/workflows/${attempt.runInfo.workflowName}/${attempt.runInfo.runId}/${attempt.runInfo.attemptId}/${v === 0 ? 'timeline' : 'table'}`)
        if (stepName) navigate(`/workflows/${attempt.runInfo.workflowName}/${attempt.runInfo.runId}/${attempt.runInfo.attemptId}/${v === 0 ? 'timeline' : 'table'}/${stepName}`)
    }
    return ( 
        <>
            
            <Tabs aria-label="Basic tabs" defaultValue={value} onChange={(e, v) => handleChange(e, v)}>
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'row',
                        mt: '1rem',
                    }}
                >
                    <TabList variant="plain" sx={style}>
                        <Tab>Timeline</Tab>
                        <Tab>Actions table</Tab>
                    </TabList>
                </Box>
                <TabsPanels attempt={attempt} open = {panelOpen}/>
            </Tabs>
        </>
     );
}

const style = {
    '--List-radius': '4px',
    '--ListItem-minHeight': '48px',
    [`& .${tabClasses.root}`]: {
        boxShadow: 'none',
        fontWeight: 'md',
        [`&.${tabClasses.selected}::before`]: {
            content: '""',
            display: 'block',
            position: 'absolute',
            left: '0', // change to `0` to stretch to the edge.
            right: '0', // change to `0` to stretch to the edge.
            bottom: 0,
            height: 3,
            bgcolor: 'primary.500',
        },
    },
}
 
export default TabNav;