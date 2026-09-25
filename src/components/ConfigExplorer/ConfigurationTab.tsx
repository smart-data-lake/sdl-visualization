import { ExploreOutlined, LayersOutlined, OpenInNew, RocketLaunchOutlined, TableViewTwoTone } from '@mui/icons-material';
import AltRouteIcon from '@mui/icons-material/AltRoute';
import LanOutlinedIcon from '@mui/icons-material/LanOutlined';
import SellIcon from '@mui/icons-material/Sell';
import StyleIcon from '@mui/icons-material/Style';
import { Box, Chip, Grid, Select, Stack, Table, Tooltip, Typography } from '@mui/joy';
import Option from '@mui/joy/Option';
import 'github-markdown-css/github-markdown.css';
import { ReactNode, useEffect, useState } from 'react';
import { Link } from "react-router-dom";
import { useFetchDataObjectStats, useFetchRunsQuiet, useFetchWorkflowRunsByElement } from '../../hooks/useFetchData';
import { formatTimestamp } from '../../util/WorkflowsExplorer/date';
import { getPropertyByPath } from '../../util/helpers';
import './ComponentsStyles.css';
import ConfigurationAccordions from './ConfigurationAccordions';
import MarkdownComponent from './MarkdownComponent';
import { createPropertiesComponent } from './PropertiesComponent';
import { getIcon } from '../../util/WorkflowsExplorer/StatusInfo';
import { Stats, TstampEntry, WorkflowRun } from '../../types';
import { useWorkspace } from '../../hooks/useWorkspace';
import { updateStateFile } from '../../util/WorkflowsExplorer/Attempt';
import { ElementRunDetails, elementRunDetails } from '../../util/WorkflowsExplorer/elementRunDetails';
import { schemaViewerUrl } from '../../util/ConfigExplorer/schemaViewer';

interface ElementProps {
  data: any; // config of object to display
  connection?: any; // connection config of object to display
  dataObjects?: any; // every DataObject of the configuration, to tell a reference that leads somewhere from one that does not
  statsEntries?: TstampEntry[]; // list of available statistics entries, ordered from youngest to oldest
  elementName: string;
  elementType: string;
}

// a recursive input is declared apart from the other inputs, but it is read by the action all the same
function getInputOutputIds(action: any | undefined): [string[], string[], string[]]{
  if (!action) return [[],[],[]];
  const recursiveInputs: string[] = action['recursiveInputIds'] ?? [];
  const inputs: string[] = [...(action['inputIds'] ?? []), ...recursiveInputs];
  const outputs: string[] = [...(action['outputIds'] ?? [])];
  if (action['inputId']) inputs.push(action['inputId']);
  if (action['outputId']) outputs.push(action['outputId']);
  return [inputs, outputs, recursiveInputs];
}

function formatInputsOutputs(inputs: string[], outputs: string[], recursiveInputs: string[] = []): JSX.Element {
  return ( 
  <Box sx={{display: 'flex', flexDirection: 'column'}}>
    <Box sx={{display: 'flex', pb: '3px'}}>
      <Box sx={{flex: 1}}>Inputs</Box>
      <Box sx={{flex: 1, textAlign: 'right'}}>Outputs</Box>
    </Box>  
    <Box sx={{display: 'flex'}}>    
      <Stack sx={{flex: 1, height: '100%', alignSelf: 'center', marginRight: '15px'}} spacing={1}>
        {inputs.map((name,idx) => createDataObjectChip(name,'md',{},idx, recursiveInputs.includes(name) ? 'recursive input' : undefined))}
      </Stack>
      <Stack sx={{flex: 1, height: '100%', alignItems: 'end', alignSelf: 'center', marginLeft: '15px'}} spacing={1}>
        {outputs.map((name,idx) => createDataObjectChip(name,'md',{},idx))}
      </Stack>
    </Box>
  </Box>
  );
}

/*
  The create*Chip functions below are called from render bodies as plain functions - conditionally,
  and in .map() over config attributes. They must therefore not call useWorkspace() themselves: the
  number of hooks of the calling component would depend on the config being displayed, and react
  reports a change in hook order as soon as another element is selected. Each chip is a component
  instead, so the hook lives in its own scope.
*/

type ChipSize = 'sm' | 'md' | 'lg';
type ChipColor = "primary" | "neutral" | "success" | "danger" | "warning" | undefined;

