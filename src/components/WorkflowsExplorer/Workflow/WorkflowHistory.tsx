import { useLocation } from "react-router-dom";
import PageHeader from "../../../layouts/PageHeader";
import RunsHistoryTable from "./WorkflowHistoryTable";
import { Box, CircularProgress, Sheet } from "@mui/joy";
import ToolBar from "../ToolBar/ToolBar";
import HistoryBarChart from "../HistoryChart/HistoryBarChart";
import { useFetchWorkflow } from "../../../hooks/useFetchData";
import { durationMicro, getISOString } from "../../../util/WorkflowsExplorer/date";
import { useEffect, useState } from "react";
import { TablePagination } from "@mui/material";
import HistoryAreaChart from "../HistoryChart/HistoryAreaChart";
import HistoryPieChart from "../HistoryChart/HistoryPieChart";
import { DataGrid } from "@mui/x-data-grid";
import { formatDuration } from "../../../util/WorkflowsExplorer/format";


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
    const [toDisplay, setToDisplay] = useState<any[]>(rows);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [count, setCount] = useState(0);
    
    useEffect(() => {
        if (!isLoading) {
            setRows(data[0].runs);
            setCount(rows.length)
        }
    }, [data])

    useEffect(() => {
        setToDisplay(rows.slice(0, rowsPerPage));
        setCount(rows.length)
    }, [rows])

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
        setToDisplay(rows.slice(0, parseInt(event.target.value, 10)));
    }

    const handleChangePage = (event: React.MouseEvent<HTMLButtonElement> | null, newPage: number,) => {
        setPage(newPage);
        setToDisplay(rows.slice(newPage*rowsPerPage, newPage*rowsPerPage + rowsPerPage));
    }

    const updateRows = (rows: any[]) => {
        
        setRows(rows);
    }

    const generateChartData = (data?: any) => {
        const res : {
            value: number,
            status: string,
            name: string,
            runId: number,
            attemptId: number
        }[] = [];

        if (data) {
            data.forEach((run: any) => {
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
        }
        else {
        toDisplay.forEach((run) => {
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
        }
        return res;
    }

    const columns = [
            { field: 'runId', headerName: 'Run ID', flex: 1 },
            { field: 'attemptId', headerName: 'Attempt ID', flex: 1 },
            { field: 'attemptStartTime', headerName: 'Attempt Start Time', flex: 1 },
            { field: 'duration', headerName: 'Duration', flex: 1 },
            { field: 'status', headerName: 'Status', flex: 1 },
    ]

    const formatRows = () => {
        console.log(rows)
        return rows.map((row: any) => {
            return {
                id: row.attemptStartTime,
                runId: row.runId,
                attemptId: row.attemptId,
                attemptStartTime: getISOString(new Date(row.attemptStartTime)),
                duration: formatDuration(durationMicro(row.duration)),
                status: row.status
            };
        })
    }


    const filters = [
        {name: 'Succeeded', fun: (rows: any) => {return rows.filter(row => row.status === 'SUCCEEDED')}},
        /* {name: 'Unknown', fun: (rows: any) => {return rows.filter(row => row.status === 'SKIPPED')}}, */
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
                            width: '100%',
                            flexDirection: 'column',
                            gap: '3rem',
                        }}
                    >
                        <Box
                            sx={{
                                display: 'flex',
                                flexDirection: 'row',
                                justifyContent: 'left',
                                gap: '1rem',
                            }}
                        >
                            <Sheet 
                                sx={{
                                    flexGrow: 1,
                                    maxWidth: '50%',
                                    p: '2rem',
                                    border: '1px solid lightgray',
                                    borderRadius: '0.5rem',
                                }}
                            >
                                <HistoryAreaChart data={generateChartData(rows)}/>
                            </Sheet>
                            <Sheet 
                                sx={{
                                    flexGrow: 1,
                                    maxWidth: '50%',
                                    p: '1rem',
                                    border: '1px solid lightgray',
                                    borderRadius: '0.5rem',
                                }}
                            >
                                <HistoryPieChart data={generateChartData(rows)}/>
                            </Sheet>
                            <Sheet 
                                sx={{
                                    flexGrow: 3,
                                    p: '2rem',
                                    border: '1px solid lightgray',
                                    borderRadius: '0.5rem',
                                }}
                            >
                                <HistoryBarChart data={generateChartData()}/>
                            </Sheet>
                        </Box>
                        <Sheet sx={{width: '100%', height: '60vh'}}>
                            <DataGrid rows={formatRows()} columns={columns}/>
                        </Sheet>
                    </Box>
                </Box>
            </Box>
        </>   
    );
}
{/* <RunsHistoryTable data={toDisplay}/>
<TablePagination
    component="div"
    count={count}
    page={page}
    onPageChange={handleChangePage}
    rowsPerPage={rowsPerPage}
    onRowsPerPageChange={handleChangeRowsPerPage}
/> */}
 
export default WorkflowHistory;