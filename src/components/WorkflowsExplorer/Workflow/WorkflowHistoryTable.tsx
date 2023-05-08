import { Box, Table } from "@mui/joy";
import { useFetchWorkflow } from "../../../hooks/useFetchData";
import RunsRow from "./RunsRow";
import { CircularProgress } from "@mui/joy";
    
/**
 * The WorkflowHistoryTable component is the table that displays the history of a workflow.
 * It fetches the data from the backend and renders the table.
 * @param props.workflow - string
 * @returns JSX.Element
 */
const WorkflowHistoryTable = (props : {workflow: string}) => {
    const { workflow } = props;
    const { data, isLoading, isFetching } = useFetchWorkflow(workflow);
    
    if (isLoading || isFetching) return <CircularProgress/>
    console.log(data);
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
                        <th>Attempt ID</th>
                        <th>Run Start Time</th>
                        <th>Duration</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {data.runs.map((run: any) => (
                        <>
                            <RunsRow run={run}/>
                        </>
                    ))}
                </tbody>
            </Table>
            
        </Box>
    )
}
 
export default WorkflowHistoryTable;