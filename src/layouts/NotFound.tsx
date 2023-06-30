import { Box, Sheet, Typography } from "@mui/joy";

/**
 * NotFound is the 404 page of the application. It contains the SDL logo and a message.
 * @returns A JSX element that represents the NotFound component
 */

const NotFound = (props: {errorType?: number, errorMessage?: string}) => {
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
                Error {props.errorType ? props.errorType : 404}
            </Typography>
            <Sheet variant='soft' color='info' sx={{display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1rem', mx: '15rem', p: '2rem', borderRadius: '0.5rem'}}>
                <Typography color="info" level='body1' >
                    Hint:
                </Typography>
                <Typography color="info" level='body1' >
                    {props.errorMessage ? props.errorMessage : "Try going back, or go to the homepage"}
                </Typography>
            </Sheet>
        </Box>
     );
}
 
export default NotFound;