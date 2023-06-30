import React, { useEffect, useState } from "react";
import PageHeader from "../../../layouts/PageHeader";
import WorkflowsTable from "./WorkflowsTable";
import ToolBar from "../ToolBar/ToolBar";
import { CircularProgress, Sheet } from "@mui/joy";
import useFetchWorkflows from "../../../hooks/useFetchData";
import { TablePagination } from "@mui/material";
import { checkFiltersAvailability, defaultFilters } from "../../../util/WorkflowsExplorer/StatusInfo";
import NotFound from "../../../layouts/NotFound";

const Workflows = () => {
    const { data, isLoading } = useFetchWorkflows();
    const [rows, setRows] = useState<any[]>([]);
    const [toDisplay, setToDisplay] = useState<any[]>(rows);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (!isLoading && !data.detail) {
            setRows(data);
        } else if (!isLoading && data.detail) {
            setRows([]);
        }
    }, [data, isLoading])

    useEffect(() => {
        setToDisplay(rows.slice(0, rowsPerPage));
        setCount(rows.length)
    }, [rows, rowsPerPage])

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

    console.log(data && (!data.detail))
    return (      
        <>
            {data ? (
                (!data.detail) ? (
                    <>
                        <PageHeader title={'Workflows'} noBack={true} />
                        <Sheet
                            sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-evenly',
                                alignItems: 'left',
                                
                                p: '1rem',
                                gap: '1rem'
                            }}
                        >
                            <ToolBar 
                                controlledRows={data} 
                                updateRows={updateRows} 
                                filters={checkFiltersAvailability(data, defaultFilters('lastStatus'))}
                                searchColumn={"name"}
                                sortEnabled={false}
                                searchPlaceholder="Search by name"
                                searchMode="contains"
                            />
                            <Sheet
                                sx={{
                                    display: 'flex',
                                    flexDirection: 'column'
                                }}
                            >
                                <WorkflowsTable data={toDisplay}/>
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
                    </>
                ):(
                    <>
                        <NotFound errorType={500} errorMessage={data.detail}/>
                    </>
                )
            ):(
                <>
                    <NotFound/>
                </>
            )}
        </>
    );
}

export default Workflows;