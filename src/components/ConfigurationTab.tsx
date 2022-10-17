import * as React from 'react';
import './ComponentsStyles.css';
import 'github-markdown-css/github-markdown.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import 'github-markdown-css/github-markdown.css';
import { GlobalStyles } from '@mui/material';
import { Box } from "@mui/material";
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import SellIcon from '@mui/icons-material/Sell';
import ConfigurationAccordions from './ConfigurationAccordions';
import AltRouteIcon from '@mui/icons-material/AltRoute';
import Grid from '@mui/material/Grid';
import { getAttributeGeneral } from '../util/ConfigSearchOperation';
import { Link } from "react-router-dom";
import { TOP_ATTRIBUTES } from "../util/TopAttributes";



interface detailsTableProps {
  data: any; // config of object to display
  elementName: string;
  elementType: string;
}


function getInputOutputIds(action: any): [string[], string[]]{
  let inputs: string[] = [];
  let outputs: string[] = [];

  let hasManyInputs = action['inputIds'] !== undefined; //we assume that each action has either inputId or InputIds (same for outputs)
  let hasManyOutputs = action['outputIds'] !== undefined;
  
  if (hasManyInputs){
    let inputList = action['inputIds'] as string[];
    inputList.forEach((item) => inputs.push(item));
  } else inputs.push(action['inputId'] as string);

  if (hasManyOutputs){
    let outputList = action['outputIds'] as string[];
    outputList.forEach((item) => outputs.push(item));
  } else outputs.push(action['outputId'] as string);

  return [inputs, outputs];
}

function formatInputsOutputs(inputs: string[], outputs: string[]): [string, string]{
  let formattedInputs = '|Inputs| \n |----| \n';
  inputs.forEach((input) => {
    formattedInputs = formattedInputs.concat(`|[${input}](http://${window.location.host}/#/dataObjects/${input})|`, '\n');
  });
  let formattedOutputs = '|Outputs| \n |----| \n';
  outputs.forEach((output) => {
    formattedOutputs = formattedOutputs.concat(`|[${output}](http://${window.location.host}/#/dataObjects/${output})|`, '\n');
  });
  return [formattedInputs, formattedOutputs];
}


export default function ConfigurationTab(props: detailsTableProps) {

  const getAttribute = (attributeName: string) => getAttributeGeneral(props.data, attributeName.split('.'));

  let createdSections: string[] = [];
  let topMdString = '';
  

  //attributes to be displayed at the top of the page
  let topAttributes: string[] = TOP_ATTRIBUTES;

  createdSections.push('table', 'metadata'); //Push manually because we read sub-attributes
  topAttributes.forEach(attributeName => {
    let att = getAttribute(attributeName);
    createdSections.push(attributeName);
    if (att){
      topMdString = topMdString.concat('\n', "**", attributeName, "**: ", att, '\n');
      }
  });



  let tagsList = getAttribute('metadata.tags');
  const tags = tagsList === undefined ? (<div></div>) : tagsList.map((tag: string) => {
    let path = `/search/tags=${tag}`;
    return(
      <Link to={path}>
        <Chip label={tag}
          color="primary"
          icon={<SellIcon />}
          variant="outlined" 
          className='chips'/>
      </Link>);
    });

  function feedChip(){
    let feed = getAttribute('metadata.feed');
    if (feed){
      const path = `/search/feed=${feed}`;
      return(
        <Link to={path}>
          <Chip label={'feed: ' + feed}
            color="success"
            icon={<AltRouteIcon />}
            variant="outlined" 
            className='chips'/>
        </Link>
      )
    }
  }

  createdSections.push('metadata.tags', 'metadata.feed'); //must be done after the top attributes are rendered.

  function inputOutputTables(){
    if (props.elementType === 'actions'){
      let [inputs, outputs] = getInputOutputIds(props.data)
      let [formattedInputs, formattedOutputs] = formatInputsOutputs(inputs, outputs);
      return(
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <React.Fragment>
              <GlobalStyles styles={{ table: { width: '100% !important' } }} />
              <ReactMarkdown className='markdown-body' children={formattedInputs} remarkPlugins={[remarkGfm]} />
            </React.Fragment>
          </Grid>
          <Grid item xs={6}>
            <React.Fragment>
              <GlobalStyles styles={{ table: { width: '100% !important' } }} />
              <ReactMarkdown className='markdown-body' children={formattedOutputs} remarkPlugins={[remarkGfm]} />
            </React.Fragment>          
          </Grid>
        </Grid>
      )
    }
    return(<div></div>) //returns nothing if the selected element are not actions
  }

  function bodyContent(){
    if (props.elementType === 'actions' || props.elementType === 'dataObjects' || props.elementType === 'connections'){
      return(<ConfigurationAccordions data={props.data} elementType={props.elementType} createdSections={createdSections} />)
    } 
    else{throw new Error(`Unknown element Type ${props.elementType}`);}
  }


  return (
    <Box>
      <Grid container spacing={2}>
        <Grid item xs={5}>
          <React.Fragment>
            <GlobalStyles styles={{ table: { width: '100% !important' } }} />
            <ReactMarkdown className='markdown-body' children={topMdString} remarkPlugins={[remarkGfm]} />
          </React.Fragment>
        </Grid>
        <Grid item xs={7}>
          {inputOutputTables()}
        </Grid>
      </Grid>
      <Stack spacing={1} alignItems="left" className='chipStack'>
        <Stack direction="row" spacing={2}>
          {tags}
          {feedChip()}
        </Stack>
      </Stack>
      <br />
      {bodyContent()}
    </Box>
  )
}
