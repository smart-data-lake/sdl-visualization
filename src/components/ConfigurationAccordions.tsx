import * as React from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
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
import { NumericLiteral, PropertySignature } from 'typescript';
import { Box, Tab, Tabs } from "@mui/material";
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import SellIcon from '@mui/icons-material/Sell';
import { exec } from 'child_process';



interface KV{
  key: string, 
  value: string
}

function createRow(key: string, value: string) {
  return { key, value };
}

/**
 * Returns "attribute" object or "undefined" if attribute not existent.
 * "attributeName" supports dot notation for sub attributes (e.g. one can pass a string "metadata.feed" as a parameter)
 **/
function getAttributeGeneral(jsonObject: any, elementName: string, elementType: string, attributeName: string){

  let attributeLevels = attributeName.split('.');
  attributeLevels = [elementType, elementName].concat(attributeLevels);

  let hasAttribute = true;

  let forObject = jsonObject;
  for(var i = 0; i<attributeLevels.length; i++ ){
    forObject = forObject[attributeLevels[i]];
    console.log()
    if (forObject === undefined){
      hasAttribute = false;
      break;
    }
  }

  return hasAttribute ? forObject : undefined;
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

function getExpectations(jsonObject: any, elementName: string, elementType: string){
  let element = jsonObject[elementType][elementName];
  return element['expectations'] !== undefined ? element['expectations'] : [] //if existent, returns a list of expectation objects (empty instead)
}



function formatExpectations(expectationsList: any[]): string {
  let expectationsAttributes = ['type','name','description','expectation', 'failedSeverity', 'scope', 'countConditionExpression', 'globalConditionExpression', 'aggExpression'];
  let expectationsMdString = '|';
  expectationsAttributes.forEach(attribute => expectationsMdString = expectationsMdString.concat(attribute, '|')); //header
  expectationsMdString = expectationsMdString.concat('\n', '|'); //next line and start header separator.
  expectationsAttributes.forEach(attribute => expectationsMdString = expectationsMdString.concat('----', '|')); //header separator line
  expectationsMdString = expectationsMdString.concat('\n');
  expectationsList.forEach(expectationObject => {
    expectationsAttributes.forEach(attribute => {
      expectationsMdString = expectationsMdString.concat('|', expectationObject[attribute]);
    });
    expectationsMdString = expectationsMdString.concat('|', '\n'); //next expectation
  });
  return expectationsMdString;
}

function formatTransformers(transformerObjects: any[]): string{
  let mdString = '';
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

/**
 * Returns a Markdown header and the type name (deprecated)
 */
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

function formatExecutionMode(execMode: any): string{
    let mdString = `### Execution Mode \n`;
    mdString = mdString.concat('\n |Property (key) | Value | \n |-----|-----|');
    Object.keys(execMode).forEach((key)=>{
        let value = JSON.stringify(execMode[key]).replaceAll('\\n', '').replaceAll('\\t', '').replaceAll('\\r', '');
        mdString = mdString.concat(`\n | ${key} | ${value} |`);
    });
    return mdString;
}

function formatExecutionCondition(execCondition: any): string{
    let mdString = `### Execution Condition \n`;
    mdString = mdString.concat('- **Expression**:', execCondition['expression'], '\n');
    mdString = mdString.concat('- **Description**:', execCondition['description'], '\n');
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

function markdownAccordion(accordionName: string, markdownText: string){
  return(
    <Accordion className='accordion' elevation={0}>
    <AccordionSummary
      expandIcon={<ExpandMoreIcon />}
      className='accordionSummary'
    >
      <Typography className='accordionTitle'>{accordionName}</Typography>
    </AccordionSummary>
    <AccordionDetails>
      <React.Fragment>
        <GlobalStyles styles={{ table: { width: '100% !important' } }} />
        <ReactMarkdown className='markdown-body' children={markdownText} remarkPlugins={[remarkGfm]} />
      </React.Fragment>
    </AccordionDetails>
  </Accordion>
  )
}





interface accordionCreatorProps {
  data: object;
  elementName: string;
  elementType: string;
  createdSections: string[]; //This shows which attributes should or should not be in the "additional attributes" accordion
}

export default function ConfigurationAccordions(props: accordionCreatorProps) {

  const getAttribute = (attributeName: string) => getAttributeGeneral(props.data, props.elementName, props.elementType, attributeName);
  let createdSections = props.createdSections;


  //Markdown Strings use in the accordions
  let foreignKeysMdString = 'No foreign keys defined for this element in the configuration files';
  let constraintsMdString = 'No constraints defined for this element in the configuration files';
  let expectationsMdString = 'No expectations defined for this element in the configuration files';
  let transformersMdString = 'No transformers defined for this element in the configuration files';
  let executionMdString = 'No execution mode or condition defined for this element in the configuration files';
  let mdString = ''; //Currently being used in additional properties. To be replaced. 


  //Formatting of Markdown Strings:
  //FOREIGN KEYS --> FOR DATA OBJECTS. TODO: See if defined structure/syntax for foreign keys in .config file is correct
  let foreignKeysList = getAttribute('table.foreignKeys');
  if (foreignKeysList !== undefined){
    foreignKeysMdString = '|table|columns|db (optional)|name (optional)| \n |---|---|---|---|';
    foreignKeysList.forEach((fkObject: any) => {
      foreignKeysMdString = foreignKeysMdString.concat('\n', '|', fkObject['table'], '|', fkObject['columns'], '|', fkObject['db'], '|', fkObject['name'], '|');
    });
  }

  //CONSTRAINTS --> FOR DATA OBJECTS. TODO: See if defined structure/syntax for foreign keys in .config file is correct
  let constraintsList = getAttribute('constraints');
  if (constraintsList !== undefined){
    constraintsMdString = '|constraint| \n |----|';
    constraintsList.forEach((c: any) => constraintsMdString = constraintsMdString.concat('\n', '|', c, '|'));
  }


  //EXPECTATIONS --> FOR DATA OBJECTS
  let expectations = getExpectations(props.data, props.elementName, props.elementType);
  if (expectations.length > 0){
    expectationsMdString = '';
    createdSections.push('expectations');
    expectationsMdString = expectationsMdString.concat('\n', '\n', formatExpectations(expectations));
  }

  //TRANSFORMERS --> FOR ACTIONS
function transformerAccordion(){
    let tr = getTransformers(props.data, props.elementName);
    if(tr.length>0){
        transformersMdString = '';
        createdSections.push('transformers');
        transformersMdString = transformersMdString.concat('\n', '\n', formatTransformers(tr));
    }
}

  //EXECUTION MODE / CONDITION --> FOR ACTIONS

  function execModeConditionAccordion(){
    let execMode = getAttribute('executionMode');
    let execCondition = getAttribute('executionCondition');
    if(execMode !== undefined || execCondition !== undefined){
        executionMdString = '';
    }
    if(execMode !== undefined){
        executionMdString = formatExecutionMode(execMode);
        createdSections.push('executionMode');
    }
    if(execCondition !== undefined){
        executionMdString = executionMdString.concat(formatExecutionCondition(execCondition));
        createdSections.push('executionCondition');
    }
}

  //ADDITIONAL PROPERTIES --> FOR ALL


  if(props.elementType==='actions'){transformerAccordion(); execModeConditionAccordion()};






  let rows = createElementRows(props.data, props.elementName, props.elementType);
  let metadataKV = getMetadataKV(props.data, props.elementName, props.elementType);



  if (metadataKV .length > 0){
    createdSections.push('metadata');
    mdString = mdString.concat('\n', '\n', formatMetadata(metadataKV));
  }

  
  if (rows.some((row) => !createdSections.includes(row.key))){ //Check if there are any additional keys
    let additionalConfigHeader = createdSections.length > 0 ? ' \n ## Addtional configuration attributes' : '## Configuration attributes';
    mdString = mdString.concat(`${additionalConfigHeader} \n \n |Property (key) | Value | \n |-----|-----|`);
    rows.forEach((row)=> {
      row.value = JSON.stringify(row.value).replaceAll('\\n', '').replaceAll('\\t', '').replaceAll('\\r', '');
      if (row.key != 'code'){
        row.value = row.value.replaceAll('"', '').replaceAll('\\', ''); //The second replace is needed as removing two double quotes results in a backslash
      }
      if (!createdSections.includes(row.key)){
        mdString = mdString.concat(`\n | ${row.key} | ${row.value} |`);
      }
    });
  }


  const accordionsParameters = [['Foreign Keys', foreignKeysMdString],
                                ['Constraints', constraintsMdString], 
                                ['Expectations', expectationsMdString],
                                ['Transformers', transformersMdString],
                                ['Execution Mode and Condition', executionMdString], 
                                ['Additional configurations', mdString]];

  const accordions = accordionsParameters.map(([accordionName, markdownText]) => markdownAccordion(accordionName, markdownText));



  return (
    <Box>
      {accordions}
    </Box>
  )
}