import KeyboardDoubleArrowLeftIcon from '@mui/icons-material/KeyboardDoubleArrowLeft';
import KeyboardDoubleArrowRightIcon from '@mui/icons-material/KeyboardDoubleArrowRight';
import { Button, Sheet } from "@mui/joy";
import Tab, { tabClasses } from '@mui/joy/Tab';
import TabList from '@mui/joy/TabList';
import TabPanel from '@mui/joy/TabPanel';
import Tabs from '@mui/joy/Tabs';
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

  return (
	<>
		<Sheet sx={{ flex: 1, minWidth: '500px', height: '100%', display: 'flex', flexDirection: 'column',  p: '1rem 0rem 1rem 0.5rem'}} ref={mainRef}>
			<Tabs size="md" value={selectedTyp} onChange={(e,v) => setSelectedTab(v as string)} aria-label="element tabs" sx={{height: '100%'}}>
				<Sheet sx={{ display: 'flex', justifyContent: 'space-between'}}>
					<TabList>
						<Tab value="description">Description</Tab>
						<Tab value="configuration">Configuration</Tab>
					</TabList>
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
				<TabPanel value="description" className="content-panel" sx={{height: '100%', width: '100%', overflow: 'auto'}}>
					<DescriptionTab elementName={elementName as string} data={configObj} elementType={elementType as string}/>
				</TabPanel>
				<TabPanel value="configuration" className="content-panel" sx={{height: '100%', width: '100%', overflow: 'auto'}}>
					<ConfigurationTab data={configObj} elementName={elementName as string} elementType={elementType as string} connection={connectionConfigObj} />
				</TabPanel>
			</Tabs>
		</Sheet>

		{openLineage &&
			<>
				<DraggableDivider id="config-lineage" cmpRef={lineageRef} isRightCmp={true} defaultCmpWidth={500} parentCmpRef={props.parentCmpRef} />
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