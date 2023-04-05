import React, { useState } from "react";
import Tabs from '@mui/joy/Tabs';
import TabList from '@mui/joy/TabList';
import Tab, { tabClasses } from '@mui/joy/Tab';
import TabPanel from '@mui/joy/TabPanel';
import { Box, Input } from "@mui/joy";
import Attempt from "../../utils/Attempt";
import TableOfActions from "./ActionsTable";
import { ThemeProvider } from 'styled-components';
import ContentDrawer from './ContentDrawer';
import { useNavigate, useParams } from 'react-router-dom'
import theme from "../../theme";
import GlobalStyle from "../../GlobalStyle";
import VirtualizedTimeline from "../Timeline/VirtualizedTimeline";
import { Row } from "../../types";

const ToolBar = (props: {rows: Row[], updateRows: (rows: Row[]) => void}) => {
    const { rows, updateRows } = props;

    function handleInput(value: string) {
        const filteredRows = rows.filter((row) => row.step_name.toLowerCase().includes(value.toLowerCase()));
        updateRows(filteredRows);    
    }
  

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'left',
                mt: '2rem',
                mb: '1rem',
                gap: '1rem'
            }}
        >
                <Input
                    placeholder="Search"
                    required
                    sx={{ mb: 1, fontSize: 'var(--joy-fontSize-sm)' }}
                    onChange={(event) => {
                        const { value } = event.target;
                        handleInput(value)
                    }}
                />
        </Box>
    )
}
/**
 * 
 * @param attempt 
 * @param open 
 * @returns This is a TypeScript function that returns a set of three React components which are rendered inside a parent component. The components are displayed inside a tabs UI component and include a timeline of events related to a specific "attempt," a table of available actions related to the attempt, and a placeholder panel for a feature labeled "Lineage." The open prop is optional and can display additional content related to the timeline or table components when truthy.
 */
const TabsPanels = (props : {attempt: Attempt, open?: boolean}) => {
    const { attempt, open } = props;
    const defaultRows = attempt.rows;
    const [rows, setRows] = useState(defaultRows);

    const updateRows = (rows: Row[]) => {
        setRows(rows);
    }

    return ( 
        <>
            <ToolBar rows={defaultRows} updateRows={updateRows}/>
            <TabPanel className='timeline-panel' value={0} sx={{ py: '1rem' }}>
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between'
                    }}
                    >
                    <ThemeProvider theme={theme}>
                    <GlobalStyle />
                        <VirtualizedTimeline run={attempt.run} rows={rows}/>
                    </ThemeProvider>
                    {open && <ContentDrawer attempt={attempt}/>}
                </Box>
            </TabPanel>
            <TabPanel className='actions-table-panel' value={1} sx={{ py: '1rem' }}>
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between'
                    }}
                >
                    <TableOfActions rows={rows}/>
                    {open && <ContentDrawer attempt={attempt}/>}
                </Box>
            </TabPanel>
            <TabPanel value={2} sx={{ py: '1rem' }}>
                <b>Lineage</b> tab panel
            </TabPanel>
            
        </> 
    );
}


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
                        <Tab disabled>Action lineage</Tab>
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