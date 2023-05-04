import { Box } from "@mui/material";
import HistoryAreaChart from "./HistoryAreaChart";
import HistoryBarChart from "./HistoryBarChart";

const ChartControl = (props: {rows: any, data: any}) => {
    const {rows, data } = props;
    
    return ( 
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'row',
                mt: '1rem'
            }}
        >
            <HistoryBarChart data={rows}/>
            <HistoryAreaChart data={data}/>
        </Box>
     );
}
 
export default ChartControl;