import 'github-markdown-css/github-markdown.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import 'github-markdown-css/github-markdown.css';
import { GlobalStyles } from '@mui/material';
import * as React from 'react';


interface thisProps {
    data: any;
}

interface KV {
    key: string, 
    value: string
}

export default function GlobalConfigsBody(props: thisProps){
    let resultMdString = '';

    Object.keys(props.data).map(option => {
        resultMdString = resultMdString.concat('\n', `### ${option}`, '\n');
        Object.keys(props.data[option]).forEach(key => {
            resultMdString = resultMdString.concat(`- **${key}**: ${JSON.stringify(props.data[option][key])}`, '\n');
        });
    });
        
    return (
        <React.Fragment>
        <GlobalStyles styles={{ table: { width: '100% !important' } }} />
        <ReactMarkdown className='markdown-body' children={resultMdString} remarkPlugins={[remarkGfm]} />
        </React.Fragment>
    )
}