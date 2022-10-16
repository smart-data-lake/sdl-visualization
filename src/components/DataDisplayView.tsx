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
  data: any; // complete configuration
}


export default function DataDisplayView(props: displayProps) {

  const {elementName, elementType} = useParams();
  const [configObj, setConfigObj] = React.useState();
  const [selectedTyp, setSelectedTab] = React.useState('description');

  React.useEffect(() => {
    if (elementType && elementName) setConfigObj(props.data[elementType][elementName]);
  }, [elementName, elementType]);

  // change selected tab
  const handleChange = (event: React.SyntheticEvent, newValue: string) => {
    setSelectedTab(newValue);
  };

  return (
    <TabContext value={selectedTyp}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={selectedTyp} onChange={handleChange} aria-label="element tabs">
          <Tab label="Description" value="description" sx={{height: "15px"}} />
          <Tab label="Configuration" value="configuration" sx={{height: "15px"}} />
          {(elementType==="actions" || elementType==="dataObjects") && <Tab label="Lineage" value="lineage" sx={{height: "15px"}} />}
        </Tabs>
      </Box>
      <TabPanel value="description" className="content-panel">
        <MarkdownComponent filename={elementName as string} data={configObj} elementType={elementType as string}/>
      </TabPanel>
      <TabPanel value="configuration" className="content-panel">
        <MetadataTable data={configObj} elementName={elementName as string} elementType={elementType as string} />
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