import React from "react";
import { Box, Breadcrumbs, Link, Sheet, Typography } from "@mui/joy";
import { useLocation, useNavigate } from "react-router-dom";
import HomeRounded from "@mui/icons-material/HomeRounded";
import BasicBreadcrumbs from "./BasicBreadCrumbs";


const PageHeader = (props: {title : string, subtitle?: string, description?: string}) => {
    const { title, subtitle, description } = props;
    return ( 
        <>
            <Sheet sx={{
                display: 'flex',
                flexDirection: 'column',
                pb: '1rem',
                top: '0px',
                position: 'sticky',

            }}>
                <Typography level="h3" sx={{pb: '1rem', textTransform: 'capitalize'}}>{title}</Typography>
                {subtitle && <Typography level="h4" sx={{pb: '1rem'}}>{subtitle}</Typography>}
                {description && <Typography level="body2" sx={{pb: '2rem'}}>{description}</Typography>}
            </Sheet>
        </>
     );
}
 
export default PageHeader;