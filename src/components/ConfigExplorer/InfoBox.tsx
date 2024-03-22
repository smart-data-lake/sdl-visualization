import { Sheet, Typography } from "@mui/joy";


export default function InfoBox(props: {info: string | JSX.Element, color?: string}) {
    return (
        <Sheet color={props.color || 'neutral' as any} variant="soft" key='resultSheet' invertedColors sx={{ p: '1rem', mt: '1rem', mb: '1rem', borderRadius: '0.5rem',}}>
            <Typography color="neutral" level='body-md'>Info:</Typography>
            <code>{props.info}</code>
        </Sheet>
    )
}