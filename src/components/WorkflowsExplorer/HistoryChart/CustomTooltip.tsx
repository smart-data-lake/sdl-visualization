import { Sheet, Typography } from "@mui/joy";
import { getIcon } from "../../../util/WorkflowsExplorer/StatusInfo";
import { formatTimestamp } from "../../../util/WorkflowsExplorer/date";
import { formatDuration } from "../../../util/WorkflowsExplorer/format";

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