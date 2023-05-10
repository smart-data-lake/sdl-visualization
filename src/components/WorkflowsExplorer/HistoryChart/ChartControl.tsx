import { Box } from "@mui/material";
import HistoryLineChart from "./HistoryLineChart";
import HistoryBarChart from "./HistoryBarChart";
import { Indices } from "../Workflow/WorkflowHistory";
import { Sheet } from "@mui/joy";

const ChartControl = (props: {rows: any, data: any, indices: Indices }) => {
    const {rows, data, indices } = props;
    
    return ( 
        <Sheet
            sx={{
                display: 'flex',
                mt: '1rem'
            }}
        >
            <Sheet
                sx={{
                    flex: 1,
                    px: '1rem',
                }}
            >
                <HistoryBarChart data={rows}/>
            </Sheet>
            <Sheet
                sx={{
                    flex: 3,
                    borderLeft: '1px solid lightgray',
                    px: '1rem',
                }}
            >
                <HistoryLineChart data={data} indices={indices}/>
            </Sheet>
        </Sheet>
     );
}
 
export default ChartControl;