// the search link is the chip's action slot rather than a wrapper, so an end decorator may hold a link of its own
function SearchChip({attr, value, route, icon, color, size, sx, endDecorator}:
                    {attr: string, value: string, route: string, icon: JSX.Element, color: ChipColor, size: ChipSize, sx: object, endDecorator?: ReactNode}) {
  const {contentPath} = useWorkspace();
  const path = (attr == "feedSel" ?
    `${contentPath}config/${route}?elementSearchType=${attr}&elementSearch=${value}` :
    `${contentPath}config/${route}?elementSearchType=property&elementSearch=${attr}:${value}`
  )
  return(
    <Chip key={attr} sx={{mr: 1, ...sx}} color={color} startDecorator={icon} endDecorator={endDecorator} variant="outlined"
          slotProps={{action: {component: Link, to: path} as any}} onClick={(e) => e.stopPropagation()} size={size}>{value}</Chip>
  )
}

export function createSearchChip(attr: string, value: string, route: string, icon: JSX.Element, color: ChipColor = "primary", size: ChipSize ="md", sx: object = {}, endDecorator?: ReactNode) {
  if (!value) return undefined;
  return <SearchChip key={attr+':'+value} attr={attr} value={value} route={route} icon={icon} color={color} size={size} sx={sx} endDecorator={endDecorator}/>
}

function SchemaViewerLink({url, type}: {url: string, type: string}) {
  return (
    <Tooltip title="Open in configuration schema viewer" size="sm" arrow enterDelay={500}>
      <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`${type} in configuration schema viewer`}
         onClick={(e) => e.stopPropagation()} style={{display: 'flex', pointerEvents: 'auto', color: 'inherit'}}>
        <OpenInNew sx={{fontSize: '1em'}}/>
      </a>
    </Tooltip>
  )
}

function DataObjectChip({name, size, sx, title}: {name: string, size: ChipSize, sx: object, title?: ReactNode}){
  const {contentPath} = useWorkspace();
  const chip = (
    <Link to={`${contentPath}config/dataObjects/${name}`}>
      <Chip key={"dataObjects/"+name} color="primary" startDecorator={<TableViewTwoTone />} variant="outlined" className='chips' sx={{mr: 1, ...sx}} onClick={(e) => e.stopPropagation()} size={size}>{name}</Chip>
    </Link>
  )
  // the span gives the tooltip something to hold on to that is not the link itself
  return (title ? <Tooltip title={title} size="sm" arrow enterDelay={500}><span>{chip}</span></Tooltip> : chip)
}

/** @param title what the chip says on hover, e.g. which foreign key leads there. None by default. */
export function createDataObjectChip(name: string, size: ChipSize ="md", sx: object = {}, key?: any, title?: ReactNode){
  return <DataObjectChip key={key} name={name} size={size} sx={sx} title={title}/>
}

/*
  A data object this configuration does not describe - a foreign key may name one that the exporter
  filtered away. It reads like a data object but leads nowhere, so it is not a link; the relations
  view marks the same reference as unresolved.
*/
export function createUnknownDataObjectChip(name: string, size: ChipSize ="md", sx: object = {}, key?: any, title: ReactNode = "not a DataObject of this configuration"){
  return (
    <Tooltip key={key} title={title} size="sm" arrow enterDelay={500}>
      <Chip color="neutral" startDecorator={<TableViewTwoTone />} variant="outlined" className='chips' sx={{mr: 1, ...sx}} size={size}>{name}</Chip>
    </Tooltip>
  )
}

function ActionsChip({name, size, sx}: {name: string, size: ChipSize, sx: object}){
  const {contentPath} = useWorkspace();
  return(
    <Link to={`${contentPath}config/actions/${name}`}>
      <Chip key={"action/"+name} color="primary" startDecorator={<RocketLaunchOutlined />} variant="outlined" className='chips' sx={{mr: 1, ...sx}} onClick={(e) => e.stopPropagation()} size={size}>{name}</Chip>
    </Link>
  )
}

export function createActionsChip(name: string, size: ChipSize ="md", sx: object = {}){
  return <ActionsChip key={"action/"+name} name={name} size={size} sx={sx}/>
}

function ConnectionChip({name}: {name: string}){
  const {contentPath} = useWorkspace();
  return(
    <Link to={`${contentPath}config/connections/${name}`}>
      <Chip key={"connections/"+name} color="primary" startDecorator={<LanOutlinedIcon />} variant="outlined" >{name}</Chip>
    </Link>
  )
}

function createConnectionChip(name: string){
  return <ConnectionChip key={"connections/"+name} name={name}/>
}

