import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import { Box, IconButton, Sheet, Stack, Tooltip } from '@mui/joy';
import { useWorkspace } from '../hooks/useWorkspace';
import { History } from '@mui/icons-material';

/**
 * The SideBar is a navigation bar that is fixed on the left side of the screen. It contains buttons that allow the user to navigate to different pages, such as the Home page, Workflows Explorer page, and Config Viewer page.
 */
const SideBar = () => {
    const {contentPath, contentSubPath, navigateContent} = useWorkspace();
    const module = (contentSubPath?.split("/") || [""])[0];

    var buttons = [{
        icon : <HomeRoundedIcon/>,
        subPath : "",
        filetype : 'none',
        description: 'Home'
    }]
    if (contentPath) {
        buttons.push({
            icon : <TuneRoundedIcon/>,
            subPath : 'config',
            filetype : 'config',
            description: 'Configuration Viewer'
        });
        buttons.push({
            icon : <History/>,
            subPath : 'workflows',
            filetype : 'state',
            description: 'Workflows History Explorer'
        })
    }

    return ( 
        <Sheet color='neutral' invertedColors variant='outlined'
            sx={{
                display: 'flex',
                justifyContent: 'space-between',
                flexDirection: 'column',
                backgroundColor: 'lightgray',
                maxWidth: '3.5rem',
                position: 'sticky',
                pt: '3rem',
            }}
        >
            <Box>
                <Stack spacing={0}>   
                    {buttons.map((component) => (
                        <Tooltip key={component.filetype} arrow title={component.description} placement='right' enterDelay={500} enterNextDelay={500}>
                            <IconButton onClick={e => navigateContent(component.subPath)} color={module===component.subPath ? 'primary' : 'neutral'} variant='plain'
                                sx={{ borderRadius: 0 }}>
                                    {component.icon}
                            </IconButton>
                        </Tooltip>
                    ))}
                </Stack>
            </Box>
        </Sheet>
     );
}
 
export default SideBar;