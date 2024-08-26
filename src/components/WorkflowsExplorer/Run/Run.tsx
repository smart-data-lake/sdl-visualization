import { useParams } from "react-router-dom";
import { useFetchRun } from "../../../hooks/useFetchData";
import NotFound from "../../../layouts/NotFound";
import PageHeader from "../../../layouts/PageHeader";
import Attempt, { updateStateFile } from "../../../util/WorkflowsExplorer/Attempt";
import CenteredCircularProgress from "../../Common/CenteredCircularProgress";
import TabNav from "./Tabs";

/**
    The Run component displays information about a specific run of a workflow.
    It uses the useFetchData hook to fetch data from the backend and then passes it to the Attempt class for processing.
    It then renders the page header with the workflow name and run ID and displays a tab navigation component
    that shows details about the run.
    @param {boolean} props.panelOpen - Indicates whether the details panel is open or not.
    @returns {JSX.Element} - The Run component UI.
*/
const Run = () => {
    const {flowId, runNumber, taskId} = useParams();
    const { data, isLoading, isFetching, refetch } = useFetchRun(flowId!, parseInt(runNumber!), parseInt(taskId!));

    if (isLoading || isFetching || !data) return <CenteredCircularProgress/>
    
    const attempt = data.detail ? undefined : new Attempt(updateStateFile(data));
    if (process.env.NODE_ENV === 'development' && data.detail) console.log(data.detail);

    return (
        <>
			{data ? (
				(!data.detail && attempt) ? (
                <>
                    <PageHeader title= {attempt.appName + ': run ' + attempt.runId + ' attempt ' + attempt.attemptId} refresh={refetch} />
                    <TabNav attempt={attempt}/>
                </>
                ): <NotFound errorType={500}/>
            ): <NotFound/>
        }
        </>
    );
}
 
export default Run;
