import { Chip, Typography } from "@mui/joy";
import { useNavigate } from "react-router-dom";
import { Row } from "../../../types";
import { getISOString } from "../../../util/WorkflowsExplorer/date";
import { formatDuration } from "../../../util/WorkflowsExplorer/format";
import { getIcon, getSDLBStatus } from "../../../util/WorkflowsExplorer/StatusInfo";


const ActionRow = (props: { row: Row }) => {
    const row : Row = props.row;
    const navigate = useNavigate()

   

    return ( 
        
            <tr style={{cursor: 'pointer'}} onClick={() => navigate(`/workflows/${row.flow_id}/${row.run_number}/${row.task_id}/table/${row.step_name}`)}>
                <td scope="row"><Typography noWrap={true}>{row.step_name}</Typography></td>
                <td>
                    {getIcon(getSDLBStatus(row.status))}
                </td>
                <td><Typography noWrap={true}>{getISOString(new Date(row.started_at || 0))}</Typography></td>
                <td><Typography noWrap={true}>{getISOString(new Date(row.finished_at || 0))}</Typography></td>
                <td><Typography noWrap={true}>{row.task_id}</Typography></td>
                <td><Typography noWrap={true}>{formatDuration(row.duration || 0)}</Typography></td>
            </tr>
     );
}
 
export default ActionRow;