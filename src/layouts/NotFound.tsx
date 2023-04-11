import React from "react";
import { Box, Typography } from "@mui/joy";

const NotFound = () => {
    return ( 
        <Box
            sx={{
                flexDirection: 'column',
                display: 'flex',
                alignItems: 'center',
                m: '10rem'
            }}
        >
            <img src="/images/404_sdl_logo_old_plain_black.svg" height={128} />
            <Typography level='h1' sx={{pb: '10rem', pt: '3rem'}}>
                404 page not found
            </Typography>
            <Typography level='body1'>
                Try going back, or go to the homepage
            </Typography>
        </Box>
     );
}
 
export default NotFound;