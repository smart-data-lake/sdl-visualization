import { Box } from "@mui/material";
import HistoryLineChart from "./HistoryLineChart";
import HistoryBarChart from "./HistoryBarChart";
import { Indices } from "../Workflow/WorkflowHistory";

const ChartControl = (props: {rows: any, data: any, indices: Indices }) => {
    const {rows, data, indices } = props;
    
    return ( 
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'row',
                mt: '1rem'
            }}
        >
            <HistoryBarChart data={rows}/>
            <HistoryLineChart data={data} indices={indices}/>
        </Box>
     );
}
 
export default ChartControl;