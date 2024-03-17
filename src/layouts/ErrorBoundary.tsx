import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Typography } from "@mui/joy";
import { useRouteError } from "react-router-dom";

export default function ErrorBoundary() {
    const error = useRouteError() as Error;
    const errorStack = error.stack?.split("\n") || [];

    return (
    <Box sx={{ alignItems: 'center', paddingTop: '1rem', flex: 1 }}>
        <Alert variant="soft" color="danger" invertedColors sx={{ alignItems: 'flex-start', gap: '1rem' }}>            
            <Box sx={{ flex: 1, gap: '2rem' }}>
                <Typography level="title-lg">Application Error</Typography>
                <Typography level="body-md" fontWeight="sm">{String(error)}</Typography>
                <Accordion>
                <AccordionSummary><Typography level="body-sm" fontWeight="sm">Show stacktrace</Typography></AccordionSummary>
                <AccordionDetails>
                    {errorStack.slice(2,errorStack.length).map(x => <Typography level="body-sm" fontWeight="sm">{x}</Typography>)}
                </AccordionDetails>
                </Accordion>
            </Box>
        </Alert>
    </Box>
    );
  }