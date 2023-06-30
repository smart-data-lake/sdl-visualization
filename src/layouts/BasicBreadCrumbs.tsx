import { Breadcrumbs, Typography, Link } from "@mui/joy";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * The BasicBreadcrumbs component is the breadcrumbs of each page. It displays a URL path in a hierarchical manner. It allows the user to quickly navigate back to a parent page.
 * @returns JSX element that represents the BasicBreadCrumbs component
 */

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
        <Breadcrumbs 
            aria-label="breadcrumbs"
            sx={{color: 'white'}}
        >
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
            <Typography fontSize="inherit" sx={{color: 'white', textTransform: 'capitalize'}}>{current}</Typography>
        </Breadcrumbs>
    );
}

export default BasicBreadcrumbs;