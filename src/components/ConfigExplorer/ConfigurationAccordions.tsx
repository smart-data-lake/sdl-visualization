import * as React from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import './ComponentsStyles.css';
import 'github-markdown-css/github-markdown.css';
import 'github-markdown-css/github-markdown.css';
import { Box, Chip, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow} from "@mui/material";
import { getAttributeGeneral } from '../../util/ConfigExplorer/ConfigSearchOperation';
import { createPropertiesComponent } from './PropertiesComponent';
import CodeViewComponent from './CodeViewComponent';

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

  const getAttribute = (attributeName: string) => getAttributeGeneral(props.data, attributeName.split('.'));
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
        <TableRow>
          <TableCell>{foreignKey.name}</TableCell>
          <TableCell>{(foreignKey.db || props.connectionDb || "<db?>") + "." + foreignKey.name}</TableCell>
          <TableCell><Stack spacing={0.5} direction="row">{Object.entries(foreignKey.columns).map(([k,v]) => <Chip label={k+" -> "+v} size="small"/>)}</Stack></TableCell>
        </TableRow>
      )
      let tbl = <TableContainer >
        <Table size="small">
          <TableHead>
          <TableRow sx={{"& th": {backgroundColor: "rgba(0, 0, 0, 0.08)"}}}>
              <TableCell width="10%">Name</TableCell>
              <TableCell>Target table</TableCell>            
              <TableCell>Column mapping</TableCell>            
            </TableRow>
          </TableHead>
          <TableBody>
            {rows}
          </TableBody>
        </Table>
      </TableContainer>
      accordionSections.set('table.foreignKeys', ['Foreign Keys', tbl]);
    }
  }

  function constraintsAccordion(){
    let constraints = getAttribute('constraints');
    if (constraints && constraints.length>0){
      let rows = constraints.map((constraint: any) => 
        <TableRow>
          <TableCell>{constraint.name}</TableCell>
          <TableCell>{createPropertiesComponent({obj: constraint, propsToIgnore: ["name"]})}</TableCell>
        </TableRow>
      )
      let tbl = <TableContainer >
        <Table size="small">
          <TableHead>
          <TableRow sx={{"& th": {backgroundColor: "rgba(0, 0, 0, 0.08)"}}}>
              <TableCell width="10%">Name</TableCell>
              <TableCell>Attributes</TableCell>            
            </TableRow>
          </TableHead>
          <TableBody>
            {rows}
          </TableBody>
        </Table>
      </TableContainer>
      accordionSections.set('constraints', ['Constraints', tbl]);
    }
  }

  function expectationsAccordion(){
    let expectations = getAttribute('expectations');
    if (expectations && expectations.length>0){
      let rows = expectations.map((expectation: any) => 
        <TableRow>
          <TableCell>{expectation.type}</TableCell>
          <TableCell>{expectation.name}</TableCell>
          <TableCell>{createPropertiesComponent({obj: expectation, propsToIgnore: ["type","name"]})}</TableCell>
        </TableRow>
      )
      let tbl = <TableContainer >
        <Table size="small">
          <TableHead>
            <TableRow sx={{"& th": {backgroundColor: "rgba(0, 0, 0, 0.08)"}}}>
              <TableCell width="10%">Type</TableCell>
              <TableCell width="10%">Name</TableCell>
              <TableCell>Attributes</TableCell>            
            </TableRow>
          </TableHead>
          <TableBody>
            {rows}
          </TableBody>
        </Table>
      </TableContainer>
      accordionSections.set('expectations', ['Expectations', tbl]);
    }
  }

  function transformerAccordion(){
    let tr = getTransformers(props.data);
    if (tr && tr.length>0){
      let cmps = tr.map((transformer,idx) => createPropertiesComponent({obj: transformer, colHeader: (idx+1).toString()}));
      accordionSections.set('transformers', ['Transformers', <Stack spacing={1}>{cmps}</Stack>]);
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
    // remove origin from data if it exists
    if (rawData.origin) {
      var rawData = {...rawData}; // deep clone to avoid mutation of the original data
      rawData.origin = undefined; // remove origin definition
    }
    accordionSections.set('rawJson', ['Raw Code', <CodeViewComponent code={JSON.stringify(rawData, null, 2)} language="json" />]);
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
      <Accordion key={key} className='accordion' elevation={3} disableGutters={true}
                  expanded={openAccordion === accordionName} 
                  onChange={handleChange(accordionName)}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="body1">{accordionName}</Typography>
        </AccordionSummary>
        <AccordionDetails>{jsxElement}</AccordionDetails>
      </Accordion>
    )
  }

  const accordions = getAccordionSections().map(([key, name, jsxElement], _) => createAccordion(key, name, jsxElement));

  return (
    <Box>
      {accordions}
    </Box>
  )
}