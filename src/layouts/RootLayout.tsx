import { Box } from "@mui/joy";
import { Outlet } from "react-router-dom";
import Header from "./Header";
import SideBar from "./SideBar";

function RootLayout() {
    return ( 
        <>
            <Header />
            <SideBar/>
            <main>
                <Box
                    sx={{
                        flex: 1,
                        pl: '17rem',
                        pr: '14rem',
                        pt: '2rem',
                        display: 'flex',
                        flexDirection: 'column',
                        height: '100%',
                        overflow: 'hidden',
                    }}
                >
                    <Outlet />
                </Box>
            </main>
        </>
     );
}

export default RootLayout;