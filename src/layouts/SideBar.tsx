import { List, ListItem/* , ListItemContent */, ListItemButton, Sheet, Box, Divider, Tooltip } from '@mui/joy';
import React from 'react'
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import { useNavigate } from 'react-router-dom';
import { useManifest } from '../hooks/useManifest';

/**
 * The SideBar is a navigation bar that is fixed on the left side of the screen. It contains buttons that allow the user to navigate to different pages, such as the Home page, Workflows Explorer page, and Config Viewer page.
 * @returns JSX element that represents the SideBar component
 */
const SideBar = () => {
    const {data, isLoading} = useManifest();
    const navigate = useNavigate();
    
    if (isLoading) return <></>
    
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
            disabled : !(data.localSetup && data.statefilesIndex),
            filetype : 'state',
            description: 'Workflows Explorer'
        },
        {
            icon : <TuneRoundedIcon/>,
            link : '/config',
            disabled : !(data.localSetup && data.configfilesIndex),
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
                flexDirection: 'column',
                backgroundColor: 'lightgray',
                maxWidth: '3.5rem',
                flex: 1,
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
                                        sx={{
                                            borderRadius: 4, 
                                            scale: '90%',
                                            justifyContent: 'center',
                                        }}
                                        onClick={() => navigate(component.link)}
                                        disabled={component.disabled}
                                        >   
                                        {component.icon}
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