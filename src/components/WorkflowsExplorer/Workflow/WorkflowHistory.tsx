import React from "react";
import { useLocation } from "react-router-dom";
import PageHeader from "../../../layouts/PageHeader";
import RunsHistoryTable from "./WorkflowHistoryTable";
import { Box } from "@mui/joy";
import ToolBar from "../ToolBar/ToolBar";

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