import { Box, IconButton, Sheet, Table } from "@mui/joy";
import RunsRow from "./RunsRow";
import ImportExportIcon from '@mui/icons-material/ImportExport';

const invertSort = (a: any, b: any) => {
    return new Date(a.attemptStartTime).getTime() - new Date(b.attemptStartTime).getTime();
}

/**
 * The WorkflowHistoryTable component is the table that displays the history of a workflow.
 * It fetches the data from the backend and renders the table.
 * @param props.workflow - string
 * @returns JSX.Element
 */
 
const WorkflowHistoryTable = (props : {data: any[], updateRows: (rows?: any[], cmp?: ((a: any, b: any) => number) | undefined) => void}) => {
    const { data, updateRows } = props;
    
    return (
        <Box
            sx={{
                overflowY: 'scroll',
            }}
        >
            <Table 
                size='sm' 
                hoverRow 
                color='neutral'
                
             >
                <thead>
                    <tr>
                        <th style={{width: '15%'}}>
                            <Sheet sx={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                                <div>Run ID</div>
                                <IconButton
                                    size='sm' 
                                    variant='plain' 
                                    color="neutral"
                                    disabled
                                >
                                    <ImportExportIcon sx={{scale: '80%'}} />
                                </IconButton>
                            </Sheet>
                        </th>
                        <th style={{width: '15%'}}>
                        <Sheet sx={{display: 'flex', alignItems: 'center'}}>
                                <div>Status</div>
                                <IconButton disabled size='sm' variant='plain' color="neutral">
                                    <ImportExportIcon sx={{scale: '80%'}} />
                                </IconButton>
                            </Sheet>
                        </th>
                        <th>
                            <Sheet sx={{display: 'flex', alignItems: 'center'}}>
                                <div>Run Start Time</div>
                                <IconButton size='sm' variant='plain' color="neutral" onClick={() => updateRows(undefined, invertSort)}>
                                    <ImportExportIcon sx={{scale: '80%'}} />
                                </IconButton>
                            </Sheet>
                        </th>
                        <th>
                            <Sheet sx={{display: 'flex', alignItems: 'center'}}>
                                <div>Attempt ID</div>
                                <IconButton disabled size='sm' variant='plain' color="neutral">
                                    <ImportExportIcon sx={{scale: '80%'}} />
                                </IconButton>
                            </Sheet>
                        </th>
                        <th>
                        <Sheet sx={{display: 'flex', alignItems: 'center'}}>
                                <div>Duration</div>
                                <IconButton disabled size='sm' variant='plain' color="neutral">
                                    <ImportExportIcon sx={{scale: '80%'}} />
                                </IconButton>
                            </Sheet>
                        </th>
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