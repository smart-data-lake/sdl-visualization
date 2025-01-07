import { KeyboardArrowLeft, KeyboardArrowRight, RefreshOutlined } from "@mui/icons-material";
import { Box, IconButton, Sheet, Typography } from "@mui/joy";
/**
 * The PageHeader component is the header of each page. It contains the title, subtitle, and description of the page.
 * It is used in pages such as Workflows, Workflow and Run.
 */
const PageHeader = (props: {title : string | React.ReactElement, subtitle?: string, description?: string, enablePrevNext?: boolean, prevNavigate?: () => void, nextNavigate?: () => void, corner?: string | React.ReactElement, refresh?: () => void}) => {
    const { title, subtitle, description, enablePrevNext, prevNavigate, nextNavigate, corner, refresh } = props;

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
                    {refresh && <IconButton onClick={refresh} variant="plain" color="neutral" size="sm">
                        <RefreshOutlined/>
                    </IconButton>}
                </Box>
            </Sheet>
     );
}
 
export default PageHeader;