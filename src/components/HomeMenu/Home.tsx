import { Box, Divider, Typography } from "@mui/joy";
import Grid from '@mui/joy/Grid';
import Sheet from '@mui/joy/Sheet';
import PageHeader from "../../layouts/PageHeader";
import WelcomeCard from "./WelcomeCard";

const info = [
    {title: 'Explore Configuration', subtitle: 'Learn about SDLB', image: 'images/config.png', link: 'internal;/config'},
    {title: 'Explore Workflows', subtitle: 'Learn about SDLB', image: 'images/workflow.png', link: 'internal;/workflows'},
    {title: 'Learn about SDLB', subtitle: 'Learn about SDLB', image: 'images/wwwsdlb.png', link: 'external;https://www.smartdatalake.ch/'},
]

const Home = () => {
    return ( 
        <>
            <PageHeader 
                title="Welcome to SDLB UI"
                noBack={true}
            />
            <Sheet sx={{display: 'flex', flexDirection: 'column', overflowY: 'auto', height: '100%', pt: '2rem', ml: '1rem', gap: '2rem '}}>
                <Typography level="body1" fontSize="lg">
                    Start here with Smart Data Lake Builder UI
                </Typography>
                <Sheet sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', p: 0, m: 0 }}>
                    {info.map((item) => <WelcomeCard title={item.title} subtitle={item.subtitle} image={item.image} link={item.link}/>)}
                </Sheet>
            </Sheet>
        </>
     );
}
 
export default Home;