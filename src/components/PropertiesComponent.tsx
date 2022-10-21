import 'github-markdown-css/github-markdown.css';
import { Box } from "@mui/material";

export default function PropertiesComponent(props: {obj?: any, properties?: {key: string, value: any}[]}){
    
  var rows = props.properties ?? [];
  if (props.obj && typeof props.obj == 'object') rows = rows.concat(Object.keys(props.obj).map(key => {return {key: key, value: props.obj[key]}}));

  const entries = rows.map(row => {
    const key = row.key;
    var value = row.value;
    if (typeof value == 'object' && !Array.isArray(value)) {
      value = <PropertiesComponent obj={value} />;
    } else {
      value = JSON.stringify(row.value).replaceAll('\\n', '').replaceAll('\\t', '').replaceAll('\\r', '');
      if (key !== 'code') {
        value = value.replaceAll('"', '').replaceAll('\\', ''); //The second replace is needed as removing two double quotes results in a backslash
      }
    }
    return <tr><td>{key}</td><td>{value}</td></tr>;
  });
      
  return (
      <Box className='markdown-body'>
          <table>
              {entries}    
          </table>
      </Box>
  );
}