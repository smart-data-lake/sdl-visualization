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
                alignItems: 'center',
                py: '1rem',
            }}
        >
            <Sheet
                sx={{
                    flex: 4,
                    px: '1rem',
                }}
            >
                <Sheet
                    sx={{display: 'flex', flexDirection: 'row', gap: '1rem', alignItems: 'center', pb: '1rem'}}
                >
                <Typography level='h5'>Runs</Typography>
                <Tooltip variant="solid" placement="bottom-start" title="This chart displays the runs in the current page. You can jump to a detailed run view by clicking on the corresponding bar">
                    <HelpOutlineIcon sx={{scale: '70%'}}/>
                </Tooltip>
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
                    sx={{display: 'flex', flexDirection: 'row', gap: '0.5rem', alignItems: 'center', pb: '1rem'}}
                >
                    <Typography level='h5'>Overview</Typography>
                    <Tooltip variant="solid" placement='bottom-end' title="This charts displays a history of all runs of this workflow. You can zoom on specific part of it using the brush at its bottom">
                        <HelpOutlineIcon sx={{scale: '70%'}}/>
                    </Tooltip>
                </Sheet>
                <HistoryLineChart data={data} indices={indices}/>
            </Sheet>
        </Sheet>
     );
}
 
export default ChartControl;