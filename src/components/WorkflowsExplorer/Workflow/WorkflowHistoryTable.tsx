import { Box, Table } from "@mui/joy";
import React from "react";
import { StateFile } from "../../../types";
import useFetchData from "../../../hooks/useFetchData";
import RunsRow from "./RunsRow";
import { Height } from "@mui/icons-material";

/**
 * The WorkflowHistoryTable component is the table that displays the history of a workflow.
 * It fetches the data from the backend and renders the table.
 * @param props.workflow - string
 * @returns JSX.Element
 */
const WorkflowHistoryTable = (props : {workflow: string}) => {
    const { workflow } = props;
    const data = useFetchData(workflow);
    
    const render = () => { 
        const runs = data;
        return (
            <Box sx={{ 
                overflow: 'auto',
                height: '80vh',
            }}>
                <Table 
                    size='sm' 
                    hoverRow 
                    color='neutral' 
                    stickyHeader 
                    >
                    <thead>
                        <tr>
                            <th>Run ID</th>
                            <th>Attempt number</th>
                            <th>Started</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {runs.map((run : {id: number, run: StateFile}) => (
                            <>
                                <RunsRow run={run}/>
                            </>
                        ))}
                    </tbody>
                </Table>
            </Box>
        )
    }
    return (
        <>
            {data && render()}
        </> 
    );
}
 
export default WorkflowHistoryTable;