import { Box, CircularProgress, Table } from "@mui/joy";
import useFetchWorkflows from "../../../hooks/useFetchData";
import WorkflowRow from "./WorkflowRow";

const WorkflowsTable = (props : {data : any[]}) => {
    const { data } = props
    
    return (
        <Box sx={{ 
                maxHeight: '64vh',
                overflow: 'auto',
            }}>
            <Table size='sm' hoverRow color='neutral' stickyHeader>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Last run status</th>
                        <th>Last run duration</th>
                        <th>Number of runs</th>
                        <th>Number of attempts</th>
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
    )
}
 
export default WorkflowsTable;