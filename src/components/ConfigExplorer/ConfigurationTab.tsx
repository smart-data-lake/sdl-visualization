import { ExploreOutlined, LayersOutlined, TableViewTwoTone } from '@mui/icons-material';
import AltRouteIcon from '@mui/icons-material/AltRoute';
import LanOutlinedIcon from '@mui/icons-material/LanOutlined';
import SellIcon from '@mui/icons-material/Sell';
import StyleIcon from '@mui/icons-material/Style';
import 'github-markdown-css/github-markdown.css';
import { Link } from "react-router-dom";
import { getPropertyByPath } from '../../util/helpers';
import './ComponentsStyles.css';
import ConfigurationAccordions from './ConfigurationAccordions';
import { createPropertiesComponent } from './PropertiesComponent';
import { Box, Chip, Grid, Stack, Table } from '@mui/joy';

interface ElementProps {
  data: any; // config of object to display
  connection?: any; // connection config of object to display
  elementName: string;
  elementType: string;
}

function getInputOutputIds(action: any): [string[], string[]]{
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

function createSearchChip(attr: string, value: string, route: string, icon: JSX.Element, color: "primary" | "neutral" | "success" | "danger" | "warning" | undefined = "primary") {
  if (value){
    const path = `/config/${route}?elementSearchType=property&elementSearch=${attr}:${value}`;
    return(
      <Link to={path}>
        <Chip sx={{mr: 1}}
          color={color}
          startDecorator={icon}
          variant="outlined" 
          className='chips'>{value}</Chip>
      </Link>
    )
  }
}

function createDataObjectChip(name: string){
  return(
    <Link to={"/config/dataObjects/"+name}>
      <Chip
        color="primary"
        startDecorator={<TableViewTwoTone />}
        variant="outlined" 
        className='chips'>{name}</Chip>
    </Link>
  )
}

function createConnectionChip(name: string){
  return(
    <Link to={"/config/connections/"+name}>
      <Chip
        color="primary"
        startDecorator={<LanOutlinedIcon />}
        variant="outlined" 
        className='chips'>{name}</Chip>
    </Link>
  )
}

export function createSimpleChip(name: string) {
  return <Chip size="sm">{name}</Chip>
}

export default function ConfigurationTab(props: ElementProps) {

  const getAttribute = (attributeName: string) => getPropertyByPath(props.data, attributeName);

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
    let feed = getAttribute('metadata.feed');
    return createSearchChip("metadata.feed", feed, props.elementType, <AltRouteIcon />, "success");
  }
  function typeChip(){
    let type = getAttribute('type');
    return createSearchChip("type", type, props.elementType, <StyleIcon />, "success");
  }
  function mainContent(){
    let propsToIgnore = topAttributes.map(x => x.key).concat(['metadata', 'type', 'inputId', 'inputIds', 'outputId', 'outputIds', 'id']);
    if (props.elementType === 'actions' || props.elementType === 'dataObjects' || props.elementType === 'connections'){
      return(<ConfigurationAccordions data={props.data} elementType={props.elementType} propsToIgnore={propsToIgnore} connectionDb={(props.connection && props.connection.db) as string} />)
    } else { 
      throw new Error(`Unknown element Type ${props.elementType}`);
    }
  }

  let tags = getAttribute('metadata.tags') as string[] || [];
  let [inputs, outputs] = getInputOutputIds(props.data)
  let topAttributesCmp = createPropertiesComponent({properties: topAttributesPrep, orderProposal: ['table', 'path', 'partitions']})

  return (
    <Box sx={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
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
      {topAttributesCmp && <Grid>{topAttributesCmp}</Grid>}
      {mainContent()}
    </Box>
  )
}
