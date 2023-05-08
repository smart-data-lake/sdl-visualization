import { Box, Table } from "@mui/joy";
import { useFetchWorkflow } from "../../../hooks/useFetchData";
import RunsRow from "./RunsRow";
import { CircularProgress } from "@mui/joy";
import { TablePagination } from "@mui/material";
import { useState } from "react";
    
/**
 * The WorkflowHistoryTable component is the table that displays the history of a workflow.
 * It fetches the data from the backend and renders the table.
 * @param props.workflow - string
 * @returns JSX.Element
 */
 
const WorkflowHistoryTable = (props : {data: any[]}) => {
    const { data } = props;
    
    return (
        <Box>
            <Table 
                size='sm' 
                hoverRow 
                color='neutral' 
             >
                <thead>
                    <tr>
                        <th>Run ID</th>
                        <th>Attempt ID</th>
                        <th>Duration</th>
                        <th>Run Start Time</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((run: any) => (
                        <>
                            <RunsRow run={run}/>
                        </>
                    ))}
                </tbody>
            </Table>
            
        </Box>
    );
}
 
export default WorkflowHistoryTable;