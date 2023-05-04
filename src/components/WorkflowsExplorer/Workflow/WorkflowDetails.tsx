import { Sheet, Typography } from "@mui/joy";
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import EqualizerIcon from '@mui/icons-material/Equalizer';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';

const WorkflowDetails = (props : {data: any}) => {
    const { data } = props;


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
            <Sheet
                sx={{
                    display: 'flex',
                    justifyContent: 'flex-start',
                    alignItems: 'center',
                    gap: '1rem'
                }}
                >
                <TuneRoundedIcon />
                <Typography level="h4">Configuration</Typography>
            </Sheet>

            <Typography level="body1">{data[0].name}</Typography>
            </Sheet>
        </>
     );
}
 
export default WorkflowDetails;