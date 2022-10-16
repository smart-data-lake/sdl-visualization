import './ComponentsStyles.css';
import { Box, Tab, Tabs } from "@mui/material";
import TabPanel from '@mui/lab/TabPanel';
import TabContext from '@mui/lab/TabContext';
import GlobalConfigsBody from "./GlobalConfigsBody";

interface ViewProps {
  data: any; // global configuration
}

export default function GlobalConfigView(props: ViewProps) {

  if (props.data){
    return(
      <TabContext value={'configuration'}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={'configuration'} aria-label="element tabs">
          <Tab label="Configuration" value="configuration" sx={{height: "15px"}} />
        </Tabs>
      </Box>
      <TabPanel value="configuration">
        <GlobalConfigsBody data={props.data} />
      </TabPanel>
    </TabContext>      
    );
  }
  else{
    return(<p>There are no global options defined in the configuration files</p>)
  }
} 