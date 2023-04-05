import React from "react";
import PageHeader from "../../utils/PageHeader";
import WorkflowsTable from "./WorkflowsTable";

const Workflows = () => {
    return (      
        <>
            <PageHeader 
                title={'Workflows'} 
                description={'Workflows are specified sets of SLDB actions to be run. They represent a specific pipeline used in the project'}
            />
            <WorkflowsTable/>
        </>
    );
}


export default Workflows;