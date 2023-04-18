import { Box, Table } from "@mui/joy";
import useFetchWorkflows from "../../../hooks/useFetchData";
import WorkflowRow from "./WorkflowRow";

const WorkflowsTable = () => {
    const { data } = useFetchWorkflows();

    const render = () => {
        return (
            <Box sx={{ 
                overflow: 'auto',
                height: '80vh',
            }}>
                <Table size='sm' hoverRow color='neutral' stickyHeader>
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
        )
    }
    return ( 
        <>
            {data && render()}
        </>
     );
}
 
export default WorkflowsTable;