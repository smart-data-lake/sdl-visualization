import FlowChart from "./FlowChart";
import React from 'react';
import './ComponentsStyles.css';
import { Box, Tab, Tabs } from "@mui/material";
import TabPanel from '@mui/lab/TabPanel';
import TabContext from '@mui/lab/TabContext';
import MetadataTable from "./MetadataTable";
import MarkdownComponent from "./MarkdownComponent";
import { useParams } from "react-router-dom";
import { ReactFlowProvider } from "react-flow-renderer";

interface displayProps {
  data: any;
  globalSelected?: boolean; //true for the url /globalOptions
}


export default function DataDisplayView(props: displayProps) {

  const {elementName, elementType} = useParams();
  
  const [value, setValue] = React.useState('description');

  // reset value on element change
  //React.useEffect(() => setValue('description'), [elementName, elementType]);

  // change selected tab
  const handleChange = (event: React.SyntheticEvent, newValue: string) => {
    setValue(newValue);
  };

  function getGlobalView(){
    if (props.data['global']){
      console.log('Global present');
      return(
        <TabContext value={'configuration'}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={'configuration'} onChange={handleChange} aria-label="element tabs">
            <Tab label="Configuration" value="configuration" sx={{height: "15px"}} />
          </Tabs>
        </Box>
        <TabPanel value="configuration">
          <MetadataTable data={props.data} elementName='global' elementType='global' />;
        </TabPanel>
      </TabContext>      
      );
    }
    else{
      return(<p>There are no global options defined in the configuration files</p>)
    }
  }


  if (props.globalSelected){
    return getGlobalView();

  }else return (
    <TabContext value={value}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={value} onChange={handleChange} aria-label="element tabs">
          <Tab label="Description" value="description" sx={{height: "15px"}} />
          <Tab label="Configuration" value="configuration" sx={{height: "15px"}} />
          {(elementType==="actions" || elementType==="dataObjects") && <Tab label="Lineage" value="lineage" sx={{height: "15px"}} />}
        </Tabs>
      </Box>
      <TabPanel value="description" className="content-panel">
        <MarkdownComponent filename={elementName as string} data={props.data} elementType={elementType as string}/>;
      </TabPanel>
      <TabPanel value="configuration" className="content-panel">
        <MetadataTable data={props.data} elementName={elementName as string} elementType={elementType as string} />;
      </TabPanel>
      <TabPanel value="lineage" className="content-panel">
      <ReactFlowProvider>
        <FlowChart 
          data={props.data}
          elementName={elementName as string} 
          elementType={elementType as string} />
      </ReactFlowProvider>
      </TabPanel>
    </TabContext> 
  );
} 