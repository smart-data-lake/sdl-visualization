import React from "react";
import { Box, Typography } from "@mui/joy";

/**
 * NotFound is the 404 page of the application. It contains the SDL logo and a message.
 * @returns A JSX element that represents the NotFound component
 */

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