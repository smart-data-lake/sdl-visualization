import { Sheet } from '@mui/joy';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function MarkdownComponent(props: {markdown: string}){
  return (
    <Sheet
      sx={{
        width: '44rem'
      }}
    >
      <ReactMarkdown className='markdown-body' children={props.markdown} remarkPlugins={[remarkGfm]} />
    </Sheet>
  )
}