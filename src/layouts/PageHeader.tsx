import React from "react";
import { Box, Breadcrumbs, IconButton, Link, Sheet, Typography } from "@mui/joy";
import { useLocation, useNavigate } from "react-router-dom";
import HomeRounded from "@mui/icons-material/HomeRounded";
import BasicBreadcrumbs from "./BasicBreadCrumbs";
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
        if (currURL.split('/').length === 2) {
            navigate(currURL.split('/').slice(0, 2).join('/'))
        } else if (currURL.split('/').length === 3) {
            navigate(currURL.split('/').slice(0, 3  ).join('/'))
        }
        else {
            navigate(currURL.split('/').slice(0, 3).join('/'))
        }
    }

    return ( 
        <>
            <Box sx={{
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'left',
                position: 'sticky',
                pb : '2rem',
                gap: '1rem',
            }}>
                {!noBack && <IconButton onClick={handleClick} variant="plain" color="neutral">
                    <ArrowBackIosIcon />
                </IconButton>}
                <Box sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    top: '0px',
                    position: 'sticky',
                    verticalAlign: 'middle',

                }}>
                    <Typography level="h2">{title}</Typography>
                    {subtitle && <Typography level="h4" sx={{pt: '1rem'}}>{subtitle}</Typography>}
                    {description && <Typography level="body2" sx={{py: '1rem'}}>{description}</Typography>}
                </Box>
            </Box>
        </>
     );
}
 
export default PageHeader;