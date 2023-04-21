import { useLocation } from "react-router-dom";
import PageHeader from "../../../layouts/PageHeader";
import RunsHistoryTable from "./WorkflowHistoryTable";
import { Box, CircularProgress, Sheet } from "@mui/joy";
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
            runId: number,
            attemptId: number
        }[] = [];

        rows.forEach((run) => {
            res.push(
                {
                    value: durationMicro(run.duration),
                    status: run.status,
                    name: getISOString(new Date(run.attemptStartTime)),
                    runId: run.runId,
                    attemptId: run.attemptId    
                }
            )
        });
        return res;
    }

    const filters = [
        {name: 'Succeeded', fun: (rows: any) => {return rows.filter(row => row.status === 'SUCCEEDED')}},
        {name: 'Unknown', fun: (rows: any) => {return rows.filter(row => row.status === 'SKIPPED')}},
        {name: 'Cancelled', fun: (rows: any) => {return rows.filter(row => row.status === 'CANCELLED')}}
    ];

    if (isLoading) return (<CircularProgress/>)

    return (
        <>
            <Box>
                <PageHeader title={workflowName} />
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
                            filters={filters}
                        />
                        <Box
                            sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '3rem',
                            }}
                        >
                            <Sheet 
                                sx={{
                                    p: '2rem',
                                    border: '1px solid lightgray',
                                    borderRadius: '0.5rem',
                                }}
                            >
                                <HistoryChart data={generateChartData()}/>
                                {/* <Example />  */}
                            </Sheet>
                            <Sheet 
                                sx={{
                                    py: '4rem',
                                    p: '2rem',
                                    border: '1px solid lightgray',
                                    borderRadius: '0.5rem',
                                }}
                            >
                                <RunsHistoryTable data={rows}/>
                            </Sheet>
                        </Box>
                </Box>
            </Box>
        </>   
    );
}
 
export default WorkflowHistory;