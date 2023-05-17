import HistoryLineChart from "./HistoryLineChart";
import HistoryBarChart from "./HistoryBarChart";
import { Indices } from "../Workflow/WorkflowHistory";
import { Sheet, Tooltip, Typography } from "@mui/joy";
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { formatDuration } from "../../../util/WorkflowsExplorer/format";
import { getISOString } from "../../../util/WorkflowsExplorer/date";
import { getIcon } from "../../../util/WorkflowsExplorer/StatusInfo";

export const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <Sheet sx={{ px: '2rem', py: '1rem', zIndex: 10000, borderRadius: '0.5rem', border: '1px solid lightgray', gap: '0.5rem', display: 'flex', flexDirection: 'column' }}>
          <Typography level='body1' sx={{display: 'flex', alignItems: 'center'}}>Run {payload[0].payload.runId} attempt {payload[0].payload.attemptId} {getIcon(payload[0].payload.status)}</Typography>
          <Typography level='body2'>Date: {new Date(payload[0].payload.name).toLocaleDateString(undefined, {year: 'numeric', month: 'short', day: 'numeric'})}</Typography>
          <Typography level='body2'>Time: {getISOString(new Date(payload[0].payload.name)).split(' ')[1]}</Typography>
          <Typography level='body2'>Duration: {formatDuration(payload[0].payload.value)}</Typography>
        </Sheet>
      );
    }
    return null;
}

const ChartControl = (props: {rows: any, data: any, indices: Indices }) => {
    const {rows, data, indices } = props;
    const selected = indices?.rangeLeft ? (indices?.rangeRight ? indices.rangeRight - indices.rangeLeft + 1: data.length) : data.length;

    return ( 
        <Sheet
            sx={{
                display: 'flex',
                alignItems: 'center',
                py: '1rem',
                maxWidth: '100%'
            }}
        >
            <Sheet
                sx={{
                    flex: 4,
                    px: '1rem',
                }}
            >
                <Sheet
                    sx={{display: 'flex', flexDirection: 'row', gap: '1rem', alignItems: 'flex-end', pb: '1rem'}}
                >
                <Typography level='h5'>Runs</Typography>
                <Tooltip variant="solid" placement="bottom-start" title="This chart displays the runs in the current page. You can jump to a detailed run view by clicking on the corresponding bar">
                    <HelpOutlineIcon sx={{scale: '70%'}}/>
                </Tooltip>
                <Typography level='body2' sx={{color: 'gray'}}>{rows.length} runs displayed</Typography>
                </Sheet>
                <HistoryBarChart data={rows}/>
            </Sheet>
            <Sheet
                sx={{
                    flex: 2,
                    borderLeft: '1px solid lightgray',
                    px: '1rem',
                }}
            >
                <Sheet
                    sx={{display: 'flex', gap: '0.5rem', alignItems: 'flex-end', pb: '1rem'}}
                >
                    <Typography level='h5'>Overview</Typography>
                    <Tooltip variant="solid" placement='bottom-end' title="This charts displays a history of all runs of this workflow. You can zoom on specific part of it using the brush at its bottom">
                        <HelpOutlineIcon sx={{scale: '70%'}}/>
                    </Tooltip>
                    <Typography level='body2' sx={{color: 'gray'}}>{selected} runs selected</Typography>
                </Sheet>
                <HistoryLineChart data={data} indices={indices}/>
            </Sheet>
        </Sheet>
     );
}
 
export default ChartControl;