import { Chip } from "@mui/joy";
import { useNavigate } from "react-router-dom";

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
                <tr onClick={() => handleClick()}>
                    <td>{data.name}</td>
                    <td>{data.numRuns}</td>
                    <td>{data.numAttempts}</td>
                    <td>
                        <Chip variant="soft" size="sm" color={data.lastStatus === 'SUCCEEDED' ? 'success' : 'danger'}>
                            {data.lastStatus}
                        </Chip>
                    </td>
                    <td>{data.lastDuration}</td>
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
