import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import parseCustomMarkdown from '../util/MarkdownParser';
import 'github-markdown-css/github-markdown.css';
import { GlobalStyles } from '@mui/material';



export default function MarkdownComponent(props: {filename: string, data:any}){

  const [input, setInput] = React.useState('');

  let hasMetadataDescription = props.data['dataObjects'][props.filename]['metadata'] != undefined && props.data['dataObjects'][props.filename]['metadata']['description'] != undefined;


  if (hasMetadataDescription){
    let inputConfig = `# ${props.filename} \n` + String(props.data['dataObjects'][props.filename]['metadata']['description']);
    return( //Redundant return as a check on objects' properties combined with setState() results in an endless rendering loop. 
      <React.Fragment>
        <GlobalStyles styles={{ table: { width: '100% !important' } }} />
        <ReactMarkdown className='markdown-body' children={inputConfig} remarkPlugins={[remarkGfm]} />
      </React.Fragment>
    ); 
  }
  else{
  
    const filename = "/descriptionFiles/" + props.filename +".md"; //file must be in public/descriptionFiles folder
    const missingInputFile = "# Missing .md file \n"
      + "Please provide a Markdown file in the public folder of the project and use the [Commonmark Standard](https://commonmark.org/) \n \n"
      + "The file should be named as <dataObjectId>.md or <actionId>.md.";
    fetch(filename) //file must be in public folder
    .then(r => {
      if (!r.ok){ throw new Error("Connectivity problems in the fetch method") }
      return r.text();
    })
    .then(text => {
      //If the given Markdown File is not found, fetch() per default reads the index.html file (but doesn't throw an error !!) 
      //and sets the status to 200 == OK. For this we assume that the beginning of our file should not start with <!DOCTYPE html>
      if (text.startsWith("<!DOCTYPE html>")){throw new Error("Markdown File not found, system fetched index.html")} 
      else{
      setInput(parseCustomMarkdown(text));
      }
    })
    .catch((error) => {
      console.log(error);
      setInput(missingInputFile);
    });

  }

  return(
    <React.Fragment>
      <GlobalStyles styles={{ table: { width: '100% !important' } }} />
      <ReactMarkdown className='markdown-body' children={input} remarkPlugins={[remarkGfm]} />
    </React.Fragment>
  ); 
}