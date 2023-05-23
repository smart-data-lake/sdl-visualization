import React, { useState } from "react";
import Tabs from '@mui/joy/Tabs';
import TabList from '@mui/joy/TabList';
import Tab, { tabClasses } from '@mui/joy/Tab';
import TabPanel from '@mui/joy/TabPanel';
import { Box, Button, IconButton, Sheet, Typography } from "@mui/joy";
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
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import StartIcon from '@mui/icons-material/Start';
import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import KeyboardDoubleArrowLeftIcon from '@mui/icons-material/KeyboardDoubleArrowLeft';
import KeyboardDoubleArrowRightIcon from '@mui/icons-material/KeyboardDoubleArrowRight';
import { checkFiltersAvailability, defaultFilters } from "../../../util/WorkflowsExplorer/StatusInfo";

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

    /**
   * Updates the rows displayed in the table of actions.
   *
   * @param {Row[]} rows - The updated array of rows
   * @returns void
   */
    const updateRows = (rows: Row[]) => {
        setRows(rows);
    }
    
    return ( 
        <>
            {/* Renders the ToolBar component, which contains a set of buttons that allow the user to filter the rows displayed in the actions table */}
            <Sheet
                sx={{
                    py: '1rem',
                    my: '1.2rem',
                    position: 'sticky',
                    borderRadius: '0.5rem',
                }}
            >
                <ToolBar 
                    controlledRows={defaultRows} 
                    updateRows={updateRows} 
                    filters={checkFiltersAvailability(defaultRows, defaultFilters())}
                    sortEnabled={true}
                    searchColumn={"step_name"}
                    searchPlaceholder="Search by action name"
                    style="horizontal"
                    />
                    {/* <Sheet sx={{borderBottom: '1px solid lightgray', mb: '1rem', mt: '1.5rem'}}/> */}
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
                        height: '67vh',
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
                        <Sheet 
                            sx={{
                                display: 'flex',
                                gap: '0.5rem',
                                height: '70vh',
                                position: 'relative',  
                                
                            }}
                        >
                                <ThemeProvider theme={theme}>
                                <GlobalStyle />
                                    <Sheet
                                        sx={{
                                            flex: '1',
                                            width: '99%',
                                            position: 'absolute', 
                                            top: 0,
                                            left: 0,
                                            backgroundColor: open ? 'primary.main' : 'none',
                                            opacity: open ? [0.5, 0.5, 0.5] : [],
                                            transition: 'opacity 0.2s ease-in-out',
                                            cursor: 'context-menu'
                                        }}
                                    >
                                        <VirtualizedTimeline run={attempt.run} rows={rows}/>
                                    </Sheet>
                                </ThemeProvider>
                            {open && (
                                <>
                                    {/* <Sheet sx={{borderLeft: '1px solid lightgray', ml: '2rem', mr: '1rem'}}/> */}
                                    <Sheet
                                        sx={{
                                            flex: '1', 
                                            maxWidth: '50%',
                                            position: 'absolute',
                                            top: 0,
                                            left: '50%',
                                            boxShadow: '-10px 8px 10px lightgray',
                                            borderLeft: open ? '1px solid lightgray' : 'none',
                                            borderRadius: '1rem',
                                        }}
                                    >
                                        <ContentDrawer attempt={attempt}/>
                                    </Sheet>
                                </>
                            )}
                        </Sheet> 
                    </TabPanel>
                    <TabPanel className='actions-table-panel' value={1} sx={{ py: '1rem' }}>
                        <Sheet 
                            sx={{
                                gap: '0.5rem',
                                height: '70vh',
                                position: 'relative',
                                display: 'flex',
                            }}
                        >

                            <Sheet
                                sx={{
                                    overflowY: 'scroll',
                                    position: 'absolute',
                                    flex: '1', 
                                    height: '70vh',
                                    top: 0,
                                    left: 0,
                                    backgroundColor: open ? 'primary.main' : 'none',
                                    opacity: open ? [0.5, 0.5, 0.5] : [],
                                    transition: 'opacity 0.2s ease-in-out',
                                }}
                            >
                                <TableOfActions rows={rows}/>
                            </Sheet>
                            {open && (
                                <>
                                    {/* <Sheet sx={{borderLeft: '1px solid lightgray', ml: '2rem', mr: '1rem'}}/> */}
                                    <Sheet
                                        sx={{
                                            maxWidth: '50%',
                                            position: 'absolute',
                                            top: 0,
                                            left: '50%',
                                            boxShadow: '-10px 8px 10px lightgray',
                                            borderLeft: open ? '1px solid lightgray' : 'none',
                                            borderRadius: '1rem',
                                        }}
                                        >
                                        <ContentDrawer attempt={attempt}/>
                                    </Sheet>
                                </>
                            )}
                        </Sheet>
                    </TabPanel>
                    <TabPanel value={2} sx={{ py: '1rem' }}>
                        <b>Lineage</b> tab panel
                    </TabPanel>
                </Sheet>
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
    const [openLineage, setOpenLineage] = useState<boolean>(false);
    const { attempt, panelOpen } = props;
    const navigate =  useNavigate();

    const handleChange = (_e : any, v: any) => {
        setValue(typeof v === 'number' ? v : 0);
        navigate(`/workflows/${attempt.runInfo.workflowName}/${attempt.runInfo.runId}/${attempt.runInfo.attemptId}/${v === 0 ? 'timeline' : 'table'}`)
        if (stepName) navigate(`/workflows/${attempt.runInfo.workflowName}/${attempt.runInfo.runId}/${attempt.runInfo.attemptId}/${v === 0 ? 'timeline' : 'table'}/${stepName}`)
    }
    return ( 
        <Sheet sx={{display: 'flex', height: '100vh'}}>
            <Sheet 
                sx={{
                    flex: 3,
                }}
            >
                <Tabs aria-label="Basic tabs" defaultValue={value} onChange={(e, v) => handleChange(e, v)}>
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: 'row',
                            mt: '1rem',
                            justifyContent: 'space-between',
                        }}
                        >
                        <TabList variant="plain" sx={style}>
                            <Tab>Timeline</Tab>
                            <Tab>Actions table</Tab>
                        </TabList>
                        {!openLineage ?
                            (
                                <IconButton color={'primary'} size="md" variant="soft" sx={{ml: '1rem', px: '1rem', scale: '90%', border: '1px solid'}} onClick={() => setOpenLineage(!openLineage)}>
                                    Open lineage
                                    <KeyboardDoubleArrowLeftIcon  sx={{ml: '0.5rem', scale: '70%'}}/>
                                </IconButton>
                            ) : (
                                <IconButton color={'primary'} size="md" variant="soft" sx={{ml: '0.5rem', px: '0.5rem', scale: '90%', border: '1px solid'}} onClick={() => setOpenLineage(!openLineage)}>
                                    Close lineage
                                    <KeyboardDoubleArrowRightIcon  sx={{ml: '0.5rem', scale: '70%'}}/>
                                </IconButton>
                            )
                        }
                    </Box>
                    <TabsPanels attempt={attempt} open = {panelOpen}/>
                </Tabs>
            </Sheet>
            {openLineage && (
                <>
                    <Sheet sx={{borderLeft: '1px solid lightgray', mx: '1rem'}}/>
                    <Sheet sx={{width: '50%', flex: 3}}>
                        Hey
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