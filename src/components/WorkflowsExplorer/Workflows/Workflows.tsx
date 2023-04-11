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
                    gap: 10,
                }}
            >
                <ToolBar style={'vertical'} controlledRows={[]} updateRows={() => null}/>
                <Box>
                    <PageHeader 
                        title={'Workflows'} 
                        description={'Workflows are specified sets of SLDB actions to be run. They represent a specific pipeline used in the project'}
                        />
                    <WorkflowsTable/>
                </Box>
            </Box>
        </>
    );
}


export default Workflows;