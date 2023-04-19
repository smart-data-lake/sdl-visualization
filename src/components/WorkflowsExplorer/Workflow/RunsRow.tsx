import { useLocation, useNavigate } from "react-router-dom";
import { Chip } from "@mui/joy";
import { durationMicro, getISOString } from "../../../util/WorkflowsExplorer/date";
import { formatDuration } from "../../../util/WorkflowsExplorer/format";

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

    return ( 
        <tr  onClick={() => handleClick()}>
            <td>{run.runId}</td>
            <td>{run.attemptId}</td>
            <td>{getISOString(new Date(run.attemptStartTime))}</td>
            <td>{formatDuration(durationMicro(run.duration))}</td>
            <td>
                <Chip variant="soft" size="sm" color={run.status === 'SUCCEEDED' ? 'success' : 'danger'}>
                    {run.status}
                </Chip>
            </td>
        </tr>
     ); 
}
 
export default RunsRow;