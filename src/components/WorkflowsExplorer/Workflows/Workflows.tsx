import React from "react";
import PageHeader from "../../../layouts/PageHeader";
import WorkflowsTable from "./WorkflowsTable";
import ToolBar from "../ToolBar/ToolBar";
import { Box } from "@mui/joy";

const Workflows = () => {
    
    return (      
        <>
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'row',
                    gap: '3rem',
                }}
            >
                {/* <ToolBar style={'vertical'} controlledRows={[]} updateRows={() => null}/>
                 */}<Box>
                    <PageHeader 
                        title={'Workflows'} />
                    <WorkflowsTable/>
                </Box>
            </Box>
        </>
    );
}


export default Workflows;