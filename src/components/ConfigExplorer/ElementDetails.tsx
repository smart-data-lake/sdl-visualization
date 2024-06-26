import KeyboardDoubleArrowLeftIcon from '@mui/icons-material/KeyboardDoubleArrowLeft';
import KeyboardDoubleArrowRightIcon from '@mui/icons-material/KeyboardDoubleArrowRight';
import { Box, Button, Sheet, Tooltip } from "@mui/joy";
import Tab from '@mui/joy/Tab';
import TabList from '@mui/joy/TabList';
import TabPanel from '@mui/joy/TabPanel';
import Tabs from '@mui/joy/Tabs';
import React from 'react';
import { ReactFlowProvider } from "reactflow";
import { useNavigate, useParams } from "react-router-dom";
import DraggableDivider from "../../layouts/DraggableDivider";
import { ConfigData } from "../../util/ConfigExplorer/ConfigData";
import './ComponentsStyles.css';
import ConfigurationTab from "./ConfigurationTab";
import DescriptionTab from "./DescriptionTab";
import LineageTabSep from './LineageTab/LineageTabWithSeparateView'; // testing new component
import { useFetchDataObjectSchemaEntries, useFetchDataObjectStatsEntries, useFetchDescription } from '../../hooks/useFetchData';
import SchemaTab from './SchemaTab';


export function getMissingDescriptionFileCmp(elementType: string, elementName: string) {
	return <Box>
		There is no detailed description for this element.<br/>
		To add a description create the following Markdown file in your project folder:<br/>
		<span style={{ fontWeight: 'bold' }}>description/{elementType}/{elementName}.md</span><br/>
		You can use <a href="https://commonmark.org/">Commonmark Standard</a> to format your text.
	</Box>
}

export function getMissingSchemaFileCmp(elementType: string, elementName: string) {
	return <Box>
		There is no schema data for this DataObject available.<br/>
		Structured DataObjects like SparkDataObjects or Tables have a schema at runtime.<br/>
		To display it here, launch DataObjectSchemaExporter Java program to export it,<br/>
		see also <a href="https://github.com/smart-data-lake/sdl-visualization">SDLB UI Readme</a>
	</Box>
}

export default function ElementDetails(props: {configData?: ConfigData, parentCmpRef: React.RefObject<HTMLDivElement>}) {

  const {configData} = props;
  const {elementName, elementType, tab} = useParams();
  const [lastTab, setLastTab] = React.useState('configuration');
  const [openLineage, setOpenLineage] = React.useState(false);
  const lineageRef = React.useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const navigateRel = (subPath: string) => navigate(subPath, {relative: 'path'}); // this navigates Relative to path, not route

  const configObj = React.useMemo(() => {
    if (configData && elementType && elementName) {
      return configData[elementType][elementName];
    } else return null;
  }, [elementName, elementType, configData]);

  const connectionConfigObj = React.useMemo(() => {
	if (configData && configObj && configObj['connectionId']) {
		return configData['connections'][configObj['connectionId']];
	} else return null;
  }, [configObj, configData]);

  React.useEffect(() => {
	if (tab) setLastTab(tab)
	else if (lastTab === 'schema' && elementType != 'dataObjects' ) setLastTab('configuration')
  }, [tab, elementType])

  const setSelectedTab = (v: any) => (tab ? navigateRel(`../${v}`) : navigateRel(`${v}`));

  const { data: description, isLoading: descriptionIsLoading } = useFetchDescription(elementType, elementName);
  const { data: schemaEntries, isLoading: schemaEntriesLoading } = useFetchDataObjectSchemaEntries(elementType, elementName);
  const { data: statsEntries } = useFetchDataObjectStatsEntries(elementType, elementName);

  return (
	<>
		<Sheet sx={{ flex: 1, minWidth: '500px', height: '100%', display: 'flex', flexDirection: 'column',  p: '1rem 0rem 1rem 0.5rem'}}>
			<Tabs size="md" value={tab || lastTab} onChange={(e,v) => setSelectedTab(v as string)} aria-label="element tabs" sx={{height: '100%'}}>
				<Sheet sx={{ display: 'flex', justifyContent: 'space-between'}}>
					<TabList>					
						<Tab value="configuration">Configuration</Tab>
						<Tooltip arrow variant="soft" title={(descriptionIsLoading ? "Loading" : (!description ? getMissingDescriptionFileCmp(elementType!, elementName!) : null))} enterDelay={500} enterNextDelay={500} placement='bottom-start'>
							<span>
								<Tab value="description" disabled={!description}>Description</Tab>
							</span>
						</Tooltip>
						<Tooltip arrow variant="soft" title={(schemaEntriesLoading ? "Loading" : (!schemaEntries ? getMissingSchemaFileCmp(elementType!, elementName!) : null))} enterDelay={500} enterNextDelay={500} placement='bottom-start'>
							<span>
								{elementType === "dataObjects" && <Tab value="schema" disabled={!schemaEntries}>Schema</Tab>}
							</span>
						</Tooltip>
					</TabList>
					{	(elementType === "dataObjects" || elementType === "actions") && 
						(<Sheet>
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
						</Sheet>)
					}
				</Sheet>
				<TabPanel value="configuration" className="content-panel" sx={{height: '100%', width: '100%', overflow: 'auto'}}>
					<ConfigurationTab data={configObj} connection={connectionConfigObj} statsEntries={statsEntries} elementName={elementName!} elementType={elementType!} />
				</TabPanel>
				<TabPanel value="description" className="content-panel" sx={{height: '100%', width: '100%', overflow: 'auto'}}>
					<DescriptionTab data={description!} elementName={elementName!} elementType={elementType!}/>
				</TabPanel>
				{elementType === "dataObjects" && 
				// key is needed to force rerender of DataTable in SchemaTab, otherwise column changes might not be reflected.
				<TabPanel key={elementName} value="schema" className="content-panel" sx={{height: '100%', width: '100%', overflow: 'auto'}}>
					<SchemaTab columnDescriptions={configObj?._columnDescriptions} schemaEntries={schemaEntries} statsEntries={statsEntries} elementName={elementName!} elementType={elementType!}/>
				</TabPanel>}
			</Tabs>
		</Sheet>

		{openLineage &&
			<>
				<DraggableDivider id="config-lineage" cmpRef={lineageRef} isRightCmp={true} defaultCmpWidth={500} parentCmpRef={props.parentCmpRef} />
				<Sheet sx={{height: '100%', minWidth: '100px'}} ref={lineageRef}>
					{/* <ReactFlowProvider> */}
						<LineageTabSep configData={configData} elementName={elementName as string} elementType={elementType as string} />
					{/* </ReactFlowProvider> */}
				</Sheet>
			</>
		}		
	</>
  );
} 