import 'github-markdown-css/github-markdown.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import 'github-markdown-css/github-markdown.css';
import { GlobalStyles } from '@mui/material';
import * as React from 'react';

export default function MarkdownComponent(props: {markdown: string}){
  return (
    <React.Fragment>
      <GlobalStyles styles={{ table: { width: '100% !important' } }} />
      <ReactMarkdown className='markdown-body' children={props.markdown} remarkPlugins={[remarkGfm]} />
    </React.Fragment>
  )
}