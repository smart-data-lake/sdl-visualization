import { Box, CircularProgress, Table } from "@mui/joy";
import useFetchWorkflows from "../../../hooks/useFetchData";
import WorkflowRow from "./WorkflowRow";

const WorkflowsTable = () => {
    const { data, isLoading, isFetching } = useFetchWorkflows();

    if (isLoading || isFetching) return <CircularProgress/>
    
    return (
        <Box sx={{ 
            overflow: 'auto',
            height: '80vh',
        }}>
            <Table size='sm' hoverRow color='neutral' stickyHeader>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Number of runs</th>
                        <th>Number of attempt</th>
                        <th>Last run status</th>
                        <th>Last run duration</th>
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