import FlowChart from "./FlowChart";
import React from 'react';
import './ComponentsStyles.css';
import { Box, Tab, Tabs } from "@mui/material";
import TabPanel from '@mui/lab/TabPanel';
import TabContext from '@mui/lab/TabContext';
import MetadataTable from "./MetadataTable";
import MarkdownComponent from "./MarkdownComponent";
import { useParams } from "react-router-dom";

interface displayProps {
  data: object;
  globalSelected?: boolean; //true for the url /globalOptions
}

export default function DataDisplayView(props: displayProps) {

  let urlParams = useParams();

  const [value, setValue] = React.useState('description');


  
  const handleChange = (event: React.SyntheticEvent, newValue: string) => {
    setValue(newValue);
  };


  if (props.globalSelected){
    return (
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


  

  return (
    <TabContext value={value}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={value} onChange={handleChange} aria-label="element tabs">
          <Tab label="Description" value="description" sx={{height: "15px"}} />
          <Tab label="Configuration" value="configuration" sx={{height: "15px"}} />
          <Tab label="Lineage" value="lineage" sx={{height: "15px"}} />
        </Tabs>
      </Box>
      <TabPanel value="description" className="content-panel">
        <MarkdownComponent filename={urlParams.elementName as string} />;
      </TabPanel>
      <TabPanel value="configuration" className="content-panel">
        <MetadataTable data={props.data} elementName={urlParams.elementName as string} elementType={urlParams.elementType as string} />;
      </TabPanel>
      <TabPanel value="lineage" className="content-panel">
        <FlowChart data={props.data} elementName={urlParams.elementName as string} elementType={urlParams.elementType as string} />
      </TabPanel>
    </TabContext> 
  );
} 