import PageHeader from "../../layouts/PageHeader";
import { styled } from '@mui/joy/styles';
import Sheet from '@mui/joy/Sheet';
import Grid from '@mui/joy/Grid';
import Card from '@mui/joy/Card';
import WelcomeCard from "./WelcomeCard";
import { Box, Divider, Typography } from "@mui/joy";


const Item = styled(Sheet)(({ theme }) => ({
    backgroundColor:
      theme.palette.mode === 'dark' ? theme.palette.background.level1 : 'salmon',
    ...theme.typography.body2,
    padding: theme.spacing(1),
    textAlign: 'center',
    borderRadius: 4,
    color: theme.vars.palette.text.secondary,
  }));

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
            <Sheet sx={{display: 'flex', flexDirection: 'column', justifyContent: 'center', overflowY: 'scroll', overflowX: 'hidden', height: '100%', pt: '2rem', ml: '1rem', gap: '2rem '}}>
                <Typography level="body1" fontSize="lg">
                    Start here with Smart Data Lake Builder UI
                </Typography>
                <Grid container spacing={3} sx={{ flexGrow: 1}}>
                    {info.map((item) => 
                        <>
                            <Grid xs={2}>
                                <WelcomeCard title={item.title} subtitle={item.subtitle} image={item.image} link={item.link}/>
                            </Grid>
                        </>
                    ) }
                </Grid>
                <Divider />
            </Sheet>
        </>
     );
}
 
export default Home;