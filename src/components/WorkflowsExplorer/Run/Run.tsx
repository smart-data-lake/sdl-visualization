import { useParams } from "react-router-dom";
import { useFetchRun, useFetchWorkflowRuns } from "../../../hooks/useFetchData";
import { useUser } from "../../../hooks/useUser";
import { useWorkspace } from "../../../hooks/useWorkspace";
import NotFound from "../../../layouts/NotFound";
import PageHeader from "../../../layouts/PageHeader";
import { compareMultiFunc } from "../../../util/helpers";
import Attempt, { isRunning, updateStateFile } from "../../../util/WorkflowsExplorer/Attempt";
import CenteredCircularProgress from "../../Common/CenteredCircularProgress";
import TabNav from "./Tabs";
import { useQueryClient } from "react-query";
import { Sheet } from "@mui/joy";
import { useMemo } from "react";
import { useLiveWorkflowUpdates } from "../../../hooks/useLiveWorkflowUpdates";

/**
    The Run component displays information about a specific run of a workflow.
    It uses the useFetchData hook to fetch data from the backend and then passes it to the Attempt class for processing.
    It then renders the page header with the workflow name and run ID and displays a tab navigation component
    that shows details about the run.
    @param {boolean} props.panelOpen - Indicates whether the details panel is open or not.
*/
const Run = () => {
    const {flowId, runIdAttempt} = useParams();
    const [runId,attemptNb] = runIdAttempt!.split(".").map(x => parseInt(x));
    const userContext = useUser();
    const enabled = !userContext || userContext.authenticated;
    const { data, isLoading, refetch } = useFetchRun(flowId!, runId!, attemptNb!, enabled);
	const { data: runs } = useFetchWorkflowRuns(flowId!, enabled);
	const {navigateContent} = useWorkspace();
    const queryClient = useQueryClient();
    const live = useLiveWorkflowUpdates(flowId, enabled, !!data && isRunning(data));
    const attempt = useMemo(() => data ? new Attempt(updateStateFile(data)) : undefined, [data]);

    // only the first load: a refetch keeps showing the attempt until the new state arrives
    if (isLoading) return <CenteredCircularProgress/>
    
	function refreshData() {
		refetch();
		queryClient.invalidateQueries(["workflow", flowId]);        
		queryClient.invalidateQueries(["workflows"]);
	}

    var prevNavigate: any = undefined;
    var nextNavigate: any = undefined;
    if (Array.isArray(runs)) {
        const sortedRuns = runs.sort(compareMultiFunc(["runId","attemptId"]));
        const prevLink = sortedRuns.findLast(r => (r.runId == runId && r.attemptId < attemptNb) || r.runId < runId);
        if (prevLink) prevNavigate = () => navigateContent(`workflows/${flowId}/${prevLink.runId}.${prevLink.attemptId}`);
        const nextLink = sortedRuns.find(r => (r.runId == runId && r.attemptId > attemptNb) || r.runId > runId);
        if (nextLink) nextNavigate = () => navigateContent(`workflows/${flowId}/${nextLink.runId}.${nextLink.attemptId}`);
    }

    return (
		<Sheet sx={{ display: 'flex', flexDirection: 'column', p: '0.1rem 1rem', gap: '1rem', width: '100%', height: '100%' }}>
            <PageHeader title= {(attempt? flowId + ': ' : '') + 'run ' + runId + ' attempt ' + attemptNb} enablePrevNext={true} prevNavigate={prevNavigate} nextNavigate={nextNavigate} refresh={refreshData} live={live} />
            {attempt ? <TabNav attempt={attempt}/> : <NotFound errorType={500} errorMessage={'run ' + runId + ' attempt ' + attemptNb + " not found!"}/>}
        </Sheet>    
    );
}
 
export default Run;
