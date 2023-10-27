import './ComponentsStyles.css';
import { createPropertiesComponent } from './PropertiesComponent';
import { Box, Sheet, Tab, TabList, TabPanel, Tabs } from "@mui/joy";

interface ViewProps {
  data: any; // global configuration
}

export default function GlobalConfigView(props: ViewProps) {

  if (props.data){
    return(
      <Sheet sx={{ flex: 1, maxWidth: '500px', display: 'flex', flexDirection: 'column',  p: '1rem 0rem 1rem 0.5rem'}}>
        <Tabs size="md" value={'configuration'}>
          <Box>
            <TabList size="md" sx={{width: 'fit-content'}}>
              <Tab value="configuration" sx={{height: "15px"}}>Configuration</Tab>
            </TabList>
          </Box>
          <TabPanel value="configuration" className="content-panel">
            {createPropertiesComponent({obj: props.data})}
          </TabPanel>
        </Tabs>      
      </Sheet>
    );
  }
  else{
    return(<p>There are no global options defined in the configuration files</p>)
  }
} 