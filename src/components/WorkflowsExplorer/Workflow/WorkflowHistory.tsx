import { useLocation } from "react-router-dom";
import PageHeader from "../../../layouts/PageHeader";
import RunsHistoryTable from "./WorkflowHistoryTable";
import { Box, CircularProgress } from "@mui/joy";
import ToolBar from "../ToolBar/ToolBar";
import HistoryChart from "../HistoryChart/HistoryChart";
import { useFetchWorkflow } from "../../../hooks/useFetchData";
import { durationMicro, getISOString } from "../../../util/WorkflowsExplorer/date";

import { useEffect, useState } from "react";
import Example from "../HistoryChart/Example";


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
        const res : {
            value: number,
            status: string,
            name: string,
        }[] = [];

        rows.forEach((run) => {
            res.push(
                {
                    value: durationMicro(run.duration),
                    status: run.status,
                    name: getISOString(new Date(run.attemptStartTime)),
                }
            )
        });
        return res;
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
                        {/* <Example />  */}
                    </Box>
                    <RunsHistoryTable data={rows}/>
                </Box>
            </Box>
        </>   
    );
}
 
export default WorkflowHistory;