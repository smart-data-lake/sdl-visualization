import React from "react";
import { useLocation } from "react-router-dom";
import PageHeader from "../../../layouts/PageHeader";
import RunsHistoryTable from "./WorkflowHistoryTable";
import { Box } from "@mui/joy";
import ToolBar from "../ToolBar/ToolBar";


/**
 * The WorkflowHistory component is the page that displays the history of a workflow as a table.
 * It allows the user to filter according to different filters/search/sort criteria passed to the ToolBar component.
 * @returns JSX.Element
 */
const WorkflowHistory = () => {
    const links = [...useLocation().pathname.split('/')].splice(1);
    const workflowName :  string= links[links.length - 1];
    return (
        <>
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'row',
                    gap: '3rem',
                }}
            >
                <ToolBar style={'vertical'} controlledRows={[]} updateRows={() => null}/>
                <Box>
                    <PageHeader 
                        title={workflowName} 
                    />
                    <RunsHistoryTable workflow={workflowName}/>

                </Box>
            </Box>
        </>   
    );
}
 
export default WorkflowHistory;