export function createFeedChip(feed: string, elementType: string, size: ChipSize ="md", sx: object = {}){
  return createSearchChip("feedSel", feed, elementType, <AltRouteIcon />, "success", size, sx);
}

export function createSimpleChip(name: string, key?: any) {
  return <Chip key={key} size="sm">{name}</Chip>
}

function TruncatedCell({text, title}: {text?: ReactNode, title?: ReactNode}) {
  if (text === undefined) return <td/>;
  return (
    <td style={{padding: '2px 5px'}}>
      <Tooltip title={title ?? text} size="sm" arrow enterDelay={500} sx={{maxWidth: '500px'}}>
        <Box sx={{maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{text}</Box>
      </Tooltip>
    </td>
  )
}

function startMillis(run: WorkflowRun): number {
  return run.attemptStartTime ? new Date(run.attemptStartTime).getTime() : 0;
}

// the details come from the runs' state files, so their columns appear once those are loaded and only if any run has a value
function LastRuns({runs, elementType, elementName}: {runs: WorkflowRun[], elementType: string, elementName: string}) {
  const {contentPath} = useWorkspace();
  // the local fetcher lists runs oldest first, the backend newest first
  const lastRuns = [...runs].sort((a, b) => startMillis(b) - startMillis(a)).slice(0, 5);
  const stateFiles = useFetchRunsQuiet(lastRuns);
  // a run whose state file is not loaded, or that has no details, still gets one row
  const details: ElementRunDetails[][] = stateFiles.map(query =>
    query.data ? elementRunDetails(updateStateFile(query.data), elementType, elementName) : []);
  const has = (key: keyof ElementRunDetails) => details.some(writes => writes.some(d => d[key] !== undefined));
  const columns = {actionId: has('actionId'), partitionValues: has('partitionValues'), incrementalState: has('incrementalState'), outputMetric: has('outputMetric')};
  const hasDetails = Object.values(columns).some(x => x);
  const rows = lastRuns.flatMap((run,runIdx) => {
    const writes: (ElementRunDetails | undefined)[] = details[runIdx].length > 0 ? details[runIdx] : [undefined];
    // several actions writing the same data object get one row each, below one set of run cells
    return writes.map((d, writeIdx) => {
      const metric = d?.outputMetric;
      return (
        <tr key={`${runIdx}.${writeIdx}`}>
          {writeIdx === 0 && <>
            <td rowSpan={writes.length} style={{padding: '2px 5px'}}>{formatTimestamp(run.attemptStartTime!)}</td>
            <td rowSpan={writes.length} style={{padding: '2px 5px', width: 'auto'}}>
              <Link to={`${contentPath}workflows/${run.name}/${run.runId}.${run.attemptId}/table`}>{getIcon(run.status!, '0px', {display: 'block', margin: 'auto'})}</Link>
            </td>
            <td rowSpan={writes.length} style={{padding: '2px 5px'}}><Link to={`${contentPath}workflows/${run.name}`}>{run.name}</Link></td>
          </>}
          {columns.actionId && <td style={{padding: '2px 5px'}}>{d?.actionId && createActionsChip(d.actionId, 'sm')}</td>}
          {columns.partitionValues && <TruncatedCell text={d?.partitionValues}/>}
          {columns.incrementalState && <TruncatedCell text={d?.incrementalState}/>}
          {columns.outputMetric && <TruncatedCell text={metric && `${metric.value} ${metric.name === 'files_written' ? 'files' : 'records'}`} title={metric?.all.map(m => `${m.name}: ${m.value}`).join(', ')}/>}
        </tr>
      )
    })
  })
  return (
    <Box>
      <Typography level="title-sm" >Last 5 runs</Typography>
      <Table size='md' sx={{tableLayout: 'auto', width: 'max-content', maxWidth: '100%', borderCollapse: 'collapse', '& td, & th': {padding: '0px', height: '32px', border: '1px solid var(--TableCell-borderColor)'}, '& th': {padding: '2px 5px', verticalAlign: 'middle'}}}>
        {hasDetails && <thead>
          <tr>
            <th>Started</th>
            <th>Status</th>
            <th>Workflow</th>
            {columns.actionId && <th>Action</th>}
            {columns.partitionValues && <th>{elementType === 'actions' ? 'Selected partitions' : 'Written partitions'}</th>}
            {columns.incrementalState && <th>Incremental state</th>}
            {columns.outputMetric && <th>Written</th>}
          </tr>
        </thead>}
        <tbody>
          {rows}
        </tbody>
      </Table>
    </Box>
  )
}

export default function ConfigurationTab(props: ElementProps) {

  // store the current stats entry to display
  const [statsEntry, setStatsEntry] = useState<TstampEntry>();

  // initialize stats entry if not yet set
  useEffect(() => {
    if (statsEntry && !props.statsEntries) {
      setStatsEntry(undefined);
    } else if (props.statsEntries && (!statsEntry  || (statsEntry && props.statsEntries && props.statsEntries.findIndex((e) => e.key == statsEntry.key) < 0))) {
      setStatsEntry(props.statsEntries[0]);
    }
  }, [props.statsEntries]);

	const { data: stats } = useFetchDataObjectStats(statsEntry);

	const { data: runs } = useFetchWorkflowRunsByElement(props.elementType, props.elementName);

  function getAttribute(attributeName: string) {
    return getPropertyByPath(props.data, attributeName);
  }

  function appendSeparator(v?: string) {
    return (v ? v+"." : '');
  }

  //attributes to be displayed at the top of the page
  let topAttributes: {key: string, func: (x:any) => any}[] = [
    {key: "path", func: (x: any) => x},
    {key: "partitions", func: (cols: any) => <Stack spacing={0.5} direction="row">{(cols as string[]).map((col,idx) => createSimpleChip(col,idx))}</Stack>}, 
    {key: "virtualPartitions", func: (cols: any) => <Stack spacing={0.5} direction="row">{(cols as string[]).map((col,idx) => createSimpleChip(col,idx))}</Stack>}, 
    {key: "table", func: (tbl: any) => appendSeparator(tbl.catalog || props.connection?.catalog) + (tbl.db || props.connection?.db || "<db?>") + "." + tbl.name},
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
    const url = schemaViewerUrl(props.elementType, type);
    return createSearchChip("type", type, props.elementType, <StyleIcon />, "success", "md", {}, url && <SchemaViewerLink url={url} type={type}/>);
  }
  function mainContent(){
    let propsToIgnore = topAttributes.map(x => x.key).concat(['metadata', 'type', 'inputId', 'inputIds', 'recursiveInputIds', 'outputId', 'outputIds', 'id']);
    if (props.elementType === 'actions' || props.elementType === 'dataObjects' || props.elementType === 'connections'){
      return(<ConfigurationAccordions data={props.data} elementType={props.elementType} propsToIgnore={propsToIgnore} dataObjects={props.dataObjects} />)
    } else { 
      throw new Error(`Unknown element Type ${props.elementType}`);
    }
  }
  function createStatsCmp(stats: Stats) {
    const statsPrep = {...stats};
    if (Object.keys(statsPrep).length > 0) {    
      statsPrep['Exported at'] = (
        <Select variant="plain" size='sm' value={statsEntry?.key} onChange={(ev, value) => setStatsEntry(props.statsEntries?.find((e) => e.key === value))}>
          {props.statsEntries?.map((e) => <Option key={e.key} value={e.key}>{formatTimestamp(e.tstamp)}</Option>)}
        </Select>      
      )
    }
    return (    
      <Box>
        {createPropertiesComponent({obj: statsPrep, orderProposal: ['Exported at', 'createdAt', 'lastModifiedAt', 'lastAnalyzedAt', 'lastAnalyzedColumnsAt', 'minPartition', 'maxPartition'], propsToIgnore: ['columns'], title: 'Table statistics'})}
      </Box>
    )
  }
  let tags = getAttribute('metadata.tags') as string[] || [];
  let [inputs, outputs, recursiveInputs] = getInputOutputIds(props.data)
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
          {tags.map(tag => createSearchChip("metadata.tags", tag, props.elementType, <SellIcon />, "warning"))}
        </Box>
        {inputs.length > 0 && <Grid xs={12} xl={6}>{formatInputsOutputs(inputs,outputs,recursiveInputs)}</Grid>}
      </Box>
      <Box sx={{display: 'flex', flexWrap: 'wrap', gap: '1rem'}}>
        {topAttributesCmp && <><Box>{topAttributesCmp}</Box></>}
        {runs && runs.length>0 && <><Box flex={1}/><Box><LastRuns runs={runs} elementType={props.elementType} elementName={props.elementName}/></Box></>}
        {stats && <><Box flex={1}/><Box>{createStatsCmp(stats)}</Box></>}
      </Box>
      {mainContent()}
    </Box>
  )
}
