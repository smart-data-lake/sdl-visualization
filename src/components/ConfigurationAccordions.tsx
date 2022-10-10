import * as React from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import './ComponentsStyles.css';
import 'github-markdown-css/github-markdown.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import 'github-markdown-css/github-markdown.css';
import { GlobalStyles } from '@mui/material';
import { Box} from "@mui/material";
import { Propane } from '@mui/icons-material';



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

function getTransformers(jsonObject: any, actionName: string){
  let action = jsonObject['actions'][actionName];
  if(action['transformers']!= undefined){
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
    let additionalConfigsMd = `### Execution Mode \n`;
    additionalConfigsMd = additionalConfigsMd.concat('\n |Property (key) | Value | \n |-----|-----|');
    Object.keys(execMode).forEach((key)=>{
        let value = JSON.stringify(execMode[key]).replaceAll('\\n', '').replaceAll('\\t', '').replaceAll('\\r', '');
        additionalConfigsMd = additionalConfigsMd.concat(`\n | ${key} | ${value} |`);
    });
    return additionalConfigsMd;
}

function formatExecutionCondition(execCondition: any): string{
    let additionalConfigsMd = `### Execution Condition \n`;
    additionalConfigsMd = additionalConfigsMd.concat('- **Expression**:', execCondition['expression'], '\n');
    additionalConfigsMd = additionalConfigsMd.concat('- **Description**:', execCondition['description'], '\n');
    return additionalConfigsMd;
}

//elementType can be 'actions', 'dataObjects' or 'global'. Returns a list of "simple" additionalAttributes. 
function createElementRows(jsonObject: any, elementName: string, elementType: string) {
  if (elementType==='global'){
    var keyList = Object.keys(jsonObject[elementType]);
    return keyList.map(key => createRow(key, JSON.stringify(jsonObject[elementType][key], null, '\t')));
  }
  var keyList = Object.keys(jsonObject[elementType][elementName]);
  return keyList.map(key => createRow(key, JSON.stringify(jsonObject[elementType][elementName][key], null, '\t')));
}






interface accordionCreatorProps {
  data: any;
  elementName: string;
  elementType: string;
  createdSections: string[]; //This shows which attributes should or should not be in the "additional attributes" accordion
}

export default function ConfigurationAccordions(props: accordionCreatorProps) {

  const getAttribute = (attributeName: string) => getAttributeGeneral(props.data, props.elementName, props.elementType, attributeName);
  let createdSections = props.createdSections;
  const [openAccordion, setOpenAccordion] = React.useState('none'); //none of the accordions are open at the beginning

  //Only one accordion open at a time
  const handleChange = (accordionName: string) => (event: React.SyntheticEvent, isExpanded: boolean) =>
    setOpenAccordion(isExpanded ? accordionName : 'none')
  

  //Markdown Strings use in the accordions
  let foreignKeysadditionalConfigsMd = 'No foreign keys defined for this element in the configuration files';
  let constraintsadditionalConfigsMd = 'No constraints defined for this element in the configuration files';
  let expectationsadditionalConfigsMd = 'No expectations defined for this element in the configuration files';
  let transformersadditionalConfigsMd = 'No transformers defined for this element in the configuration files';
  let executionadditionalConfigsMd = 'No execution mode or condition defined for this element in the configuration files';
  let additionalConfigsMd = 'No additional configurations defined for this element in the configuration files'; //Currently being used in additional properties. To be replaced. 
  let rawHoconCodeMd = '';

  //Formatting of Markdown Strings:
  //FOREIGN KEYS --> FOR DATA OBJECTS. TODO: See if defined structure/syntax for foreign keys in .config file is correct
  function foreignKeysAccordion(){
    let foreignKeysList = getAttribute('table.foreignKeys');
    if (foreignKeysList !== undefined){
      foreignKeysadditionalConfigsMd = '|table|columns (key)|columns (value)|db (optional)|name (optional)| \n |---|---|---|---|---|';
      foreignKeysList.forEach((fkObject: any) => {
        let cKey = Object.keys(fkObject['columns'])[0];
        let [columnsKey, columnsValue] = [cKey, fkObject['columns'][cKey]]
        foreignKeysadditionalConfigsMd = foreignKeysadditionalConfigsMd.concat('\n', '|', fkObject['table'], '|', columnsKey, '|', columnsValue, '|', fkObject['db'], '|', fkObject['name'], '|');
      });
    }
  }

  

  //CONSTRAINTS --> FOR DATA OBJECTS. TODO: See if defined structure/syntax for foreign keys in .config file is correct
  function constraintsAccordion(){
    let constraintsList = getAttribute('constraints');
    if (constraintsList !== undefined){
      constraintsadditionalConfigsMd = '|constraint| \n |----|';
      constraintsList.forEach((c: any) => constraintsadditionalConfigsMd = constraintsadditionalConfigsMd.concat('\n', '|', c, '|'));
    }
  }


  //EXPECTATIONS --> FOR DATA OBJECTS
  function expectationsAccordion(){
    let expectations = getAttribute('expectations');
    if (expectations !== undefined){
      expectationsadditionalConfigsMd = '';
      createdSections.push('expectations');
      expectationsadditionalConfigsMd = expectationsadditionalConfigsMd.concat('\n', '\n', formatExpectations(expectations));
    }
  }

  //TRANSFORMERS --> FOR ACTIONS
function transformerAccordion(){
    let tr = getTransformers(props.data, props.elementName);
    if(tr.length>0){
        transformersadditionalConfigsMd = '';
        createdSections.push('transformers');
        transformersadditionalConfigsMd = transformersadditionalConfigsMd.concat('\n', '\n', formatTransformers(tr));
    }
}

  //EXECUTION MODE / CONDITION --> FOR ACTIONS

  function execModeConditionAccordion(){
    let execMode = getAttribute('executionMode');
    let execCondition = getAttribute('executionCondition');
    if(execMode !== undefined || execCondition !== undefined){
        executionadditionalConfigsMd = '';
    }
    if(execMode !== undefined){
        executionadditionalConfigsMd = formatExecutionMode(execMode);
        createdSections.push('executionMode');
    }
    if(execCondition !== undefined){
        executionadditionalConfigsMd = executionadditionalConfigsMd.concat(formatExecutionCondition(execCondition));
        createdSections.push('executionCondition');
    }
  }

  

  //if(props.elementType==='actions'){transformerAccordion(); execModeConditionAccordion()};


  //ADDITIONAL PROPERTIES --> FOR ALL
  function additionalPropertiesAccordion(){

    let metadata = getAttribute('metadata');
  
    function additionalMetadataList(): {key: string, value: string}[]{
      //if there are still some metadata properties that haven't been displayed...
      if (metadata !== undefined){
        let additionalMetadata = Object.keys(metadata).filter((key) => {
          let keyAux = 'metadata.'+key;
          return !createdSections.includes(keyAux);
        });
        if (additionalMetadata.length > 0){
          //...then return a list of Key-Value pairs of this data.
          return additionalMetadata.map(key => createRow(key, JSON.stringify(metadata[key])));
        }
      }
      //...or an empty list instead
      return [];
    }
  
  
    let additionalAttributes = createElementRows(props.data, props.elementName, props.elementType)
                              .filter(row => !createdSections.includes(row.key))
                              .concat(additionalMetadataList());
    if (additionalAttributes.length > 0){ //Check if there are any additional keys (either normal keys or metadata keys)
      
      additionalConfigsMd = ` \n |Property (key) | Value | \n |-----|-----|`;
      additionalAttributes.forEach((row)=> {
        row.value = JSON.stringify(row.value).replaceAll('\\n', '').replaceAll('\\t', '').replaceAll('\\r', '');
        if (row.key != 'code'){
          row.value = row.value.replaceAll('"', '').replaceAll('\\', ''); //The second replace is needed as removing two double quotes results in a backslash
        }
        additionalConfigsMd = additionalConfigsMd.concat(`\n | ${row.key} | ${row.value} |`);
      });
    }
  }

  function rawHoconAccordion(){
    let object = props.data[props.elementType][props.elementName];
    rawHoconCodeMd = '```json \n' + JSON.stringify(object, null, 4) + '\n ```';
  }


  function getAccordionsParameters(): [string, string][]{
    let parameters: [string, string][] = []
    if (props.elementType === 'dataObjects'){
      foreignKeysAccordion();
      constraintsAccordion();
      expectationsAccordion();
      additionalPropertiesAccordion(); //Always to be computed last
      rawHoconAccordion();
      parameters = [['Foreign Keys', foreignKeysadditionalConfigsMd],
                    ['Constraints', constraintsadditionalConfigsMd], 
                    ['Expectations', expectationsadditionalConfigsMd],
                    ['Additional configurations', additionalConfigsMd], 
                    ['Raw Code', rawHoconCodeMd]]
    }
    else if (props.elementType === 'actions'){
      transformerAccordion();
      execModeConditionAccordion();
      additionalPropertiesAccordion(); //Always to be computed last
      rawHoconAccordion();
      parameters = [['Transformers', transformersadditionalConfigsMd],
                    ['Execution Mode and Condition', executionadditionalConfigsMd], 
                    ['Additional configurations', additionalConfigsMd],
                    ['Raw Code', rawHoconCodeMd]]
    }
    else if (props.elementType === 'connections'){
      additionalPropertiesAccordion();
      rawHoconAccordion();
      parameters = [['Details', additionalConfigsMd],
                    ['Raw Code', rawHoconCodeMd]];
    }
    return parameters; 
  }

  function markdownAccordion(accordionName: string, markdownText: string){
    return(
      <Accordion  className='accordion' elevation={0} 
                  expanded={openAccordion === accordionName} 
                  onChange={handleChange(accordionName)}>
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


  //Select which accordions will be rendered
  const accordions = getAccordionsParameters().map(([accordionName, markdownText]) => markdownAccordion(accordionName, markdownText));



  return (
    <Box>
      {accordions}
    </Box>
  )
}