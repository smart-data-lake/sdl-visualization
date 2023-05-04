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
import { Panel, PanelGroup } from "react-resizable-panels";


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
    const [rowsPerPage, setRowsPerPage] = useState(15);
    const [count, setCount] = useState(0);
    const [barChartData, setBarChartData] = useState<any[]>([])
    const [areaChartData, setAreaChartData] = useState<any[]>([])
    
    useEffect(() => {
        if (!isLoading) {
            updateRows(data[0].runs);
            setCount(rows.length)
            setAreaChartData(generateChartData(data[0].runs))
        }
    }, [data])
    
    useEffect(() => {
        setToDisplay(rows.slice(0, rowsPerPage));
        setCount(rows.length)
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

    if (isLoading) return (<CircularProgress/>)


    return (
        <>
            <PageHeader title={workflowName} />             
            <Sheet
                sx={{
                    display: 'flex',
                    width: '100%',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    gap: '1rem',
                }}
                >
                <PanelGroup direction="horizontal">                      
                    <Panel
                        collapsible={false}
                        order={1}
                    >
                        <Sheet
                            sx={{
                                p: '1rem'
                            }}
                        >
                            <ChartControl rows={barChartData} data={areaChartData}/>
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
                            </Sheet>
                        </Sheet>
                    </Panel>
                    <Panel
                        collapsible={true}
                        order={1}
                        defaultSize={25}
                    >
                        <Sheet
                            sx={{
                                borderLeft: '1px solid lightgray',
                                height: '100%'
                            }}
                        >
                            <span>HEEEEEEEY</span>
                        </Sheet>
                    </Panel>
                </PanelGroup>
            </Sheet>
        </>   
    );
}
 
export default WorkflowHistory;