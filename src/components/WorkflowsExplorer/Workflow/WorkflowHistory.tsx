import { useLocation } from "react-router-dom";
import PageHeader from "../../../layouts/PageHeader";
import RunsHistoryTable from "./WorkflowHistoryTable";
import { Box, CircularProgress, Sheet } from "@mui/joy";
import ToolBar from "../ToolBar/ToolBar";
import { useFetchWorkflow } from "../../../hooks/useFetchData";
import { useEffect, useState } from "react";
import { TablePagination } from "@mui/material";
import ChartControl from "../HistoryChart/ChartControl";
import { durationMicro, getISOString } from "../../../util/WorkflowsExplorer/date";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import WorkflowDetails from "./WorkflowDetails";
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

export type Indices = {
    toDisplayLeft: number, 
    toDisplayRight?: number, 
    rangeLeft: number, 
    rangeRight?: number
}

/**
 * The WorkflowHistory component is the page that displays the history of a workflow as a table.
 * It allows the user to filter according to different filters/search/sort criteria passed to the ToolBar component.
 * @returns JSX.Element
*/
const WorkflowHistory = () => {
    const links = [...useLocation().pathname.split('/')].splice(1);
    const workflowName :  string= links[links.length - 1];
    const { data, isLoading, isFetching } = useFetchWorkflow(workflowName);
    const [rows, setRows] = useState<any[]>([]);
    const [toDisplay, setToDisplay] = useState<any[]>(rows);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    const [count, setCount] = useState(0);
    const [barChartData, setBarChartData] = useState<any[]>([])
    const [areaChartData, setAreaChartData] = useState<any[]>([])
    const [indices, setIndices] = useState<Indices>({toDisplayLeft: 0, toDisplayRight: rowsPerPage, rangeLeft: 0})
    const [open, setOpen] = useState<Boolean>(true)
    
    useEffect(() => {
        if (!isLoading) {
            updateRows(data.runs);
            setCount(rows.length)
            setAreaChartData(generateChartData(data.runs))
        }
    }, [data])
    
    useEffect(() => {
        setToDisplay(rows.slice(0, rowsPerPage));
        setCount(rows.length)
        setIndices({toDisplayLeft: page*rowsPerPage, toDisplayRight: (page+1)*rowsPerPage, rangeLeft: indices.rangeLeft, rangeRight: indices?.rangeRight})
    }, [rows])

    useEffect(() => {
        setBarChartData(generateChartData(toDisplay))
    }, [toDisplay])
    
    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
        setToDisplay(rows.slice(0, parseInt(event.target.value, 10)));
    }
    
    const handleChangePage = (event: React.MouseEvent<HTMLButtonElement> | null, newPage: number,) => {
        setPage(newPage);
        setToDisplay(rows.slice(newPage*rowsPerPage, newPage*rowsPerPage + rowsPerPage));
        setIndices({toDisplayLeft: page*rowsPerPage, toDisplayRight: (page+1)*rowsPerPage, rangeLeft: indices.rangeLeft, rangeRight: indices?.rangeRight})
    }

    const updateRows = (rows: any[]) => {
        setRows(rows.sort(cmp));
    }

    const cmp = (a: any, b: any) => {
        return new Date(b.attemptStartTime).getTime() - new Date(a.attemptStartTime).getTime();
    }

    const generateChartData = (data: any) => {
        const res : {
            value: number,
            status: string,
            name: string,
            runId: number,
            attemptId: number
        }[] = [];
    
        
        data.forEach((run) => {
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
        {name: 'Running', fun: (rows: any) => {return rows.filter(row => row.status === 'RUNNING')}},
        {name: 'Cancelled', fun: (rows: any) => {return rows.filter(row => row.status === 'CANCELLED')}}
    ];

    if (isLoading || isFetching) return (<CircularProgress/>)

    return (
        <>
            <PageHeader title={workflowName} />             
            <Sheet
                sx={{
                    display: 'flex',
                    gap: '1rem',
                    height: '85vh'
                }}
                >
                        <Sheet
                            sx={{
                                py: '1rem',
                                pr: '1rem',
                                borderRight: '1px solid lightgray',
                                flex: 3
                            }}
                        >
                            <ChartControl rows={barChartData} data={areaChartData} indices={indices}/>
                            <ToolBar 
                                style={'horizontal'} 
                                controlledRows={data.runs} 
                                updateRows={updateRows}
                                searchColumn={'runId'}
                                filters={filters}
                                />
                            <Sheet sx={{
                                    width: '100%',
                                    height: '57vh',
                                    overflowY: 'scroll', 
                                }}
                            >
                                <RunsHistoryTable data={toDisplay}/>
                                <TablePagination
                                    component="div"
                                    count={count}
                                    page={page}
                                    onPageChange={handleChangePage}
                                    rowsPerPage={rowsPerPage}
                                    onRowsPerPageChange={handleChangeRowsPerPage}
                                    /> 
                            </Sheet>
                        </Sheet>
                    {open && (
                                   
                        <Sheet
                            sx={{
                                flex: 1,
                                height: '10%',
                                pt: '2rem',
                                pl: '2rem',
                            }}
                        >
                            <WorkflowDetails data={data}/>
                        </Sheet>
                    )}
            </Sheet>
        </>   
    );
}
 
export default WorkflowHistory;