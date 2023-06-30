import { List, ListItem, Sheet, Typography } from "@mui/joy";
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import EqualizerIcon from '@mui/icons-material/Equalizer';
import { getISOString } from "../../../util/WorkflowsExplorer/date";
import HistoryPieChart from "../HistoryChart/HistoryPieChart";
import { getIcon } from "../../../util/WorkflowsExplorer/StatusInfo";




const WorkflowDetails = (props : {data: any, pieChartData: any}) => {
    const { data, pieChartData } = props;

    const listWorkflowDetails = [
        {name: 'Name', value: data.name.toString()}, 
        {name: 'Number of runs', value: data.runs.length.toString()},
        {name: 'Latest run' , value: <><div style={{display: 'flex', alignItems: 'center'}}><span>{getISOString(new Date(data.runs[0].runStartTime.toString()))} </span><span>{ getIcon(data.runs[0].status.toString())}</span></div></>},
        {name: 'Oldest run execution', value: <><div style={{display: 'flex', alignItems: 'center'}}><span>{getISOString(new Date(data.runs[data.runs.length-1].runStartTime.toString()))} </span><span>{ getIcon(data.runs[0].status.toString())}</span></div></>},
    
    ]
    
    const getList = (list: {name: string, value: string}[]) => {    
        return (
            <Sheet
                sx={{
                    display: 'flex',
                    justifyContent: 'flex-start',
                }}
            >
                <List>
                {list.map((item) => {
                    return (<>
                            <ListItem>
                                <Typography level="body1">{item.name}</Typography>
                            </ListItem>
                        </>)})}
                </List>
                <List>
                {list.map((item) => {
                    return (<>
                            <ListItem>
                                <Typography level="body2">{item.value}</Typography>
                            </ListItem>
                        </>)})}
                </List>
            </Sheet>
        )
    }

    return ( 
        <>
            <Sheet
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-start',
                    alignItems: 'stretch',
                    gap: '4rem'
                }}
                >
                <Sheet>
                    <Sheet
                        sx={{
                            display: 'flex',
                            justifyContent: 'flex-start',
                            alignItems: 'center',
                            gap: '1rem'
                        }}
                        >
                        <ErrorOutlineIcon />
                        <Typography level="h4">Workflow details</Typography>
                    </Sheet> 
                    {getList(listWorkflowDetails)}
                </Sheet>
                <Sheet>
                    <Sheet
                        sx={{
                            display: 'flex',
                            justifyContent: 'flex-start',
                            alignItems: 'center',
                            gap: '1rem'
                        }}
                        >
                        <EqualizerIcon />
                        <Typography level="h4">Runs overview</Typography>
                    </Sheet>
                    <HistoryPieChart data={pieChartData}/>
                </Sheet>
            {/* <Sheet
                sx={{
                    display: 'flex',
                    justifyContent: 'flex-start',
                    alignItems: 'center',
                    gap: '1rem'
                }}
                >
                <TuneRoundedIcon />
                <Typography level="h4">Configuration</Typography>
            </Sheet> */}

            {/* <Typography level="body1">{data[0].name}</Typography> */}
            </Sheet>
        </>
     );
}
 
export default WorkflowDetails;