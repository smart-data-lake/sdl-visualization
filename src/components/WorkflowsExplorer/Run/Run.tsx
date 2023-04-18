import { useFetchRun } from "../../../hooks/useFetchData";
import Attempt from "../../../util/WorkflowsExplorer/Attempt";
import TabNav from "./Tabs";
import { useLocation } from "react-router-dom";
import PageHeader from "../../../layouts/PageHeader";
import randomStateFile from "../../../util/WorkflowsExplorer/randomStateFile";

/**
    The Run component displays information about a specific run of a workflow.
    It uses the useFetchData hook to fetch data from the backend and then passes it to the Attempt class for processing.
    It then renders the page header with the workflow name and run ID and displays a tab navigation component
    that shows details about the run.
    @param {boolean} props.panelOpen - Indicates whether the details panel is open or not.
    @returns {JSX.Element} - The Run component UI.
*/
const Run = (props : {panelOpen?: boolean}) => {
    const links = [...useLocation().pathname.split('/')].splice(1);
    console.log(links[1], parseInt(links[2]), parseInt(links[3]))
    const { data, isLoading } = useFetchRun(links[1], parseInt(links[2]), parseInt(links[3]));
    if (!isLoading) console.log(data)

    const render = () => {
        const attempt = new Attempt(data[0]);
        return (
            <>
                <PageHeader title= {attempt.runInfo.workflowName + ': run ' + attempt.runInfo.runId} />
                {/* <RunDetails attempt={attempt}/> */}
                <TabNav attempt={attempt} panelOpen={props.panelOpen}/>
            </>
        )
    }

    return ( 
        <>
            {!isLoading && render()}
        </>
     );
}
 
export default Run;
