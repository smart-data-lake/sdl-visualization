import InboxIcon from '@mui/icons-material/Inbox';
import KeyboardDoubleArrowLeftIcon from '@mui/icons-material/KeyboardDoubleArrowLeft';
import KeyboardDoubleArrowRightIcon from '@mui/icons-material/KeyboardDoubleArrowRight';
import { Box, IconButton, Sheet, Typography } from "@mui/joy";
import Tab, { tabClasses } from '@mui/joy/Tab';
import TabList from '@mui/joy/TabList';
import TabPanel from '@mui/joy/TabPanel';
import Tabs from '@mui/joy/Tabs';
import React, { useState } from "react";
import { ReactFlowProvider } from "react-flow-renderer";
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import GlobalStyle from "../../../GlobalStyle";
import theme from "../../../theme";
import { Row } from "../../../types";
import Attempt from "../../../util/WorkflowsExplorer/Attempt";
import { checkFiltersAvailability, defaultFilters } from "../../../util/WorkflowsExplorer/StatusInfo";
import LineageTab from "../../ConfigExplorer/LineageTab";
import VirtualizedTimeline from "../Timeline/VirtualizedTimeline";
import ToolBar from "../ToolBar/ToolBar";
import TableOfActions from "./ActionsTable";
import ContentDrawer from './ContentDrawer';

