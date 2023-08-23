import { CircularProgress } from "@mui/joy";
import { useParams } from "react-router-dom";
import { useFetchRun } from "../../../hooks/useFetchData";
import NotFound from "../../../layouts/NotFound";
import PageHeader from "../../../layouts/PageHeader";
import Attempt from "../../../util/WorkflowsExplorer/Attempt";
import TabNav from "./Tabs";

/**
    The Run component displays information about a specific run of a workflow.
    It uses the useFetchData hook to fetch data from the backend and then passes it to the Attempt class for processing.
    It then renders the page header with the workflow name and run ID and displays a tab navigation component
    that shows details about the run.
    @param {boolean} props.panelOpen - Indicates whether the details panel is open or not.
    @returns {JSX.Element} - The Run component UI.
*/
const Run = (props : {panelOpen?: boolean}) => {
    const {flowId, runNumber, taskId} = useParams();
    const { data, isLoading, isFetching, refetch } = useFetchRun(flowId!, parseInt(runNumber!), parseInt(taskId!));

    if (isLoading || isFetching) return <CircularProgress/>
    
    const attempt = data.detail ? undefined : new Attempt(data);
    if (process.env.NODE_ENV === 'development' && data.detail) console.log(data.detail);

    return (
        <>
			{data ? (
				(!data.detail && attempt) ? (
                <>
                    <PageHeader title= {attempt.runInfo.workflowName + ': run ' + attempt.runInfo.runId} refresh={refetch} />
                    {/* <RunDetails attempt={attempt}/> */}
                    <TabNav attempt={attempt} panelOpen={props.panelOpen}/>
                </>
                ): <NotFound errorType={500}/>
            ): <NotFound/>
        }
        </>
    );
}
 
export default Run;
