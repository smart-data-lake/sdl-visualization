import * as React from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell, { tableCellClasses } from '@mui/material/TableCell';
import { styled } from '@mui/material/styles';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import './ComponentsStyles.css';
import 'github-markdown-css/github-markdown.css';
import { orange } from '@mui/material/colors';
import CSS from 'csstype';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import parseCustomMarkdown from '../util/MarkdownParser';
import 'github-markdown-css/github-markdown.css';
import { GlobalStyles } from '@mui/material';
import { NumericLiteral } from 'typescript';



interface KV{
  key: string, 
  value: string
}

function createRow(key: string, value: string) {
  return { key, value };
}

function getType(jsonObject: any, elementName: string, elementType: string){
  let hasType = 
  jsonObject[elementType] != undefined 
  && jsonObject[elementType][elementName] != undefined
  && jsonObject[elementType][elementName]['type'] != undefined;

  return hasType ? jsonObject[elementType][elementName]['type'] : undefined;
}

function getMetadataKV(jsonObject:any, elementName: string, elementType: string){
  let hasMetadata = 
    jsonObject[elementType] != undefined 
    && jsonObject[elementType][elementName] != undefined
    && jsonObject[elementType][elementName]['metadata'] != undefined;
  
  let kv: KV [] = [];

  if (hasMetadata){
    let list = Object.keys(jsonObject[elementType][elementName]['metadata']);
    list.forEach((field) => {
      const obj = {key: field, value: JSON.stringify(jsonObject[elementType][elementName]['metadata'][field])};
      kv.push(obj);
    });
  }
  return kv; //returns empty list if no metadata found
}

