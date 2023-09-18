import * as React from 'react';
import './ComponentsStyles.css';
import 'github-markdown-css/github-markdown.css';
import { Table } from '@mui/joy';
import { createPropertiesComponent } from './PropertiesComponent';
import CodeViewComponent from './CodeViewComponent';
import { getPropertyByPath, hoconify } from '../../util/helpers';
import { Accordion, AccordionDetails, AccordionGroup, AccordionSummary, Chip, Stack } from '@mui/joy';
import { createSimpleChip } from './ConfigurationTab';

function getTransformers(action: any): any[] {
  //returns a list of transformer objects
  return (action['transformer'] ? [action['transformer']] : [])
  .concat(action['transformers'] ?? []);
}

interface AccordionCreatorProps {
  data: any; // config of object to display
  propsToIgnore: string[] // This shows which attributes should or should not be in the "additional attributes" accordion
  elementType: string;
  connectionDb: String;
}

export default function ConfigurationAccordions(props: AccordionCreatorProps) {

  const getAttribute = (attributeName: string) => getPropertyByPath(props.data, attributeName);
  var accordionSections = new Map<string,[string,JSX.Element]>();
  const [openAccordion, setOpenAccordion] = React.useState('none'); //none of the accordions are open at the beginning

  // reset accordion on element change -> disabled as it more intuitive if the same accordion section stays open
  //React.useEffect(() => setOpenAccordion('none'), [props.data]);

  //Only one accordion open at a time
  const handleChange = (accordionName: string) => (_: React.SyntheticEvent, isExpanded: boolean) =>
    setOpenAccordion(isExpanded ? accordionName : 'none')
  
  //Formatting of Markdown Strings:
  //FOREIGN KEYS --> FOR DATA OBJECTS. TODO: See if defined structure/syntax for foreign keys in .config file is correct
  function foreignKeysAccordion(){
    let foreignKeys = getAttribute('table.foreignKeys');
    if (foreignKeys && foreignKeys.length>0){
      //db, table, columns: Map[String,String], name
      let rows = foreignKeys.map((foreignKey: any) => 
        <tr>
          <td>{foreignKey.name}</td>
          <td>{(foreignKey.db || props.connectionDb || "<db?>") + "." + foreignKey.name}</td>
          <td><Stack spacing={0.5} direction="row">{Object.entries(foreignKey.columns).map(([k,v]) => createSimpleChip(k+" -> "+v))}</Stack></td>
        </tr>
      )

      let tbl = (<Table size='md'
        sx={{tableLayout: 'auto', width: 'max-content', maxWidth: '100%', borderCollapse: 'collapse', border: '1px solid var(--TableCell-borderColor)', '& td': {padding: '0px', height: '32px', borderLeft: '1px solid var(--TableCell-borderColor)', borderRight: '1px solid var(--TableCell-borderColor)'}}}>
          <thead>
            <tr>
              <td width="10%">Name</td>
              <td>Target table</td>            
              <td>Column mapping</td>            
            </tr>
          </thead>
          <tbody>{rows}</tbody>
      </Table>)
      accordionSections.set('table.foreignKeys', ['Foreign Keys', tbl]);
    }
  }

  function constraintsAccordion(){
    let elements = getAttribute('constraints');
    if (elements && elements.length>0){
      let cmps = elements.map((element,idx) => createPropertiesComponent({obj: element, orderProposal: ['name']}));
      accordionSections.set('constraints', ['Constraints', <Stack sx={{overflow: 'auto'}} spacing={1}>{cmps}</Stack>]);
    }      
  }

  function expectationsAccordion(){
    let elements = getAttribute('expectations');
    if (elements && elements.length>0){
      let cmps = elements.map((element,idx) => createPropertiesComponent({obj: element, orderProposal: ['name','type','description']}));
      accordionSections.set('expectations', ['Expectations', <Stack sx={{overflow: 'auto'}} spacing={1}>{cmps}</Stack>]);
    }      
  }

  function transformerAccordion(){
    let elements = getTransformers(props.data);
    if (elements && elements.length>0){
      let cmps = elements.map((element,idx) => createPropertiesComponent({obj: element, colHeader: (idx+1).toString()}));
      accordionSections.set('transformers', ['Transformers', <Stack sx={{overflow: 'auto'}} spacing={1}>{cmps}</Stack>]);
    }
  }

  function execModeAccordion(){
    let execMode = getAttribute('executionMode');
    if(execMode){
      const cmp = createPropertiesComponent({ obj: execMode, propsToIgnore: ["type"] })
      if (cmp) accordionSections.set('executionMode', ["Execution Mode: "+execMode.type, cmp]);
    }
  }

  function execConditionAccordion(){
    let execCondition = getAttribute('executionCondition');
    if(execCondition){
      const cmp = createPropertiesComponent({ obj: execCondition })
      if (cmp) accordionSections.set('executionCondition', ['Execution Condition', cmp]);
    }
  }

  function additionalPropertiesAccordion(){
    const propsToIgnore = props.propsToIgnore.concat(["transformer","origin"]).concat(Array.from(accordionSections.keys()))
    const cmp = createPropertiesComponent({obj: props.data, propsToIgnore: propsToIgnore})
    if (cmp) accordionSections.set('additionalAttrs', ['Additional configurations', cmp]);
  }

  function rawHoconAccordion(){
    var rawData = props.data;
    var title = 'Raw Config'
    // remove origin from data if it exists, add it to title
    if (rawData.origin) {
      title = title + ` - ${rawData.origin.path}:${rawData.origin.lineNumber}`;
      rawData = {...rawData}; // deep clone to avoid mutation of the original data
      delete rawData['origin'];
    }
    // remove id from data
    if (rawData.id) {
      rawData = {...rawData}; // deep clone to avoid mutation of the original data
      delete rawData['id'];
    }    
    const hoconConfig = hoconify(rawData);
    accordionSections.set('rawJson', [title, <CodeViewComponent code={hoconConfig} language="" />]);
  }

  function getAccordionSections(): [string, string, JSX.Element][]{
    foreignKeysAccordion();
    constraintsAccordion();
    expectationsAccordion();
    transformerAccordion();
    execModeAccordion();
    execConditionAccordion();
    additionalPropertiesAccordion(); //Always to be computed last
    rawHoconAccordion();
    return Array.from(accordionSections.entries()).map(([key,[name,element]]) => [key,name,element]); 
  }

  function createAccordion(key: string, accordionName: string, jsxElement: JSX.Element){
    return(
      <Accordion>
        <AccordionSummary sx={{fontWeight: 'normal'}}>{accordionName}</AccordionSummary>
        <AccordionDetails>{jsxElement}</AccordionDetails>
      </Accordion>
    )
  }

  const accordions = getAccordionSections().map(([key, name, jsxElement], _) => createAccordion(key, name, jsxElement));

  return (
    <AccordionGroup size='md'>
      {accordions}
    </AccordionGroup>
  )
}