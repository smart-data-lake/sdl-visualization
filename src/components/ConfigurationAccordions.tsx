import * as React from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import './ComponentsStyles.css';
import 'github-markdown-css/github-markdown.css';
import 'github-markdown-css/github-markdown.css';
import { Box} from "@mui/material";
import { getAttributeGeneral } from '../util/ConfigSearchOperation';
import MarkdownComponent from './MarkdownComponent';
import PropertiesComponent from './PropertiesComponent';


interface KV{
  key: string, 
  value: string
}

function createRow(key: string, value: string) {
  return { key, value };
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

function getTransformers(action: any){
  if(action['transformers']){
    return action['transformers']; //returns a list of transformer objects
  }
  return []; //returns empty list if there are no transformers in the configuration
}




function formatExpectations(expectationsList: any[]): string {
  let expectationsAttributes = ['type','name','description','expectation', 'failedSeverity', 'scope', 'countConditionExpression', 'globalConditionExpression', 'aggExpression'];
  let expectationsadditionalConfigsMd = '|';
  expectationsAttributes.forEach(attribute => expectationsadditionalConfigsMd = expectationsadditionalConfigsMd.concat(attribute, '|')); //header
  expectationsadditionalConfigsMd = expectationsadditionalConfigsMd.concat('\n', '|'); //next line and start header separator.
  expectationsAttributes.forEach(attribute => expectationsadditionalConfigsMd = expectationsadditionalConfigsMd.concat('----', '|')); //header separator line
  expectationsadditionalConfigsMd = expectationsadditionalConfigsMd.concat('\n');
  expectationsList.forEach(expectationObject => {
    expectationsAttributes.forEach(attribute => {
      expectationsadditionalConfigsMd = expectationsadditionalConfigsMd.concat('|', expectationObject[attribute]);
    });
    expectationsadditionalConfigsMd = expectationsadditionalConfigsMd.concat('|', '\n'); //next expectation
  });
  return expectationsadditionalConfigsMd;
}

function formatTransformers(transformerObjects: any[]): string{
  let additionalConfigsMd = '';
  let trNumber = 1;
  transformerObjects.forEach((tr) =>{
    additionalConfigsMd = additionalConfigsMd.concat('\n', `### ${trNumber.toString()}. Transformer \n`);
    trNumber += 1;
    additionalConfigsMd = additionalConfigsMd.concat('\n |Property (key) | Value | \n |-----|-----|');
    Object.keys(tr).forEach((key)=>{
      let value = JSON.stringify(tr[key]).replaceAll('\\n', '').replaceAll('\\t', '').replaceAll('\\r', '');
      if (key != 'code'){
        value = value.replace(/"/g, '').replaceAll('\\', ''); //The second replace is needed as removing two double quotes results in a backslash
      }
      else{ //Remove only first and last double quote from code.
        if (value.charAt(value.length -1 ) === '"'){value = value.substring(0, value.length - 2);}
        if (value.charAt(0) === '"'){value = value.substring(1, value.length - 1);}
      }
      additionalConfigsMd = additionalConfigsMd.concat(`\n | ${key} | ${value} |`);
    });
  });
  return additionalConfigsMd;
}

function formatExecutionMode(execMode: any): string{
    let additionalConfigsMd = '';
    additionalConfigsMd = additionalConfigsMd.concat('|Property (key) | Value | \n |-----|-----|');
    Object.keys(execMode).forEach((key)=>{
        let value = JSON.stringify(execMode[key]).replaceAll('\\n', '').replaceAll('\\t', '').replaceAll('\\r', '');
        additionalConfigsMd = additionalConfigsMd.concat(`\n | ${key} | ${value} |`);
    });
    return additionalConfigsMd;
}

function formatExecutionCondition(execCondition: any): string{
    let additionalConfigsMd = '';
    additionalConfigsMd = additionalConfigsMd.concat('- **Expression**:', execCondition['expression'], '\n');
    additionalConfigsMd = additionalConfigsMd.concat('- **Description**:', execCondition['description'], '\n');
    return additionalConfigsMd;
}

function createElementRows(obj: any) {
  var keyList = Object.keys(obj);
  return keyList.map(key => createRow(key, JSON.stringify(obj[key], null, '\t')));
}


interface AccordionCreatorProps {
  data: any; // config of object to display
  elementType: string;
  createdSections: string[]; //This shows which attributes should or should not be in the "additional attributes" accordion
}

export default function ConfigurationAccordions(props: AccordionCreatorProps) {

  const getAttribute = (attributeName: string) => getAttributeGeneral(props.data, attributeName.split('.'));
  var accordionSections = new Map<string,[string,JSX.Element]>();
  const [openAccordion, setOpenAccordion] = React.useState('none'); //none of the accordions are open at the beginning

  // reset accordion on element change
  React.useEffect(() => setOpenAccordion('none'), [props.data]);

  //Only one accordion open at a time
  const handleChange = (accordionName: string) => (event: React.SyntheticEvent, isExpanded: boolean) =>
    setOpenAccordion(isExpanded ? accordionName : 'none')
  
  //Formatting of Markdown Strings:
  //FOREIGN KEYS --> FOR DATA OBJECTS. TODO: See if defined structure/syntax for foreign keys in .config file is correct
  function foreignKeysAccordion(){
    let foreignKeysList = getAttribute('table.foreignKeys');
    if (foreignKeysList && foreignKeysList.length>0){
      var foreignKeyMd = '|table|columns (key)|columns (value)|db (optional)|name (optional)| \n |---|---|---|---|---|';
      foreignKeysList.forEach((fkObject: any) => {
        let cKey = Object.keys(fkObject['columns'])[0];
        let [columnsKey, columnsValue] = [cKey, fkObject['columns'][cKey]]
        foreignKeyMd = foreignKeyMd.concat('\n', '|', fkObject['table'], '|', columnsKey, '|', columnsValue, '|', fkObject['db'], '|', fkObject['name'], '|');
      });
      accordionSections.set('table.foreignKeys', ['Foreign Keys', <MarkdownComponent markdown={foreignKeyMd} />]);
    }
  }

  

  //CONSTRAINTS --> FOR DATA OBJECTS. TODO: See if defined structure/syntax for foreign keys in .config file is correct
  function constraintsAccordion(){
    let constraintsList = getAttribute('constraints');
    if (constraintsList && constraintsList.length>0){
      var constraintsMd = '|constraint| \n |----|';
      constraintsList.forEach((c: any) => constraintsMd = constraintsMd.concat('\n', '|', c, '|'));
      accordionSections.set('constraints', ['Constraints', <MarkdownComponent markdown={constraintsMd} />]);
    }
  }


  //EXPECTATIONS --> FOR DATA OBJECTS
  function expectationsAccordion(){
    let expectations = getAttribute('expectations');
    if (expectations && expectations.length>0){
      var expectationsMd = formatExpectations(expectations);
      accordionSections.set('expectations', ['Expectations', <MarkdownComponent markdown={expectationsMd} />]);
    }
  }

  //TRANSFORMERS --> FOR ACTIONS
  function transformerAccordion(){
    let tr = getTransformers(props.data);
    if (tr && tr.length>0){
      var transformersMd = formatTransformers(tr);
      accordionSections.set('transformers', ['Transformers', <MarkdownComponent markdown={transformersMd} />]);
    }
  }

  //EXECUTION MODE / CONDITION --> FOR ACTIONS
  function execModeAccordion(){
    let execMode = getAttribute('executionMode');
    if(execMode){
      accordionSections.set('executionMode', ['Execution Mode', <PropertiesComponent obj={execMode} />]);
    }
  }

  //EXECUTION CONDITION --> FOR ACTIONS
  function execConditionAccordion(){
    let execCondition = getAttribute('executionCondition');
    if(execCondition){
      accordionSections.set('executionCondition', ['Execution Condition', <PropertiesComponent obj={execCondition} />]);
    }
  }

  //ADDITIONAL PROPERTIES --> FOR ALL
  function additionalPropertiesAccordion(){

    let metadata = getAttribute('metadata');
  
    function additionalMetadataList(): {key: string, value: string}[]{
      //if there are still some metadata properties that haven't been displayed...
      if (metadata !== undefined){
        let additionalMetadata = Object.keys(metadata).filter((key) => {
          let keyAux = 'metadata.'+key;
          return !props.createdSections.includes(keyAux);
        });
        if (additionalMetadata.length > 0){
          //...then return a list of Key-Value pairs of this data.
          return additionalMetadata.map(key => createRow(key, JSON.stringify(metadata[key])));
        }
      }
      //...or an empty list instead
      return [];
    }
  
    let additionalAttributes = createElementRows(props.data)
                              .filter(row => !props.createdSections.includes(row.key))
                              .filter(row => !accordionSections.has(row.key))
                              .concat(additionalMetadataList());
    if (additionalAttributes.length > 0){ //Check if there are any additional keys (either normal keys or metadata keys)
      accordionSections.set('additionalAttrs', ['Additional configurations', <PropertiesComponent properties={additionalAttributes} />]);
    }
  }

  function rawHoconAccordion(){
    var rawHoconCodeMd = '```json \n' + JSON.stringify(props.data, null, 4) + '\n ```';
    accordionSections.set('rawJson', ['Raw Code', <MarkdownComponent markdown={rawHoconCodeMd} />]);
  }


  function getAccordionSections(): [string, JSX.Element][]{
    if (props.elementType === 'dataObjects'){
      foreignKeysAccordion();
      constraintsAccordion();
      expectationsAccordion();
      additionalPropertiesAccordion(); //Always to be computed last
      rawHoconAccordion();
    }
    else if (props.elementType === 'actions'){
      transformerAccordion();
      execModeAccordion();
      execConditionAccordion();
      additionalPropertiesAccordion(); //Always to be computed last
      rawHoconAccordion();
    }
    else if (props.elementType === 'connections'){
      additionalPropertiesAccordion();
      rawHoconAccordion();
    }
    return Array.from(accordionSections.values()); 
  }

  function createAccordion(accordionName: string, jsxElement: JSX.Element){
    return(
      <Accordion  className='accordion' elevation={3} disableGutters={true}
                  expanded={openAccordion === accordionName} 
                  onChange={handleChange(accordionName)}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="body1">{accordionName}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          {jsxElement}
        </AccordionDetails>
      </Accordion>
    )
  }

  //Select which accordions will be rendered
  const accordions = getAccordionSections().map(([accordionName, jsxElement]) => createAccordion(accordionName, jsxElement));

  return (
    <Box>
      {accordions}
    </Box>
  )
}