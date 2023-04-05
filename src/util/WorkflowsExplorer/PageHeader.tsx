import React from "react";
import { Box, Breadcrumbs, Link, Typography } from "@mui/joy";
import { useLocation, useNavigate } from "react-router-dom";
import HomeRounded from "@mui/icons-material/HomeRounded";

function BasicBreadcrumbs() {
    const url = useLocation().pathname;
    const links = [...url.split('/')].splice(1);
    const current = links.pop();
    const navigate = useNavigate();

    const handleClick = (elem: string) => {
        if (elem === 'Home') {
            navigate('/');
        } else {
            const targetURL = url.split(elem)[0] + elem
            navigate(targetURL)
        }
    }

    return (
      <Breadcrumbs aria-label="breadcrumbs">
        <Link
            onClick={() => handleClick('Home')}
            key='Home'
            color="neutral"          
        >
            <HomeRounded sx={{ mt: 0.75 }} fontSize="inherit"/>
        </Link>
        {links.map((item: string) => (
            <Link
                // `preventDefault` is for demo purposes
                // and is generally not needed in your app
                onClick={() => handleClick(item)}
                key={item}
                color="neutral"   
            >
                <Typography fontSize="inherit" sx={{textTransform: 'capitalize'}}>{item}</Typography>
            </Link>
        ))}
        <Typography fontSize="inherit" sx={{textTransform: 'capitalize'}}>{current}</Typography>
      </Breadcrumbs>
    );
}

const PageHeader = (props: {title : string, subtitle?: string, description?: string}) => {
    const { title, subtitle, description } = props;
    return ( 
        <>
            <BasicBreadcrumbs/>
            <Box sx={{
                pb: '4rem'
            }}>
                <Typography level="h2" sx={{pb: '1rem', textTransform: 'capitalize'}}>{title}</Typography>
                {subtitle && <Typography level="h4" sx={{pb: '1rem'}}>{subtitle}</Typography>}
                {description && <Typography level="body2" sx={{pb: '2rem'}}>{description}</Typography>}
            </Box>
        </>
     );
}
 
export default PageHeader;