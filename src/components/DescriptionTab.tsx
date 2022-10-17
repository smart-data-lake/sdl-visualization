import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import parseCustomMarkdown from '../util/MarkdownParser';
import 'github-markdown-css/github-markdown.css';
import { GlobalStyles } from '@mui/material';
import MarkdownComponent from './MarkdownComponent';



export default function DescriptionTab(props: {elementType: string, elementName: string, data:any}){

  const [input, setInput] = React.useState('');

  React.useEffect(() => {
    const filename = "/description/" + props.elementType + "/" + props.elementName +".md"; //file must be in public/description/elementType folder
    const missingInputFile = "### Detailed description \n"
      + "There is no detailed description for this element. Please provide a Markdown file in the "
      + "description/<elementType> folder of the project and use the [Commonmark Standard](https://commonmark.org/). \n \n"
      + "The file should be named as <dataObjectId>.md, <actionId>.md or <connectionId>.md.";
    fetch(filename) //file must be in public folder
    .then(r => {
      if (!r.ok) { throw new Error("Connectivity problems in the fetch method when fetching the .md description file") }
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
  }, [props.elementName]);

  let hasMetadataDescription = 
    props.data && props.data['metadata'] 
    && props.data['metadata']['description'];

  if (hasMetadataDescription){
    let inputConfig = `### Short description \n` 
                        + String(props.data['metadata']['description'])
                        + '\n'
                        + input;

    return ( //Redundant return as a check on objects' properties combined with setState() results in an endless rendering loop. 
      <MarkdownComponent markdown={inputConfig} />
    );
  }

  return <MarkdownComponent markdown={input} />;
}