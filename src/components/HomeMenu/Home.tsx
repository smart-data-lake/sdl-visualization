import { Typography } from "@mui/joy";
import Sheet from '@mui/joy/Sheet';
import PageHeader from "../../layouts/PageHeader";
import WelcomeCard from "./WelcomeCard";

const info = [
    {title: 'Configuration', subtitle: 'Explore configuration', image: 'images/config.png', linkType: 'internal', link: 'config'},
    {title: 'Workflows', subtitle: 'Explore runtime info', image: 'images/workflow.png', linkType: 'internal', link: 'workflows'},
    {title: 'Documentation', subtitle: 'Learn about SDLB', image: 'images/wwwsdlb.png', linkType: 'external', link: 'https://www.smartdatalake.ch/'},
]

const Home = () => {
    return ( 
        <>
            <PageHeader 
                title="Welcome to SDLB UI"
                noBack={true}
            />
            <Sheet sx={{display: 'flex', flexDirection: 'column', overflowY: 'auto', height: '100%', pt: '2rem', ml: '1rem', gap: '2rem '}}>
                <Typography level="body-md">
                    Start here with Smart Data Lake Builder UI
                </Typography>
                <Sheet sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', p: 0, m: 0 }}>
                    {info.map((item,idx) => <WelcomeCard key={idx} {...item}/>)}
                </Sheet>
            </Sheet>
        </>
     );
}
 
export default Home;