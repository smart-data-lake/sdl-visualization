import { useLocation, useNavigate } from "react-router-dom";
import { durationMicro, getISOString } from "../../../util/WorkflowsExplorer/date";
import { formatDuration } from "../../../util/WorkflowsExplorer/format";
import { getIcon } from "../../../util/WorkflowsExplorer/StatusInfo";



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
            <td>{getIcon(run.status)}</td>
            <td>{getISOString(new Date(run.attemptStartTime))}</td>
            <td>{run.attemptId}</td>
            <td>{formatDuration(durationMicro(run.duration))}</td>
        </tr>
     ); 
}
 
export default RunsRow;