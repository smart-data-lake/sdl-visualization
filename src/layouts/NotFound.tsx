import { Box, Sheet, Typography } from "@mui/joy";

const NotFound = (props: {errorType?: number, errorMessage?: string}) => {
    return ( 
        <Box
            sx={{
                flexDirection: 'column',
                display: 'flex',
                alignItems: 'center',
                height: '100%',
                gap: '2rem'
            }}
        >
            <Box sx={{flex: 1}}></Box>
            <Typography level='h1'>
                Ooops... Error {props.errorType ? props.errorType : 404}
            </Typography>
            {props.errorMessage && <Sheet variant='soft' color='neutral' sx={{display: 'flex', flexDirection: 'column', justifyContent: 'center', p: '2rem', borderRadius: '0.5rem'}}>
                <Typography color="neutral" level='body-md' >
                    {props.errorMessage}
                </Typography>
            </Sheet>}
            <Box sx={{flex: 1}}></Box>
        </Box>
     );
}
 
export default NotFound;