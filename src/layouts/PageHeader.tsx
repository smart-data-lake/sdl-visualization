import { KeyboardArrowLeft, KeyboardArrowRight, RefreshOutlined } from "@mui/icons-material";
import { Badge, Box, IconButton, Sheet, Tooltip, Typography } from "@mui/joy";
import type { LiveIndicator } from "../hooks/useLiveWorkflowUpdates";

const LIVE_TITLES: Record<LiveIndicator, string> = {
    running: 'Live: updates while the workflow runs. Click to refresh now.',
    finished: 'Live: the workflow has finished, a new run will show up by itself. Click to refresh now.',
};
/**
 * The PageHeader component is the header of each page. It contains the title, subtitle, and description of the page.
 * It is used in pages such as Workflows, Workflow and Run.
 */
const PageHeader = (props: {title : string | React.ReactElement, subtitle?: string, description?: string, enablePrevNext?: boolean, prevNavigate?: () => void, nextNavigate?: () => void, corner?: string | React.ReactElement, refresh?: () => void, live?: LiveIndicator}) => {
    const { title, subtitle, description, enablePrevNext, prevNavigate, nextNavigate, corner, refresh, live } = props;
    // while connected for live updates, a dot on the refresh button: green while running, grey once finished
    const liveTitle = live && LIVE_TITLES[live];

    return ( 
            <Sheet sx={{
                alignItems: 'center',
                position: 'sticky',
                top: 0,
                width: '100%',
                borderBottom: '1px solid lightgray',
                pl : '1.2rem',
                pr : '0.2rem',
                pt : '3.2rem',
                pb : '0.2rem',
            }}>
                <Box sx={{ display: 'flex', verticalAlign: 'middle', pb: '0.5rem', height: '38px' }}>
                    {enablePrevNext && <IconButton onClick={prevNavigate} disabled={!prevNavigate} variant="plain" color="neutral" size="sm">
                        <KeyboardArrowLeft/>
                    </IconButton>}
                    {typeof title === "string" ? <Typography level="h4">{title}</Typography> : title}
                    {subtitle && <Typography level="title-md" sx={{pt: '1rem'}}>{subtitle}</Typography>}
                    {description && <Typography level="body-sm" sx={{py: '1rem'}}>{description}</Typography>}
                    {enablePrevNext && <IconButton  onClick={nextNavigate} disabled={!nextNavigate} variant="plain" color="neutral" size="sm">
                        <KeyboardArrowRight/>
                    </IconButton>}
                    <Box sx={{ flex: 1 }}/>
                    {typeof corner === "string" ? <Typography level="body-sm">{corner}</Typography> : corner}
                    {refresh && (liveTitle
                        ? <Tooltip title={liveTitle} variant="solid" size="sm">
                            <IconButton onClick={refresh} variant="plain" color="neutral" size="sm" aria-label={liveTitle} data-live={live}>
                                <Badge color={live === 'running' ? 'success' : 'neutral'} size="sm" badgeInset="14%">
                                    <RefreshOutlined/>
                                </Badge>
                            </IconButton>
                        </Tooltip>
                        : <IconButton onClick={refresh} variant="plain" color="neutral" size="sm">
                            <RefreshOutlined/>
                        </IconButton>)}
                </Box>
            </Sheet>
     );
}
 
export default PageHeader;