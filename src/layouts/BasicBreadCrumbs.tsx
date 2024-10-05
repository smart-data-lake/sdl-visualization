import { Breadcrumbs, Typography, Link } from "@mui/joy";
import { useLocation, useNavigate } from "react-router-dom";
import { capitalize } from "../util/helpers";

/**
 * The BasicBreadcrumbs component is the breadcrumbs of each page. It displays a URL path in a hierarchical manner. It allows the user to quickly navigate back to a parent page.
 * @returns JSX element that represents the BasicBreadCrumbs component
 */

const BasicBreadcrumbs = () => {
    const url = useLocation().pathname;
    const links = [...url.split('/')].splice(1);
    const navigate = useNavigate();

    const handleClick = (elem: string) => {
        if (elem === 'Home') {
            navigate('/');
        } else {
            const targetURL = url.split(new RegExp('/'+elem+'(/|^)'))[0] + '/' + elem;
            navigate(targetURL)
        }
    }

    function getItem(str: string, doCapitalize: boolean, key: any) {
      return <Typography key={key} fontSize="inherit">{(doCapitalize ? capitalize(str) : str)}</Typography>
    }

    return (
        <Breadcrumbs aria-label="breadcrumbs" sx={{color: 'white', padding: 0}}>
            {links.map((item, idx) => 
                // create link for elements except the last
                (idx < links.length -1 ? <Link onClick={() => handleClick(item)} key={item} sx={{color: 'white'}}>{getItem(item, idx == 0, idx)}</Link> : getItem(item, idx == 0, idx))
            )}
        </Breadcrumbs>
    );
}

export default BasicBreadcrumbs;