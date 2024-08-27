import { Box, IconButton, Sheet, Typography } from "@mui/joy";
import { useLocation, useNavigate } from "react-router-dom";
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import { RefreshOutlined } from "@mui/icons-material";
/**
 * The PageHeader component is the header of each page. It contains the title, subtitle, and description of the page. It is used in pages such as Workflows, Workflow and Run.
 * @param props title - The title of the page, subtitle - The subtitle of the page, description - The description of the page
 * @returns JSX element that represents the PageHeader component
 */
const PageHeader = (props: {title : string | React.ReactElement, subtitle?: string, description?: string, noBack?: boolean, refresh?: () => void}) => {
    const { title, subtitle, description, noBack, refresh } = props;
    const currURL = useLocation().pathname;
    const navigate = useNavigate();

    const handleClick = () => {
        const routes = currURL.split('/');
        if (routes.length === 3) {
            const newUrl = routes.slice(0, 2  ).join('/')
            navigate(newUrl)
        }
        else {
            navigate(routes.slice(0, 3).join('/'))
        }
    }

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
                    {!noBack && <IconButton  onClick={handleClick} variant="plain" color="neutral" size="sm">
                        <ArrowBackIosIcon sx={{scale: '80%', pl: '0.3rem'}}/>
                    </IconButton>}
                    {typeof title === "string" ? <Typography level="h4">{title}</Typography> : title}
                    {subtitle && <Typography level="title-md" sx={{pt: '1rem'}}>{subtitle}</Typography>}
                    {description && <Typography level="body-sm" sx={{py: '1rem'}}>{description}</Typography>}
                    <Box sx={{ flex: 1 }}/>
                    {refresh && <IconButton onClick={refresh} variant="plain" color="neutral" size="sm">
                        <RefreshOutlined/>
                    </IconButton>}
                </Box>
            </Sheet>
     );
}
 
export default PageHeader;