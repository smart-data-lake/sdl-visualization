import './ComponentsStyles.css';
import 'github-markdown-css/github-markdown.css';
import { Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { Box } from "@mui/material";
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import SellIcon from '@mui/icons-material/Sell';
import StyleIcon from '@mui/icons-material/Style';
import ConfigurationAccordions from './ConfigurationAccordions';
import AltRouteIcon from '@mui/icons-material/AltRoute';
import Grid from '@mui/material/Grid';
import { getAttributeGeneral } from '../../util/ConfigSearchOperation';
import { Link } from "react-router-dom";
import { ExploreOutlined, LayersOutlined, TableViewTwoTone } from '@mui/icons-material';
import LanOutlinedIcon from '@mui/icons-material/LanOutlined';
import { createPropertiesComponent } from './PropertiesComponent';



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
  return <TableContainer component={Paper} elevation={3}>
  <Table size="small">
    <TableHead>
      <TableRow>
        <TableCell>Inputs</TableCell>
        <TableCell align="right">Outputs</TableCell>
      </TableRow>
    </TableHead>
    <TableBody>
      <TableRow key="1">
        <TableCell component="th" scope="row">       
          <Stack spacing={1}>{inputs.map(name => createDataObjectChip(name))}</Stack>
        </TableCell>
        <TableCell align="right">
          <Stack spacing={1}>{outputs.map(name => createDataObjectChip(name))}</Stack>
        </TableCell>
      </TableRow>
    </TableBody>
  </Table>        
  </TableContainer>;
}

function createSearchChip(attr: string, value: string, icon: JSX.Element, color: "primary" | "default" | "success" | "secondary" | "error" | "info" | "warning" | undefined = "primary") {
  if (value){
    const path = `/search/${attr}=${value}`;
    return(
      <Link to={path}>
        <Chip label={value} sx={{mr: 1}}
          color={color}
          icon={icon}
          variant="outlined" 
          className='chips'/>
      </Link>
    )
  }
}

function createDataObjectChip(name: string){
  return(
    <Link to={"/dataObjects/"+name}>
      <Chip label={name}
        color="primary"
        icon={<TableViewTwoTone />}
        variant="outlined" 
        className='chips'/>
    </Link>
  )
}

function createConnectionChip(name: string){
  return(
    <Link to={"/connections/"+name}>
      <Chip label={name}
        color="primary"
        icon={<LanOutlinedIcon />}
        variant="outlined" 
        className='chips'/>
    </Link>
  )
}

export function createSimpleChip(name: string) {
  return <Chip label={name} size="small"/>
}

export default function ConfigurationTab(props: ElementProps) {

  const getAttribute = (attributeName: string) => getAttributeGeneral(props.data, attributeName.split('.'));

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
    return createSearchChip("layer", x, <LayersOutlined/>, "secondary");
  }
  function subjectAreaChip(){
    let x = getAttribute('metadata.subjectArea');
    return createSearchChip("subjectArea", x, <ExploreOutlined/>, "secondary");
  }  
  function feedChip(){
    let feed = getAttribute('metadata.feed');
    return createSearchChip("feed", feed, <AltRouteIcon />, "success");
  }
  function typeChip(){
    let type = getAttribute('type');
    return createSearchChip("type", type, <StyleIcon />, "success");
  }
  function mainContent(){
    let propsToIgnore = topAttributes.map(x => x.key).concat(['metadata', 'type', 'inputId', 'inputIds', 'outputId', 'outputIds']);
    if (props.elementType === 'actions' || props.elementType === 'dataObjects' || props.elementType === 'connections'){
      return(<ConfigurationAccordions data={props.data} elementType={props.elementType} propsToIgnore={propsToIgnore} connectionDb={(props.connection && props.connection.db) as string} />)
    } else { 
      throw new Error(`Unknown element Type ${props.elementType}`);
    }
  }

  let tags = getAttribute('metadata.tags') as string[] || [];
  let [inputs, outputs] = getInputOutputIds(props.data)
  let topAttributesCmp = createPropertiesComponent({properties: topAttributesPrep, width: "100%", rowHeight: "45px"})

  return (
    <Box>
      <Grid container spacing={2}>
        <Grid item xs={12} xl={6}>
          <Box>
          {typeChip()}
          {feedChip()}
          {layerChip()}
          {subjectAreaChip()}
          {tags.map(tag => createSearchChip("tags", tag, <SellIcon />, "secondary"))}
          </Box>
        </Grid>
        {topAttributesCmp && <Grid item xs={12} xl={6}>{topAttributesCmp}</Grid>}
        {inputs.length > 0 && <Grid item xs={12} xl={6}>{formatInputsOutputs(inputs,outputs)}</Grid>}
        <Grid item xs={12}>{mainContent()}</Grid>
      </Grid>
    </Box>
  )
}
