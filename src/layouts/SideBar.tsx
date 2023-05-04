import { List, ListItem/* , ListItemContent */, ListItemButton, Sheet, Box, Divider } from '@mui/joy';
import React from 'react'
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import { useNavigate } from 'react-router-dom';

/**
 * The SideBar is a navigation bar that is fixed on the left side of the screen. It contains buttons that allow the user to navigate to different pages, such as the Home page, Workflows Explorer page, and Config Viewer page.
 * @returns JSX element that represents the SideBar component
 */
const SideBar = () => {
    const buttons = [
        {
            icon : <HomeRoundedIcon/>,
            link : '/'
        },
        {
            icon : <SpeedRoundedIcon/>,
            link : '/workflows'
        },
        {
            icon : <TuneRoundedIcon/>,
            link : '/configviewer'
        }
    ]
    const navigate = useNavigate();

    return ( 
        <Sheet
            color='neutral'
            invertedColors
            variant='outlined'
            sx={{
                position: 'fixed',
                top: 43,
                display: 'flex',
                flexShrink: 0,
                zIndex: 1,
                flexDirection: 'column',
                justifyContent: 'space-between',
                height: '100%',
                pb: 5,
                backgroundColor: 'lightgray'
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
                                <ListItemButton 
                                    sx={{
                                        borderRadius: 4, 
                                        scale: '90%',
                                        justifyContent: 'center',
                                    }}
                                    onClick={() => navigate(component.link)}
                                >
                                    {component.icon}
                                </ListItemButton>
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