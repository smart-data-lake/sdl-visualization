/* import Close from "@mui/icons-material/Close"; */
import React from "react";
import { Box, IconButton, Sheet, Typography } from "@mui/joy";
import CloseIcon from '@mui/icons-material/Close';
import { useNavigate, useParams } from "react-router-dom";
import Attempt from "../../utils/Attempt";
import { Row } from "../../types"

const getRow = (attempt: Attempt, taskName: string) => {
    if (taskName === 'err') throw('was not able to fetch task name');

    return attempt.rows.filter((row) => {return row.step_name === taskName})[0];
}


const ContentDrawer = (props: {attempt: Attempt}) => {
    const { attempt } = props;
    const { flowId, runNumber, taskId, tab, stepName } = useParams();
    const navigate = useNavigate();
    const action : Row = getRow(attempt, stepName || 'err');
    
    return ( 
        <Sheet
            sx={{
                minWidth: '50%',
                ml: '1rem',
                p: '1rem',
                borderLeft: '1px solid',
                borderColor: 'lightgray',
            }}
        >
            <Box sx={{
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'space-between'
            }}>
                <Typography noWrap level='h3'>
                    {action.step_name}
                </Typography>
                <IconButton
                    variant="plain" 
                    color="neutral" 
                    size="sm" 
                    onClick={() => navigate(`/workflows/${flowId}/${runNumber}/${taskId}/${tab}`)}
                >
                    <CloseIcon />
                </IconButton>
            </Box>
            
        </Sheet>
     );
}
 
export default ContentDrawer;