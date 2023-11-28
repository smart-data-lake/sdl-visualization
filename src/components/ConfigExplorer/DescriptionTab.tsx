import React from 'react';
import parseCustomMarkdown from '../../util/ConfigExplorer/MarkdownParser';
import 'github-markdown-css/github-markdown.css';
import MarkdownComponent from './MarkdownComponent';

export default function DescriptionTab(props: {elementType: string, elementName: string, data: string | null}){

  const markdown = React.useMemo(() => (props.data ? parseCustomMarkdown(props.data) : null), [props.data]);

  return <MarkdownComponent markdown={markdown!} />;
}