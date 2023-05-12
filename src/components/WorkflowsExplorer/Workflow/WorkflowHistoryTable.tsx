import { Box, Table } from "@mui/joy";
import RunsRow from "./RunsRow";
    
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
                        <th style={{width: '15%'}}>Run ID</th>
                        <th style={{width: '15%'}}>Status</th>
                        <th>Run Start Time</th>
                        <th>Attempt ID</th>
                        <th>Duration</th>
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