import { useLocation, useNavigate } from "react-router-dom";
import { Chip, Typography } from "@mui/joy";
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
            <td><Typography level="body3">{run.runId}</Typography></td>
            <td><Typography level="body3">{run.attemptId}</Typography></td>
            <td><Typography level="body3">{formatDuration(durationMicro(run.duration))}</Typography></td>
            <td><Typography level="body3">{getISOString(new Date(run.attemptStartTime))}</Typography></td>
            <td>
                <Chip variant="soft" size="sm" color={run.status === 'SUCCEEDED' ? 'success' : 'danger'}>
                    {run.status}
                </Chip>
            </td>
        </tr>
     ); 
}
 
export default RunsRow;