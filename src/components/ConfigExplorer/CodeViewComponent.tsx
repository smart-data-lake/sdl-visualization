import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json';
import scala from 'react-syntax-highlighter/dist/esm/languages/hljs/scala';
import { vs as codeStyle } from 'react-syntax-highlighter/dist/esm/styles/hljs';

SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('scala', scala);

codeStyle.hljs.lineHeight = "1.2"
codeStyle.hljs.fontSize = "0.8em"
codeStyle.hljs.padding = "0"
codeStyle.hljs.margin = "0"

export default function MarkdownComponent(props: {code: string, language: string}){
  return (
    <SyntaxHighlighter language={props.language} wrapLongLines={true} style={codeStyle}>{props.code}</SyntaxHighlighter>
  )
}