import DraggableDivider from "../../../layouts/DraggableDivider";
import { DAGraph } from "../../../util/ConfigExplorer/Graphs";
import { Lineage } from "../../../util/WorkflowsExplorer/Lineage";

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
const TabsPanels = (props: { attempt: Attempt, open?: boolean }) => {
    const { attempt, open } = props;
    const defaultRows = attempt.rows;
    const [rows, setRows] = useState<Row[]>(defaultRows);
    const [checked, setChecked] = useState([
        { name: 'Execution', checked: true },
        { name: 'Initialized', checked: false },
        { name: 'Prepared', checked: false }
    ]);
    const navigate = useNavigate();
    const location = useLocation().pathname;

    /**
   * Updates the rows displayed in the table of actions.
   *
   * @param {Row[]} rows - The updated array of rows
   * @returns void
   */
    const updateRows = (rows: Row[]) => {
        setRows(rows);
    }

    const updateChecked = (checked: { name: string; checked: boolean; }[]) => {
        setChecked(checked);
    }

    return (
        <Sheet sx={{ display: 'flex', height: '100%' }}>
            <Sheet sx={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Renders the ToolBar component, which contains a set of buttons that allow the user to filter the rows displayed in the actions table */}
                <Sheet sx={{ py: '1rem', my: '1.2rem', position: 'sticky', top: '0', borderRadius: '0.5rem' }}>
                    <ToolBar
                        controlledRows={defaultRows}
                        updateRows={updateRows}
                        filters={checkFiltersAvailability(defaultRows, defaultFilters())}
                        sortEnabled={true}
                        searchColumn={"step_name"}
                        searchPlaceholder="Search by action name"
                        searchMode="contains"
                        updateChecked={attempt.runInfo.runStateFormatVersion && attempt.runInfo.runStateFormatVersion > 1 ? updateChecked : undefined}
                    />

                </Sheet>
                {/* Renders either an icon and message indicating that no actions were found, or the VirtualizedTimeline/Table and ContentDrawer components */}
                {rows.length === 0 ? (
                    <Sheet
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'center',
                            mt: '1rem',
                            p: '10rem',
                            gap: '5rem',
                            border: '1px solid lightgray',
                            borderRadius: '0.5rem',
                            height: '100%',
                        }}
                    >
                        <InboxIcon
                            color="disabled"
                            sx={{
                                scale: '5',
                            }}
                        />
                        <Typography>
                            No actions found
                        </Typography>
                    </Sheet>
                ) : (
                    <Sheet>
                        <TabPanel className='timeline-panel' value={0} sx={{ py: '1rem' }}>
                            <Sheet sx={{ display: 'flex', gap: '0.5rem', height: '100%', position: 'relative',}} >
                                <ThemeProvider theme={theme}>
                                    <GlobalStyle />
                                    <Sheet
                                        onClick={() => {
                                            if (open) {
                                                navigate(`${location.split('timeline')[0]}timeline`);
                                            }
                                        }}
                                        sx={{
                                            flex: '1',
                                            width: '99%',
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            backgroundColor: open ? 'primary.main' : 'none',
                                            opacity: open ? [0.4, 0.4, 0.4] : [],
                                            transition: 'opacity 0.2s ease-in-out',
                                            cursor: 'context-menu'
                                        }}
                                    >
                                        <Sheet
                                            sx={{
                                                gap: '0.5rem',
                                                height: '69vh',
                                                display: 'flex',
                                            }}
                                        >

                                            <VirtualizedTimeline run={attempt.run} rows={rows} displayPhases={checked} />
                                        </Sheet>
                                    </Sheet>
                                </ThemeProvider>
                            </Sheet>
                        </TabPanel>
                        <TabPanel className='actions-table-panel' value={1} sx={{ py: '1rem' }}>
                            <Sheet
                                sx={{
                                    gap: '0.5rem',
                                    height: '69vh',
                                    display: 'flex',
                                    overflowY: 'scroll'
                                }}
                            >

                                <Sheet
                                    onClick={() => {
                                        if (open) {
                                            navigate(`${location.split('table')[0]}table`);
                                        }
                                    }}
                                    sx={{
                                        height: '100%',
                                        top: 0,
                                        left: 0,
                                        backgroundColor: open ? 'primary.main' : 'none',
                                        opacity: open ? [0.4, 0.4, 0.4] : [],
                                        transition: 'opacity 0.2s ease-in-out',
                                        cursor: 'context-menu'
                                    }}
                                >
                                    <TableOfActions rows={rows} />
                                </Sheet>
                            </Sheet>
                        </TabPanel>
                        <TabPanel value={2} sx={{ py: '1rem' }}>
                            <b>Lineage</b> tab panel
                        </TabPanel>
                    </Sheet>
                )}
            </Sheet>
            {open && (
                <>
                    {/* <Sheet sx={{borderLeft: '1px solid lightgray', ml: '2rem', mr: '1rem'}}/> */}
                    <Sheet
                        sx={{
                            position: 'absolute',
                            top: 0,
                            height: '80vh',
                            left: '50%',
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: '-10px 30px 20px lightgray',
                            p: '1rem'
                        }}
                    >
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
    const [value, setValue] = React.useState(tab === 'timeline' ? 0 : 1);
    const [openLineage, setOpenLineage] = useState<boolean>(false);
    const [lineageWidth, setLineageWidth] = React.useState(500);
    const lineageRef = React.useRef<HTMLDivElement>(null);
    const { attempt, panelOpen } = props;
    const navigate = useNavigate();

    const handleChange = (_e: any, v: any) => {
        setValue(typeof v === 'number' ? v : 0);
        navigate(`/workflows/${attempt.runInfo.workflowName}/${attempt.runInfo.runId}/${attempt.runInfo.attemptId}/${v === 0 ? 'timeline' : 'table'}`)
        if (stepName) navigate(`/workflows/${attempt.runInfo.workflowName}/${attempt.runInfo.runId}/${attempt.runInfo.attemptId}/${v === 0 ? 'timeline' : 'table'}/${stepName}`)
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
            <Sheet
                sx={{
                    flex: 1,
                    height: '100%',
                }}
            >
                <Tabs aria-label="Basic tabs" defaultValue={value} onChange={(e, v) => handleChange(e, v)} >
                    <Box
                        sx={{
                            display: 'flex',
                            flex: 1,
                            mt: '1rem',
                            justifyContent: 'space-between'
                        }}
                    >
                        <TabList variant="plain" sx={style}>
                            <Tab>Timeline</Tab>
                            <Tab>Actions table</Tab>
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
                    <TabsPanels attempt={attempt} open={panelOpen} />
                </Tabs>
            </Sheet>
            {openLineage && (
                <>
                    <DraggableDivider setWidth={setLineageWidth} cmpRef={lineageRef} isRightCmp={true} />
                    <Sheet sx={{ width: lineageWidth }} ref={lineageRef}>
                        <ReactFlowProvider>
                            <LineageTab graph={graph} elementName="" elementType="" />
                        </ReactFlowProvider>
                    </Sheet>
                </>
            )}
        </Sheet>
    );
}

const style = {
    '--List-radius': '12px',
    '--ListItem-minHeight': '32px',
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
            height: 2,
            bgcolor: 'primary.500',
        },
    },
}

export default TabNav;