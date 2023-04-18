import { useLocation, useNavigate } from "react-router-dom";
import { Chip } from "@mui/joy";

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
            <td>{run.runStartTime}</td>
            <td>{run.duration}</td>
            <td>
                <Chip variant="soft" size="sm" color={run.status === 'SUCCEEDED' ? 'success' : 'danger'}>
                    {run.status}
                </Chip>
            </td>
        </tr>
     ); 
}
 
export default RunsRow;