import { useLocation, useNavigate } from "react-router-dom";
import PageHeader from "../../../layouts/PageHeader";
import RunsHistoryTable from "./WorkflowHistoryTable";
import { Box, CircularProgress, Sheet } from "@mui/joy";
import ToolBar from "../ToolBar/ToolBar";
import HistoryBarChart from "../HistoryChart/HistoryBarChart";
import { api, useFetchWorkflow } from "../../../hooks/useFetchData";
import { durationMicro, getISOString } from "../../../util/WorkflowsExplorer/date";
import { useEffect, useState } from "react";
import { TablePagination } from "@mui/material";
import HistoryAreaChart from "../HistoryChart/HistoryAreaChart";
import HistoryPieChart from "../HistoryChart/HistoryPieChart";
import { DataGrid, GridToolbar, gridPaginatedVisibleSortedGridRowIdsSelector, useGridApiRef } from "@mui/x-data-grid";
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
    const currURL = useLocation().pathname;
    const navigate = useNavigate();
    const apiRef = useGridApiRef();
    
    useEffect(() => {
        if (!isLoading) {
            updateRows(data[0].runs);
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
        setRows(rows.sort((a, b) => {
            return new Date(b.attemptStartTime).getTime() - new Date(a.attemptStartTime).getTime();
        }));
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
        {name: 'Running', fun: (rows: any) => {return rows.filter(row => row.status === 'RUNNING')}},
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
                            width: '100%',
                            flexDirection: 'column',
                            gap: '1rem',
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
                                    flex: 1,
                                    display: 'flex',
                                    flexDirection: 'row',
                                    justifyContent: 'space-around',
                                    borderBottom: '1px solid lightgrey',
                                    py: '1rem',
                                }}
                            >
                                <HistoryBarChart data={generateChartData()}/>
                                <HistoryAreaChart data={generateChartData(rows)}/>
                            </Sheet>
                        </Box>
                        <ToolBar 
                        style={'horizontal'} 
                        controlledRows={data[0].runs} 
                        updateRows={updateRows}
                        searchColumn={'runId'}
                        filters={filters}
                    />
                        <Sheet sx={{width: '100%'}}>
                            <RunsHistoryTable data={toDisplay}/>
                            <TablePagination
                                component="div"
                                count={count}
                                page={page}
                                onPageChange={handleChangePage}
                                rowsPerPage={rowsPerPage}
                                onRowsPerPageChange={handleChangeRowsPerPage}
                            /> 
                            {/* <DataGrid 
                                apiRef={apiRef}
                                density={'compact'} 
                                rows={formatRows()} 
                                columns={columns} 
                                onRowClick={(row) => navigate(currURL + '/' + row.row.runId + '/' + row.row.attemptId + '/timeline')}
                                pageSizeOptions={[10, 15, 25]}
                                initialState={{
                                    sorting: {
                                      sortModel: [{ field: 'runId', sort: 'desc' }],
                                    },
                                    pagination: { paginationModel: { pageSize: 15 } },
                                }}
                            /> */}
                        </Sheet>
                    </Box>
                </Box>
        </>   
    );
}
 
export default WorkflowHistory;