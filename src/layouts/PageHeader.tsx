import { Box, IconButton, Sheet, Typography } from "@mui/joy";
import { useLocation, useNavigate } from "react-router-dom";
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
/**
 * The PageHeader component is the header of each page. It contains the title, subtitle, and description of the page. It is used in pages such as Workflows, Workflow and Run.
 * @param props title - The title of the page, subtitle - The subtitle of the page, description - The description of the page
 * @returns JSX element that represents the PageHeader component
 */
const PageHeader = (props: {title : string, subtitle?: string, description?: string, noBack?: boolean}) => {
    const { title, subtitle, description, noBack } = props;
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
                <Box sx={{
                    display: 'flex',
                    verticalAlign: 'middle',
                    pb: '0.5rem',
                }}>
                    {!noBack && <IconButton  onClick={handleClick} variant="plain" color="neutral" size="sm">
                        <ArrowBackIosIcon sx={{scale: '80%', pl: '0.3rem'}}/>
                    </IconButton>}
                    <Typography level="h4">{title}</Typography>
                    {subtitle && <Typography level="h5" sx={{pt: '1rem'}}>{subtitle}</Typography>}
                    {description && <Typography level="body2" sx={{py: '1rem'}}>{description}</Typography>}
                </Box>
            </Sheet>
     );
}
 
export default PageHeader;