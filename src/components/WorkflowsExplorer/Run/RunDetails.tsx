import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import { Box, List, ListItemDecorator, Typography } from "@mui/joy";
import ListItem /* , { listItemClasses }  */ from '@mui/joy/ListItem';
import ListItemButton /* , { listItemButtonClasses } */ from '@mui/joy/ListItemButton';
import React from "react";
import Attempt from "../../../util/WorkflowsExplorer/Attempt";
import { formatTimestamp } from "../../../util/WorkflowsExplorer/date";

const RunDetails = (props: { attempt: Attempt; }) => {
    const attempt : Attempt = props.attempt;
    const [open, setOpen] = React.useState(false);
    const started_at = new Date(attempt.runInfo.runStartTime);
    const first_task_at = new Date(attempt.run.ts_epoch+10);
    const finished_at = new Date(attempt.run.finished_at?attempt.run.finished_at:attempt.run.ts_epoch+10);
    


    return ( 
        <Box>
            <List size="sm">
                <ListItem
                nested
                startAction={
                    <ListItemDecorator>
                        <KeyboardArrowDown
                            sx={{ transform: open ? 'initial' : 'rotate(-90deg)' }}
                        />
                    </ListItemDecorator>
                }
                >
                <ListItem>
                <ListItemButton 
                    variant="plain" 
                    onClick={() => setOpen(!open)}
                    sx={{
                        borderRadius: 4
                    }}
                >
                    <Typography
                        level="inherit"
                        sx={{
                            color: open ? 'text.primary' : 'inherit',
                        }}
                    >
                        {open ? 'Hide run details' : 'Show run details'}
                    </Typography>
                </ListItemButton>
                </ListItem>
                {open && (
                    <List>
                        <ListItem>
                            <Typography level='body-md' sx={{px: '2rem'}}>
                                <b>Run start:</b> {formatTimestamp(started_at)}
                            </Typography>
                        </ListItem>
                        <ListItem sx={{mx: '2rem'}}>
                            <Typography level='body-sm' sx={{px: '1rem', mx: '1rem', borderLeft: '1px solid', borderColor: 'lightgray'}}>
                                <b>First task start:</b> {formatTimestamp(first_task_at)}
                            </Typography>
                        </ListItem>
                        <ListItem>
                            <Typography level='body-sm' sx={{px: '2rem'}}>
                                <b>Run finished at:</b> {formatTimestamp(finished_at)}
                            </Typography>
                        </ListItem>
                        <ListItem>
                            <Typography level='body-sm' sx={{px: '2rem'}}>
                                <b>Total elapsed time:</b> 
                            </Typography>
                        </ListItem>
                        <ListItem>
                            <Typography level='body-sm' sx={{px: '2rem'}}>
                            <b>Number of actions:</b> {attempt.rows.length}
                            </Typography>
                        </ListItem>
                    </List>
                )}
                </ListItem>
                
            </List>
        </Box>
    );
}
 
export default RunDetails;