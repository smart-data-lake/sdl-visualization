import React, { useEffect, useState } from "react";
import PageHeader from "../../../layouts/PageHeader";
import WorkflowsTable from "./WorkflowsTable";
import ToolBar from "../ToolBar/ToolBar";
import { Box, Sheet } from "@mui/joy";
import useFetchWorkflows from "../../../hooks/useFetchData";
import { TablePagination } from "@mui/material";

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

    console.log(data)

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
                                    py: '4rem',
                                    p: '2rem',
                                    border: '1px solid lightgray',
                                    borderRadius: '0.5rem',
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
                </Box>
            </Box>
        </>
    );
}


export default Workflows;