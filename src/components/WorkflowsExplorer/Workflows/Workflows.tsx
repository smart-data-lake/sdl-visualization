import React from "react";
import PageHeader from "../../../layouts/PageHeader";
import WorkflowsTable from "./WorkflowsTable";
import ToolBar from "../ToolBar/ToolBar";
import { Box, Sheet } from "@mui/joy";

const Workflows = () => {
    
    return (      
        <>
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                <PageHeader title={'Workflows'} noBack={true} />
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'row',
                        gap: '3rem',
                    }}
                >
                    <ToolBar style={'vertical'} controlledRows={[]} updateRows={() => null} searchColumn={"name"}/>
                    <Sheet 
                                sx={{
                                    py: '4rem',
                                    p: '2rem',
                                    border: '1px solid lightgray',
                                    borderRadius: '0.5rem',
                                }}
                            >
                    <WorkflowsTable/>
                    </Sheet>
                </Box>
            </Box>
        </>
    );
}


export default Workflows;