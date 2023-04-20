import { useLocation } from "react-router-dom";
import PageHeader from "../../../layouts/PageHeader";
import RunsHistoryTable from "./WorkflowHistoryTable";
import { Box, CircularProgress } from "@mui/joy";
import ToolBar from "../ToolBar/ToolBar";
import HistoryChart from "../HistoryChart/HistoryChart";
import { useFetchWorkflow } from "../../../hooks/useFetchData";
import { durationMicro, getISOString } from "../../../util/WorkflowsExplorer/date";
import { formatDuration } from "../../../util/WorkflowsExplorer/format";
import { useEffect, useState } from "react";


/**
 * The WorkflowHistory component is the page that displays the history of a workflow as a table.
 * It allows the user to filter according to different filters/search/sort criteria passed to the ToolBar component.
 * @returns JSX.Element
 */
const WorkflowHistory = () => {
    const links = [...useLocation().pathname.split('/')].splice(1);
    const workflowName :  string= links[links.length - 1];
    const { data, isLoading } = useFetchWorkflow(workflowName);
    const [rows, setRows] = useState<any[]>([]);

    useEffect(() => {
        if (!isLoading) setRows(data[0].runs);
    }, [data])

    const updateRows = (rows: any[]) => {
        setRows(rows);
    }

    const generateChartData = () => {
        const succeeded : any[] = [];
        const cancelled : any[] = [];
        const categories: any[] = [];

        data[0].runs.forEach((run) => {
            if (run.status === 'CANCELLED') {
                cancelled.push(durationMicro(run.duration));
                succeeded.push(0);
            } else {
                succeeded.push(durationMicro(run.duration));
                cancelled.push(0);
            }    
            categories.push(getISOString(new Date(run.attemptStartTime)));
        });
        return {succeeded, cancelled, categories};
    }

    if (isLoading) return (<CircularProgress/>)

    return (
        <>
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'row',
                    gap: '3rem',
                }}
            >
                    <ToolBar 
                        style={'vertical'} 
                        controlledRows={data[0].runs} 
                        updateRows={updateRows}
                        searchColumn={'runId'}
                    />
                <Box>
                    <PageHeader title={workflowName} />
                    <Box sx={{minWidth: '100%'}}>
                        <HistoryChart data={generateChartData()}/>    
                    </Box>
                    <RunsHistoryTable data={rows}/>
                </Box>
            </Box>
        </>   
    );
}
 
export default WorkflowHistory;