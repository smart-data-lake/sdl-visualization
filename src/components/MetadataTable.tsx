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




function createRow(key: string, value: string) {
  return { key, value };
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


/*
//TODO
function createRowComponents(jsonObject, elementName, elementType){
  var keyList = Object.keys(jsonObject[elementType][elementName]);
  return keyList.map(key => {
    if (jsonObject[elementType][elementName]
  });
}
*/



/*
1. For each element in the action/dataObject:
  1.1. Check if it is a single row, a nested object or a nested list.
    1.1.1 --> If it is a single row, append the row to the result (directly as JSX code)
    1.1.2 --> If it's a nested element, append a collapsible table where each element in the collapsible table
        recursively calls the first function. With objects, this should work as they are based on a KV concept. 
    1.1.3 --> If it's a list, check if it's a list of single elements, a list of objects or a list of lists.
            i. If it's a list of single elements, append a single row to the result with the name of the list and 
              all the words as bullet points. 
            ii. If it's a list of objects, append a collapsible table where each element in the collapsible table
              recursively calls the first function.
            iii. If it's a list of lists, append a collapsible table where each element (each list) in the collapsible table
              recursively calls the first function.
*/



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


  const rows = createElementRows(props.data, props.elementName, props.elementType);



  let mdString = '|Property (key) | Value | \n |-----|-----|';
  rows.forEach((row)=> {
    console.log('KEY', row.key, 'VALUE', row.value);
    row.value = JSON.stringify(row.value).replaceAll('\\n', '').replaceAll('\\t', '');
    mdString = mdString.concat(`\n | ${row.key} | ${row.value} |`);});


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
