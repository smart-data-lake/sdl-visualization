import LineageTab from "./LineageTab";
import React from 'react';
import './ComponentsStyles.css';
import { Box, Tab, Tabs } from "@mui/material";
import TabPanel from '@mui/lab/TabPanel';
import TabContext from '@mui/lab/TabContext';
import ConfigurationTab from "./ConfigurationTab";
import DescriptionTab from "./DescriptionTab";
import { useParams } from "react-router-dom";
import { ReactFlowProvider } from "react-flow-renderer";
import { Sheet } from "@mui/joy";

interface displayProps {
  data: any; // complete configuration
}


export default function DataDisplayView(props: displayProps) {

  const {elementName, elementType} = useParams();
  const [configObj, setConfigObj] = React.useState();
  const [connectionConfigObj, setConnectionConfigObj] = React.useState();
  const [selectedTyp, setSelectedTab] = React.useState('description');

  React.useEffect(() => {
    if (elementType && elementName) {
      let obj = props.data[elementType][elementName];
      if (obj && obj['connectionId']) setConnectionConfigObj(props.data['connections'][obj['connectionId']]);
      setConfigObj(obj);
    }
  }, [elementName, elementType, props.data]);

  // change selected tab
  const handleChange = (_: React.SyntheticEvent, newValue: string) => {
    setSelectedTab(newValue);
  };

  return (
	<Sheet
		sx={{
			display: 'flex',
			width: '100%',
			height: '86vh'
		}}
		>
		<Sheet
			sx={{
				flex: 3,
				overflowY: 'scroll',
				p: '1rem'		
			}}
		>
			<TabContext value={selectedTyp}>
    	  	<Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
    	  	  <Tabs value={selectedTyp} onChange={handleChange} aria-label="element tabs">
    	  	    <Tab label="Description" value="description" sx={{height: "15px"}} />
    	  	    <Tab label="Configuration" value="configuration" sx={{height: "15px"}} />
    	  	   {/*  {(elementType==="actions" || elementType==="dataObjects") && <Tab label="Lineage" value="lineage" sx={{height: "15px"}} />} */}
    	  	  </Tabs>
    	  	</Box>
    	  	<TabPanel value="description" className="content-panel">
    	  	  <DescriptionTab elementName={elementName as string} data={configObj} elementType={elementType as string}/>
    	  	</TabPanel>
    	  	<TabPanel value="configuration" className="content-panel">
    	  	  <ConfigurationTab data={configObj} elementName={elementName as string} elementType={elementType as string} connection={connectionConfigObj} />
    	  	</TabPanel>
    	  	{/* <TabPanel value="lineage" className="content-panel">

</TabPanel> */}
    	</TabContext> 
		</Sheet>
		<Sheet
			sx={{
				flex: 2,
			}}
		>
			<ReactFlowProvider>
				<LineageTab data={props.data} elementName={elementName as string} elementType={elementType as string} />
			</ReactFlowProvider>
		</Sheet>
	</Sheet>
  );
} 