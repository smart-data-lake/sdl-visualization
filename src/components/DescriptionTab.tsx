import React from 'react';
import parseCustomMarkdown from '../util/MarkdownParser';
import 'github-markdown-css/github-markdown.css';
import MarkdownComponent from './MarkdownComponent';
import { getUrlContent } from '../util/HoconParser';

// cache for already loaded descriptions
var descriptionCache: any = {};

export default function DescriptionTab(props: {elementType: string, elementName: string, data:any}){

  const [input, setInput] = React.useState('');

  React.useEffect(() => {
    const filename = "/description/" + props.elementType + "/" + props.elementName +".md"; //file must be in public/description/elementType folder
    // check if already read
    if (descriptionCache[filename]) setInput(descriptionCache[filename]);
    else {
      const missingInputFile = "### Detailed description \n"
        + "There is no detailed description for this element. Please provide a Markdown file in the "
        + "description/<elementType> folder of the project and use the [Commonmark Standard](https://commonmark.org/). \n \n"
        + "The file should be named as <dataObjectId>.md, <actionId>.md or <connectionId>.md.";
      getUrlContent(filename)
      .then(text => parseCustomMarkdown(text))
      .catch((error) => {
        console.log(error);
        return missingInputFile;
      })
      .then(description => {
        descriptionCache[filename] = description;
        setInput(description);
      });
    }
  }, [props.elementType, props.elementName]);

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