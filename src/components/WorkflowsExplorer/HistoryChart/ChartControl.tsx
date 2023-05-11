import { Box } from "@mui/material";
import HistoryLineChart from "./HistoryLineChart";
import HistoryBarChart from "./HistoryBarChart";
import { Indices } from "../Workflow/WorkflowHistory";
import { Sheet, Tooltip, Typography } from "@mui/joy";
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

const ChartControl = (props: {rows: any, data: any, indices: Indices }) => {
    const {rows, data, indices } = props;
    
    return ( 
        <Sheet
            sx={{
                display: 'flex',
                py: '1rem',
            }}
        >
            <Sheet
                sx={{
                    px: '1rem',
                }}
            >
                <Sheet
                    sx={{display: 'flex', flexDirection: 'row', gap: '1rem', alignItems: 'center', pb: '1rem'}}
                >
                <Typography level='h5'>Runs</Typography>
                <Tooltip variant="solid" title="Number of runs per status">
                    <HelpOutlineIcon sx={{scale: '70%'}}/>
                </Tooltip>
                </Sheet>
                <HistoryBarChart data={rows}/>
            </Sheet>
            <Sheet
                sx={{
                    flex: 1,
                    borderLeft: '1px solid lightgray',
                    px: '1rem',
                }}
            >
                <Sheet
                    sx={{display: 'flex', flexDirection: 'row', gap: '0.5rem', alignItems: 'center', pb: '1rem'}}
                >
                    <Typography level='h5'>Overview</Typography>
                    <Tooltip variant="solid" title="This charts displays a history of all runs of this workflow. You can zoom on specific part of it using the brush at its bottom">
                        <HelpOutlineIcon sx={{scale: '70%'}}/>
                    </Tooltip>
                </Sheet>
                <HistoryLineChart data={data} indices={indices}/>
            </Sheet>
        </Sheet>
     );
}
 
export default ChartControl;