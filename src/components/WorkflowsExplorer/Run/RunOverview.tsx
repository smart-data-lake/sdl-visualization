import useFetchData from "../../../hooks/useFetchData";
import Attempt from "../../../util/WorkflowsExplorer/Attempt";
import TabNav from "./Tabs";
import RunDetails from "./RunDetails"
import { useLocation } from "react-router-dom";
import PageHeader from "../../../util/WorkflowsExplorer/PageHeader";
import React from "react";

const RunOverview = (props : {panelOpen?: boolean}) => {
    const links = [...useLocation().pathname.split('/')].splice(1);
    const data  = useFetchData(links[1] + '/' + links[2]);
    
    const render = () => {
        const attempt = new Attempt(data.run);
        return (
            <>
                <PageHeader title= {attempt.runInfo.workflowName + ': run ' + attempt.runInfo.runId} />
                <RunDetails attempt={attempt}/>
                <TabNav attempt={attempt} panelOpen={props.panelOpen}/>
            </>
        )
    }

    return ( 
        <>
            {data && render()}
        </>
     );
}
 
export default RunOverview;
