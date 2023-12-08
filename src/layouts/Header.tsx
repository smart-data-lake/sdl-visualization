import {List, ListItem, Sheet, Tooltip, Typography } from '@mui/joy'
import BasicBreadcrumbs from './BasicBreadCrumbs';
import { useEffect, useRef, useState } from 'react';
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import LogoutIcon from '@mui/icons-material/Logout';
import LoginIcon from '@mui/icons-material/Login';
import { useNavigate } from 'react-router-dom';


/**
 * Header is the header of the application. It contains the SDL logo and the breadcrumbs.
 * @returns A JSX element that represents the RootLayout component
 */

const Header = () => {
    const {user, signOut, authStatus} = useAuthenticator();
    const [showLogin, setShowLogin] = useState(false);
    const navigate = useNavigate();
    const prevAuthStatus = useRef<any>();

    useEffect(() => {
        if(authStatus !== prevAuthStatus.current && [authStatus, prevAuthStatus.current].every(x => ['authenticated', 'unauthenticated'].includes(x)) ) {
            navigate(0);
        }
        prevAuthStatus.current = authStatus;
    }, [authStatus])

    const logout = () => {
        setShowLogin(false);
        signOut();
    }

    return ( 
        <>
            <Sheet
                color='primary'
                variant='solid'
                sx={{
                    top: 0,
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    position: 'fixed',
                    height: '2.7rem',
                    zIndex: 10000,
                    px: 2,
                }}
                >

                <List sx={{
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'flex-start',
                    gap: 2
                }}>
                    <ListItem>
                        <img alt="SDLB UI logo" src="images/sdl_logo_old_plain_white.svg" height={20} />
                    </ListItem>
                    <ListItem sx={{flexGrow: 1}}>
                        <BasicBreadcrumbs />
                    </ListItem>
                    <ListItem>
                        {(user || showLogin) && <Authenticator variation='modal'>
                           {() => (
                            <>
                                <Typography fontSize="inherit" sx={{color: 'white'}}>{user?.attributes?.email}</Typography>
                                <Tooltip title="Sign out">
                                    <LogoutIcon sx={{color: 'white', cursor: 'pointer', ml: 2}} onClick={() => logout()}/>
                                </Tooltip>
                            </>
                           )}
                        </Authenticator>}
                        {!user && <Tooltip title="Sign in">
                            <LoginIcon sx={{color: 'white', cursor: 'pointer', ml: 2}} onClick={() => setShowLogin(true)}/>
                        </Tooltip>}
                    </ListItem>
                </List>
            </Sheet>
        </>
     );
}
 
export default Header;