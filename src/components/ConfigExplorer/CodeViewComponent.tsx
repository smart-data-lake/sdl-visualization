import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json';
import python from 'react-syntax-highlighter/dist/esm/languages/hljs/python';
import scala from 'react-syntax-highlighter/dist/esm/languages/hljs/scala';
import { vs as codeStyle } from 'react-syntax-highlighter/dist/esm/styles/hljs';

SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('scala', scala);
SyntaxHighlighter.registerLanguage('python', python);

codeStyle.hljs.lineHeight = "1.2"
codeStyle.hljs.fontSize = "0.8em"
codeStyle.hljs.padding = "0"
codeStyle.hljs.margin = "0"

export default function MarkdownComponent(props: {code: string, language: string}){
  return (
    <SyntaxHighlighter language={props.language} wrapLongLines={true} style={codeStyle}>{props.code}</SyntaxHighlighter>
  )
}