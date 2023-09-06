import * as React from 'react';
import 'github-markdown-css/github-markdown.css';
import CodeViewComponent from './CodeViewComponent';
import { Table } from '@mui/joy';

export function createPropertiesComponent(props: {obj?: any, properties?: {key: string, value: any}[], propsToIgnore?: string[], colHeader?: string, marginTop?: string, nested?: boolean}): JSX.Element | undefined {
  var rows = props.properties ?? [];
  if (props.obj && typeof props.obj == 'object') rows = rows.concat(Object.keys(props.obj).map(key => {return {key: key, value: props.obj[key]}}));
  const propsToIgnore = props.propsToIgnore || [];
  const entries = rows.filter(row => !propsToIgnore.includes(row.key));
  if (entries.length > 0) return <PropertiesComponent entries={entries} colHeader={props.colHeader} marginTop={props.marginTop} nested={props.nested} />;
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
export default function PropertiesComponent(props: {entries: {key: string, value: any}[], colHeader?: string, marginTop?: string, nested?: boolean}){
  const rows = props.entries
  .map((entry,idx) => {
    const key = entry.key;
    var value = entry.value;
    var nestedChild = false;
    // pass through react elements
    if (React.isValidElement(value)) {} // no operation
    // pass through list of react elements
    else if (Array.isArray(value) && React.isValidElement(value[0])) {} // no operation
    // map every array element to react element
    else if (Array.isArray(value)) {
      value = value.map((e,idx) => createPropertiesComponent({obj: e, marginTop: (idx===0 ? "0px" : "8px"), nested: true}));
      //nestedChild = true;
    // create a key/value table for objects
    } else if (typeof value == 'object' && !Array.isArray(value)) {
      value = createPropertiesComponent({obj: value, nested: true});
      nestedChild = true;
    } else if (key === "code") {
    // format code
      const type = props.entries.find(e => e.key === "type");
      var language = "default"
      if (type && type.value.startsWith("SQL")) language = 'sql';
      if (type && type.value.startsWith("Scala")) language = 'scala';
      if (type && type.value.startsWith("Python")) language = 'python';
      value = <CodeViewComponent code={removeBlockOfTrailingSpaces(value)} language={language} />
    } else {
    // stringify the rest  
      value = JSON.stringify(value).replaceAll('\\n', '').replaceAll('\\t', '').replaceAll('\\r', '');
      value = value.replaceAll('"', '').replaceAll('\\', ''); //The second replace is needed as removing two double quotes results in a backslash
    }
    if (value) {
      return (<tr>
        {idx===0 && props.colHeader && <td style={{padding: '2px 5px', borderBottomWidth: '0px'}} rowSpan={props.entries.length}>{props.colHeader}</td>}
        <td style={{padding: '2px 5px'}}>{key}</td>
        {/* if there is a nested child table: disable padding so there is no gap to internal boarders of nested table */}
        <td style={{padding: (nestedChild ? '0px' : '2px 5px'), width: (props.nested ? '100%' : 'auto')}}>{value}</td>
      </tr>);
    }
    return undefined;
  })
  .filter(cmp => cmp); // remove undefined values;

  function getTable() {
    if (props.nested) { // for nested tables add internal vertical borders (horizontal internal borders are created by default)
      return <Table size='md'
        sx={{tableLayout: 'auto', mt: props.marginTop, borderCollapse: 'collapse', '& td': {padding: '0px', height: '32px', borderLeft: '1px solid var(--TableCell-borderColor)', borderRight: '1px solid var(--TableCell-borderColor)' }, '& td:first-child': { borderLeft: 'none' }, '& td:last-child': { borderRight: 'none' }}}>
        <tbody>{rows}</tbody>
      </Table>
    } else { // for the main table add all external boarder + internal vertical borders (horizontal internal borders are created by default)
      return <Table size='md'
        sx={{tableLayout: 'auto', width: 'max-content', maxWidth: '100%', mt: props.marginTop, borderCollapse: 'collapse', border: '1px solid var(--TableCell-borderColor)', '& td': {padding: '0px', height: '32px', borderLeft: '1px solid var(--TableCell-borderColor)', borderRight: '1px solid var(--TableCell-borderColor)'}}}>
        <tbody>{rows}</tbody>
      </Table>
    }
  }

  return getTable();
}