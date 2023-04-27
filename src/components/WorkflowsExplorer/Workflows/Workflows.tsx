import React, { useEffect, useState } from "react";
import PageHeader from "../../../layouts/PageHeader";
import WorkflowsTable from "./WorkflowsTable";
import ToolBar from "../ToolBar/ToolBar";
import { Box, Sheet } from "@mui/joy";
import useFetchWorkflows from "../../../hooks/useFetchData";
import { TablePagination } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { durationMicro } from "../../../util/WorkflowsExplorer/date";
import { formatDuration } from "../../../util/WorkflowsExplorer/format";
import { useNavigate } from "react-router-dom";

const Workflows = () => {
    const { data, isLoading } = useFetchWorkflows();
    const [rows, setRows] = useState<any[]>([]);
    const [toDisplay, setToDisplay] = useState<any[]>(rows);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [count, setCount] = useState(0);
    const navigate = useNavigate();

    useEffect(() => {
        if (!isLoading) {
            setRows(data);
        }
    }, [data, isLoading])

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

    const formatRows = () => {
        return rows.map((row: any) => {
            return {
                name: row.name,
                numRuns: row.numRuns,
                numAttempts: row.numAttempts,
                lastStatus: row.lastStatus,
                lastDuration: formatDuration(durationMicro(row.lastDuration)),
            };
        })
    }

    const columns = [
        { field: 'name', headerName: 'Name', flex: 1 },
        { field: 'numRuns', headerName: 'Number of runs', flex: 1 },
        { field: 'numAttempts', headerName: 'Number of attempt', flex: 1 },
        { field: 'lastStatus', headerName: 'Last run status',  flex: 1 },
        { field: 'lastDuration', headerName: 'Last run duration',  flex: 1 },
    ]

    return (      
        <>
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                <PageHeader title={'Workflows'} noBack={true} />
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'row',
                        gap: '3rem',
                    }}
                >
                    {data && <ToolBar style={'vertical'} controlledRows={data} updateRows={updateRows} searchColumn={"name"}/>}
                    <Sheet 
                                sx={{
                                    width: '100%',
                                }}
                            >
                    {data && (<DataGrid 
                                onRowClick={(row) => {navigate('/workflows/' + row.id)}} 
                                getRowId={(row) => row.name} 
                                rows={formatRows()} 
                                columns={columns} 
                            />
                        
                        )}
                    </Sheet>
                </Box>
            </Box>
        </>
    );
}

{/* <>
<WorkflowsTable data={toDisplay}/>
<TablePagination
component="div"
count={count}
page={page}
onPageChange={handleChangePage}
rowsPerPage={rowsPerPage}
onRowsPerPageChange={handleChangeRowsPerPage}
/>
</> */}

export default Workflows;