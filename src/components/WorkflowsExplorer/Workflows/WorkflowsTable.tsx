import { Box, Table } from "@mui/joy";
import useFetchWorkflows from "../../../hooks/useFetchData";
import WorkflowRow from "./WorkflowRow";

const WorkflowsTable = (props: {data: any}) => {
    const { data } = props;

    const render = () => {
        return (
            <Box sx={{ 
                maxHeight: '64vh',
                overflow: 'auto',
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
    return ( 
        <>
            {data && render()}
        </>
     );
}
 
export default WorkflowsTable;