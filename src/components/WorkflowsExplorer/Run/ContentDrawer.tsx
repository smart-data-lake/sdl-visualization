import { Box, IconButton, Sheet, Table, Typography } from "@mui/joy";
import CloseIcon from '@mui/icons-material/Close';
import { useNavigate, useParams } from "react-router-dom";
import Attempt from "../../../util/WorkflowsExplorer/Attempt";
import { Row } from "../../../types"
import { position } from "polished";

const getRow = (attempt: Attempt, taskName: string) => {
    if (taskName === 'err') throw('was not able to fetch task name');

    return attempt.rows.filter((row) => {return row.step_name === taskName})[0];
}

/**
 * The result table component displays the metadata of a task. It is used in the ContentDrawer component.
 * It visually structures the information available in the metrics and subfeed properties of a task.
 * @param props.metrics metrics: any - the metrics of the task
 * @param props.subfeed subFeed: any - the subfeed of the task
 * @returns 
 */
const ResultsTable = (props: {metrics?: any, subFeed?: any}) => {
    const { metrics, subFeed } = props;
    const formatByte = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = 2;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
    const data = metrics ? [
        {name: 'Stage', value: metrics.stage},
        {name: 'Bytes written', value: formatByte(metrics.bytes_written)},
        {name: 'Number of tasks', value: metrics.num_tasks},/* 
        {name: 'Records written', value: metrics.records_written}, */
        {name: 'Count', value: metrics.count},
    ] : [
        {name: 'Type', value: subFeed.type},
        {name: 'Data object ID', value: subFeed.dataObjectId},
        {name: 'Is DAG start', value: subFeed.isDAGStar},
    ]
    const renderTable = () => {
        return (
            <Table size="sm">
                <tbody>
                    {data.map((data) => ( 
                        <>
                            {data.value && (
                                <tr key={data.name}>
                                    <td><b>{data.name}</b></td>
                                    <td>{data.value}</td>
                                </tr>
                            )}
                        </>
                    ))}
                </tbody>
            </Table>
        )
    }

    return (
        <>
            {metrics && renderTable()}
            {subFeed && renderTable()}
        </>
    )
}

/**
 * The content sheet component displays the metadata of a task. It is used in the ContentDrawer component. 
 * It displays the main metrics of a task if they are available, otherwise it displays the subfeed.
 * If available, it also displays the message of the task.
 * @param props action: Row - the row to display
 * @returns 
 */
const ContentSheet = (props: {action: Row}) => {
    const { action } = props;
    
    return (
        
            <Box
                sx={{
                    overflowY: 'scroll',
                    overflowX: 'hidden',
                    scrollbarWidth: 'none',
                }}
            >
                {action.metadata.map((meta) => {
                    const toDisplay : any[] = [];
                    if (meta.mainMetrics) {
                        toDisplay.push(
                            <Box 
                            key='meta.mainMetrics'
                            sx={{mb: '1.5rem'}}
                            >
                                    <Typography noWrap level='h5'>
                                        Main metrics
                                    </Typography>
                                    <ResultsTable metrics={meta.mainMetrics}/>
                                </Box>
                            )
                        } 
                        if (meta.subFeed) {
                            toDisplay.push(
                                <Box 
                                key='meta.subFeed'
                                >
                                    <Typography noWrap level='h5'>
                                        Subfeed
                                    </Typography>
                                    <ResultsTable subFeed={meta.subFeed}/>
                                </Box>
                            )
                        } 
                        if (!meta.mainMetrics && !meta.subFeed) {
                            toDisplay.push(
                                <Typography noWrap level='h5' key='noData'>
                                    Error: found no metadata to display
                                </Typography>
                            )
                        }
                        return (
                            <Sheet 
                            color="neutral" 
                            variant="outlined"
                            key='resultSheet'
                            sx={{
                                p: '1rem',
                                mt: '1rem',
                                borderRadius: '0.5rem',
                                height: 'auto',
                            }}>
                                {toDisplay}
                            </Sheet>
                        )
                    })
                }
                {action.message && <Sheet 
                    color="info" 
                    variant="soft"
                    key='resultSheet'
                    invertedColors
                    sx={{
                        p: '1rem',
                        mt: '1rem',
                        borderRadius: '0.5rem',
                    }}>
                    <Typography color="info" level='body2'>
                        Info:
                    </Typography>
                    <code>
                        {action.message}
                    </code>
                </Sheet>}
            </Box>
    )
}

/**
 * ContentDrawer is a component that displays the content of a task. It can be opened by clicking on a task in the Run component and closed by clicking the close button.
 * The content is fetched from the attempt object. It is displayed in a ContentSheet.
 * @param props attempt: Attempt
 * @returns 
 */
const ContentDrawer = (props: {attempt: Attempt}) => {
    const { attempt } = props;
    const { flowId, runNumber, taskId, tab, stepName } = useParams();
    const navigate = useNavigate();
    const action : Row = getRow(attempt, stepName || 'err');
    
    return ( 
        <Sheet
            sx={{
                p: '1rem',
                height: '68vh',
            }}
            >
            
            <Box 
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    position: 'sticky',
                }}
            >

                <Typography noWrap level='h3'>
                    {action.step_name}
                </Typography>
                <IconButton
                    variant="plain" 
                    color="neutral" 
                    size="sm" 
                    onClick={() => navigate(`/workflows/${flowId}/${runNumber}/${taskId}/${tab}`)}
                    >
                    <CloseIcon />
                </IconButton>
            </Box>
            <ContentSheet action={action}/>
        </Sheet>
     );
}
 
export default ContentDrawer;