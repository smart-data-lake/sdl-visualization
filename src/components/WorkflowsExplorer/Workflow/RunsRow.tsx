import { useLocation, useNavigate } from "react-router-dom";
import { Chip, Typography } from "@mui/joy";
import { durationMicro, getISOString } from "../../../util/WorkflowsExplorer/date";
import { formatDuration } from "../../../util/WorkflowsExplorer/format";
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import AutorenewIcon from '@mui/icons-material/Autorenew';


export const getIcon = (name: string) => {
    return name === 'SUCCEEDED' ? <CheckCircleOutlineIcon color='success' sx={{ scale: '80%', ml: '0.5rem' }} /> : (name === 'CANCELLED' ? <HighlightOffIcon color='error' sx={{ scale: '80%', ml: '0.5rem' }} /> : <AutorenewIcon color='warning' sx={{ scale: '80%', ml: '0.5rem' }} />)
}

/**
 * The RunsRow component is a row in the WorkflowHistoryTable component.
 * @param props.run - {id: number, run: StateFile}
 * @returns JSX.Element
 */

const RunsRow = (props : {run: any}) => {
    const { run } = props
    const currURL = useLocation().pathname;
    const navigate = useNavigate();

    const handleClick = () => {
        navigate(currURL + '/' + run.runId + '/' + run.attemptId + '/timeline')
    }  

    const getChip = (name: string) => {
        if (name === 'SUCCEEDED') {
            return <Chip variant="soft" size="sm" color="success" startDecorator={getIcon(name)} />
        } else if (name === 'CANCELLED') {
            return <Chip variant="soft" size="sm" color="danger" startDecorator={getIcon(name)} />
        } else {
            return <Chip variant="soft" size="sm" color="warning" startDecorator={getIcon(name)} />
        } 
    }

    return ( 
        <tr  onClick={() => handleClick()}>
            <td>{run.runId}</td>
            <td>{getIcon(run.status)}</td>
            <td>{getISOString(new Date(run.attemptStartTime))}</td>
            <td>{run.attemptId}</td>
            <td>{formatDuration(durationMicro(run.duration))}</td>
        </tr>
     ); 
}
 
export default RunsRow;