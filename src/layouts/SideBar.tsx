import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import { Box, Divider, IconButton, Sheet, Stack, Tooltip } from '@mui/joy';
import { useLocation, useNavigate } from 'react-router-dom';
import { useManifest } from '../hooks/useManifest';

/**
 * The SideBar is a navigation bar that is fixed on the left side of the screen. It contains buttons that allow the user to navigate to different pages, such as the Home page, Workflows Explorer page, and Config Viewer page.
 * @returns JSX element that represents the SideBar component
 */
const SideBar = () => {
    const manifest = useManifest();
    const navigate = useNavigate();
    const location = useLocation();

    function getModulePath() {
        const secondSlashPos = location.pathname.indexOf('/',1);
        if (secondSlashPos>0) {
            return location.pathname.substring(0, secondSlashPos);
        } else {
            return location.pathname;
        }
    }

    if (manifest.isLoading) return <></>
    
    const buttons = [
        {
            icon : <HomeRoundedIcon/>,
            link : '/',
            disabled : false,
            filetype : 'none',
            description: 'Home'
        },
        {
            icon : <SpeedRoundedIcon/>,
            link : '/workflows',
            filetype : 'state',
            description: 'Workflows Explorer'
        },
        {
            icon : <TuneRoundedIcon/>,
            link : '/config',
            filetype : 'config',
            description: 'Config Viewer'
        }
    ]

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
                        <Tooltip key={component.filetype} arrow title={component.disabled ? `No data was found for the menu "${component.description.toLowerCase()}". Please check that the ${component.filetype} files are at the expected location according to the manifest.` : component.description} placement='right' enterDelay={500} enterNextDelay={500}>
                            <IconButton onClick={e => navigate(component.link)} color={getModulePath()===component.link ? 'primary' : 'neutral'} variant='plain'
                                sx={{ borderRadius: 0 }}
                                disabled={component.disabled}>
                                    {component.icon}
                            </IconButton>
                        </Tooltip>
                    ))}
                </Stack>
            </Box>
            <Box>
                <Divider />
                <Stack>
                    <IconButton variant='plain' sx={{ borderRadius: 0 }} disabled={true}>
                        <SettingsRoundedIcon />
                    </IconButton>                    
                </Stack>
            </Box>
        </Sheet>
     );
}
 
export default SideBar;