import { useNavigate } from "react-router-dom";
import { durationMicro } from "../../../util/WorkflowsExplorer/date";
import { formatDuration } from "../../../util/WorkflowsExplorer/format";
import { getIcon } from "../../../util/WorkflowsExplorer/StatusInfo";

/**
 * The WorkflowRow component is a row in the WorkflowsTable component.
 * @param props.data - {id: number, name: string}
 * @returns 
 */

const WorkflowRow = (props: {data: any}) => {
    const { data } = props;
    const navigate = useNavigate();
    
    const render = () => {
        return (
            <>
                <tr style={{cursor: 'pointer'}} onClick={() => handleClick()}>
                    <td>{data.name}</td>
                    <td>
                        {getIcon(data.lastStatus)}
                    </td>
                    <td>{formatDuration(durationMicro(data.lastDuration))}</td>
                    <td>{data.numRuns}</td>
                    <td>{data.numAttempts}</td>
                </tr>
            </>
        )
    }

    const handleClick = () => {
        navigate('/workflows/' + data.name)
    }

    return (  
        <>
            {data && render()}
        </>
    );
}
 
export default WorkflowRow;
