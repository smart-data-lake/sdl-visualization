import HistoryLineChart from "./HistoryLineChart";
import HistoryBarChart from "./HistoryBarChart";
import { Indices } from "../WorkflowHistory";
import { Sheet, Tooltip, Typography } from "@mui/joy";
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { formatDuration } from "../../../util/WorkflowsExplorer/format";
import { formatTimestamp } from "../../../util/WorkflowsExplorer/date";
import { getIcon } from "../../../util/WorkflowsExplorer/StatusInfo";

export const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <Sheet sx={{ px: '2rem', py: '1rem', zIndex: 10000, borderRadius: '0.5rem', border: '1px solid lightgray', gap: '0.5rem', display: 'flex', flexDirection: 'column' }}>
          <Typography level='title-md' sx={{display: 'flex', alignItems: 'center'}}>Run {payload[0].payload.runId} attempt {payload[0].payload.attemptId} {getIcon(payload[0].payload.status)}</Typography>
          <Typography level='body-md'>Date: {new Date(payload[0].payload.attemptStartTime).toLocaleDateString(undefined, {year: 'numeric', month: 'short', day: 'numeric'})}</Typography>
          <Typography level='body-md'>Time: {formatTimestamp(new Date(payload[0].payload.attemptStartTime)).split(' ')[1]}</Typography>
          <Typography level='body-md'>Duration: {formatDuration(payload[0].payload.duration)}</Typography>
        </Sheet>
      );
    }
    return null;
}

const ChartControl = (props: {runs: any}) => {
    const {runs} = props;

    return ( 
        <Sheet
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                py: '1rem',
                width: '100%'
            }}
        >
            <Sheet sx={{flex: 4 }}>
                <Sheet sx={{display: 'flex', flexDirection: 'row', gap: '1rem', alignItems: 'flex-end', pb: '1rem'}}>
                <Typography level='title-md'>Runs</Typography>
                <Tooltip variant="solid" placement="bottom-start" title="This chart displays the runs in the current page. You can jump to a detailed run view by clicking on the corresponding bar">
                    <HelpOutlineIcon sx={{scale: '70%'}}/>
                </Tooltip>
                <Typography level='body-sm' sx={{color: 'gray'}}>{runs.length} runs displayed</Typography>
                </Sheet>
                <HistoryBarChart runs={runs}/>
            </Sheet>
        </Sheet>
     );
}
 
export default ChartControl;