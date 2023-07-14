import { useFetchRun } from "../../../hooks/useFetchData";
import Attempt from "../../../util/WorkflowsExplorer/Attempt";
import TabNav from "./Tabs";
import { useLocation } from "react-router-dom";
import PageHeader from "../../../layouts/PageHeader";
import { CircularProgress } from "@mui/joy";
import { displayProps } from "../../ConfigExplorer/DataDisplayView";
import NotFound from "../../../layouts/NotFound";

/**
    The Run component displays information about a specific run of a workflow.
    It uses the useFetchData hook to fetch data from the backend and then passes it to the Attempt class for processing.
    It then renders the page header with the workflow name and run ID and displays a tab navigation component
    that shows details about the run.
    @param {boolean} props.panelOpen - Indicates whether the details panel is open or not.
    @returns {JSX.Element} - The Run component UI.
*/
const Run = (props : {panelOpen?: boolean, configData: displayProps}) => {
    const links = [...useLocation().pathname.split('/')].splice(1);
    const { data, isLoading, isFetching } = useFetchRun(links[1], parseInt(links[2]), parseInt(links[3]));

    if (isLoading || isFetching) return <CircularProgress/>
    
    const attempt = data.detail ? undefined : new Attempt(data);
    if (process.env.NODE_ENV === 'development' && data.detail) console.log(data.detail);

    return (
        <>
			{data ? (
				(!data.detail && attempt) ? (
                <>
                    <PageHeader title= {attempt.runInfo.workflowName + ': run ' + attempt.runInfo.runId} />
                    {/* <RunDetails attempt={attempt}/> */}
                    <TabNav attempt={attempt} panelOpen={props.panelOpen} configData={props.configData}/>
                </>
                ):(
                    <>
                        <NotFound errorType={500}/>
                    </>
                )
            ):(
                <>
                    <NotFound/>
                </>
            )
        }
        </>
    );
}
 
export default Run;
