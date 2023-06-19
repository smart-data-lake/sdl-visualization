import { Box, CircularProgress, Sheet } from "@mui/joy";
import { Outlet } from "react-router-dom";
import Header from "./Header";
import SideBar from "./SideBar";
import { useConfig } from "../hooks/useConfig";
import { useEffect } from "react";

/**

    RootLayout sets up the main layout that is consistent across all pages of the application.
    It includes the header, sidebar, and main content.
    The isLoading state is derived from the useConfig hook, and it is used to display a spinner while the page loads.
    The storeData prop is a function passed in from App and is used to store the data from the config file.
    @param {storeData} props - A function to store the data from the config file
    @param {currData} props - The current data
    @returns A JSX element that represents the RootLayout component
    */

function RootLayout(props: {storeData?: (data: any) => void, currData?: any}) {
    const { storeData, currData } = props;
    const { data, isLoading } = useConfig()

    useEffect(()=>{
        if (!isLoading && storeData) storeData(data)
    }, [isLoading])
        
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
                    height: '100%',
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
                    {isLoading && <CircularProgress />}
                    {!isLoading && <Outlet />}
                </Box>
            </Box>
        </Box>
     );
}

export default RootLayout;