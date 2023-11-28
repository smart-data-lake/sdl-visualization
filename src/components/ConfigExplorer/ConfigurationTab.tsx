import { ExploreOutlined, LayersOutlined, RocketLaunchOutlined, TableViewTwoTone } from '@mui/icons-material';
import AltRouteIcon from '@mui/icons-material/AltRoute';
import LanOutlinedIcon from '@mui/icons-material/LanOutlined';
import SellIcon from '@mui/icons-material/Sell';
import StyleIcon from '@mui/icons-material/Style';
import { Box, Chip, Grid, Select, Stack, Table, Typography } from '@mui/joy';
import Option from '@mui/joy/Option';
import 'github-markdown-css/github-markdown.css';
import { useEffect, useState } from 'react';
import { Link } from "react-router-dom";
import { Stats, TsIndexEntry, useFetchDataObjectStats, useFetchWorkflowRunsByElement } from '../../hooks/useFetchData';
import { formatTimestamp } from '../../util/WorkflowsExplorer/date';
import { getPropertyByPath } from '../../util/helpers';
import './ComponentsStyles.css';
import ConfigurationAccordions from './ConfigurationAccordions';
import MarkdownComponent from './MarkdownComponent';
import { createPropertiesComponent } from './PropertiesComponent';
import { cellIconRenderer } from './DataTable';
import { getIcon } from '../../util/WorkflowsExplorer/StatusInfo';

interface ElementProps {
  data: any; // config of object to display
  connection?: any; // connection config of object to display  
  statsIndex?: TsIndexEntry[]; // index of available statistics files, ordered from youngest to oldest
  elementName: string;
  elementType: string;
}

function getInputOutputIds(action: any | undefined): [string[], string[]]{
  if (!action) return [[],[]];
  let inputs: string[] = action['inputIds'] ? action['inputIds'] : [];
  let outputs: string[] = action['outputIds'] ? action['outputIds'] : [];
  if (action['inputId']) inputs.push(action['inputId']);
  if (action['outputId']) outputs.push(action['outputId']);
  return [inputs, outputs];
}

function formatInputsOutputs(inputs: string[], outputs: string[]): JSX.Element {
  return ( 
  <Box sx={{display: 'flex', flexDirection: 'column'}}>
    <Box sx={{display: 'flex', pb: '3px'}}>
      <Box sx={{flex: 1}}>Inputs</Box>
      <Box sx={{flex: 1, textAlign: 'right'}}>Outputs</Box>
    </Box>  
    <Box sx={{display: 'flex'}}>    
      <Stack sx={{flex: 1, height: '100%', alignSelf: 'center', marginRight: '15px'}} spacing={1}>{inputs.map(name => createDataObjectChip(name))}</Stack>
      <Stack sx={{flex: 1, height: '100%', alignItems: 'end', alignSelf: 'center', marginLeft: '15px'}} spacing={1}>
        {outputs.map(name => createDataObjectChip(name))}
      </Stack>
    </Box>
  </Box>
  );
}

export function createSearchChip(attr: string, value: string, route: string, icon: JSX.Element, color: "primary" | "neutral" | "success" | "danger" | "warning" | undefined = "primary", size: ('sm' | 'md' | 'lg') ="md", sx: object = {}) {
  if (value){
    const path = `/config/${route}?elementSearchType=property&elementSearch=${attr}:${value}`;
    return(
      <Link to={path}>
        <Chip key={attr} sx={{mr: 1, ...sx}} color={color} startDecorator={icon} variant="outlined" onClick={(e) => e.stopPropagation()} size={size}>{value}</Chip>
      </Link>
    )
  }
}

export function createDataObjectChip(name: string, size: ('sm' | 'md' | 'lg') ="md", sx: object = {}){
  return(
    <Link to={"/config/dataObjects/"+name}>
      <Chip key={"dataObjects/"+name} color="primary" startDecorator={<TableViewTwoTone />} variant="outlined" className='chips' sx={{mr: 1, ...sx}} onClick={(e) => e.stopPropagation()} size={size}>{name}</Chip>
    </Link>
  )
}

