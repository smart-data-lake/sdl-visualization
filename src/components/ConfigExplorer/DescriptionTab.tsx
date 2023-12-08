import React from 'react';
import parseCustomMarkdown from '../../util/ConfigExplorer/MarkdownParser';
import 'github-markdown-css/github-markdown.css';
import MarkdownComponent from './MarkdownComponent';
import InfoBox from './InfoBox';
import { getMissingDescriptionFileCmp } from './ElementDetails';

export default function DescriptionTab(props: {elementType: string, elementName: string, data: string | null}){

  const markdown = React.useMemo(() => (props.data ? parseCustomMarkdown(props.data) : null), [props.data]);

  return (markdown? <MarkdownComponent markdown={markdown!} /> : <InfoBox info={getMissingDescriptionFileCmp(props.elementType, props.elementName)}/>);
}