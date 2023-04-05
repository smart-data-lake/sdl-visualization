import { Box, Table } from "@mui/joy";
import React from "react";
import useFetchData from "../../../hooks/useFetchData";
import WorkflowRow from "./WorkflowRow";

const WorkflowsTable = () => {
    const data = useFetchData('index');

    const render = () => {
        return (
            <>
                <Box
                    sx={{
                        height: '30rem', 
                        overflow: 'auto'
                    }}
                >
                    <Table size='md' hoverRow color='neutral' stickyHeader>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Run number</th>
                                <th>Number of attempt</th>
                                <th>Started</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((row : {id: number, name: string}) => (
                                <>
                                    <WorkflowRow data={row}/>
                                </>
                            ))}
                        </tbody>
                    </Table>
                </Box>
            </>
        )
    }
    return ( 
        <>
            {data && render()}
        </>
     );
}
 
export default WorkflowsTable;