import { Breadcrumbs, Typography, Link } from "@mui/joy";
import { useLocation, useNavigate } from "react-router-dom";
import { capitalize } from "../util/helpers";
import { useWorkspace } from "../hooks/useWorkspace";

/**
 * The BasicBreadcrumbs component is the breadcrumbs of each page. It displays a URL path in a hierarchical manner. It allows the user to quickly navigate back to a parent page.
 * @returns JSX element that represents the BasicBreadCrumbs component
 */

const BasicBreadcrumbs = () => {
    const {contentSubPath} = useWorkspace();
    const links = (contentSubPath || "").split('/');
    const navigate = useNavigate();

    function getItem(str: string, doCapitalize: boolean, key: any) {
      return <Typography key={key} fontSize="inherit">{(doCapitalize ? capitalize(str) : str)}</Typography>
    }

    function navigateRelative(idx: number) {
      const cntToRemove = links.length - idx - 1;
      navigate("../".repeat(cntToRemove), {relative: "path"});
    }

    return (
        <Breadcrumbs aria-label="breadcrumbs" sx={{color: 'white', padding: 0}}>
            {links.map((item, idx) => 
                // create link for elements except the last
                (idx < links.length -1 ? <Link onClick={() => navigateRelative(idx)} key={item} sx={{color: 'white'}}>{getItem(item, idx == 0, idx)}</Link> : getItem(item, idx == 0, idx))
            )}
        </Breadcrumbs>
    );
}

export default BasicBreadcrumbs;