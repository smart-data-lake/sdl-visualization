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
import { orange } from '@mui/material/colors';
import CSS from 'csstype';



function createRow(key: string | number, value: string | number) {
  return { key, value };
}

//elementType can be 'actions', 'dataObjects' or 'global'. Returns a list of "simple" rows. 
function createElementRows(jsonObject: any, elementName: string, elementType: string) {
  var keyList = Object.keys(jsonObject[elementType][elementName]);
  return keyList.map(key => createRow(key, JSON.stringify(jsonObject[elementType][elementName][key], null, '\t')));
}


/*
//FINISH!!!
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





//Styles of header and rows
const StyledTableCell = styled(TableCell)(({ theme }) => ({
  [`&.${tableCellClasses.head}`]: {
    color: theme.palette.common.white,
  },
  [`&.${tableCellClasses.body}`]: {
    fontSize: 14,
  },
}));

interface detailsTableProps {
  data: object;
  elementName: string;
  elementType: string;
}

export default function MetadataTable(props: detailsTableProps) {

  const rows = createElementRows(props.data, props.elementName, props.elementType);


  /*
    const rows = [
  createRow("inputId", "ext-airports"),
  createRow('metadata', "feed : download"),
  createRow("outputId", "stg-airports"),
  createRow("type", "FileTransferAction"),
  ];
  */
  const rowStyles: CSS.Properties =
  {
    backgroundColor: 'white',
    border: '2px solid #555'
  };

  const headerMetadata: CSS.Properties =
  {
    fontFamily: 'arial'
  };


  return (
    <div>
      <TableContainer component={Paper}>
        <Table sx={{ minWidth: 650 }} aria-label="simple table">
          <TableHead>
            <TableRow>
              <StyledTableCell>Property (Key)</StyledTableCell>
              <StyledTableCell>Value</StyledTableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.key}
                sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
              >
                <TableCell component="th" scope="row" style={rowStyles}>
                  {row.key}
                </TableCell>
                <TableCell style={rowStyles}>{row.value}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
}
