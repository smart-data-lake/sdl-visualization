import React from "react";
import { useLocation } from "react-router-dom";
import PageHeader from "../../../layouts/PageHeader";
import RunsHistoryTable from "./WorkflowHistoryTable";

const WorkflowHistory = () => {
    const links = [...useLocation().pathname.split('/')].splice(1);
    const workflowName :  string= links[links.length - 1];
    return (
        <>
            <PageHeader 
                title={workflowName} 
                description={'A run is an execution of the workflow, which execute the subset of actions on the data-objects defined by the workflow.'}
            />
            <RunsHistoryTable workflow={workflowName}/>
        </>   
    );
}
 
export default WorkflowHistory;