import LineageTab from "./LineageTab";
import React from 'react';
import './ComponentsStyles.css';
import { Tab, Tabs } from "@mui/material";
import TabPanel from '@mui/lab/TabPanel';
import TabContext from '@mui/lab/TabContext';
import ConfigurationTab from "./ConfigurationTab";
import DescriptionTab from "./DescriptionTab";
import { useParams } from "react-router-dom";
import { ReactFlowProvider } from "react-flow-renderer";
import { Button, Sheet } from "@mui/joy";
import KeyboardDoubleArrowLeftIcon from '@mui/icons-material/KeyboardDoubleArrowLeft';
import KeyboardDoubleArrowRightIcon from '@mui/icons-material/KeyboardDoubleArrowRight';
import DraggableDivider from "../../layouts/DraggableDivider";

export interface displayProps {
  data: any; // complete configuration
}


export default function DataDisplayView(props: displayProps) {

  const {elementName, elementType} = useParams();
  const [configObj, setConfigObj] = React.useState();
  const [connectionConfigObj, setConnectionConfigObj] = React.useState();
  const [selectedTyp, setSelectedTab] = React.useState('description');
  const [openLineage, setOpenLineage] = React.useState(false);
  const [lineageWidth, setLineageWidth] = React.useState(500);
  const lineageRef = React.useRef<HTMLDivElement>(null);  

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
	<>
		<Sheet sx={{ flex: 1, minWidth: '500px', display: 'flex', flexDirection: 'column',  p: '1rem'}}>

			<TabContext value={selectedTyp}>
				<Sheet sx={{ display: 'flex', justifyContent: 'space-between'}}>
					<Tabs value={selectedTyp} onChange={handleChange} aria-label="element tabs">
						<Tab label="Description" value="description" />
						<Tab label="Configuration" value="configuration" />
					{/*  {(elementType==="actions" || elementType==="dataObjects") && <Tab label="Lineage" value="lineage" sx={{height: "15px"}} />} */}
					</Tabs>
					<Sheet>
						{!openLineage ?
							(
								<Button size="sm" onClick={() => setOpenLineage(!openLineage)}>
									Open lineage
									<KeyboardDoubleArrowLeftIcon  sx={{ml: '0.5rem'}}/>
								</Button>
							) : (
								<Button variant='soft' size="sm" onClick={() => setOpenLineage(!openLineage)}>
									Close lineage
									<KeyboardDoubleArrowRightIcon  sx={{ml: '0.5rem'}}/>
								</Button>
						)}
					</Sheet>
				</Sheet>
				<TabPanel value="description" className="content-panel" sx={{height: '100%', width: '100%', overflowY: 'auto'}}>
					<DescriptionTab elementName={elementName as string} data={configObj} elementType={elementType as string}/>
				</TabPanel>
				<TabPanel value="configuration" className="content-panel"  sx={{height: '100%', width: '100%', overflowY: 'auto'}}>
					<ConfigurationTab data={configObj} elementName={elementName as string} elementType={elementType as string} connection={connectionConfigObj} />
				</TabPanel>
			</TabContext> 
		</Sheet>

		{openLineage &&
			<>
				<DraggableDivider setWidth={setLineageWidth} cmpRef={lineageRef} isRightCmp={true} />
				<Sheet sx={{width: lineageWidth, height: '100%'}} ref={lineageRef}>
					<ReactFlowProvider>
						<LineageTab data={props.data} elementName={elementName as string} elementType={elementType as string} />
					</ReactFlowProvider>
				</Sheet>
			</>
		}		
	</>
  );
} 