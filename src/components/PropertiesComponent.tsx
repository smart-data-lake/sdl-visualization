import * as React from 'react';
import 'github-markdown-css/github-markdown.css';
import { Paper, Table, TableBody, TableCell, TableContainer, TableRow } from "@mui/material";
import CodeViewComponent from './CodeViewComponent';

export function createPropertiesComponent(props: {obj?: any, properties?: {key: string, value: any}[], propsToIgnore?: string[], colHeader?: string, width?: string, rowHeight?: string, marginTop?: string}): JSX.Element | undefined {
  var rows = props.properties ?? [];
  if (props.obj && typeof props.obj == 'object') rows = rows.concat(Object.keys(props.obj).map(key => {return {key: key, value: props.obj[key]}}));
  const propsToIgnore = props.propsToIgnore || [];
  const entries = rows.filter(row => !propsToIgnore.includes(row.key));
  if (entries.length > 0) return <PropertiesComponent entries={entries} width={props.width} rowHeight={props.rowHeight} colHeader={props.colHeader} marginTop={props.marginTop} />;
}

function removeBlockOfTrailingSpaces(code: string): string {
  const lines = code.split(/\r?\n/);
  const minNbOfTrailingSpaces = Math.min(...lines.filter(line => line.trim().length > 0).map(line => line.length - line.trimStart().length));
  return lines.map(line => line.substring(minNbOfTrailingSpaces)).join('\n');
}

/**
 * Create a table without row header to visualize key-value properties.
 * Recursion is supported.
 * @param colHeader a optional string which is displayed as an additional column on the left
 */
export default function PropertiesComponent(props: {entries: {key: string, value: any}[], colHeader?: string, width?: string, rowHeight?: string, marginTop?: string}){
  let width = props.width || "fit-content";
  const rows = props.entries
  .map((entry,idx) => {
    const key = entry.key;
    var value = entry.value;
    // pass through react elements
    if (React.isValidElement(value)) {} // no operation
    // pass through list of react elements
    else if (Array.isArray(value) && React.isValidElement(value[0])) {} // no operation
    // map every array element to react element
    else if (Array.isArray(value)) {
      value = value.map((e,idx) => createPropertiesComponent({obj: e, marginTop: (idx==0 ? "0px" : "8px")}));
    // create a key/value table for objects
    } else if (typeof value == 'object' && !Array.isArray(value)) {
      value = createPropertiesComponent({obj: value});
    } else if (key === "code") {
    // format code
      const type = props.entries.find(e => e.key === "type");
      const language = (type && type.value.split(/(?=[A-Z])/)[0].toLowerCase()) || "default";
      console.log(language);
      value = <CodeViewComponent code={removeBlockOfTrailingSpaces(value)} language={language} />
    } else {
    // stringify the rest  
      value = JSON.stringify(value).replaceAll('\\n', '').replaceAll('\\t', '').replaceAll('\\r', '');
      value = value.replaceAll('"', '').replaceAll('\\', ''); //The second replace is needed as removing two double quotes results in a backslash
    }
    if (value) {
      return <TableRow key={idx} sx={{height: props.rowHeight}}>
        {idx===0 && props.colHeader && <TableCell rowSpan={props.entries.length}>{props.colHeader}</TableCell>}
        <TableCell component="th" scope="row" sx={{width: "100px"}}>{key}</TableCell>
        <TableCell>{value}</TableCell>
      </TableRow>;
    }
    return undefined;
  })
  .filter(cmp => cmp); // remove undefined values;
  return <TableContainer component={Paper} sx={{width: width, mt: props.marginTop}}>
    <Table size="small">
      <TableBody>
        {rows}
      </TableBody>
    </Table>        
  </TableContainer>;
}