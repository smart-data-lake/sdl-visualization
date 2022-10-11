import 'github-markdown-css/github-markdown.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import 'github-markdown-css/github-markdown.css';
import { GlobalStyles } from '@mui/material';
import * as React from 'react';


interface thisProps {
    data: any;
    elementName: string;
    elementType: string;
}

interface KV {
    key: string, 
    value: string
}

export default function GlobalConfigsBody(props: thisProps){
    const globalOptions = props.data['global'];

    let resultMdString = '';

    Object.keys(globalOptions).map(option => {
        resultMdString = resultMdString.concat('\n', `### ${option}`, '\n');
        Object.keys(globalOptions[option]).forEach(key => {
            resultMdString = resultMdString.concat(`- **${key}**: ${JSON.stringify(globalOptions[option][key])}`, '\n');
        });
    });
        
    
    return (
          <React.Fragment>
            <GlobalStyles styles={{ table: { width: '100% !important' } }} />
            <ReactMarkdown className='markdown-body' children={resultMdString} remarkPlugins={[remarkGfm]} />
          </React.Fragment>
    )

    
}