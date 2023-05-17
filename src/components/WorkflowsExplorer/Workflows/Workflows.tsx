import React, { useEffect, useState } from "react";
import PageHeader from "../../../layouts/PageHeader";
import WorkflowsTable from "./WorkflowsTable";
import ToolBar from "../ToolBar/ToolBar";
import { Box, CircularProgress, Sheet } from "@mui/joy";
import useFetchWorkflows from "../../../hooks/useFetchData";
import { TablePagination } from "@mui/material";
import { durationMicro } from "../../../util/WorkflowsExplorer/date";
import { formatDuration } from "../../../util/WorkflowsExplorer/format";
import { useNavigate } from "react-router-dom";
import { checkFiltersAvailability, defaultFilters } from "../../../util/WorkflowsExplorer/StatusInfo";

const Workflows = () => {
    const { data, isLoading } = useFetchWorkflows();
    const [rows, setRows] = useState<any[]>([]);
    const [toDisplay, setToDisplay] = useState<any[]>(rows);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [count, setCount] = useState(0);

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

    if (isLoading) return <CircularProgress/>;
    return (      
        <>
            <PageHeader title={'Workflows'} noBack={true} />
            
            <Sheet
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-evenly',
                    alignItems: 'left',
                    
                    py: '1rem',
                    gap: '1rem'
                }}
                >
                <ToolBar 
                    style={'horizontal'} 
                    controlledRows={data} 
                    updateRows={updateRows} 
                    filters={checkFiltersAvailability(data, defaultFilters('lastStatus'))}
                    searchColumn={"name"}
                    sortEnabled={false}
                    searchPlaceholder="Search by name"
                />
                <Sheet
                    sx={{
                        display: 'flex',
                        flexDirection: 'column'
                    }}
                    >
                    {data && (
                        <>
                            <WorkflowsTable data={toDisplay}/>
                            <TablePagination
                                component="div"
                                count={count}
                                page={page}
                                onPageChange={handleChangePage}
                                rowsPerPage={rowsPerPage}
                                onRowsPerPageChange={handleChangeRowsPerPage}
                                />
                        </>
                    )}
                </Sheet>
            </Sheet>
        </>
    );
}

export default Workflows;