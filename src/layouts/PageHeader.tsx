import React from "react";
import { Box, Breadcrumbs, Link, Sheet, Typography } from "@mui/joy";
import { useLocation, useNavigate } from "react-router-dom";
import HomeRounded from "@mui/icons-material/HomeRounded";
import BasicBreadcrumbs from "./BasicBreadCrumbs";

/**
 * The PageHeader component is the header of each page. It contains the title, subtitle, and description of the page. It is used in pages such as Workflows, Workflow and Run.
 * @param props title - The title of the page, subtitle - The subtitle of the page, description - The description of the page
 * @returns JSX element that represents the PageHeader component
 */
const PageHeader = (props: {title : string, subtitle?: string, description?: string}) => {
    const { title, subtitle, description } = props;
    return ( 
        <>
            <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                pb: '1rem',
                top: '0px',
                position: 'sticky',

            }}>
                <Typography level="h2" sx={{pb: '1rem', textTransform: 'capitalize'}}>{title}</Typography>
                {subtitle && <Typography level="h4" sx={{pb: '1rem'}}>{subtitle}</Typography>}
                {description && <Typography level="body2" sx={{pb: '2rem'}}>{description}</Typography>}
            </Box>
        </>
     );
}
 
export default PageHeader;