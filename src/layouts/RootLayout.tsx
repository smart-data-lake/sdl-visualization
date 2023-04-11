import { Box, CircularProgress } from "@mui/joy";
import { Outlet } from "react-router-dom";
import Header from "./Header";
import SideBar from "./SideBar";
import { useConfig } from "../hooks/useConfig";
import { useEffect } from "react";

function RootLayout(props: {storeData?: (data: any) => void}) {
    const { storeData } = props;
    const { data, isLoading } = useConfig()

    useEffect(()=>{
        if (!isLoading && storeData) storeData(data)
    }, [isLoading])

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
                    {isLoading && <CircularProgress />}
                    <Outlet />
                </Box>
            </main>
        </>
     );
}

export default RootLayout;