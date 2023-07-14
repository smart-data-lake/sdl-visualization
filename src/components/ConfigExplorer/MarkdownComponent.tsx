import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function MarkdownComponent(props: {markdown: string}){
  return (
    <>
      <ReactMarkdown className='markdown-body' children={props.markdown} remarkPlugins={[remarkGfm]} />
    </>
  )
}