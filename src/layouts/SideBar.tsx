import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import { Box, Divider, List, ListItem /* , ListItemContent */, ListItemButton, Sheet, Tooltip } from '@mui/joy';
import { ListItemIcon } from '@mui/material';
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
        <Sheet
            color='neutral'
            invertedColors
            variant='outlined'
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
                <List
                    sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        p: '0.2rem',
                    }}
                >   
                    {buttons.map((component) => (
                        <>  
                            <ListItem>
                                <Tooltip title={component.disabled ? `No data was found for the menu "${component.description.toLowerCase()}". Please check that the ${component.filetype} files are at the expected location according to the manifest.` : component.description} placement='right'>
                                    <div>
                                    <ListItemButton 
                                        sx={{ scale: '90%', justifyContent: 'center' }}
                                        onClick={() => navigate(component.link)}
                                        disabled={component.disabled}>
                                        <ListItemIcon sx={{minWidth: '25px', color: (getModulePath()===component.link ? 'primary.main' : '')}}>{component.icon}</ListItemIcon>                                        
                                    </ListItemButton>
                                    </div>
                                </Tooltip>
                            </ListItem>
                        </>
                    ))}
                </List>
            </Box>
            <Box>
                <Divider />
                <List>
                    <ListItem>
                        <ListItemButton 
                            disabled 
                            sx={{
                                borderRadius: 4, 
                                scale: '90%',
                                justifyContent: 'center'
                            }}
                        >
                            <SettingsRoundedIcon />
                        </ListItemButton>
                    </ListItem>
                </List>
            </Box>
        </Sheet>
     );
}
 
export default SideBar;