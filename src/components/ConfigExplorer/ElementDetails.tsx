import KeyboardDoubleArrowLeftIcon from '@mui/icons-material/KeyboardDoubleArrowLeft';
import KeyboardDoubleArrowRightIcon from '@mui/icons-material/KeyboardDoubleArrowRight';
import { Button, Sheet } from "@mui/joy";
import TabContext from '@mui/lab/TabContext';
import TabPanel from '@mui/lab/TabPanel';
import { Tab, Tabs } from "@mui/material";
import React from 'react';
import { ReactFlowProvider } from "react-flow-renderer";
import { useParams } from "react-router-dom";
import DraggableDivider from "../../layouts/DraggableDivider";
import { ConfigData } from "../../util/ConfigExplorer/ConfigData";
import './ComponentsStyles.css';
import ConfigurationTab from "./ConfigurationTab";
import DescriptionTab from "./DescriptionTab";
import LineageTab from "./LineageTab";


export default function ElementDetails(props: {configData?: ConfigData, parentCmpRef: React.RefObject<HTMLDivElement>}) {

  const {configData} = props;
  const {elementName, elementType} = useParams();
  const [configObj, setConfigObj] = React.useState();
  const [connectionConfigObj, setConnectionConfigObj] = React.useState();
  const [selectedTyp, setSelectedTab] = React.useState('description');
  const [openLineage, setOpenLineage] = React.useState(false);
  const mainRef = React.useRef<HTMLDivElement>(null);  
  const lineageRef = React.useRef<HTMLDivElement>(null);  

  React.useEffect(() => {
    if (configData && elementType && elementName) {
      let obj = configData[elementType][elementName];
      if (obj && obj['connectionId']) setConnectionConfigObj(configData['connections'][obj['connectionId']]);
      setConfigObj(obj);
    }
  }, [elementName, elementType, configData]);

  // change selected tab
  const handleChange = (_: React.SyntheticEvent, newValue: string) => {
    setSelectedTab(newValue);
  };

  return (
	<>
		<Sheet sx={{ flex: 1, minWidth: '500px', display: 'flex', flexDirection: 'column',  p: '1rem'}} ref={mainRef}>

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
				<DraggableDivider cmpRef={lineageRef} isRightCmp={true} defaultCmpWidth={500} parentCmpRef={props.parentCmpRef} />
				<Sheet sx={{height: '100%', minWidth: '100px'}} ref={lineageRef}>
					<ReactFlowProvider>
						<LineageTab configData={configData} elementName={elementName as string} elementType={elementType as string} />
					</ReactFlowProvider>
				</Sheet>
			</>
		}		
	</>
  );
} 