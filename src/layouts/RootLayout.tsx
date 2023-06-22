import { Box, CircularProgress } from "@mui/joy";
import { Outlet } from "react-router-dom";
import Header from "./Header";
import SideBar from "./SideBar";

/**

    RootLayout sets up the main layout that is consistent across all pages of the application.
    It includes the header, sidebar, and main content.
    The isLoading state is derived from the useConfig hook, and it is used to display a spinner while the page loads.
    @returns A JSX element that represents the RootLayout component
    */

function RootLayout(props: {isLoading: boolean}) {
        
    return ( 
        <Box
            sx={{
                display: 'flex',
                height: '100vh',
                alignItems: 'stretch',
            }}
        >
            <Header />
            <Box
                sx={{
                    display: 'flex',
                    height: '100vh',
                    justifyContent: 'flex-start',
                    alignItems: 'stretch',
                    flex: 1,
                }}
                >
                <SideBar/>
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        flex: 1,
                    }}
                >
                    {props.isLoading && <CircularProgress />}
                    {!props.isLoading && <Outlet />}
                </Box>
            </Box>
        </Box>
     );
}

export default RootLayout;