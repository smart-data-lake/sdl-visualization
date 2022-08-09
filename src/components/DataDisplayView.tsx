import FlowChart from "./FlowChart";
import ChartView from "./ChartView";
import LayoutFlow from "./LayoutFlow";
import LayoutFlowTest from "./LayoutFlowTest";
import React, {Fragment, useEffect, useState} from 'react';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import './ComponentsStyles.css';
import DetailsView from './DetailsView'
import { Box, Tab, Tabs } from "@mui/material";
import TabPanel from '@mui/lab/TabPanel';
import TabContext from '@mui/lab/TabContext';
import MetadataTable from "./MetadataTable";
import MarkdownComponent from "./MarkdownComponent";

interface displayProps {
  data: object;
  selectedElementToChild: string;
  selectedElementTypeToChild: string;
  sendSelectedElementToParent: React.Dispatch<React.SetStateAction<string>>;
  sendSelectedElementTypeToParent: React.Dispatch<React.SetStateAction<string>>;
}

export default function DataDisplayView(props: displayProps) {
  const [value, setValue] = React.useState('description');
  
  const handleChange = (event: React.SyntheticEvent, newValue: string) => {
    setValue(newValue);
  };

  if (!props.selectedElementToChild) {
    return <Box>Select a component in the drawer on the left to see its configuration.</Box>;
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
      <TabPanel value="description">
        <MarkdownComponent filename={props.selectedElementToChild} />;
      </TabPanel>
      <TabPanel value="configuration">
        <MetadataTable data={props.data} elementName={props.selectedElementToChild} elementType={props.selectedElementTypeToChild} />;
      </TabPanel>
      <TabPanel value="lineage">
        <FlowChart data={props.data} elementName={props.selectedElementToChild} elementType={props.selectedElementTypeToChild} />
      </TabPanel>
    </TabContext>      
  );
} 