export function createActionsChip(name: string, size: ('sm' | 'md' | 'lg') ="md", sx: object = {}){
  return(
    <Link to={"/config/actions/"+name}>
      <Chip key={"action/"+name} color="primary" startDecorator={<RocketLaunchOutlined />} variant="outlined" className='chips' sx={{mr: 1, ...sx}} onClick={(e) => e.stopPropagation()} size={size}>{name}</Chip>
    </Link>
  )
}

function createConnectionChip(name: string){
  return(
    <Link to={"/config/connections/"+name}>
      <Chip key={"connections/"+name} color="primary" startDecorator={<LanOutlinedIcon />} variant="outlined" >{name}</Chip>
    </Link>
  )
}

export function createFeedChip(feed: string, elementType: string, size: ('sm' | 'md' | 'lg') ="md", sx: object = {}){
  return createSearchChip("metadata.feed", feed, elementType, <AltRouteIcon />, "success", size, sx);
}

export function createSimpleChip(name: string) {
  return <Chip size="sm">{name}</Chip>
}

export default function ConfigurationTab(props: ElementProps) {

  // store the current stats entry to display
  const [statsEntry, setStatsEntry] = useState<TsIndexEntry>();

  // initialize stats entry if not yet set
  useEffect(() => {
    if (statsEntry && !props.statsIndex) {
      setStatsEntry(undefined);
    } else if (props.statsIndex && (!statsEntry  || (statsEntry && props.statsIndex && props.statsIndex.findIndex((e) => e.filename == statsEntry.filename) < 0))) {
      setStatsEntry(props.statsIndex[0]);
    }
  }, [props.statsIndex]);

	const { data: stats } = useFetchDataObjectStats(statsEntry);

	const { data: runs } = useFetchWorkflowRunsByElement(props.elementType, props.elementName);

  function getAttribute(attributeName: string) {
    return getPropertyByPath(props.data, attributeName);
  }

  //attributes to be displayed at the top of the page
  let topAttributes: {key: string, func: (x:any) => any}[] = [
    {key: "path", func: (x: any) => x},
    {key: "partitions", func: (cols: any) => <Stack spacing={0.5} direction="row">{(cols as string[]).map(col => createSimpleChip(col))}</Stack>}, 
    {key: "table", func: (tbl: any) => (tbl.db || (props.connection && props.connection.db) || "<db?>") + "." + tbl.name},
    {key: "table.primaryKey", func: (cols: any) => <Stack spacing={0.5} direction="row">{(cols as string[]).map(col => createSimpleChip(col))}</Stack>}, 
    {key: "db", func: (x: any) => x},
    {key: "pathPrefix", func: (x: any) => x},
    {key: "database", func: (x: any) => x},
    {key: "port", func: (x: any) => x},
    {key: "host", func: (x: any) => x},
    {key: "url", func: (x: any) => x},
    {key: "connectionId", func: (c: any) => createConnectionChip(c as string)}
  ]
  let topAttributesPrep = topAttributes.map(attr => {
    let value = getAttribute(attr.key);
    if (value) return {key: attr.key, value: attr.func(value)};
    else return {key: attr.key, value: undefined};
  })
  .filter(x => x.value); // filter if value undefined

  function layerChip(){
    let x = getAttribute('metadata.layer');
    return createSearchChip("metadata.layer", x, props.elementType, <LayersOutlined/>, "warning");
  }
  function subjectAreaChip(){
    let x = getAttribute('metadata.subjectArea');
    return createSearchChip("metadata.subjectArea", x, props.elementType, <ExploreOutlined/>, "warning");
  }  
  function feedChip(){
    return createFeedChip(getAttribute('metadata.feed'), props.elementType);
  }
  function typeChip(){
    let type = getAttribute('type');
    return createSearchChip("type", type, props.elementType, <StyleIcon />, "success");
  }
  function mainContent(){
    let propsToIgnore = topAttributes.map(x => x.key).concat(['metadata', 'type', 'inputId', 'inputIds', 'outputId', 'outputIds', 'id']);
    if (props.elementType === 'actions' || props.elementType === 'dataObjects' || props.elementType === 'connections'){
      return(<ConfigurationAccordions data={props.data} elementType={props.elementType} propsToIgnore={propsToIgnore} connectionDb={(props.connection ? props.connection.db : undefined)} />)
    } else { 
      throw new Error(`Unknown element Type ${props.elementType}`);
    }
  }
  function createStatsCmp(stats: Stats) {
    const statsPrep = {...stats};
    if (Object.keys(statsPrep).length > 0) {    
      statsPrep['Exported at'] = (
        <Select variant="plain" size='sm' value={statsEntry?.filename} onChange={(ev, value) => setStatsEntry(props.statsIndex?.find((e) => e.filename === value))}>
          {props.statsIndex?.map((e) => <Option key={e.filename} value={e.filename}>{formatTimestamp(e.ts)}</Option>)}
        </Select>      
      )
    }
    return (    
      <Box>
        {createPropertiesComponent({obj: statsPrep, orderProposal: ['Exported at', 'createdAt', 'lastModifiedAt', 'lastAnalyzedAt', 'lastAnalyzedColumnsAt', 'minPartition', 'maxPartition'], propsToIgnore: ['columns'], title: 'Table statistics'})}
      </Box>
    )
  }
  function createRunsCmp(runs: any[]) {
    const rows = runs.slice(-5).reverse().map((run,idx) => 
      <tr key={idx}>        
        <td style={{padding: '2px 5px'}}>{formatTimestamp(run.attemptStartTime)}</td>
        <td style={{padding: '2px 5px', width: 'auto'}}>
          <Link to={`/workflows/${run.name}/${run.runId}/${run.attemptId}/table`}>{getIcon(run.status, '0px', {display: 'block', margin: 'auto'})}</Link>
        </td>        
      </tr>
    )
    return (    
      <Box>
        <Typography level="title-sm" >Last 5 runs</Typography>
        <Table size='md' sx={{tableLayout: 'auto', width: 'max-content', maxWidth: '100%', borderCollapse: 'collapse', '& td': {padding: '0px', height: '32px', border: '1px solid var(--TableCell-borderColor)'}}}>
          <tbody>
            {rows}
          </tbody>
        </Table>        
      </Box>
    )
  }  
  
  let tags = getAttribute('metadata.tags') as string[] || [];
  let [inputs, outputs] = getInputOutputIds(props.data)
  let topAttributesCmp = createPropertiesComponent({properties: topAttributesPrep, orderProposal: ['table', 'path', 'partitions'], title: 'Main configuration'})
  let metadataDescriptionCmp = (props.data?.metadata?.description ? <MarkdownComponent markdown={props.data.metadata?.description}/> : <></>)

  return (
    <Box sx={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
      {metadataDescriptionCmp}
      <Box sx={{display: 'flex', flexWrap: 'wrap', gap: '1rem'}}>
        <Box flex={1}>
          {typeChip()}
          {feedChip()}
          {layerChip()}
          {subjectAreaChip()}
          {tags.map(tag => createSearchChip("tags", tag, props.elementType, <SellIcon />, "warning"))}
        </Box>
        {inputs.length > 0 && <Grid xs={12} xl={6}>{formatInputsOutputs(inputs,outputs)}</Grid>}
      </Box>
      <Box sx={{display: 'flex', flexWrap: 'wrap', gap: '1rem'}}>
        {topAttributesCmp && <><Box>{topAttributesCmp}</Box><Box flex={1}/></>}
        {runs && runs.length>0 && <><Box>{createRunsCmp(runs)}</Box><Box flex={1}/></>}
        {stats && <Box>{createStatsCmp(stats)}</Box>}
      </Box>
      {mainContent()}
    </Box>
  )
}
