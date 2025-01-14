import { Breadcrumbs, Typography, Link, Box } from "@mui/joy";
import { capitalize } from "../util/helpers";
import { useWorkspace } from "../hooks/useWorkspace";

/**
 * The BasicBreadcrumbs component is the breadcrumbs of each page. It displays a URL path in a hierarchical manner. It allows the user to quickly navigate back to a parent page.
 * @returns JSX element that represents the BasicBreadCrumbs component
 */

const BasicBreadcrumbs = () => {
    const {contentSubPath} = useWorkspace();
    const links = (contentSubPath || "").split('/');
    const {navigateRel} = useWorkspace();

    function getItem(str: string, doCapitalize: boolean, key: any) {
      return <Typography key={key} fontSize="inherit" noWrap={true} sx={{color: "white"}}>{(doCapitalize ? capitalize(str) : str)}</Typography>
    }

    function navigateUp(idx: number) {
      const cntToRemove = links.length - idx - 1;
      navigateRel("../".repeat(cntToRemove));
    }

    return (

      <Box sx={{display: "flex", alignContent: "flex-end", flexDirection: "row", gap: 1, flexGrow: 1, overflowX: "hidden"}}>
          {links.map((item, idx) => 
                // create link for elements except the last
                (idx < links.length -1 ? <><Link onClick={() => navigateUp(idx)} key={item} sx={{color: 'white'}}>{getItem(item, idx == 0, idx)}</Link> /</> : getItem(item, idx == 0, idx))
          )}
      </Box>            
    );
}

export default BasicBreadcrumbs;