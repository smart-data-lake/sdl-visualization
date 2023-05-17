import { Chip, Typography } from "@mui/joy";
import { useNavigate } from "react-router-dom";
import { Row } from "../../../types";
import { getISOString } from "../../../util/WorkflowsExplorer/date";
import { formatDuration } from "../../../util/WorkflowsExplorer/format";
import { getIcon } from "../../../util/WorkflowsExplorer/StatusInfo";


const ActionRow = (props: { row: Row }) => {
    const row : Row = props.row;
    const navigate = useNavigate()

    const getSDLBStatus = (status: string) => {
        if (status === 'completed') {
            return 'SUCCEEDED';
        } else if (status === 'unknown') {
            return 'SKIPPED';
        } else {
            return 'FAILED';
        }
    }

    return ( 
        
            <tr onClick={() => navigate(`/workflows/${row.flow_id}/${row.run_number}/${row.task_id}/table/${row.step_name}`)}>
                <td scope="row"><Typography noWrap={true}>{row.step_name}</Typography></td>
                <td>
                    {getIcon(getSDLBStatus(row.status))}
                    {/* <Chip variant="soft" size="sm" color={row.status === 'completed' ? 'success' : (row.status === 'unknown' ? 'neutral' : 'danger')}>
                        <Typography noWrap={true}>{row.status}</Typography>
                    </Chip> */}
                </td>
                <td><Typography noWrap={true}>{row.task_id}</Typography></td>
                <td><Typography noWrap={true}>{getISOString(new Date(row.started_at || 0))}</Typography></td>
                <td><Typography noWrap={true}>{getISOString(new Date(row.finished_at || 0))}</Typography></td>
                <td><Typography noWrap={true}>{formatDuration(row.duration || 0)}</Typography></td>
            </tr>
     );
}
 
export default ActionRow;