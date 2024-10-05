import { Box } from "@mui/joy";
import { Outlet } from "react-router-dom";
import Header from "./Header";
import SideBar from "./SideBar";
import RootLayoutSpinner from "./RootLayoutSpinner";

/**
    RootLayout sets up the main layout that is consistent across all pages of the application.
    It includes the header, sidebar, and main content.
    @returns A JSX element that represents the RootLayout component
*/
function RootLayout() {
        
    return ( 
        <Box sx={{ display: 'flex', height: '100vh', alignItems: 'stretch'}}>
            <Header />
            <Box
                sx={{display: 'flex', height: '100vh', width: '100vh', justifyContent: 'flex-start', alignItems: 'stretch', flex: 1, minHeight: 0 }}>
                <SideBar/>
                <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                    <RootLayoutSpinner>
                        <Outlet />
                    </RootLayoutSpinner>
                </Box>
            </Box>
        </Box>
     );
}

export default RootLayout;