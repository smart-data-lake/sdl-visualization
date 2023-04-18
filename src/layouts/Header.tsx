import React from 'react'

import { List, ListItem, Sheet } from '@mui/joy'
import BasicBreadcrumbs from './BasicBreadCrumbs';

/**
 * Header is the header of the application. It contains the SDL logo and the breadcrumbs.
 * @returns A JSX element that represents the RootLayout component
 */

const Header = () => {
    return ( 
        <>
            <Sheet
                color='primary'
                variant='solid'
                sx={{
                    top: 0,
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'left',
                    position: 'sticky',
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
                        <img src="/images/sdl_logo_old_plain_white.svg" height={28} />
                    </ListItem>
                    {/* <BasicBreadcrumbs/> */}
                </List>

            </Sheet>
        </>
     );
}
 
export default Header;