function getInputOutputIds(jsonObject: any, actionName: string): [string[], string[]]{
  let inputs: string[] = [];
  let outputs: string[] = [];

  let action = jsonObject['actions'][actionName];
  let hasManyInputs = action['inputIds'] != undefined; //we assume that each action has either inputId or InputIds (same for outputs)
  let hasManyOutputs = action['outputIds'] != undefined;
  
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

function getTransformers(jsonObject: any, actionName: string){
  let action = jsonObject['actions'][actionName];
  if(action['transformers']!= undefined){
    return action['transformers']; //returns a list of transformer objects
  }
  return []; //returns empty list if there are no transformers in the configuration
}

function formatTransformers(transformerObjects: any[]): string{
  let mdString = '## Transformers \n';
  let trNumber = 1;
  transformerObjects.forEach((tr) =>{
    mdString = mdString.concat('\n', `### ${trNumber.toString()}. Transformer \n`);
    trNumber += 1;
    mdString = mdString.concat('\n |Property (key) | Value | \n |-----|-----|');
    Object.keys(tr).forEach((key)=>{
      let value = JSON.stringify(tr[key]).replaceAll('\\n', '').replaceAll('\\t', '').replaceAll('\\r', '');
      if (key != 'code'){
        value = value.replace(/"/g, '').replaceAll('\\', ''); //The second replace is needed as removing two double quotes results in a backslash
      }
      else{ //Remove only first and last double quote from code.
        if (value.charAt(value.length -1 ) === '"'){value = value.substring(0, value.length - 2);}
        if (value.charAt(0) === '"'){value = value.substring(1, value.length - 1);}
      }
      mdString = mdString.concat(`\n | ${key} | ${value} |`);
    });
  });
  return mdString;
}

function formatType(type: any, elementType: string){
  return `## ${elementType.slice(0, -1)} type \n \n ${JSON.stringify(type).replaceAll('"', '')} \n`; //"dataObjects" becomes "dataObject"
}

function formatMetadata(keyvalue: KV[]){
  let mdString = '## Metadata \n';
  keyvalue.forEach((kv) => {
    mdString = mdString.concat('\n', `- **${kv.key}** : ${kv.value.replaceAll('"', '')}`);
  });
  return mdString;
}

function formatInputsOutputs(inputs: string[], outputs: string[]){
  let mdString = '## Inputs \n';
  inputs.forEach((input) => {
    mdString = mdString.concat('\n', `- [${input}](http://${window.location.host}/#/dataObjects/${input})`);
  });
  mdString = mdString.concat('\n', '\n', '## Outputs \n');
  outputs.forEach((output) => {
    mdString = mdString.concat('\n', `- [${output}](http://${window.location.host}/#/dataObjects/${output})`);
  });
  return mdString;
}

//elementType can be 'actions', 'dataObjects' or 'global'. Returns a list of "simple" rows. 
function createElementRows(jsonObject: any, elementName: string, elementType: string) {
  if (elementType==='global'){
    var keyList = Object.keys(jsonObject[elementType]);
    return keyList.map(key => createRow(key, JSON.stringify(jsonObject[elementType][key], null, '\t')));
  }
  var keyList = Object.keys(jsonObject[elementType][elementName]);
  return keyList.map(key => createRow(key, JSON.stringify(jsonObject[elementType][elementName][key], null, '\t')));
}





interface detailsTableProps {
  data: object;
  elementName: string;
  elementType: string;
}
 
interface row{
  key: string;
  value: string;
}

export default function MetadataTable(props: detailsTableProps) {


  let rows = createElementRows(props.data, props.elementName, props.elementType);
  let createdTables: string[] = [];

  let mdString = '';
  let type = getType(props.data, props.elementName, props.elementType);
  
  if(type != undefined){
    createdTables.push('type');
    mdString = mdString.concat('\n', '\n', formatType(type, props.elementType));
  }

  let metadataKV = getMetadataKV(props.data, props.elementName, props.elementType);

  if (metadataKV .length > 0){
    createdTables.push('metadata');
    mdString = mdString.concat('\n', '\n', formatMetadata(metadataKV));
  }

  if(props.elementType === 'actions'){
    let tr = getTransformers(props.data, props.elementName);
    if(tr.length>0){
      createdTables.push('transformers');
      mdString = mdString.concat('\n', '\n', formatTransformers(tr));
    }
    createdTables.push('inputId', 'inputIds', 'outputId', 'outputIds');
    let inputsOutputs = getInputOutputIds(props.data, props.elementName);
    mdString = mdString.concat('\n', '\n', formatInputsOutputs(inputsOutputs[0], inputsOutputs[1]));
  }

  
  if (rows.some((row) => !createdTables.includes(row.key))){ //Check if there are any additional keys
    let additionalConfigHeader = createdTables.length > 0 ? ' \n ## Addtional configuration attributes' : '## Configuration attributes';
    mdString = mdString.concat(`${additionalConfigHeader} \n \n |Property (key) | Value | \n |-----|-----|`);
    rows.forEach((row)=> {
      row.value = JSON.stringify(row.value).replaceAll('\\n', '').replaceAll('\\t', '').replaceAll('\\r', '');
      if (row.key != 'code'){
        row.value = row.value.replaceAll('"', '').replaceAll('\\', ''); //The second replace is needed as removing two double quotes results in a backslash
      }
      if (!createdTables.includes(row.key)){
        mdString = mdString.concat(`\n | ${row.key} | ${row.value} |`);
      }
    });
  }




  return (
    <React.Fragment>
      <GlobalStyles styles={{ table: { width: '100% !important' } }} />
      <ReactMarkdown className='markdown-body' children={mdString} remarkPlugins={[remarkGfm]} />
    </React.Fragment>
  )
}


/**
 * First (old) implementation using material UI for the table. Switched to Markdown in order to keep formatting coherence.
 */
function MetadataTableOld(props: detailsTableProps) {

  //Styles of header and rows
const StyledTableCell = styled(TableCell)(({ theme }) => ({
  [`&.${tableCellClasses.head}`]: {
    color: theme.palette.common.black,
  },
  [`&.${tableCellClasses.body}`]: {
    fontSize: 14,
  },
}));

  const rows = createElementRows(props.data, props.elementName, props.elementType);




  return (
    <div>
      <TableContainer component={Paper}>
        <Table sx={{ minWidth: 650 }} aria-label="simple table">
          <TableHead>
            <TableRow>
              <TableCell>Property (Key)</TableCell>
              <TableCell>Value</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.key}
                sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
              >
                <TableCell component="th" scope="row">
                  {row.key}
                </TableCell>
                <TableCell>{row.value}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  )
}
