import { List, ListItem/* , ListItemContent */, ListItemButton, Sheet, Box, Divider } from '@mui/joy';
import React from 'react'
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import { useNavigate } from 'react-router-dom';


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
            link : '/'
        }
    ]
    const navigate = useNavigate();

    return ( 
        <Sheet
            color='neutral'
            invertedColors
            variant='soft'
            sx={{
                position: 'fixed',
                display: 'flex',
                flexShrink: 0,
                flexDirection: 'column',
                justifyContent: 'space-between',
                height: '100%',
                p: 1,
                pb: 7
            }}
        >
            <Box>
                <List
                    sx={{
                        display: 'flex',
                        justifyContent: 'right'
                    }}
                >   
                    {buttons.map((component) => (
                        <>    
                            <ListItem>
                                <ListItemButton 
                                    sx={{
                                        borderRadius: 4, 
                                        transform: 'scale(1)',
                                        justifyContent: 'center'
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
                                transform: 'scale(1)',
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