import { HomeRounded } from "@mui/icons-material";
import { Breadcrumbs, Typography, Link } from "@mui/joy";
import { useLocation, useNavigate } from "react-router-dom";

const BasicBreadcrumbs = () => {
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
      <Breadcrumbs aria-label="breadcrumbs" sx={{color: 'white'}}>
                    
        <Link
            onClick={() => handleClick('Home')}
            key='Home'
        >
            <HomeRounded sx={{ mt: 0.75 }} fontSize="inherit"/>
        </Link>
        {links.map((item: string) => (
            <Link
                // `preventDefault` is for demo purposes
                // and is generally not needed in your app
                onClick={() => handleClick(item)}
                key={item}
                sx={{color: 'white'}}  
            >
                <Typography fontSize="inherit" sx={{textTransform: 'capitalize'}}>{item}</Typography>
            </Link>
        ))}
        <Typography fontSize="inherit" sx={{textTransform: 'capitalize', color: 'lightgray'}}>{current}</Typography>
      </Breadcrumbs>
    );
}

export default BasicBreadcrumbs;